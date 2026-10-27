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
async function isolate(page, { manualInstagram = false } = {}) {
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
    const remote = { catalog, caseIds: SEED_CASE, instagram: ${manualInstagram ? '{ ...SEED_INSTAGRAM, source: "manual" }' : 'SEED_INSTAGRAM'},
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

// Chromium exercises native touch arbitration. WebKit's automation API only
// exposes taps, so dispatch actual TouchEvents (not just PointerEvents) there.
// Paired pointer events model compatibility delivery; cancellation must not
// discard an otherwise active touch sequence or cause duplicate navigation.
async function touchStroke(page, engine, target, dx, dy = 0, { native = true, cancel = false, secondary = false, x, pointerCancel = false, cancelable = true, verticalFirst = false, detach = false } = {}) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const start = { x: x ?? box.x + box.width * (dx < 0 ? .8 : .2), y: box.y + Math.min(box.height / 2, 50) };
  if (engine === "chromium" && native && !secondary) {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
      for (let n = 1; n <= 8; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + dx * n / 8, y: start.y + dy * n / 8, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
  } else {
    return target.evaluate((element, { start, dx, dy, cancel, secondary, pointerCancel, cancelable, verticalFirst, detach }) => {
      const pointer = (type, x, y) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 11, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y }));
      const touch = (x, y, identifier = 11) => ({ identifier, target: element, clientX: x, clientY: y });
      const dispatch = (type, changed, active, canCancel = true) => {
        // Desktop WebKit exposes TouchEvent but not its iOS constructor. Use
        // the browser's Event cancellation/propagation with explicit touch lists.
        const event = document.createEvent('TouchEvent');
        event.initEvent(type, true, canCancel);
        Object.defineProperties(event, {
          touches: { value:active }, targetTouches: { value:active }, changedTouches: { value:changed },
        });
        element.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const first = touch(start.x, start.y);
      pointer('pointerdown', start.x, start.y);
      const prevented = [dispatch('touchstart', [first], [first])];
      if (secondary) dispatch('touchstart', [touch(start.x + 10, start.y, 12)], [first, touch(start.x + 10, start.y, 12)]);
      if (verticalFirst) prevented.push(dispatch('touchmove', [touch(start.x, start.y + 20)], [touch(start.x, start.y + 20)]));
      if (pointerCancel) {
        pointer('pointercancel', start.x, start.y);
        pointer('lostpointercapture', start.x, start.y);
      }
      for (let n = 1; n <= 8; n++) {
        const point = touch(start.x + dx * n / 8, start.y + dy * n / 8);
        if (!pointerCancel) pointer('pointermove', point.clientX, point.clientY);
        prevented.push(dispatch('touchmove', [point], secondary ? [point, touch(start.x + 10, start.y, 12)] : [point], cancelable));
      }
      if (detach) {
        const screen = element.closest('.collection-screen');
        screen.replaceWith(screen.cloneNode(true));
      }
      if (!pointerCancel) pointer(cancel ? 'pointercancel' : 'pointerup', start.x + dx, start.y + dy);
      prevented.push(dispatch(cancel ? 'touchcancel' : 'touchend', [touch(start.x + dx, start.y + dy)], []));
      // Real browsers can synthesize a click after a drag. Check suppression
      // against a surviving flavor-story button, not only an empty header.
      if (!cancel && !secondary && element.isConnected) element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
      return prevented;
    }, { start, dx, dy, cancel, secondary, pointerCancel, cancelable, verticalFirst, detach });
  }
}

async function dragDrawer(page, side, distance) {
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.sheet')].flatMap(el => el.getAnimations().map(a => a.finished.catch(() => {})))));
  const box = await page.locator('.grabber').boundingBox();
  const x = side === 'left' ? box.x + 10 : box.x + box.width - 10;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height / 2 + distance, { steps: 8 });
  await page.mouse.up();
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
            // A four-column pan at 200% text can be taller than the landscape
            // viewport. Check its bottom explicitly rather than centering it.
            await target.evaluate(el => el.scrollIntoView({ block: 'end', behavior: 'instant' }));
            const bounds = await target.evaluate(el => {
              const r = el.getBoundingClientRect(), s = el.closest('.screen').getBoundingClientRect();
              return { top: r.top, bottom: r.bottom, screenTop: s.top, screenBottom: s.bottom };
            });
            const visibleBottom = Math.min(bounds.screenBottom, height - bottom);
            assert.ok(bounds.bottom > bounds.screenTop && bounds.bottom <= visibleBottom + 1, `${label} ${selector}: reachable above bottom controls`);
            if (bounds.bottom - bounds.top <= visibleBottom - bounds.screenTop) assert.ok(bounds.top >= bounds.screenTop - 1, `${label} ${selector}: whole control fits`);
            else {
              await target.evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
              const top = await target.evaluate(el => ({ target: el.getBoundingClientRect().top, screen: el.closest('.screen').getBoundingClientRect().top }));
              assert.ok(top.target >= top.screen - 1 && top.target < visibleBottom, `${label} ${selector}: tall content also scrolls to its top`);
            }
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

  test(`${engine}: Instagram tap-to-play and fallbacks without live services`, { timeout: 180000 }, async () => {
    const movie = await readFile(new URL('./fixtures/instagram-video.mp4', import.meta.url));
    const requests = new Map();
    // Serve a real generated MP4 on loopback: Windows WebKit's native media
    // loader does not use the mocked HTTPS response. Never contact a live CDN.
    const serveVideo = (req, res, next) => {
      if (!req.url.startsWith('/qa-video/')) return next();
      const mode = req.url.split('/')[2];
      requests.set(mode, (requests.get(mode) || 0) + 1);
      if (mode === 'http-error') { res.statusCode = 403; res.end(); return; }
      const body = mode === 'decode-error' ? Buffer.from('invalid video') : movie;
      const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      const start = range ? Number(range[1]) : 0, end = range ? Math.min(Number(range[2] || body.length - 1), body.length - 1) : body.length - 1;
      res.statusCode = range ? 206 : 200;
      res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', end - start + 1);
      if (range) res.setHeader('Content-Range', `bytes ${start}-${end}/${body.length}`);
      res.end(body.subarray(start, end + 1));
    };
    const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, plugins: [{
      name: "video-fixture", configureServer(server) { server.middlewares.use(serveVideo); },
    }] });
    let browser;
    try {
      await server.listen();
      const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
      browser = await engines[engine].launch({ executablePath: process.env[`UI_${engine.toUpperCase()}_EXECUTABLE`] || undefined });
      for (const mode of ['play', 'large-text', 'tablet', 'http-error', 'decode-error', 'play-rejected', 'timeout', 'missing-url', 'photo', 'legacy', 'manual']) {
        const large = mode === 'large-text', tablet = mode === 'tablet';
        const context = await browser.newContext({ viewport: { width: large ? 320 : tablet ? 768 : 393, height: tablet ? 1024 : large ? 568 : 852 } });
        const page = await context.newPage();
        const errors = [], mediaRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        await isolate(page, { manualInstagram: mode === 'manual' });
        await page.route('**/src/instagram-config.js*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const INSTAGRAM_FEED_URL="https://feed.test/latest"; export const INSTAGRAM_CONNECT_URL="";' }));
        await page.route('https://feed.test/latest', route => route.fulfill({ json: {
          imageUrl: 'https://media.test/cover.svg', caption: 'A fresh batch, on video.',
          permalink: 'https://www.instagram.com/reel/fixture/', handle: 'janartys', fetchedAt: Date.now(),
          ...(mode === 'legacy' ? {} : { mediaType: mode === 'photo' ? 'IMAGE' : 'VIDEO' }),
          ...(['missing-url', 'photo', 'legacy'].includes(mode) ? {} : { videoUrl: 'https://media.test/video.mp4' }),
        } }));
        await page.route('https://media.test/cover.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#873684"/></svg>' }));
        await page.route('https://media.test/video.mp4', route => {
          mediaRequests.push(route.request().url());
          return route.abort();
        });
        try {
          await page.goto(origin); await ready(page);
          if (mode !== 'manual') await page.getByText('A fresh batch, on video.', { exact: true }).waitFor();
          if (large) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
          await page.locator('.ig-card').scrollIntoViewIfNeeded();
          if (['photo', 'legacy', 'manual'].includes(mode)) {
            await page.waitForFunction(() => document.querySelector('.ig-card')?.tagName === 'A');
            assert.equal(await page.locator('[data-ig-video]').count(), 0);
            assert.equal(await page.locator('[data-ig-play]').count(), 0);
            assert.equal(mediaRequests.length, 0);
          } else {
            await page.locator('.ig-video-link').waitFor();
            assert.equal(await page.locator('.ig-video-link').getAttribute('href'), 'https://www.instagram.com/reel/fixture/');
            assert.equal(await page.locator('.ig-video-link').getAttribute('target'), '_blank');
            assert.equal(await page.locator('.ig-card a video, .ig-card a button').count(), 0);
            if (mode === 'missing-url') {
              assert.equal(await page.locator('video').count(), 0);
              assert.equal(await page.locator('[data-ig-video-error]').isVisible(), true);
            } else {
              const video = page.locator('[data-ig-video]');
              assert.equal(await video.getAttribute('src'), null);
              assert.equal(await video.getAttribute('autoplay'), null);
              assert.equal(await video.getAttribute('preload'), 'none');
              assert.equal(await video.getAttribute('playsinline'), '');
              assert.equal(await video.getAttribute('controls'), '');
              assert.equal(mediaRequests.length, 0, 'no video download before a tap');
              assert.equal(requests.get(mode) || 0, 0);
              // The production path accepts only HTTPS (covered in unit tests).
              // Substitute the local fixture for native decoding, without enabling
              // the integration or contacting Meta, Firebase, or a real media URL.
              const localVideo = `${origin}/qa-video/${mode}/video.mp4`;
              await video.evaluate((v, url) => { v.dataset.videoUrl = url; }, localVideo);
              await checkLayout(page, `${engine} video ${mode}`);
              const coverBox = await page.locator('.ig-card-photo').boundingBox();
              if (mode === 'play-rejected') await page.evaluate(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Blocked', 'NotAllowedError')); });
              if (mode === 'timeout') {
                await page.clock.install();
                await page.evaluate(() => { HTMLMediaElement.prototype.play = () => new Promise(() => {}); });
              }
              if (large) {
                await page.getByRole('button', { name: 'Play Instagram video', exact: true }).focus();
                await page.keyboard.press('Enter');
              } else await page.getByRole('button', { name: 'Play Instagram video', exact: true }).click();
              if (mode === 'timeout') await page.clock.fastForward(15001);
              if (['http-error', 'decode-error', 'play-rejected', 'timeout'].includes(mode)) {
                await page.locator('[data-ig-video-error]').waitFor({ state: 'visible' });
                assert.match(await page.locator('[data-ig-video-error]').textContent(), /couldn’t play/);
                assert.equal(await video.isVisible(), false);
                assert.equal(await video.getAttribute('src'), null);
                assert.equal(await page.locator('[data-ig-photo]').isVisible(), true);
                assert.equal(await page.locator('.ig-video-link').isVisible(), true);
                await checkLayout(page, `${engine} failed video ${mode}`);
                if (process.env.UI_VIDEO_SCREENSHOTS) await page.screenshot({ path: `output/playwright/${engine}-video-${mode}.png` });
              } else {
                await page.waitForFunction(() => { const v = document.querySelector('video'); return (v.currentTime > 0 && !v.paused) || !document.querySelector('[data-ig-video-error]').hidden; });
                assert.ok(await video.evaluate(v => v.currentTime > 0 && !v.paused), 'video really decodes and plays');
                assert.ok(requests.get(mode) > 0);
                assert.equal(await video.isVisible(), true);
                const playingBox = await page.locator('.ig-card-photo').boundingBox();
                assert.ok(Math.abs(playingBox.height - coverBox.height) < 2, 'playback keeps the cover size');
                await checkLayout(page, `${engine} playing video ${mode}`);
                if (process.env.UI_VIDEO_SCREENSHOTS) await page.screenshot({ path: `output/playwright/${engine}-video-${mode}.png` });
                await page.evaluate(() => { window.playedVideo = document.querySelector('video'); window.playedVideo.pause(); });
                assert.equal(await video.evaluate(v => v.paused), true);
                await video.evaluate(v => v.play());
                await page.getByRole('button', { name: 'Flavors', exact: true }).click();
                assert.equal(await page.evaluate(() => window.playedVideo.paused && !window.playedVideo.hasAttribute('src')), true, 'navigation stops/unloads playback');
                await page.getByRole('button', { name: 'Freezer', exact: true }).click();
                await video.evaluate((v, url) => { v.dataset.videoUrl = url; }, localVideo);
                await page.getByRole('button', { name: 'Play Instagram video', exact: true }).click();
                await page.waitForFunction(() => !document.querySelector('video').paused);
                await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                assert.equal(await video.getAttribute('src'), null);
                assert.equal(await page.getByRole('button', { name: 'Play Instagram video', exact: true }).isVisible(), true);
                if (mode === 'play') {
                  await page.getByRole('button', { name: 'Play Instagram video', exact: true }).click();
                  await page.waitForFunction(() => !document.querySelector('video').paused);
                  await page.evaluate(() => {
                    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
                    document.dispatchEvent(new Event('visibilitychange'));
                  });
                  assert.equal(await video.getAttribute('src'), null, 'backgrounding stops playback');
                  await page.evaluate(() => { delete document.hidden; });
                  await page.getByRole('button', { name: 'Play Instagram video', exact: true }).click();
                  await page.waitForFunction(() => !document.querySelector('video').paused);
                  await page.evaluate(() => { window.playedVideo = document.querySelector('video'); });
                  await page.getByRole('button', { name: 'About, help & privacy', exact: true }).click();
                  await checkLayout(page, `${engine} video stopped behind drawer`);
                  assert.equal(await page.evaluate(() => window.playedVideo.paused && !window.playedVideo.hasAttribute('src')), true);
                  assert.equal(await page.locator('.screen').evaluate(el => getComputedStyle(el).filter), 'blur(4px)');
                }
              }
            }
          }
          assert.equal(await page.evaluate(() => window.uiWrites), 0);
          assert.deepEqual(errors, []);
        } catch (error) {
          console.error(`${engine} video ${mode}`, { mediaRequests: mediaRequests.length, localRequests: requests.get(mode) || 0 }, await page.locator('video').evaluateAll(videos => videos.map(v => ({ error: v.error?.message, ready: v.readyState, network: v.networkState }))));
          await mkdir('output/playwright/ui-regressions', { recursive: true });
          await page.screenshot({ path: `output/playwright/ui-regressions/${engine}-video-${mode}.png` });
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser?.close(); await server.close(); }
  });
  test(`${engine}: customer swipes and wide drawer drag area`, { timeout: 120000 }, async () => {
    const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
    let browser;
    try {
      await server.listen();
      const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
      browser = await engines[engine].launch({ executablePath: process.env[`UI_${engine.toUpperCase()}_EXECUTABLE`] || undefined });
      for (const [width, height, scale] of [[320,568,1],[393,852,2]]) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await isolate(page);
        const current = () => page.locator('.customer-nav [aria-current]').getAttribute('data-id');
        async function expectView(view) { await page.waitForFunction(value => document.querySelector('.customer-nav [aria-current]')?.dataset.id === value, view); }
        const header = page.locator('.collection-header');
        try {
          await page.goto(origin); await ready(page);
          if (scale === 2) await page.addStyleTag({ content: 'html{font-size:200%}' });
          await page.getByRole('button', { name:'Flavors', exact:true }).click();
          assert.match(await page.locator('.collection-screen').evaluate(el => getComputedStyle(el).touchAction), /pan-y/);
          await touchStroke(page, engine, header, -130, 18); await expectView('favorites');
          await touchStroke(page, engine, header, -130); await expectView('alerts');
          await touchStroke(page, engine, header, -130); assert.equal(await current(), 'alerts', 'no wrapping at last page');
          await touchStroke(page, engine, header, 130); await expectView('favorites');
          await touchStroke(page, engine, header, 130); await expectView('library');
          await touchStroke(page, engine, header, 130); assert.equal(await current(), 'library', 'Freezer is not part of this swipe sequence');
          for (const [dx,dy,options] of [[30,0,{}],[-100,130,{}],[-130,0,{cancel:true}],[-130,0,{secondary:true}],[-130,0,{x:width-5}]]) {
            await touchStroke(page, engine, header, dx, dy, options);
            assert.equal(await current(), 'library', 'short, vertical/diagonal, cancelled, multi-touch, and edge gestures do not navigate');
          }
          const search = page.getByRole('searchbox', { name:'Search flavors', exact:true });
          await search.fill('Butterscotch');
          await touchStroke(page, engine, search, -110);
          assert.equal(await current(), 'library'); assert.equal(await search.inputValue(), 'Butterscotch');
          await search.fill(''); await search.blur();
          // A swipe on a flavor card changes tabs without also opening a story.
          const detail = page.locator('.library-detail').first();
          await touchStroke(page, engine, detail, 100);
          assert.equal(await page.getByRole('dialog').count(), 0, 'end-page drag does not click a story');
          await touchStroke(page, engine, detail, -130); await expectView('favorites');
          assert.equal(await page.getByRole('dialog').count(), 0);
          await page.getByRole('button', {name:'Flavors',exact:true}).click();
          if (engine === 'chromium') {
            await page.locator('.screen').evaluate(el => { el.scrollTop = 0; });
            await touchStroke(page, engine, header, 0, -100);
            await page.waitForFunction(() => document.querySelector('.screen').scrollTop > 0);
            assert.equal(await current(),'library','native vertical scroll stays on the page');
          }
          await page.locator('.favorite-button').first().click();
          assert.equal(await page.locator('.favorite-button').first().getAttribute('aria-pressed'),'true','heart still works');
          await page.getByRole('button',{name:'Alerts',exact:true}).click();
          await page.locator('.alert-option input').first().check();
          assert.equal(await page.locator('.alert-option input').first().isChecked(),true,'alert control still works');
          await page.getByRole('button',{name:'Flavors',exact:true}).click();
          await page.getByRole('button',{name:'About, help & privacy',exact:true}).click();
          await checkLayout(page,'wide drawer');
          const geometry = await page.evaluate(() => {
            const controls=document.querySelector('.sheet-controls').getBoundingClientRect(), grabber=document.querySelector('.grabber').getBoundingClientRect(), dash=document.querySelector('.grabber span').getBoundingClientRect(), close=document.querySelector('.sheet-close').getBoundingClientRect();
            return { width:grabber.width, available:controls.width, overlap:grabber.right>close.left+.5, centered:Math.abs((dash.left+dash.right)/2-(controls.left+controls.right)/2)<1 };
          });
          assert.ok(geometry.width >= geometry.available-45 && geometry.width>160);
          assert.equal(geometry.overlap,false);assert.equal(geometry.centered,true);
          await touchStroke(page, engine, page.locator('.about-content h2').first(), -100);
          assert.equal(await current(),'library'); assert.equal(await page.getByRole('dialog').count(),1,'drawer prevents paging');
          await dragDrawer(page,'left',24);
          assert.equal(await page.getByRole('dialog').count(),1,'short drag snaps back');
          await dragDrawer(page,'right',-25);
          assert.equal(await page.getByRole('dialog').count(),1,'upward drag does not become a close tap');
          await dragDrawer(page,scale===1?'left':'right',100);
          await page.getByRole('dialog').waitFor({state:'detached'});
          if (engine === 'chromium') {
            await page.getByRole('button',{name:'About, help & privacy',exact:true}).click();
            await checkLayout(page,'touch drawer');
            const handle = page.locator('.grabber'), box = await handle.boundingBox();
            await touchStroke(page, engine, handle, 0, 100, { x:box.x+10 });
            await page.getByRole('dialog').waitFor({state:'detached'});
          }
          await page.locator('.library-detail').first().click();
          await checkLayout(page,'story');
          assert.equal(await page.locator('.screen').evaluate(el=>getComputedStyle(el).filter),'blur(4px)');
          await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
          await page.evaluate(()=>{location.hash='/staff';});
          await page.getByRole('button',{name:'Add flavor',exact:true}).click();
          await dragDrawer(page,'left',100);await page.getByRole('dialog').waitFor({state:'detached'});
          await page.emulateMedia({reducedMotion:'reduce'});
          await page.getByRole('button',{name:'Add flavor',exact:true}).click();await dragDrawer(page,'right',100);
          await page.getByRole('dialog').waitFor({state:'detached'});
          await page.getByRole('button',{name:'Add flavor',exact:true}).click();await close(page);
          assert.equal(await page.evaluate(()=>window.uiWrites),0);assert.deepEqual(errors,[]);
        } catch(error) {
          await mkdir('output/playwright/ui-regressions',{recursive:true});
          await page.screenshot({path:`output/playwright/ui-regressions/${engine}-gestures-${width}-${scale}.png`});throw error;
        } finally { await context.close(); }
      }
    } finally { await browser?.close(); await server.close(); }
  });

  test(`${engine}: touch swipes survive pointer cancellation and preserve native gestures`, { timeout:120000 }, async () => {
    const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
    let browser;
    try {
      await server.listen();
      browser = await engines[engine].launch({ executablePath: process.env[`UI_${engine.toUpperCase()}_EXECUTABLE`] || undefined });
      const page = await browser.newPage({ viewport: { width:393, height:852 }, hasTouch:true, isMobile:true });
      await isolate(page);
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`); await ready(page);
      const current = () => page.locator('.customer-nav [aria-current]').getAttribute('data-id');
      for (const mode of ['', 'ios-home-screen', 'is-native']) {
        await page.evaluate(mode => { document.documentElement.classList.remove('ios-home-screen', 'is-native'); if (mode) document.documentElement.classList.add(mode); }, mode);
        await page.getByRole('button', { name:'Flavors', exact:true }).click();
        const header = page.locator('.collection-header');
        const prevented = await touchStroke(page, engine, header, -130, 18, { native:false, pointerCancel:true });
        assert.equal(await current(), 'favorites', `${mode}: touch swipe survives cancelled pointer stream`);
        assert.equal(prevented[0], false, 'touch start never steals a tap or pinch');
        assert.ok(prevented.slice(1, -1).every(Boolean), 'horizontal moves are claimed by a non-passive listener');
        await touchStroke(page, engine, page.locator('.collection-header'), -130, 15, { native:false });
        assert.equal(await current(), 'alerts', 'paired touch/pointer events navigate exactly one page');
        for (const options of [{ verticalFirst:true }, { cancelable:false }, { secondary:true }, { cancel:true }, { x:5 }, { detach:true }]) {
          const events = await touchStroke(page, engine, page.locator('.collection-header'), 130, 10, { native:false, ...options });
          assert.equal(await current(), 'alerts', 'scroll, pinch, cancellation, edges, and detached screens cannot navigate');
          if (options.verticalFirst || options.secondary || options.cancelable === false || options.x) assert.ok(events.every(value => !value), 'native gesture is not prevented');
        }
        await page.getByRole('button', { name:'Flavors', exact:true }).click();
        const search = page.getByRole('searchbox', { name:'Search flavors', exact:true });
        await search.fill('Butterscotch');
        assert.ok((await touchStroke(page, engine, search, -130, 0, { native:false })).every(value => !value), 'search gestures are untouched');
        assert.equal(await current(), 'library');
        assert.equal(await search.inputValue(), 'Butterscotch');
        await search.fill(''); await search.blur();
        await touchStroke(page, engine, page.locator('.library-detail').first(), 100, 12, { native:false, pointerCancel:true });
        assert.equal(await page.getByRole('dialog').count(), 0, 'drag on end page does not open story');
        await page.locator('.library-detail').first().tap();
        await page.getByRole('dialog').waitFor();
        await checkLayout(page, `${mode || 'browser'} touch story`);
        assert.equal(await page.locator('.screen').evaluate(el => getComputedStyle(el).filter), 'blur(4px)');
        await close(page);
      }
      assert.equal(await page.evaluate(() => window.uiWrites), 0);
    } finally { await browser?.close(); await server.close(); }
  });

  test(`${engine}: landscape phones keep eight pans in two equal rows of four`, { timeout:120000 }, async () => {
    const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
    try {
      await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
      browser=await engines[engine].launch({executablePath:process.env[`UI_${engine.toUpperCase()}_EXECUTABLE`]||undefined});
      const page=await browser.newPage();await isolate(page);await page.goto(origin);await ready(page);
      for(const [width,height] of [[568,320],[667,375],[852,393],[932,430],[1280,589]]) for(const scale of [1,2]) {
        try {
          await page.setViewportSize({width,height});await page.evaluate(value=>{document.documentElement.style.fontSize=`${value*100}%`;},scale);
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          await checkLayout(page,`${width}x${height} ${scale*100}% landscape`);
          const cards=await page.locator('.case > .card').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,width:r.width,height:r.height};}));
          assert.equal(cards.length,8);assert.equal(new Set(cards.map(c=>Math.round(c.top))).size,2);
          for(let i=0;i<8;i++) {
            assert.ok(Math.abs(cards[i].width-cards[0].width)<1);
            assert.ok(Math.abs(cards[i].top-cards[i<4?0:4].top)<1);
          }
          if(height<=500) for(const card of cards)assert.ok(Math.abs(card.height-cards[0].height)<1);
          if(process.env.UI_GESTURE_SCREENSHOTS && width===852 && scale===1)await page.locator('.case').screenshot({path:`output/playwright/${engine}-landscape-four-pans.png`});
        } catch(error) {
          await mkdir('output/playwright/ui-regressions',{recursive:true});await page.screenshot({path:`output/playwright/ui-regressions/${engine}-landscape-${width}-${scale}.png`});throw error;
        }
      }
      await page.setViewportSize({width:393,height:852});await page.evaluate(()=>{document.documentElement.style.fontSize='100%';});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await page.locator('.case').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2,'portrait layout unchanged');
      assert.equal(await page.evaluate(()=>window.uiWrites),0);
    } finally {await browser?.close();await server.close();}
  });

}
