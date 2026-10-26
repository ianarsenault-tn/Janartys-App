import assert from "node:assert/strict";
import test from "node:test";
import { copy, deferred, failure, fixture, managerHarness, settle } from "./helpers/manager-harness.js";
import { addDays, validDate, normalizeSchedule, scheduledHoursPatch } from "../src/hours-schedule.js";
import { privacyContent, SUPPORT_EMAIL } from "../src/privacy-content.js";
import { readFile } from "node:fs/promises";
import { CUSTOMER_KEY } from "../src/customer-model.js";
import { STORAGE_KEY } from "../src/data.js";

test("dated hours reject impossible dates, inverted/overnight times, past dates and dates beyond a year", () => {
  assert.equal(validDate("2026-02-30"), false); assert.equal(validDate("2028-02-29"), true);
  const today = "2026-10-26";
  for (const date of ["", "2026-02-30", "2026-10-25", "2027-10-28"]) assert.throws(() => scheduledHoursPatch({}, date, { closed: true }, null, today), /Choose a date/);
  for (const entry of [{ closed: false, open: "25:00", close: "26:00" }, { closed: false, open: "17:00", close: "17:00" }, { closed: false, open: "21:00", close: "02:00" }, { closed: "true" }]) {
    assert.throws(() => scheduledHoursPatch({}, today, entry, null, today), /valid opening/);
  }
  assert.deepEqual(normalizeSchedule({ bad: {}, "2026-10-27": { closed: true }, "2026-02-30": { closed: true }, "2026-10-28": { closed: false } }), { "2026-10-27": { closed: true } });
});

test("calendar math handles leap years, year boundaries and DST without browser-zone arithmetic", () => {
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-11-01", 1), "2026-11-02");
});

test("scheduled Monday opening is used before and during opening, then the next dated exception", async () => {
  const remote = fixture(); remote.scheduledHours = { "2026-10-26": { closed: false, open: "13:00", close: "17:00" }, "2026-10-27": { closed: false, open: "10:00", close: "12:00" } };
  const h = await managerHarness({ remote, app: false });
  assert.match(h.store.getShopStatus(new Date("2026-10-26T17:00:00Z")).label, /opens today 1pm/);
  assert.equal(h.store.getShopStatus(new Date("2026-10-26T18:00:00Z")).open, true);
  assert.match(h.store.getShopStatus(new Date("2026-10-26T22:00:00Z")).label, /opens Tuesday 10am/);
});

test("next opening skips holiday closures, including more than a week of exceptions", async () => {
  const remote = fixture(); remote.scheduledHours = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [addDays("2026-10-27", i), { closed: true }]));
  const h = await managerHarness({ remote, app: false });
  assert.match(h.store.getShopStatus(new Date("2026-10-26T22:00:00Z")).label, /Nov 11, 2026 11:30am/);
});

test("scheduled dates become active at Chicago midnight across standard-time transition", async () => {
  const remote = fixture(); remote.scheduledHours = { "2026-11-01": { closed: true }, "2026-11-02": { closed: false, open: "09:00", close: "15:00" } };
  const h = await managerHarness({ remote, app: false });
  assert.match(h.store.getShopStatus(new Date("2026-11-02T05:59:00Z")).label, /Closed today/);
  assert.match(h.store.getShopStatus(new Date("2026-11-02T06:00:00Z")).label, /opens today 9am/);
  assert.equal(h.store.getShopStatus(new Date("2026-11-02T15:00:00Z")).open, true);
});

test("legacy today's override wins, and Follow normal hours clears only today's exception", async () => {
  const h = await managerHarness({ app: false }); const today = h.store.chicagoDate(), tomorrow = addDays(today, 1);
  h.backend.remote.scheduledHours = { [today]: { closed: true }, [tomorrow]: { closed: true } };
  h.emitSnapshot(); assert.equal(h.store.getHoursOverride().closed, true);
  await h.store.setHoursOverride({ date: today, closed: false, open: "10:00", close: "18:00" });
  assert.equal(h.store.getHoursOverride().open, "10:00");
  await h.store.clearHoursOverride(); assert.equal(h.store.getHoursOverride(), null);
  assert.deepEqual(copy(h.store.getScheduledHours()), { [tomorrow]: { closed: true } });
});

test("saving today's dated hours replaces the captured quick override but rejects a newer override", () => {
  const today = "2026-10-26", old = { date: today, closed: true };
  const current = { hoursOverride: old };
  assert.equal(scheduledHoursPatch(current, today, { closed: false, open: "12:00", close: "17:00" }, null, today, 10, old).hoursOverride, null);
  assert.throws(() => scheduledHoursPatch(current, today, { closed: true }, null, today, 10, null), /Today’s hours changed/);
});

test("schedule transactions preserve other staff dates and reject same-date conflicts on retry", async () => {
  const h = await managerHarness({ app: false }), date = addDays(h.store.chicagoDate(), 2), other = addDays(date, 1);
  h.backend.remote.scheduledHours = { [other]: { closed: true } };
  await h.store.saveScheduledHours(date, { closed: true });
  assert.deepEqual(copy(h.store.getScheduledHours()), { [other]: { closed: true }, [date]: { closed: true } });
  const retry = copy(h.backend.remote); retry.scheduledHours[date] = { closed: false, open: "10:00", close: "17:00" };
  h.backend.retryWith = retry;
  await assert.rejects(h.store.saveScheduledHours(date, null, { closed: true }), /Hours for that date changed/);
  assert.equal(h.backend.writes.length, 1);
});

test("explicit saves prune expired entries and enforce the upcoming-entry limit", () => {
  const today = "2026-10-26";
  const scheduledHours = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [addDays(today, i), { closed: true }]));
  assert.throws(() => scheduledHoursPatch({ scheduledHours }, addDays(today, 60), { closed: true }, null, today), /at most 60/);
  scheduledHours["2026-01-01"] = { closed: true };
  const patch = scheduledHoursPatch({ scheduledHours }, today, null, { closed: true }, today);
  assert.equal(patch.scheduledHours["2026-01-01"], undefined); assert.equal(Object.keys(patch.scheduledHours).length, 59);
});

test("loading scheduled and legacy documents performs no writes and retains schedule through cache/storage", async () => {
  const remote = fixture(); remote.scheduledHours = { "2026-12-25": { closed: true } };
  const h = await managerHarness({ remote, app: false }); assert.equal(h.backend.writes.length, 0);
  const restored = await managerHarness({ cache: copy(h.store.getState()), remote: null, app: false });
  assert.deepEqual(copy(restored.store.getScheduledHours()), remote.scheduledHours);
  const legacy = await managerHarness({ app: false }); assert.deepEqual(copy(legacy.store.getScheduledHours()), {});
  await legacy.window.fire("storage", { key: STORAGE_KEY, newValue: JSON.stringify(h.store.getState()) });
  assert.deepEqual(copy(legacy.store.getScheduledHours()), remote.scheduledHours);
});

test("changing today's closing time preserves a scheduled opening time", async () => {
  const h = await managerHarness(); const today = h.store.chicagoDate();
  h.backend.remote.scheduledHours = { [today]: { closed: false, open: "09:00", close: "18:00" } }; h.emitSnapshot();
  await h.change("hours-close-at", "17:00");
  assert.equal(h.backend.remote.hoursOverride.open, "09:00");
  assert.equal(h.backend.remote.hoursOverride.close, "17:00");
});

for (const code of ["permission-denied", "unavailable"]) {
  test(`Manager scheduled hours keep the draft and confirmed state on ${code}`, async () => {
    const h = await managerHarness(); await h.click("open-schedule");
    await h.input("schedule-closed", false); await h.input("schedule-open", "10:00"); await h.input("schedule-close", "18:00");
    h.backend.error = failure(code); await h.submit("schedule-form");
    assert.match(h.root.innerHTML, /aria-label="Plan special hours"/); assert.match(h.root.innerHTML, /value="10:00"/);
    assert.equal(h.backend.writes.length, 0); assert.deepEqual(copy(h.store.getScheduledHours()), {});
    assert.doesNotMatch(h.root.innerHTML, /Dated hours saved/);
  });
}

test("pending schedule save blocks repeat submissions, waits for acknowledgement, and does not change case freshness", async () => {
  const remote = fixture(); remote.caseUpdatedAt = 42;
  const h = await managerHarness({ remote }); await h.click("open-schedule");
  h.backend.gate = deferred(); const pending = h.submit("schedule-form"); await settle();
  await h.submit("schedule-form"); assert.equal(h.backend.attempts.length, 1);
  assert.deepEqual(copy(h.store.getScheduledHours()), {}); assert.doesNotMatch(h.root.innerHTML, /Dated hours saved/);
  h.backend.gate.resolve(); await pending;
  assert.equal(h.backend.writes.length, 1); assert.equal(h.store.getState().caseUpdatedAt, 42);
  assert.deepEqual(h.backend.remote.catalog, remote.catalog); assert.equal(h.backend.published.length, 0);
  assert.match(h.root.innerHTML, /Dated hours saved/);
  await h.click("schedule-remove"); assert.deepEqual(copy(h.store.getScheduledHours()), {});
});

test("customer hours sheet lists dated exceptions while stale entries stay hidden", async () => {
  const h = await managerHarness(); const tomorrow = addDays(h.store.chicagoDate(), 1);
  h.emitSnapshot({ ...fixture(), scheduledHours: { "2020-01-01": { closed: true }, [tomorrow]: { closed: true } } });
  await h.click("go-case"); await h.click("open-hours");
  assert.match(h.root.innerHTML, /Dated hours/); assert.doesNotMatch(h.root.innerHTML, /2020/);
  assert.equal(h.backend.writes.length, 0);
});

test("About and Privacy are reachable from every customer view without sign-in or data writes", async () => {
  const h = await managerHarness({ signedIn: false }); await h.click("go-case");
  const customerBefore = h.localStorage.getItem(CUSTOMER_KEY);
  for (const view of ["case", "library", "favorites", "alerts"]) {
    await h.click("customer-tab", { id: view }); assert.match(h.root.innerHTML, /data-act="open-about"/);
    await h.click("open-about"); assert.match(h.root.innerHTML, /aria-label="About and help"/); assert.match(h.root.innerHTML, /App content version/);
    assert.match(h.root.innerHTML, /mailto:janartys@gmail.com/); assert.match(h.root.innerHTML, /tel:\+16159180085/);
    await h.click("open-privacy"); assert.match(h.root.innerHTML, /aria-label="Privacy policy"/); assert.match(h.root.innerHTML, /topic subscriptions identify the flavors/);
    await h.click("back-about"); await h.click("close-sheet");
    assert.doesNotMatch(h.root.innerHTML, /aria-label="About and help"/);
  }
  assert.equal(h.backend.writes.length, 0); assert.equal(h.localStorage.getItem(CUSTOMER_KEY), customerBefore);
});

test("Privacy deep link and Manager/Unlock access work without enabling alerts or Instagram", async () => {
  const h = await managerHarness(); await h.click("open-about"); assert.match(h.root.innerHTML, /About Janarty/);
  await h.click("close-sheet"); await h.click("staff-logout"); await h.click("open-about"); assert.match(h.root.innerHTML, /About Janarty/);
  h.location.hash = "#/privacy"; await h.window.fire("hashchange"); assert.match(h.root.innerHTML, /aria-label="Privacy policy"/);
  await h.click("close-sheet"); assert.equal(h.location.hash, "#/");
  assert.equal(h.backend.writes.length, 0); assert.equal(h.backend.published.length, 0);
});

test("the standalone policy uses the same content and ships through the Vite multi-page build", async () => {
  const config = (await import("../vite.config.js")).default;
  const template = await readFile(new URL("../privacy.html", import.meta.url), "utf8");
  const rendered = config.plugins.find(plugin => plugin.name === "privacy-content").transformIndexHtml(template);
  assert.ok(rendered.includes(privacyContent())); assert.ok(rendered.includes(SUPPORT_EMAIL));
  assert.doesNotMatch(rendered, /JANARTYS_PRIVACY_CONTENT|<script/);
  assert.match(rendered, /href="\.\/#\/"/); assert.ok(config.build.rollupOptions.input.privacy.endsWith("privacy.html"));
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(JSON.parse(config.define.__APP_VERSION__), pkg.version);
});
