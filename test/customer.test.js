import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCustomer, filterLibrary, desiredTopics, flavorTopic } from "../src/customer-model.js";
import { swapPatch, undoPatch, canUndoSwap, availabilityFor, UNDO_MS } from "../src/case-actions.js";
import { freshSwap } from "../src/presentation.js";

const catalog = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, name: `Flavor ${i}`, note: i === 8 ? "Floral lavender" : "House flavor", dairyFree: i % 2 === 0 }));
const now = Date.parse("2026-09-15T18:00:00Z");
const base = () => ({ catalog, caseIds: catalog.slice(0, 8).map(f => f.id), lastNotice: { message: "Keep this", at: now }, availability: { f0: { pintsAvailable: true, runningLow: true, at: now }, f8: { runningLow: true, at: now } } });

test("favorites normalize duplicates and malformed input without changing alert consent", () => {
  const value = normalizeCustomer({ favorites: ["mint", "mint", null, 42], alerts: { favorites: "true", announcements: true }, enabled: "true" });
  assert.deepEqual(value.favorites, ["mint"]);
  assert.equal(value.alerts.favorites, false);
  assert.equal(value.alerts.announcements, true);
  assert.equal(value.enabled, false);
});
test("library combines description search, favorite, in-case, and dietary filters", () => {
  assert.deepEqual(filterLibrary(catalog, { query: "LAVENDER" }).map(f => f.id), ["f8"]);
  assert.deepEqual(filterLibrary(catalog, { favoritesOnly: true, favorites: ["f0", "f1", "f8"], caseIds: base().caseIds, inCaseOnly: true, dairyFree: true }).map(f => f.id), ["f0"]);
});
test("topics honor consent and isolate three categories without unsafe topic IDs", () => {
  const value = normalizeCustomer({ favorites: ["a/b", "a-b"], alerts: { favorites: true, newFlavors: true, announcements: true } });
  assert.deepEqual(desiredTopics(value), []);
  const topics = desiredTopics({ ...value, enabled: true });
  assert.equal(topics.length, 4);
  assert.notEqual(flavorTopic("a/b"), flavorTopic("a-b"));
  assert.ok(topics.every(topic => /^[A-Za-z0-9-]+$/.test(topic)));
  assert.deepEqual(desiredTopics({ ...value, enabled: true, alerts: { announcements: true } }), ["shop-announcements"]);
});
test("swap verifies current pan and clears old running-low labels", () => {
  const patch = swapPatch(base(), 0, "f8", "f0", "swap-1", now);
  assert.equal(patch.caseIds[0], "f8");
  assert.equal(patch.availability.f0.runningLow, false);
  assert.equal(patch.availability.f8.runningLow, false);
  assert.equal(patch.availability.f0.pintsAvailable, true);
  assert.throws(() => swapPatch(base(), 0, "f8", "f1", "swap-2", now));
  assert.throws(() => swapPatch(base(), 0, "f1", "f0", "swap-2", now));
});
test("undo restores the exact latest swap, preserving unrelated fields and suppressing fresh alerts", () => {
  const state = { ...base(), ...swapPatch(base(), 0, "f8", "f0", "swap-1", now) };
  assert.ok(canUndoSwap(state, "swap-1", now + 1000));
  const undo = undoPatch(state, "swap-1", now + 1000);
  assert.equal(undo.caseIds[0], "f0");
  assert.equal(undo.availability.f0.runningLow, true);
  assert.equal("lastNotice" in undo, false);
  assert.equal(freshSwap(undo.lastSwap, now + 1000), null);
  assert.equal(canUndoSwap({ ...state, ...undo }, "swap-1", now + 2000), false);
  assert.throws(() => undoPatch(state, "different-swap", now + 1000));
  assert.throws(() => undoPatch(state, "swap-1", now + UNDO_MS));
  assert.throws(() => undoPatch({ ...state, caseIds: base().caseIds }, "swap-1", now + 1000));
  const laterStock = { pintsAvailable: false, runningLow: false, at: now + 500 };
  assert.deepEqual(undoPatch({ ...state, availability: { ...state.availability, f0: laterStock } }, "swap-1", now + 1000).availability.f0, laterStock);
});
test("availability expires at shop midnight and running-low applies only to current pans", () => {
  assert.deepEqual(availabilityFor(base(), "f0", now), { pintsAvailable: true, runningLow: true });
  assert.equal(availabilityFor(base(), "f8", now).runningLow, false);
  assert.deepEqual(availabilityFor(base(), "f0", Date.parse("2026-09-16T05:00:00Z")), { pintsAvailable: false, runningLow: false });
});
