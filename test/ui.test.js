import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "vite";
import { chromium, webkit } from "playwright";

const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const engines = { chromium, webkit };

// No credentials or production reads: replace Firebase before it initializes,
// block every non-local request, and make any attempted write fail the test.
async function isolate(page) {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const module = (pattern, body) => page.route(pattern, route => route.fulfill({ contentType: "application/javascript", body }));
  await module("**/src/firebase.js*", "export const db = {}; export const auth = {};");
  await module("**/src/staff-auth.js*", `
    let signedIn = true;
    export const currentStaffUser = () => ({ getIdToken: async () => 'test-only' });
    export const isStaffSignedIn = () => signedIn;
    export const whenAuthReady = async () => {};
    export const signInStaff = async () => { signedIn = true; };
    export const signOutStaff = async () => { signedIn = false; };
    export const resetStaffPassword = async () => {};
    export const staffAuthErrorMessage = () => '';
    export const staffResetMessage = () => '';
  `);
  await module("**/src/notifications.js*", `
    export const enableNotifications = async () => {};
    export const disableNotifications = async () => {};
    export const initializeNotifications = async () => {};
    export const notificationStatus = () => ({ message: 'Push is not enabled.' });
    export const subscribeNotifications = () => {};
    export const publishShopEvent = async () => 'Push is not enabled.';
  `);
  await module("**/node_modules/.vite/deps/firebase_firestore.js*", `
    import { SEED_CATALOG, SEED_CASE, SEED_INSTAGRAM } from '/src/data.js';
    const catalog = structuredClone(SEED_CATALOG);
    catalog.find(f => f.id === SEED_CASE[0]).name = 'Butterscotch';
    catalog.find(f => f.id === SEED_CASE[1]).name = 'Strawberries and Cream Chocolate Swirl';
    // Full-size synthetic catalog: no production download or live data edits.
    // Mixed wrapping lengths expose flex rows shrinking below their contents.
    while (catalog.length < 152) {
      const index = String(catalog.length).padStart(3, '0');
      catalog.push({ ...structuredClone(catalog[0]), id: 'ui-flavor-' + index,
        name: catalog.length % 3 ? 'Roasted Sweet Potato Marshmallow ' + index : 'W'.repeat(37) + index,
        note: 'Brown butter ice cream with toasted marshmallow and a chocolate cookie ribbon.',
        dairyFree: catalog.length % 5 === 0 });
    }
    const now = Date.now();
    const remote = { catalog, caseIds: SEED_CASE, instagram: SEED_INSTAGRAM,
      availability: { [SEED_CASE[0]]: { pintsAvailable: true, runningLow: true, at: now } },
      updatedAt: now, lastSwap: { inId: SEED_CASE[0], slot: 0, at: now }, lastNotice: null, hoursOverride: null };
    window.uiWrites = 0;
    export const doc = () => ({});
    export function onSnapshot(_ref, _opts, callback) {
      queueMicrotask(() => callback({ exists: () => true, data: () => structuredClone(remote), metadata: { fromCache: false, hasPendingWrites: false } }));
      return () => {};
    }
    const reject = async () => { window.uiWrites++; throw new Error('Unexpected write in UI test'); };
    export const runTransaction = reject;
    export const updateDoc = reject;
  `);
}

async function ready(page) {
  await page.locator("#splash").waitFor({ state: "detached" });
  await page.evaluate(() => document.fonts.ready);
}

async function checkLayout(page, name) {
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.sheet,.screen')].flatMap(el => el.getAnimations().map(a => a.finished.catch(() => {})))));
  const failures = await page.evaluate(() => {
    const root = document.querySelector('[role="dialog"]') || document.querySelector("#app");
    const errors = [];
    const visible = e => e.clientWidth && e.clientHeight && !e.closest('[inert],[aria-hidden="true"]') && getComputedStyle(e).visibility !== "hidden";
    const label = e => e.getAttribute("aria-label") || e.dataset.act || e.className;
    for (const el of root.querySelectorAll('button,a.text-button,input,textarea')) {
      if (!visible(el)) continue;
      // The entire associated label is the tap target for a checkbox/switch.
      const target = el.type === "checkbox" && el.labels?.length ? el.labels[0] : el;
      const r = target.getBoundingClientRect();
      if (r.width < 43.9 || r.height < 43.9) errors.push(`${label(el)} target ${r.width}x${r.height}`);
      if (el.matches('input:not([type="checkbox"]):not([type="color"]),textarea') && parseFloat(getComputedStyle(el).fontSize) < 16) errors.push(`${label(el)} input text below 16px`);
    }
    for (const el of root.querySelectorAll('.card-name,.card-note,.pan-name,.pan-stock,.nav-title,.status-detail,.hours-btn,.collection-header h1')) {
      if (!visible(el)) continue;
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) errors.push(`${label(el)} clips text`);
    }
    for (const el of root.querySelectorAll('.hours-btns,.schedule-times,.nav,.pans,.case')) {
      if (visible(el) && el.scrollWidth > el.clientWidth + 2) errors.push(`${label(el)} overflows horizontally`);
    }
    if (document.documentElement.scrollWidth > innerWidth) errors.push('page overflows horizontally');
    return errors;
  });
  assert.deepEqual(failures, [], name);
}

async function checkContrast(page, name) {
  if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ content: axe });
  const failures = await page.evaluate(async () => {
    const root = document.querySelector('[role="dialog"]') || document.querySelector("#app");
    const result = await window.axe.run(root, { runOnly: ["color-contrast"] });
    return result.violations.flatMap(v => v.nodes.map(n => `${n.target}: ${n.failureSummary}`));
  });
  assert.deepEqual(failures, [], name);
}

async function close(page) {
  await page.getByRole("button", { name: "Close details", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
}

async function checkCatalogRows(page, label, expectedCount) {
  await checkLayout(page, label);
  const rows = page.locator('.catalog > .row');
  assert.equal(await rows.count(), expectedCount, `${label}: full unfiltered list`);
  const failures = await rows.evaluateAll(elements => elements.flatMap(row => {
    const box = row.getBoundingClientRect();
    const copy = row.querySelector(':scope > div').getBoundingClientRect();
    const errors = [];
    if (copy.top < box.top - 1 || copy.bottom > box.bottom + 1) errors.push(`${row.dataset.id}: text leaves row vertically`);
    if (copy.left < box.left - 1 || copy.right > box.right + 1 || row.scrollWidth > row.clientWidth + 2) errors.push(`${row.dataset.id}: text leaves row horizontally`);
    const next = row.nextElementSibling?.getBoundingClientRect();
    if (next && copy.bottom > next.top + 1) errors.push(`${row.dataset.id}: text overlaps next target`);
    return errors;
  }));
  assert.deepEqual(failures, [], label);
  assert.ok(await page.locator('.catalog').evaluate(el => el.scrollHeight > el.clientHeight), `${label}: list scrolls`);
}

async function checkFullCatalog(page, label) {
  // Click actual rows at the beginning, middle and end, without search or
  // forced clicks masking the neighboring-row interception regression.
  for (const index of [0, 76, 151]) {
    await page.getByRole('button', { name: 'Manage flavors', exact: true }).click();
    if (index === 0) await checkCatalogRows(page, `${label} catalog`, 152);
    const row = page.locator('.catalog > .row').nth(index);
    const name = (await row.locator('.row-name').textContent()).split(' · ')[0];
    await row.click();
    assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), name);
    await close(page);
  }
  await page.locator('[data-act="tap-pan"]').first().click();
  await checkCatalogRows(page, `${label} swap choices`, 144);
  for (const index of [0, 72, 143]) {
    const row = page.locator('.catalog > .row').nth(index);
    const id = await row.getAttribute('data-id');
    await row.click();
    assert.equal(await page.locator('.catalog > .row.chosen').getAttribute('data-id'), id);
    await checkCatalogRows(page, `${label} selected swap`, 144);
  }
  // Selection is local UI state; never submit the swap to Firestore.
  await close(page);
}

async function checkManagerSpacing(page, label) {
  const gaps = await page.evaluate(() => {
    const distance = (first, second) => document.querySelector(second).getBoundingClientRect().top - document.querySelector(first).getBoundingClientRect().bottom;
    return {
      hours: distance('.hours-btns', '[data-act="open-schedule"]'),
      instagram: distance('[data-ig-connection]', '[data-ig-connection] + .ig-mgr-sub'),
    };
  });
  for (const [section, gap] of Object.entries(gaps)) assert.ok(gap >= 12, `${label} ${section} gap is ${gap}px`);
}

for (const engine of (process.env.UI_BROWSERS || "chromium,webkit").split(",")) {
  test(`${engine}: mobile readability, touch targets, contrast and text reflow`, { timeout: 180000 }, async () => {
    const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
    let browser;
    try {
      await server.listen();
      const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
      browser = await engines[engine].launch({ executablePath: process.env[`UI_${engine.toUpperCase()}_EXECUTABLE`] || undefined });
      for (const [width, height, scale] of [[320,568,1], [393,852,1], [430,932,1], [852,393,1], [768,1024,1], [320,568,2], [393,852,2]]) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "no-preference" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await isolate(page);
        const label = `${engine} ${width}x${height} text ${scale * 100}%`;
        try {
          await page.goto(origin);
          await ready(page);
          // Exercise actual relative type sizing, not a screenshot-only zoom.
          await page.addStyleTag({ content: `html { font-size: ${scale * 100}% !important; }` });
          await page.locator('[data-act="open-story"]').first().waitFor();
          await checkLayout(page, `${label} freezer`);
          if (width === 393 && scale === 1) await checkContrast(page, "Freezer, including fresh/stock badges");
          const textSizes = await page.locator('.card-name,.card .stock-chip,.customer-nav button').evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).fontSize)));
          assert.ok(textSizes.every(size => size >= 12 * scale), `${label} readable labels`);
          await page.locator('[data-act="open-story"]').first().click();
          await checkLayout(page, `${label} story`);
          assert.equal(await page.locator(".screen").evaluate(el => getComputedStyle(el).filter), "blur(4px)");
          if (width === 393 && scale === 1) await checkContrast(page, "Story");
          await close(page);
          await page.evaluate(() => { location.hash = "/staff"; });
          await page.getByRole("button", { name: "Manage flavors", exact: true }).waitFor();
          await checkLayout(page, `${label} Manager`);
          assert.ok(await page.locator('.pan-name').evaluateAll(els => els.every(e => parseFloat(getComputedStyle(e).fontSize) >= 14 * parseFloat(getComputedStyle(document.documentElement).fontSize) / 16)), "Pan names stay readable");
          if (width === 393 && scale === 1) await checkContrast(page, "Manager");
          await checkFullCatalog(page, label);
          await checkManagerSpacing(page, label);
          await page.getByRole("button", { name: "Plan special hours", exact: true }).click();
          await page.getByRole("checkbox", { name: "Closed all day", exact: true }).uncheck();
          await checkLayout(page, `${label} scheduled hours`);
          await page.getByRole("button", { name: "Save dated hours", exact: true }).scrollIntoViewIfNeeded();
          await close(page);
          assert.equal(await page.evaluate(() => document.activeElement?.dataset.act), "open-schedule");
          if (width === 393 && scale === 1) {
            for (const [name, selector] of [["Swap", '[data-act="tap-pan"]'], ["Add", '[data-act="open-add"]'], ["Catalog", '[data-act="manage-flavors"]']]) {
              await page.locator(selector).first().click();
              await checkLayout(page, name); await checkContrast(page, name);
              await close(page);
            }
            await page.getByRole("button", { name: "Manage flavors", exact: true }).click();
            await page.locator('[data-act="edit-flavor"]').first().click();
            await checkLayout(page, "Edit"); await checkContrast(page, "Edit");
            await close(page);
            await page.getByRole("button", { name: "About, help & privacy", exact: true }).click();
            await checkLayout(page, "About"); await checkContrast(page, "About");
            await page.getByRole("link", { name: "Privacy policy", exact: true }).click();
            await checkLayout(page, "Privacy"); await close(page);
            await page.getByRole("button", { name: "Log out", exact: true }).click();
            await checkLayout(page, "Unlock"); await checkContrast(page, "Unlock");
            await page.getByRole("button", { name: "Case", exact: true }).click();
            for (const tab of ["Flavors", "Favorites", "Alerts"]) {
              await page.getByRole("button", { name: tab, exact: true }).click();
              await checkLayout(page, tab); await checkContrast(page, tab);
            }
          }
          assert.equal(await page.evaluate(() => window.uiWrites), 0);
          assert.deepEqual(errors, []);
        } catch (error) {
          await mkdir("output/playwright/ui-regressions", { recursive: true });
          await page.screenshot({ path: `output/playwright/ui-regressions/${engine}-${width}-${scale}.png` });
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser?.close(); await server.close(); }
  });

  test(`${engine}: shared screen spacing with iPhone safe areas`, { timeout: 180000 }, async () => {
    // Desktop browser engines report zero env() insets. Substitute only those
    // platform inputs in served CSS, leaving the application's layout intact.
    const server = await createServer({
      plugins: [{ name: "test-safe-area-inputs", enforce: "pre", transform(code, id) {
        if (id.split("?")[0].endsWith(".css")) return code.replace(/env\(safe-area-inset-(top|bottom|left|right)\)/g, "var(--qa-safe-$1, 0px)");
      } }],
      server: { host: "127.0.0.1", port: 0 },
    });
    let browser;
    try {
      await server.listen();
      const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
      browser = await engines[engine].launch({ executablePath: process.env[`UI_${engine.toUpperCase()}_EXECUTABLE`] || undefined });
      for (const [width, height, top, bottom, side, standalone] of [
        [320,568,59,34,0,true], [393,852,59,34,0,true], [430,932,62,34,0,true],
        [393,680,0,21,0,false], [852,393,0,21,59,true], [768,1024,24,20,0,false],
      ]) {
        for (const scale of [1, 2]) {
          const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "no-preference" });
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", error => errors.push(error.message));
          await isolate(page);
          const label = `${engine} safe-area ${width}x${height} ${scale * 100}%`;
          const edge = standalone ? Math.max(12, top) : top;
          const tablet = width >= 700 && height >= 501;
          async function header(name) {
            const metrics = await page.evaluate(() => {
              const screen = document.querySelector('.screen'), heading = screen.querySelector('.nav,.collection-header');
              return { top: screen.getBoundingClientRect().top, scroll: screen.scrollTop,
                padding: parseFloat(getComputedStyle(heading).paddingTop),
                contentTop: Math.min(...[...heading.querySelectorAll('.nav-mark,.nav-title,.nav-kicker,.collection-kicker')].map(el => el.getBoundingClientRect().top)) };
            });
            assert.equal(metrics.top, edge, `${label} ${name}: scrolling starts below the status area`);
            assert.equal(metrics.scroll, 0, `${label} ${name}: opens at the top`);
            assert.equal(metrics.padding, tablet ? 26 : 12, `${label} ${name}: same header spacing`);
            assert.ok(metrics.contentTop >= edge + 10, `${label} ${name}: header is clear of the top edge`);
          }
          async function reachable(selector) {
            const target = page.locator(selector).last();
            await target.scrollIntoViewIfNeeded();
            const bounds = await target.evaluate(el => {
              const r = el.getBoundingClientRect(), s = el.closest('.screen').getBoundingClientRect();
              return { top: r.top, bottom: r.bottom, screenTop: s.top, screenBottom: s.bottom };
            });
            const visibleBottom = Math.min(bounds.screenBottom, height - bottom);
            assert.ok(bounds.bottom > bounds.screenTop && bounds.bottom <= visibleBottom + 1, `${label} ${selector}: reachable above bottom controls`);
            if (bounds.bottom - bounds.top <= visibleBottom - bounds.screenTop) assert.ok(bounds.top >= bounds.screenTop - 1, `${label} ${selector}: whole control fits`);
          }
          try {
            await page.goto(origin); await ready(page);
            await page.evaluate(value => document.documentElement.classList.toggle('ios-home-screen', value), standalone);
            await page.addStyleTag({ content: `html{font-size:${scale * 100}%;--qa-safe-top:${top}px;--qa-safe-bottom:${bottom}px;--qa-safe-left:${side}px;--qa-safe-right:${side}px}` });
            await header('Freezer');
            await checkLayout(page, label);
            assert.equal(await page.locator('.case > .card').count(), 8);
            await reachable('.case > .card');
            await reachable('.ig-card-head');
            await reachable('.about-link');
            const nav = await page.locator('.customer-nav').evaluate(el => ({ bottom: el.getBoundingClientRect().bottom, padding: parseFloat(getComputedStyle(el).paddingBottom) }));
            assert.equal(nav.bottom, height);
            assert.equal(nav.padding, bottom + (tablet ? 10 : 5), `${label}: home indicator clearance counted once`);
            for (const tab of ['Flavors', 'Favorites', 'Alerts', 'Freezer']) {
              await page.getByRole('button', { name: tab, exact: true }).click();
              await header(tab);
              await reachable('.about-link');
            }
            await page.evaluate(() => { location.hash = '/staff'; });
            await page.getByRole('button', { name: 'Manage flavors', exact: true }).waitFor();
            await header('Manager');
            await reachable('.mgr-logout-btn');
            await page.getByRole('button', { name: 'Manage flavors', exact: true }).click();
            await checkCatalogRows(page, label, 152);
            assert.equal(await page.locator('.screen').evaluate(el => getComputedStyle(el).filter), 'blur(4px)');
            const drawerTop = await page.getByRole('dialog').evaluate(el => el.getBoundingClientRect().top);
            assert.ok(drawerTop >= edge, `${label}: drawer stays below status area`);
            await close(page);
            await page.getByRole('button', { name: 'Log out', exact: true }).click();
            await page.getByRole('button', { name: 'Unlock', exact: true }).waitFor();
            await header('Unlock'); await reachable('.about-link');
            assert.equal(await page.evaluate(() => window.uiWrites), 0);
            assert.deepEqual(errors, []);
          } catch (error) {
            await mkdir('output/playwright/ui-regressions', { recursive: true });
            await page.screenshot({ path: `output/playwright/ui-regressions/${engine}-safe-${width}-${scale}.png` });
            throw error;
          } finally { await context.close(); }
        }
      }
    } finally { await browser?.close(); await server.close(); }
  });
}
