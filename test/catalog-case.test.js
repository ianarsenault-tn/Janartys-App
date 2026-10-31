import assert from "node:assert/strict";
import test from "node:test";
import { copy, deferred, failure, fixture, managerHarness, settle } from "./helpers/manager-harness.js";
import { availabilityFor, swapPatch, undoPatch, canUndoSwap } from "../src/case-actions.js";
import { caseUpdateLabel, connectionLabel } from "../src/presentation.js";
import { filterLibrary } from "../src/customer-model.js";
import { libraryHtml, flavorLocation } from "../src/customer-ui.js";

test("special opening on a normally closed Monday is used before, during and after opening", async () => {
  const remote = fixture();
  remote.hoursOverride = { date: "2026-10-26", closed: false, open: "11:30", close: "21:00" };
  const h = await managerHarness({ remote, app: false });
  assert.match(h.store.getShopStatus(new Date("2026-10-26T15:00:00Z")).label, /opens today 11:30am/);
  assert.equal(h.store.getShopStatus(new Date("2026-10-26T16:30:00Z")).open, true);
  assert.match(h.store.getShopStatus(new Date("2026-10-27T02:00:00Z")).label, /opens Wednesday 11:30am/);
  assert.match(h.store.getShopStatus(new Date("2026-10-27T15:00:00Z")).label, /Wednesday/);
});

test("delayed opening and Chicago standard-time overrides use today's effective window", async () => {
  for (const [date, before, opening] of [["2026-10-28", "2026-10-28T17:00:00Z", "2026-10-28T18:00:00Z"], ["2026-11-02", "2026-11-02T18:00:00Z", "2026-11-02T19:00:00Z"]]) {
    const remote = fixture(); remote.hoursOverride = { date, closed: false, open: "13:00", close: "19:00" };
    const h = await managerHarness({ remote, app: false });
    assert.match(h.store.getShopStatus(new Date(before)).label, /opens today 1pm/);
    assert.equal(h.store.getShopStatus(new Date(opening)).open, true);
    h.emitSnapshot({ ...remote, hoursOverride: { date, closed: true } });
    assert.match(h.store.getShopStatus(new Date(before)).label, /Closed today/);
  }
});

test("missing and malformed remote data never present starter pans as a live case", async () => {
  const h = await managerHarness({ remote: null }); await h.click("go-case");
  assert.equal(h.store.getSyncStatus().live, false);
  assert.equal(h.store.getState().updatedAt, null);
  assert.match(h.root.innerHTML, /Current flavors haven’t loaded yet/);
  assert.doesNotMatch(h.root.innerHTML, /class="card /);
  h.emitSnapshot({ catalog: [], caseIds: [] });
  assert.equal(h.store.getSyncStatus().live, false);
  assert.equal(h.store.getState().caseLoaded, false);
  assert.equal(connectionLabel(false, true, false), "Waiting for shop");
});

test("legacy and cached cases retain honest provenance without inventing a fresh timestamp", async () => {
  const h = await managerHarness({ app: false });
  assert.equal(caseUpdateLabel(h.store.getState()), "Case update time unavailable");
  const cached = await managerHarness({ remote: null, cache: copy(h.store.getState()), app: false });
  assert.equal(cached.store.getState().caseLoaded, true);
  assert.equal(cached.store.getSyncStatus().live, false);
  const legacy = await managerHarness({ remote: null, cache: fixture(), app: false });
  assert.equal(legacy.store.getState().caseLoaded, false);
  h.emitSnapshot({ ...fixture(), caseUpdatedAt: Date.now() }, { hasPendingWrites: true });
  assert.equal(h.store.getState().caseUpdatedAt, null);
});

test("only case changes advance caseUpdatedAt; unrelated saves retain it", async () => {
  const remote = fixture(); remote.caseUpdatedAt = 100;
  const h = await managerHarness({ remote, app: false });
  await h.store.setHoursOverride(null); await h.store.sendNotice("Hello"); await h.store.resetInstagram();
  const added = await h.store.addFlavor({ name: "A new test flavor" });
  await h.store.editFlavor(added.id, added, { note: "New note" });
  await h.store.setFlavorArchived(added.id, true);
  assert.equal(h.store.getState().caseUpdatedAt, 100);
  const id = remote.caseIds[0], original = copy(h.store.flavorById(id));
  await h.store.editFlavor(id, original, { name: "New pan name" });
  assert.ok(h.store.getState().caseUpdatedAt > 100);
  assert.match(caseUpdateLabel(h.store.getState()), /Case updated just now/);
});

test("editing seed flavors preserves IDs, explicit empty fields and unrelated concurrent changes", async () => {
  const h = await managerHarness({ app: false });
  const id = h.store.getState().caseIds[0], original = copy(h.store.flavorById(id));
  h.backend.remote.catalog.find(f => f.id === id).note = "Other staff note";
  await h.store.editFlavor(id, original, { name: "Marty’s custom name", story: "", tags: [], dairyFree: false });
  const saved = h.store.flavorById(id);
  assert.equal(saved.id, id); assert.equal(saved.name, "Marty’s custom name");
  assert.equal(saved.note, "Other staff note"); assert.equal(saved.story, ""); assert.equal(saved.dairyFree, false);
  h.emitSnapshot(); assert.equal(h.store.flavorById(id).name, saved.name);
});

test("same-field concurrent edits reject without overwriting the newer value", async () => {
  const h = await managerHarness({ app: false });
  const original = copy(h.store.getState().catalog[0]);
  h.backend.remote.catalog.find(f => f.id === original.id).name = "Someone else's edit";
  await assert.rejects(h.store.editFlavor(original.id, original, { name: "My edit" }), /changed while you were editing/);
  assert.equal(h.backend.writes.length, 0);
});

test("sparse seed entries can be edited without inflating unrelated catalog fields", async () => {
  const remote = fixture(), id = remote.caseIds[0];
  remote.catalog = remote.catalog.map(f => f.id === id ? { id } : f);
  const h = await managerHarness({ remote, app: false });
  const original = copy(h.store.flavorById(id));
  await assert.rejects(h.store.addFlavor({ name: original.name }), /already exists/);
  await h.store.editFlavor(id, original, { story: "A new story" });
  assert.deepEqual(h.backend.remote.catalog.find(f => f.id === id), { id, story: "A new story" });
});

test("renaming warns on duplicates while editing an existing duplicate's note is allowed", async () => {
  const h = await managerHarness({ app: false });
  const a = copy(h.store.getState().catalog[0]), b = copy(h.store.getState().catalog[1]);
  await assert.rejects(h.store.editFlavor(a.id, a, { name: b.name }), /already exists/);
  await h.store.editFlavor(a.id, a, { name: b.name }, true);
  const renamed = copy(h.store.flavorById(a.id));
  await h.store.editFlavor(a.id, renamed, { note: "Distinct recipe" });
  assert.equal(h.store.flavorById(a.id).note, "Distinct recipe");
});

for (const key of ["archive", "restore", "sold-out"]) {
  test(`${key} failures and pending writes leave confirmed state intact`, async () => {
    const remote = fixture(), id = key === "sold-out" ? remote.caseIds[0] : remote.catalog.find(f => !remote.caseIds.includes(f.id)).id;
    if (key === "restore") remote.catalog.find(f => f.id === id).archived = true;
    const h = await managerHarness({ remote, app: false }), before = copy(h.store.getState());
    const save = () => key === "sold-out" ? h.store.setFlavorAvailability(id, "soldOut", true) : h.store.setFlavorArchived(id, key === "archive");
    h.backend.gate = deferred(); const pending = save(); await settle();
    assert.deepEqual(copy(h.store.getState()), before);
    h.backend.error = failure("permission-denied"); h.backend.gate.resolve();
    await assert.rejects(pending); assert.deepEqual(copy(h.store.getState()), before);
    assert.equal(h.backend.writes.length, 0);
  });
}

test("Manager edit keeps drafts on failed saves and only shows success after acknowledgement", async () => {
  const h = await managerHarness(); const id = h.store.getState().caseIds[0];
  await h.click("manage-flavors"); await h.click("edit-flavor", { id }); await h.input("edit-name", "Edited pan name");
  h.backend.error = failure("permission-denied"); await h.click("save-flavor");
  assert.match(h.root.innerHTML, /value="Edited pan name"/); assert.match(h.root.innerHTML, /isn’t permitted/);
  assert.doesNotMatch(h.root.innerHTML, /<em>Flavor saved/);
  h.backend.error = null; h.backend.gate = deferred(); const pending = h.click("save-flavor"); await settle();
  assert.notEqual(h.store.flavorById(id).name, "Edited pan name"); assert.doesNotMatch(h.root.innerHTML, /<em>Flavor saved/);
  h.backend.gate.resolve(); await pending;
  assert.equal(h.store.flavorById(id).name, "Edited pan name"); assert.match(h.root.innerHTML, /<em>Flavor saved/);
});

test("duplicate-name checks handle whitespace, case, archived records and transaction retries", async () => {
  const h = await managerHarness({ app: false });
  const first = await h.store.addFlavor({ name: "Rose   Cream" });
  await h.store.setFlavorArchived(first.id, true);
  await assert.rejects(h.store.addFlavor({ name: " rose cream " }), /already exists/);
  const other = await h.store.addFlavor({ name: "Rose cream", allowDuplicate: true }); assert.notEqual(other.id, first.id);
  const retried = copy(h.backend.remote); retried.catalog.push({ ...first, id: "concurrent", name: "Retry flavor" });
  h.backend.retryWith = retried;
  await assert.rejects(h.store.addFlavor({ name: "Retry flavor" }), /already exists/);
});

test("Manager Add warns about duplicates and saves only with explicit confirmation", async () => {
  const h = await managerHarness(); const name = h.store.getState().catalog[0].name;
  await h.click("open-add"); await h.input("add-name", name);
  assert.match(h.root.innerHTML, /This name already exists/);
  await h.click("do-add"); assert.equal(h.backend.writes.length, 0);
  await h.input("add-duplicate", true); await h.click("do-add"); assert.equal(h.backend.writes.length, 1);
});

test("archive refuses occupied pans, retains favorites and can restore the same ID", async () => {
  const h = await managerHarness(); const id = h.store.availableForSwap()[0].id;
  await assert.rejects(h.store.setFlavorArchived(h.store.getState().caseIds[0], true), /Swap this flavor out/);
  await h.click("manage-flavors"); await h.click("edit-flavor", { id }); await h.click("archive-flavor");
  assert.equal(h.backend.writes.length, 0); assert.match(h.root.innerHTML, /Yes, archive flavor/);
  await h.click("confirm-archive");
  assert.equal(h.store.flavorById(id).archived, true); assert.ok(!h.store.availableForSwap().some(f => f.id === id));
  const catalog = copy(h.store.getState().catalog);
  assert.ok(!filterLibrary(catalog).some(f => f.id === id));
  assert.equal(filterLibrary(catalog, { favoritesOnly: true, favorites: [id] })[0].id, id);
  assert.equal(flavorLocation(h.store.getState(), h.store.flavorById(id)), "Archived");
  await assert.rejects(h.store.swapPan(0, id), /no longer available/);
  await h.click("edit-flavor", { id }); await h.click("restore-flavor");
  assert.equal(h.store.flavorById(id).archived, false); assert.ok(h.store.availableForSwap().some(f => f.id === id));
});

test("archive checks the remote pan and undo cannot resurrect an archived flavor", async () => {
  const h = await managerHarness({ app: false }); const id = h.store.availableForSwap()[0].id;
  h.backend.remote.caseIds[0] = id;
  await assert.rejects(h.store.setFlavorArchived(id, true), /Swap this flavor out/);
  const state = fixture(), incoming = state.catalog.find(f => !state.caseIds.includes(f.id));
  const patch = swapPatch(state, 0, incoming.id, state.caseIds[0], "swap");
  const next = { ...state, ...patch, catalog: state.catalog.map(f => f.id === state.caseIds[0] ? { ...f, archived: true } : f) };
  assert.equal(canUndoSwap(next), false);
});

test("sold out persists across midnight, suppresses low labels, and swap/undo restore stock safely", () => {
  const state = fixture(), id = state.caseIds[0], now = Date.parse("2026-10-27T04:59:00Z");
  state.availability[id] = { soldOut: true, runningLow: true, pintsAvailable: true, at: now };
  assert.deepEqual(availabilityFor(state, id, now + 120000), { soldOut: true, runningLow: false, pintsAvailable: false });
  const incoming = state.catalog.find(f => !state.caseIds.includes(f.id));
  const patch = swapPatch(state, 0, incoming.id, id, "swap", now);
  assert.equal(patch.availability[id].soldOut, false); assert.equal(patch.caseUpdatedAt, now);
  const undone = undoPatch({ ...state, ...patch }, "swap", now + 1);
  assert.equal(undone.availability[id].soldOut, true); assert.equal(undone.caseIds.length, 8);
  // A still-undoable swap saved by an older app has no soldOut field.
  delete patch.availability[id].soldOut;
  assert.equal(undoPatch({ ...state, ...patch }, "swap", now + 1).availability[id].runningLow, true);
});

test("Manager swaps and undo normalize missing or malformed stock on all active pans", async () => {
  for (const entry of [undefined, null, false, 0, "stock", [], {}, { soldOut: true, runningLow: true, pintsAvailable: true, at: 123 }]) {
    const remote = fixture(), outgoing = remote.caseIds[0];
    const incoming = remote.catalog.find(f => !remote.caseIds.includes(f.id)).id;
    if (entry !== undefined) remote.availability[incoming] = copy(entry);
    remote.availability[outgoing] = null;
    const kept = remote.caseIds[1];
    remote.availability[kept] = { soldOut: true, pintsAvailable: true, at: 456 };
    remote.availability[remote.caseIds[2]] = { soldOut: "false", pintsAvailable: true };
    const h = await managerHarness({ remote });
    await h.click("tap-pan", { slot: "0" });
    await h.click("pick", { id: incoming });
    await h.click("do-swap");
    assert.equal(h.backend.remote.caseIds[0], incoming);
    assert.equal(h.backend.remote.availability[incoming].soldOut, false);
    if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
      assert.deepEqual(h.backend.remote.availability[incoming], { ...entry, soldOut: false, runningLow: false });
    } else assert.deepEqual(h.backend.remote.availability[incoming], { soldOut: false });
    for (const id of h.backend.remote.caseIds) {
      assert.equal(typeof h.backend.remote.availability[id].soldOut, "boolean", `swap: ${id}`);
      assert.ok(!Array.isArray(h.backend.remote.availability[id]));
    }
    assert.deepEqual(h.backend.remote.availability[kept], remote.availability[kept], "other pan stock stays intact");
    await h.click("undo-swap", { id: h.backend.remote.lastSwap.id });
    assert.equal(h.backend.remote.caseIds[0], outgoing);
    for (const id of h.backend.remote.caseIds) assert.equal(typeof h.backend.remote.availability[id].soldOut, "boolean", `undo: ${id}`);
  }
});

test("undo handles legacy missing stock and malformed saved snapshots without losing newer edits", () => {
  for (const entry of [undefined, null, false, "stock", [], {}, { pintsAvailable: true, runningLow: true, at: 123 }]) {
    const state = fixture(), id = state.caseIds[0];
    const incoming = state.catalog.find(f => !state.caseIds.includes(f.id)).id;
    const patch = swapPatch(state, 0, incoming, id, "legacy", 123);
    const next = { ...state, ...patch, availability: { ...patch.availability } };
    next.lastSwap = { ...patch.lastSwap, previousOutAvailability: entry ?? null };
    if (entry === undefined) delete next.availability[id];
    else next.availability[id] = copy(entry);
    const before = copy(next);
    const undone = undoPatch(next, "legacy", 124);
    for (const active of undone.caseIds) assert.equal(typeof undone.availability[active].soldOut, "boolean");
    assert.deepEqual(next, before, "patch construction does not mutate its input");
    // An older saved snapshot can exist even when returning stock is now missing.
    next.lastSwap.previousOutAvailability = { pintsAvailable: true };
    const legacyUndo = undoPatch(next, "legacy", 124);
    for (const active of legacyUndo.caseIds) assert.equal(typeof legacyUndo.availability[active].soldOut, "boolean");
    const newer = { soldOut: true, pintsAvailable: false, at: 124 };
    next.availability[id] = newer;
    assert.deepEqual(undoPatch(next, "legacy", 125).availability[id], newer);
  }
});

test("new catalog flavors receive boolean stock when Manager puts them in a pan", async () => {
  const h = await managerHarness({ app: false });
  const ids = [...h.backend.remote.caseIds];
  const added = await h.store.addFlavor({ name: "Regression test flavor" });
  assert.deepEqual(h.backend.remote.caseIds, ids, "Add Flavor only edits the catalog");
  await h.store.swapPan(0, added.id, ids[0]);
  for (const id of h.backend.remote.caseIds) assert.equal(typeof h.backend.remote.availability[id].soldOut, "boolean");
});

test("Manager sold-out saves await acknowledgement, reject stale pans and retain eight slots", async () => {
  const h = await managerHarness(); const id = h.store.getState().caseIds[0];
  await h.click("tap-pan", { slot: "0" });
  h.backend.error = failure("unavailable"); await h.change("stock-toggle", true, { id, key: "soldOut" }); await settle();
  assert.equal(availabilityFor(h.store.getState(), id).soldOut, false);
  h.backend.error = null; await h.change("stock-toggle", true, { id, key: "soldOut" }); await settle();
  assert.equal(availabilityFor(h.store.getState(), id).soldOut, true); assert.equal(h.store.getState().caseIds.length, 8);
  await h.click("go-case"); assert.match(h.root.innerHTML, /Sold out/);
  await h.store.setFlavorAvailability(id, "soldOut", false); assert.equal(availabilityFor(h.store.getState(), id).soldOut, false);
  h.backend.remote.caseIds[0] = h.store.availableForSwap()[0].id;
  await assert.rejects(h.store.setFlavorAvailability(id, "soldOut", true), /pan changed/);
});

test("sold-out flavors do not appear in available-only results or carry Just out claims", async () => {
  const remote = fixture(), id = remote.caseIds[0];
  remote.availability[id] = { soldOut: true, at: Date.now() };
  remote.lastSwap = { id: "recent", inId: id, at: Date.now() };
  const h = await managerHarness({ remote }); await h.click("go-case");
  assert.doesNotMatch(h.root.innerHTML, /class="just-out"/);
  const html = libraryHtml(h.store.getState(), { favorites: [] }, { view: "library", inCaseOnly: true });
  assert.ok(!html.includes(`data-id="${id}"`));
  assert.equal(flavorLocation(h.store.getState(), h.store.flavorById(id)), "Sold out");
});

test("Manager saves only valid undo snapshots", async () => {
  for (const stock of ["bad", false, [], {}, { soldOut: "false" }, null, { soldOut: false, pintsAvailable: true }, { soldOut: true }]) {
    const remote = fixture(), outgoing = remote.caseIds[0];
    const incoming = remote.catalog.find(f => !remote.caseIds.includes(f.id)).id;
    remote.availability[outgoing] = stock;
    const h = await managerHarness({ remote, app: false });
    await h.store.swapPan(0, incoming, outgoing);
    const swap = h.backend.remote.lastSwap;
    const valid = stock && !Array.isArray(stock) && typeof stock.soldOut === "boolean";
    assert.deepEqual(swap.previousOutAvailability, valid ? stock : null);
    await h.store.undoLastSwap(swap.id);
    assert.equal(h.backend.remote.caseIds[0], outgoing);
    assert.equal(typeof h.backend.remote.availability[outgoing].soldOut, "boolean");
  }
});

test("undo snapshots reject class instances and retain null-prototype plain stock", () => {
  class Stock { constructor() { this.soldOut = true; } }
  for (const value of [new Stock(), new Date(), Object.assign(Object.create(null), { soldOut: false })]) {
    const state = fixture(), out = state.caseIds[0], incoming = state.catalog.find(f => !state.caseIds.includes(f.id)).id;
    state.availability[out] = value;
    const snapshot = swapPatch(state, 0, incoming, out, "plain").lastSwap.previousOutAvailability;
    assert.deepEqual(snapshot, Object.getPrototypeOf(value) === null ? { soldOut: false } : null);
  }
});

test("same-name dairy variants are separate and same-type duplicates still require confirmation", async () => {
  const h = await managerHarness({ app: false });
  const regular = await h.store.addFlavor({ name: "Birthday Cake", dairyFree: false });
  const df = await h.store.addFlavor({ name: "Birthday Cake", dairyFree: true });
  assert.notEqual(regular.id, df.id);
  for (const dairyFree of [true, false]) await assert.rejects(h.store.addFlavor({ name: " birthday   cake ", dairyFree }), /already exists/);
  await assert.rejects(h.store.editFlavor(df.id, copy(h.store.flavorById(df.id)), { dairyFree: false }), /already exists/);
  await h.store.editFlavor(df.id, copy(h.store.flavorById(df.id)), { note: "Separate dairy-free recipe" });
  await h.store.setFlavorArchived(regular.id, true);
  await assert.rejects(h.store.addFlavor({ name: "Birthday Cake", dairyFree: false }), /already exists/);
  const retry = copy(h.backend.remote);
  retry.catalog.push({ ...df, id: "concurrent-df", name: "Retry cake" });
  h.backend.retryWith = retry;
  await assert.rejects(h.store.addFlavor({ name: "Retry cake", dairyFree: true }), /already exists/);
});

test("Manager dairy-free toggle updates duplicate warnings and swap rows distinguish recipes", async () => {
  const remote = fixture();
  remote.catalog.push({ id: "birthday-regular", name: "Birthday Cake", dairyFree: false, note: "Cake" });
  const h = await managerHarness({ remote });
  await h.click("open-add"); await h.input("add-name", "Birthday Cake");
  assert.match(h.root.innerHTML, /This name already exists/);
  await h.input("add-df", true);
  assert.doesNotMatch(h.root.innerHTML, /This name already exists/);
  await h.input("add-df", false);
  assert.match(h.root.innerHTML, /This name already exists/);
  await h.input("add-df", true); await h.click("do-add");
  const df = h.backend.remote.catalog.find(f => f.name === "Birthday Cake" && f.dairyFree);
  assert.ok(df);
  await h.click("tap-pan", { slot: "0" });
  assert.match(h.root.innerHTML, /Birthday Cake · Dairy-free/);
  await h.click("close-sheet"); await h.click("manage-flavors"); await h.click("edit-flavor", { id: df.id });
  await h.input("edit-df", false);
  assert.match(h.root.innerHTML, /This name already exists/);
  await h.input("edit-df", true);
  assert.doesNotMatch(h.root.innerHTML, /This name already exists/);
});

test("adding a regular version after dairy-free and renaming across variants works", async () => {
  const h = await managerHarness({ app: false });
  await h.store.addFlavor({ name: "Variant test cake", dairyFree: true });
  const regular = await h.store.addFlavor({ name: "Variant test cake", dairyFree: false });
  const other = await h.store.addFlavor({ name: "Another test cake", dairyFree: true });
  await h.store.editFlavor(other.id, copy(h.store.flavorById(other.id)), { name: "Only regular cake" });
  await h.store.editFlavor(regular.id, copy(h.store.flavorById(regular.id)), { name: "Only regular cake" });
  assert.equal(h.store.flavorById(regular.id).dairyFree, false);
});
