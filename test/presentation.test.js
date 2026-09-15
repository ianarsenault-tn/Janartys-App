import assert from "node:assert/strict";
import test from "node:test";
import { activeNotice, connectionLabel, freshSwap, JUST_OUT_MS, swapKey, updateLabel } from "../src/presentation.js";

test("updates use a clear label with the shop's day rather than a raw hour count", () => {
  const now = Date.parse("2026-09-15T18:00:00Z");
  assert.equal(updateLabel(now - 10000, now), "Last updated just now");
  assert.equal(updateLabel(now - 120000, now), "Last updated 2 min ago");
  assert.equal(updateLabel(Date.parse("2026-09-11T18:00:00Z"), now), "Last updated Friday");
  assert.equal(updateLabel(Date.parse("2026-08-01T18:00:00Z"), now), "Last updated Aug 1");
  assert.equal(updateLabel(null, now), "Update time unavailable");
  assert.equal(updateLabel(1e20, now), "Update time unavailable");
  assert.equal(updateLabel(now + 86400000, now), "Update time unavailable");
});

test("shop notices expire at Chicago midnight, not UTC midnight", () => {
  const notice = { message: "Pints after 7 tonight", at: Date.parse("2026-09-15T23:00:00Z") };
  assert.equal(activeNotice(notice, Date.parse("2026-09-16T04:59:59Z")), notice);
  assert.equal(activeNotice(notice, Date.parse("2026-09-16T05:00:00Z")), null);
});

test("notice expiry follows Chicago daylight-saving changes", () => {
  const spring = { message: "Open today", at: Date.parse("2026-03-08T06:05:00Z") };
  assert.equal(activeNotice(spring, Date.parse("2026-03-09T04:59:59Z")), spring);
  assert.equal(activeNotice(spring, Date.parse("2026-03-09T05:00:00Z")), null);
  const fall = { message: "Open today", at: Date.parse("2026-11-01T05:05:00Z") };
  assert.equal(activeNotice(fall, Date.parse("2026-11-02T05:59:59Z")), fall);
  assert.equal(activeNotice(fall, Date.parse("2026-11-02T06:00:00Z")), null);
});

test("old, missing, malformed, blank and future notices are not shown", () => {
  const now = Date.parse("2026-09-15T18:00:00Z");
  for (const notice of [null, {}, { message: "" }, { message: 42, at: now }, { message: "   ", at: now }, { message: "Offer", at: "broken" }, { message: "Offer", at: 1e20 }, { message: "Offer", at: now + 1 }, { message: "Offer", at: now - 86400000 }]) {
    assert.equal(activeNotice(notice, now), null);
  }
});

test("freshness has a finite window and identifies different swaps of the same flavor", () => {
  const now = 1789480000000;
  const swap = { inId: "mint", slot: 2, at: now - JUST_OUT_MS + 1 };
  assert.equal(freshSwap(swap, now), swap);
  assert.equal(freshSwap(swap, now + 1), null);
  assert.equal(freshSwap({ ...swap, at: now + 1 }, now), null);
  assert.equal(freshSwap({ ...swap, at: "invalid" }, now), null);
  assert.notEqual(swapKey(swap), swapKey({ ...swap, at: now }));
});

test("a browser offline signal takes precedence over a previously connected snapshot", () => {
  assert.equal(connectionLabel(true, true), "Connected");
  assert.equal(connectionLabel(true, false), "Offline");
  assert.equal(connectionLabel(false, true), "Saved view");
});
