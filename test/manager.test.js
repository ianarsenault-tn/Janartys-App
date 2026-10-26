import assert from "node:assert/strict";
import test from "node:test";
import { SEED_CATALOG, SEED_CASE, SEED_INSTAGRAM, STAFF_SESSION_KEY, STORAGE_KEY } from "../src/data.js";
import { copy, deferred, failure, fixture, managerHarness, settle } from "./helpers/manager-harness.js";

test("Manager exposes disabled Connect Instagram with a setup explanation and keeps manual editing", async () => {
  let requests = 0;
  const h = await managerHarness({ fetchFeed: () => { requests++; } });
  assert.match(h.root.innerHTML, /data-act="ig-connect" disabled>Connect Instagram/);
  assert.match(h.root.innerHTML, /connection setup is not ready yet/);
  assert.match(h.root.innerHTML, /data-act="ig-save"/);
  await h.click("ig-connect");
  assert.equal(requests, 0);
  await h.click("go-case");
  assert.doesNotMatch(h.root.innerHTML, /data-act="ig-connect"/);
});

test("checking connection status preserves unsaved Manager text and never writes shop data", async () => {
  const h = await managerHarness({ instagramConnectUrl: "https://feed.test", fetchFeed: async () => Response.json({ connected: true, feedEnabled: false }) });
  await h.input("ig-caption", "Keep this draft");
  const panel = { innerHTML: "" };
  h.root.querySelector = selector => selector === "[data-ig-connection]" ? panel : null;
  await h.click("ig-check");
  assert.match(panel.innerHTML, /Connected to @janartys/);
  assert.equal(h.backend.writes.length, 0);
  await h.submit("ig-form");
  assert.equal(h.backend.remote.instagram.caption, "Keep this draft");
});

test("Manager Connect opens the authorized service in a new tab and leaves drafts intact", async () => {
  const started = [], opened = [];
  const h = await managerHarness({ instagramConnectUrl: "https://feed.test", fetchFeed: async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer mock-staff-token");
    if (url.endsWith("/status")) return Response.json({ connected: false, feedEnabled: false });
    started.push(url);
    return Response.json({ url: `https://feed.test/connect/authorize?ticket=${"a".repeat(64)}` });
  } });
  h.window.open = () => ({ opener: "original", location: { replace: url => opened.push(url) }, close() {} });
  await h.input("ig-caption", "Draft before connecting");
  await h.click("ig-connect");
  assert.deepEqual(started, ["https://feed.test/connect/start"]);
  assert.equal(opened.length, 1);
  assert.equal(h.backend.writes.length, 0);
  await h.submit("ig-form");
  assert.equal(h.backend.remote.instagram.caption, "Draft before connecting");
});

test("automatic Instagram renders safely, manual save overrides it, and reset resumes it", async () => {
  const post = { imageUrl: "https://cdn.example/new.jpg", caption: "Latest <scoop>", permalink: "https://www.instagram.com/p/latest/", handle: "janartys", fetchedAt: Date.now() };
  const h = await managerHarness({ instagramUrl: "https://feed.example/latest", fetchFeed: async () => Response.json(post) });
  assert.match(h.root.innerHTML, /A saved post overrides the automatic feed/);
  await h.click("go-case");
  assert.match(h.root.innerHTML, /Latest &lt;scoop&gt;/);
  assert.match(h.root.innerHTML, /https:\/\/cdn.example\/new.jpg/);
  assert.equal(h.backend.writes.length, 0, "automatic content must never write shop/live");
  await h.store.setInstagram({ ...SEED_INSTAGRAM, caption: "Staff-selected" });
  assert.match(h.root.innerHTML, /Staff-selected/);
  assert.doesNotMatch(h.root.innerHTML, /Latest &lt;scoop&gt;/);
  assert.equal(h.store.getInstagram().source, "manual");
  // Source survives remote/cache hydration, including a deliberately seed-valued save.
  const restored = await managerHarness({ cache: copy(h.store.getState()), remote: null, app: false });
  assert.equal(restored.store.getInstagram().source, "manual");
  await h.store.resetInstagram();
  assert.equal(h.store.getInstagram().source, undefined);
  assert.match(h.root.innerHTML, /Latest &lt;scoop&gt;/);
});

test("automatic feed arrival preserves Manager drafts and broken images fall back to the complete default card", async () => {
  const gate = deferred();
  const h = await managerHarness({ instagramUrl: "https://feed.example/latest", fetchFeed: () => gate.promise });
  await h.input("ig-caption", "Unsaved draft");
  const post = { imageUrl: "https://cdn.example/expired.jpg", caption: "Automatic caption", permalink: "https://www.instagram.com/p/latest/", handle: "janartys", fetchedAt: Date.now() };
  gate.resolve(Response.json(post));
  await settle();
  await settle();
  await h.submit("ig-form");
  assert.equal(h.backend.remote.instagram.caption, "Unsaved draft");
  await h.store.resetInstagram();
  await h.click("go-case");
  assert.match(h.root.innerHTML, /Automatic caption/);
  const card = { outerHTML: "" };
  h.root.querySelector = selector => selector === ".ig-card" ? card : null;
  await h.root.fire("error", { target: { src: post.imageUrl, hasAttribute: name => name === "data-ig-photo" } });
  assert.doesNotMatch(card.outerHTML, /Automatic caption|expired.jpg/);
  assert.ok(card.outerHTML.includes(SEED_INSTAGRAM.caption));
  await h.store.setInstagram({ ...post, caption: "Manual choice using the same photo" });
  card.outerHTML = "unchanged manual card";
  await h.root.fire("error", { target: { src: post.imageUrl, hasAttribute: name => name === "data-ig-photo" } });
  assert.equal(card.outerHTML, "unchanged manual card", "an image error must not loop by repeatedly replacing a manual card");
});

for (const reason of ["manual", "idle"]) {
  test(`${reason} logout reaches unlock with a persistent, neutral message`, async () => {
    const h = await managerHarness();
    if (reason === "manual") await h.click("staff-logout");
    else { await h.fireTimer(1000, true); await h.fireTimer(15 * 60 * 1000); }
    assert.equal(h.backend.signOutCalls, 1);
    assert.equal(h.backend.signedIn, false);
    assert.equal(h.sessionStorage.getItem(STAFF_SESSION_KEY), null);
    assert.equal(h.location.hash, "#/staff");
    assert.match(h.root.innerHTML, /data-act="staff-form"/);
    assert.match(h.root.innerHTML, reason === "idle" ? /Signed out after 15 minutes idle\./ : /Signed out\./);
    assert.doesNotMatch(h.root.innerHTML, /class="staff shake"/);
    assert.match(h.root.innerHTML, /class="staff-sub" role="status">Signed out/);
    // A store refresh must not erase the reason or return to Manager.
    h.emitSnapshot();
    assert.match(h.root.innerHTML, /Signed out/);
  });
  test(`${reason} sign-out failure never claims the session ended`, async () => {
    const h = await managerHarness();
    h.backend.signOutError = failure("auth/network-request-failed");
    if (reason === "manual") await h.click("staff-logout");
    else { await h.fireTimer(1000, true); await h.fireTimer(15 * 60 * 1000); }
    assert.equal(h.backend.signedIn, true);
    assert.equal(h.sessionStorage.getItem(STAFF_SESSION_KEY), "ok");
    assert.match(h.root.innerHTML, /Your session is still open/);
    assert.doesNotMatch(h.root.innerHTML, /Signed out|data-act="staff-form"/);
    if (reason === "idle") {
      await h.fireTimer(1000, true);
      assert.equal(h.backend.signOutCalls, 1);
      assert.ok([...h.timers.values()].some(t => t.ms === 15 * 60 * 1000));
    }
  });
}

test("activity resets idle logout and customer navigation disarms it", async () => {
  const h = await managerHarness();
  await h.fireTimer(1000, true);
  const first = [...h.timers.keys()];
  await h.document.fire("pointerdown");
  assert.ok([...h.timers.keys()].some(id => !first.includes(id)));
  await h.click("go-case");
  await h.fireTimer(1000, true);
  await h.fireTimer(15 * 60 * 1000);
  assert.equal(h.backend.signOutCalls, 0);
});

test("rapid logout and re-login rearms idle logout without further Manager activity", async () => {
  const h = await managerHarness();
  const idleTimers = () => [...h.timers].filter(([, timer]) => timer.ms === 15 * 60 * 1000);
  await h.fireTimer(1000, true);
  assert.equal(idleTimers().length, 1);
  await h.click("staff-logout");
  // Capture-phase input on the unlock form clears the previous session's timer.
  await h.document.fire("input");
  assert.equal(idleTimers().length, 0);
  await h.input("staff-email", "staff@example.com");
  await h.input("staff-pass", "test password");
  await h.submit("staff-form");
  await settle();
  assert.equal(h.backend.signedIn, true);
  assert.match(h.root.innerHTML, /data-act="staff-logout"/);
  // Logout and re-login both completed before the next one-second monitor tick.
  await h.fireTimer(1000, true);
  const rearmed = idleTimers();
  assert.equal(rearmed.length, 1);
  await h.fireTimer(1000, true);
  assert.deepEqual(idleTimers(), rearmed, "monitor polling must not extend the idle deadline");
  await h.fireTimer(15 * 60 * 1000);
  assert.equal(h.backend.signOutCalls, 2);
  assert.equal(h.backend.signedIn, false);
  assert.match(h.root.innerHTML, /data-act="staff-form"/);
  assert.match(h.root.innerHTML, /Signed out after 15 minutes idle\./);
});

const saves = [
  ["hours override", h => h.store.setHoursOverride({ date: "2026-10-22", closed: true }), "hoursOverride"],
  ["normal hours", h => h.store.clearHoursOverride(), "hoursOverride"],
  ["Instagram", h => h.store.setInstagram({ imageUrl: "https://example.com/post.jpg", caption: "New", permalink: "https://instagram.com/p/example" }), "instagram"],
  ["Instagram reset", h => h.store.resetInstagram(), "instagram"],
  ["Add flavor", h => h.store.addFlavor({ name: "Test flavor", note: "A note", dairyFree: true, color: "#112233" }), "catalog"],
  ["notice", h => h.store.sendNotice("Closing at 7 tonight"), "lastNotice"],
  ...["pintsAvailable", "runningLow"].map(key => [key, h => h.store.setFlavorAvailability(h.store.getState().caseIds[0], key, true), "availability"]),
];
for (const [name, save, field] of saves) {
  test(`${name} waits for acknowledgement and rejects without replacing newer confirmed state`, async () => {
    const remote = fixture();
    remote.hoursOverride = { date: "2026-10-22", closed: true };
    remote.instagram.caption = "Existing remote post";
    const h = await managerHarness({ remote, app: false });
    const before = copy(h.store.getState());
    const gate = h.backend.gate = deferred();
    const pending = save(h);
    await settle();
    assert.deepEqual(copy(h.store.getState()), before);
    // A latency-compensated snapshot must not enter confirmed state/cache.
    h.emitSnapshot({ ...remote, ...h.backend.attempts[0] }, { hasPendingWrites: true });
    assert.deepEqual(copy(h.store.getState()), before);
    const newer = copy(remote);
    newer.instagram.caption = "Another staff member's confirmed edit";
    h.backend.remote = newer;
    h.emitSnapshot();
    const confirmed = copy(h.store.getState());
    const rejected = assert.rejects(pending, { code: "permission-denied" });
    gate.reject(failure("permission-denied"));
    await rejected;
    assert.deepEqual(copy(h.store.getState()), confirmed);
    assert.deepEqual(JSON.parse(h.localStorage.getItem(STORAGE_KEY)), confirmed);
    assert.equal(h.backend.writes.length, 0);
    assert.equal(h.store.getSyncStatus().writeError.code, "permission-denied");
    // A retry clears the error only once a real write is acknowledged.
    h.backend.gate = null;
    await save(h);
    assert.equal(h.backend.writes.length, 1);
    assert.ok(field in h.backend.writes[0]);
    assert.ok(h.store.getState().updatedAt > before.updatedAt);
    assert.equal(h.store.getState().updatedAt, h.backend.writes[0].updatedAt);
    assert.equal(JSON.parse(h.localStorage.getItem(STORAGE_KEY)).updatedAt, h.backend.writes[0].updatedAt);
    assert.equal(h.store.getSyncStatus().writeError, null);
  });
}

for (const [code, message] of [
  ["permission-denied", /check staff access and Firestore rules/],
  ["unauthenticated", /session expired/],
  ["unavailable", /Check your connection/],
  ["invalid-argument", /Check the entered values/],
]) {
  test(`Add flavor retains the draft and shows ${code} inside its sheet`, async () => {
    const h = await managerHarness();
    await h.click("open-add");
    await h.input("add-name", "Rose <special>");
    await h.input("add-note", "Keep my note");
    h.backend.error = failure(code);
    await h.click("do-add");
    const sheet = h.root.innerHTML.slice(h.root.innerHTML.indexOf('<aside class="sheet"'));
    assert.match(sheet, /Rose &lt;special&gt;/);
    assert.match(sheet, /Keep my note/);
    assert.match(sheet, message);
    assert.doesNotMatch(h.root.innerHTML, /Added to the catalog/);
    assert.equal(h.backend.writes.length, 0);
  });
  test(`notice retains its preview and shows ${code} without publishing`, async () => {
    const h = await managerHarness();
    await h.input("notice-msg", "Keep this notice");
    await h.submit("notice-form");
    h.backend.error = failure(code);
    await h.click("confirm-notice");
    const sheet = h.root.innerHTML.slice(h.root.innerHTML.indexOf('<aside class="sheet'));
    assert.match(sheet, /Keep this notice/);
    assert.match(sheet, message);
    assert.doesNotMatch(h.root.innerHTML, /<em>Shop notice posted<\/em>/);
    assert.equal(h.store.getState().lastNotice, null);
    assert.equal(h.backend.writes.length, 0);
    assert.equal(h.backend.published.length, 0);
  });
}

test("pending notice ignores local echoes, blocks repeats, and publishes only after acknowledgement", async () => {
  const h = await managerHarness();
  const before = h.store.getState().updatedAt;
  await h.input("notice-msg", "Pending notice");
  await h.submit("notice-form");
  h.backend.gate = deferred();
  const pending = h.click("confirm-notice");
  await settle();
  h.emitSnapshot({ ...h.backend.remote, ...h.backend.attempts[0] }, { hasPendingWrites: true });
  assert.equal(h.store.getState().lastNotice, null);
  assert.equal(h.store.getState().updatedAt, before);
  assert.equal(JSON.parse(h.localStorage.getItem(STORAGE_KEY)).lastNotice, null);
  assert.match(h.root.innerHTML, /Waiting for server confirmation/);
  assert.match(h.root.innerHTML, /data-act="confirm-notice" disabled/);
  assert.doesNotMatch(h.root.innerHTML, /<em>Shop notice posted<\/em>/);
  assert.equal(h.backend.published.length, 0);
  await h.click("confirm-notice");
  await h.click("close-sheet");
  assert.equal(h.backend.attempts.length, 1);
  h.backend.gate.resolve();
  await pending;
  assert.equal(h.backend.writes.length, 1);
  assert.ok(h.store.getState().updatedAt > before);
  assert.equal(h.backend.published.length, 1);
  assert.equal(h.backend.published[0].message, "Pending notice");
  assert.doesNotMatch(h.root.innerHTML, /aria-label="Preview shop notice"/);
  assert.match(h.root.innerHTML, /Saved. Push is not enabled/);
});

test("Instagram rejects invalid image drafts without saving and preserves blank/default behavior", async () => {
  const h = await managerHarness();
  for (const value of ["javascript:alert(1)", "data:image/png;base64,AA==", "http://example.com/photo.jpg", "/photo.jpg", "not a URL"]) {
    await h.input("ig-image", value);
    await h.submit("ig-form");
    assert.match(h.root.innerHTML, /Enter a valid HTTPS image URL/);
    assert.ok(h.root.innerHTML.includes(value));
    assert.equal(h.backend.attempts.length, 0);
    assert.doesNotMatch(h.root.innerHTML, /<em>Instagram updated<\/em>/);
  }
  await h.input("ig-image", " https://example.com/photo.jpg ");
  await h.submit("ig-form");
  assert.equal(h.store.getInstagram().imageUrl, "https://example.com/photo.jpg");
  await h.input("ig-image", " ");
  await h.submit("ig-form");
  assert.equal(h.store.getInstagram().imageUrl, SEED_INSTAGRAM.imageUrl);
});

test("Instagram rejects invalid permalink drafts before writing and preserves blank/default behavior", async () => {
  const h = await managerHarness();
  for (const value of ["javascript:alert(1)", "data:text/html,bad", "http://example.com/post", "ftp://example.com/post", "/post", "not a URL"]) {
    await h.input("ig-link", value);
    await h.submit("ig-form");
    assert.match(h.root.innerHTML, /Enter a valid HTTPS Instagram link/);
    assert.ok(h.root.innerHTML.includes(value));
    assert.equal(h.backend.attempts.length, 0);
    assert.equal(h.store.getInstagram().permalink, SEED_INSTAGRAM.permalink);
    assert.doesNotMatch(h.root.innerHTML, /<em>Instagram updated<\/em>/);
  }
  await h.input("ig-link", " https://www.instagram.com/p/example/ ");
  await h.submit("ig-form");
  assert.equal(h.store.getInstagram().permalink, "https://www.instagram.com/p/example/");
  for (const blank of ["", "   "]) {
    await h.input("ig-link", blank);
    await h.submit("ig-form");
    assert.equal(h.store.getInstagram().permalink, SEED_INSTAGRAM.permalink);
  }
});

test("unsafe stored Instagram permalinks render the default profile without rewriting data", async () => {
  for (const permalink of ["javascript:alert(1)", "data:text/html,bad", "ftp://example.com/post", "/post", ""]) {
    const remote = fixture();
    remote.instagram.permalink = permalink;
    const h = await managerHarness({ remote });
    await h.click("go-case");
    assert.ok(h.root.innerHTML.includes(`<a class="ig-card" href="${SEED_INSTAGRAM.permalink}"`));
    assert.equal(h.backend.attempts.length, 0);
  }
});

test("unsafe stored Instagram image URLs render the default photo", async () => {
  const remote = fixture();
  remote.instagram.imageUrl = "data:image/svg+xml,bad";
  const h = await managerHarness({ remote });
  await h.click("go-case");
  assert.doesNotMatch(h.root.innerHTML, /src="data:/);
  assert.ok(h.root.innerHTML.includes(SEED_INSTAGRAM.imageUrl));
});

test("toast titles and notice subtitles render dynamic text without HTML interpretation", async () => {
  const h = await managerHarness();
  await h.click("open-add");
  await h.input("add-name", '<img src=x onerror="bad()"> & Rose');
  await h.click("do-add");
  assert.match(h.root.innerHTML, /<em>&lt;img src=x onerror=&quot;bad\(\)&quot;&gt; &amp; Rose<\/em>/);
  assert.doesNotMatch(h.root.innerHTML, /<img src=x/);
  h.window.dispatchEvent({ type: "janartys-remote-notice", detail: { at: Date.now(), message: "<b>Notice</b> & update" } });
  assert.match(h.root.innerHTML, /toast-sub">&lt;b&gt;Notice&lt;\/b&gt; &amp; update/);
});

test("unchanged closing times do not write or open another notice", async () => {
  const h = await managerHarness();
  await h.change("hours-close-at", "18:30");
  assert.equal(h.backend.writes.length, 1);
  await h.click("close-sheet");
  await h.change("hours-close-at", "18:30");
  assert.equal(h.backend.writes.length, 1);
  assert.doesNotMatch(h.root.innerHTML, /aria-label="Preview shop notice"/);
});

test("pending Add flavor prevents duplicate submissions and only toasts after ack", async () => {
  const h = await managerHarness();
  await h.click("open-add");
  await h.input("add-name", "Rose");
  h.backend.gate = deferred();
  const pending = h.click("do-add");
  await settle();
  assert.match(h.root.innerHTML, /Waiting for server confirmation/);
  assert.match(h.root.innerHTML, /data-act="do-add" disabled/);
  assert.doesNotMatch(h.root.innerHTML, /Added to the catalog/);
  await h.click("do-add");
  await h.click("close-sheet");
  assert.equal(h.backend.attempts.length, 1);
  assert.match(h.root.innerHTML, /aria-label="Add flavor"/);
  h.navigator.onLine = false;
  h.window.dispatchEvent({ type: "offline" });
  await h.fireTimer(8000);
  assert.match(h.root.innerHTML, /Offline. Waiting for save confirmation/);
  h.backend.gate.resolve();
  await pending;
  assert.match(h.root.innerHTML, /Added to the catalog/);
  assert.doesNotMatch(h.root.innerHTML, /aria-label="Add flavor"/);
  assert.equal(h.backend.writes.length, 1);
});

for (const action of ["save", "reset"]) {
  test(`Instagram ${action} retains drafts on rejection and toasts only after ack`, async () => {
    const h = await managerHarness();
    const before = h.store.getState().updatedAt;
    await h.input("ig-caption", "Keep this draft");
    const save = () => action === "save" ? h.submit("ig-form") : h.click("ig-reset");
    h.backend.error = failure("permission-denied");
    await save();
    assert.equal(h.store.getState().updatedAt, before);
    assert.match(h.root.innerHTML, /Keep this draft/);
    assert.doesNotMatch(h.root.innerHTML, /<em>Instagram (updated|reset)<\/em>/);
    h.backend.error = null;
    h.backend.gate = deferred();
    const pending = save();
    await settle();
    assert.equal(h.store.getState().updatedAt, before);
    assert.doesNotMatch(h.root.innerHTML, /<em>Instagram (updated|reset)<\/em>/);
    h.backend.gate.resolve();
    await pending;
    assert.ok(h.store.getState().updatedAt > before);
    assert.match(h.root.innerHTML, action === "save" ? /<em>Instagram updated<\/em>/ : /<em>Instagram reset<\/em>/);
    if (action === "reset") assert.doesNotMatch(h.root.innerHTML, /Keep this draft/);
  });
}

for (const action of ["hours-normal", "hours-closed", "hours-open", "hours-close-at"]) {
  test(`${action} handles denial and opens a closing notice only after successful save`, async () => {
    const h = await managerHarness();
    await h.input("notice-msg", "Existing notice draft");
    const save = () => action === "hours-close-at" ? h.change(action, "18:30") : h.click(action);
    h.backend.error = failure("permission-denied");
    await save();
    assert.match(h.root.innerHTML, /check staff access and Firestore rules/);
    assert.match(h.root.innerHTML, /Existing notice draft/);
    assert.doesNotMatch(h.root.innerHTML, /aria-label="Preview shop notice"/);
    h.backend.error = null;
    h.backend.gate = deferred();
    const pending = save();
    await settle();
    assert.doesNotMatch(h.root.innerHTML, /aria-label="Preview shop notice"/);
    h.backend.gate.resolve();
    await pending;
    if (action === "hours-close-at") {
      assert.match(h.root.innerHTML, /aria-label="Preview shop notice"/);
      assert.match(h.root.innerHTML, /Closing at 6:30pm tonight/);
      assert.equal(h.store.getState().lastNotice, null);
    }
  });
}

test("signing out during a pending save suppresses its eventual success toast", async () => {
  const h = await managerHarness();
  await h.input("ig-caption", "Pending post");
  h.backend.gate = deferred();
  const pending = h.submit("ig-form");
  await settle();
  await h.click("staff-logout");
  h.backend.gate.resolve();
  await pending;
  assert.match(h.root.innerHTML, /Signed out\./);
  assert.doesNotMatch(h.root.innerHTML, /Instagram updated/);
});

test("a previous session's save cannot clear a newly signed-in staff member's draft", async () => {
  const h = await managerHarness();
  await h.input("ig-caption", "Previous session");
  h.backend.gate = deferred();
  const pending = h.submit("ig-form");
  await settle();
  await h.click("staff-logout");
  await h.input("staff-email", "staff@example.com");
  await h.input("staff-pass", "test password");
  await h.submit("staff-form");
  await settle();
  await h.input("ig-caption", "New session draft");
  h.backend.gate.resolve();
  await pending;
  assert.match(h.root.innerHTML, /New session draft/);
  assert.doesNotMatch(h.root.innerHTML, /Instagram updated/);
});

test("manual logout still succeeds when optional session storage rejects removal", async () => {
  const h = await managerHarness();
  h.sessionStorage.removeItem = () => { throw new Error("Storage unavailable"); };
  await h.click("staff-logout");
  assert.equal(h.backend.signedIn, false);
  assert.match(h.root.innerHTML, /Signed out\./);
  assert.doesNotMatch(h.root.innerHTML, /session is still open/);
});

test("swap, undo, availability, and notice success messages still work through the shared operation helper", async () => {
  const h = await managerHarness();
  const original = h.store.getState().caseIds[0];
  const incoming = h.store.availableForSwap(0).find(f => f.id !== original);
  await h.click("tap-pan", { slot: "0" });
  await h.click("pick", { id: incoming.id });
  await h.click("do-swap");
  assert.equal(h.store.getState().caseIds[0], incoming.id);
  assert.match(h.root.innerHTML, /Saved. Push is not enabled/);
  await h.click("undo-swap", { id: h.store.getState().lastSwap.id });
  assert.equal(h.store.getState().caseIds[0], original);
  assert.match(h.root.innerHTML, /Restored .*Already delivered alerts cannot be recalled/);
  await h.store.setFlavorAvailability(original, "pintsAvailable", true);
  assert.equal(h.store.getState().availability[original].pintsAvailable, true);
  await h.input("notice-msg", "Notice after confirmation");
  await h.submit("notice-form");
  h.backend.error = failure("permission-denied");
  await h.click("confirm-notice");
  assert.match(h.root.innerHTML, /aria-label="Preview shop notice"/);
  assert.match(h.root.innerHTML, /Notice after confirmation/);
  assert.equal(h.store.getState().lastNotice, null);
  h.backend.error = null;
  await h.click("confirm-notice");
  assert.equal(h.store.getState().lastNotice.message, "Notice after confirmation");
  assert.match(h.root.innerHTML, /Saved. Push is not enabled/);
});

test("remote seed fields reach the rendered pan and survive cache reloads and storage events", async () => {
  const remote = fixture();
  const id = remote.caseIds[0];
  const flavor = remote.catalog.find(f => f.id === id);
  Object.assign(flavor, { name: "Custom remote name", note: "", story: "", dairyFree: false, tags: [], scoopColor: "" });
  const h = await managerHarness({ remote });
  assert.match(h.root.innerHTML, /class="pan-name">Custom remote name</);
  assert.deepEqual(copy(h.store.flavorById(id)), flavor);
  const cache = JSON.parse(h.localStorage.getItem(STORAGE_KEY));
  const reloaded = await managerHarness({ remote: null, cache, app: false });
  assert.deepEqual(copy(reloaded.store.flavorById(id)), flavor);
  const storageCopy = copy(cache);
  storageCopy.catalog.find(f => f.id === id).name = "Updated in another tab";
  h.window.dispatchEvent({ type: "storage", key: STORAGE_KEY, newValue: JSON.stringify(storageCopy) });
  assert.match(h.root.innerHTML, /Updated in another tab/);
});

test("missing seed fields fall back without re-inflating non-case seed entries", async () => {
  const remote = fixture();
  remote.catalog = [{ id: SEED_CASE[0], name: "Custom name" }];
  const h = await managerHarness({ remote, app: false });
  const hydrated = h.store.flavorById(SEED_CASE[0]);
  const seed = SEED_CATALOG.find(f => f.id === SEED_CASE[0]);
  assert.equal(hydrated.name, "Custom name");
  for (const key of ["note", "story", "dairyFree", "tags"]) assert.deepEqual(copy(hydrated[key]), seed[key]);
  assert.deepEqual(new Set(h.store.getState().catalog.map(f => f.id)), new Set(SEED_CASE));
  assert.equal(h.backend.writes.length, 0);
});

test("Add flavor uses the latest remote catalog and recalculates IDs on transaction retry", async () => {
  const h = await managerHarness({ app: false });
  const newer = copy(h.backend.remote);
  newer.catalog[0].name = "Another staff edit";
  newer.catalog.push({ id: "rose", name: "Rose", note: "Remote addition" });
  h.backend.remote = newer; // Deliberately not delivered to this client's listener.
  const retried = copy(newer);
  retried.catalog.push({ id: "rose-2", name: "Rose 2", note: "Concurrent addition" });
  h.backend.retryWith = retried;
  const added = await h.store.addFlavor({ name: "Rose" });
  assert.equal(added.id, "rose-3");
  assert.equal(h.backend.attempts.length, 2);
  assert.deepEqual(h.backend.remote.catalog.slice(0, -1), retried.catalog);
  assert.equal(h.backend.remote.catalog.length, retried.catalog.length + 1);
});

test("a full catalog rejects Add flavor without mutating it", async () => {
  const remote = fixture();
  remote.catalog = Array.from({ length: 500 }, (_, i) => ({ id: `f-${i}`, name: `Flavor ${i}` }));
  const h = await managerHarness({ remote, app: false });
  await assert.rejects(h.store.addFlavor({ name: "Extra" }), /catalog is full/);
  assert.equal(h.backend.remote.catalog.length, 500);
  assert.equal(h.backend.writes.length, 0);
});
