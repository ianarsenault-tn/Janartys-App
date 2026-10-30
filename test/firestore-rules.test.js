import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, runTransaction, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { swapPatch, undoPatch } from "../src/case-actions.js";
import { archivePatch } from "../src/catalog-actions.js";
import { addDays, scheduledHoursPatch } from "../src/hours-schedule.js";
import { STAFF_IDENTITIES } from "../push-relay/src/staff-identities.js";

// Never fall back to a live project or an arbitrary remote emulator.
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8087", "Run npm run test:rules; a local emulator is required.");
const staff = STAFF_IDENTITIES;
const now = Date.parse("2026-10-19T15:00:00Z");
const fixture = () => ({
  catalog: Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, name: `Flavor ${i}`, note: "House flavor", story: "House flavor", scoopColor: "#fff", color: null, dairyFree: false, tags: [] })),
  caseIds: Array.from({ length: 8 }, (_, i) => `f${i}`),
  updatedAt: now, lastSwap: null, lastNotice: null, hoursOverride: null,
  instagram: { imageUrl: "", caption: "", permalink: "", handle: "janartys", updatedAt: now },
});
let env;
const auth = (uid, email, extra = {}) => env.authenticatedContext(uid, { ...(email === undefined ? {} : { email }), ...extra }).firestore();
const live = db => doc(db, "shop/live");
const seed = data => env.withSecurityRulesDisabled(context => setDoc(live(context.firestore()), data));

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-janartys-rules",
    firestore: { host: "127.0.0.1", port: 8087, rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
beforeEach(async () => { await env.clearFirestore(); await seed(fixture()); });
after(async () => { await env?.cleanup(); });

test("public readers can read the flavor board but cannot write, merge, transact, or delete", async () => {
  const db = env.unauthenticatedContext().firestore();
  assert.equal((await assertSucceeds(getDoc(live(db)))).data().caseIds.length, 8);
  await assertFails(setDoc(live(db), fixture()));
  await assertFails(setDoc(live(db), { hoursOverride: null }, { merge: true }));
  await assertFails(updateDoc(live(db), { updatedAt: now + 1 }));
  await assertFails(runTransaction(db, async transaction => { await transaction.get(live(db)); transaction.update(live(db), { updatedAt: now + 1 }); }));
  await assertFails(deleteDoc(live(db)));
});

test("new or recreated accounts cannot inherit a staff email's authority", async () => {
  for (const [, email] of staff) {
    for (const verification of [true, false, undefined]) {
      const db = auth("different-account-id", email, verification === undefined ? {} : { email_verified: verification });
      await assertFails(updateDoc(live(db), { updatedAt: now + 1 }));
    }
  }
  await assertFails(updateDoc(live(auth("outsider", "outsider@example.com", { email_verified: true, admin: true, staff: true })), { updatedAt: now + 1 }));
});

test("an approved UID must also have its own exact email", async () => {
  for (const [uid, email] of staff) {
    for (const wrong of [undefined, "outsider@example.com", email.toUpperCase(), staff.find(entry => entry[0] !== uid)[1]]) {
      await assertFails(updateDoc(live(auth(uid, wrong)), { updatedAt: now + 1 }));
    }
  }
});

for (const [uid, email] of staff) {
  test(`${email}: the approved account retains access independent of email-verification state`, async () => {
    for (const verification of [true, false, undefined]) {
      const db = auth(uid, email, verification === undefined ? {} : { email_verified: verification });
      await assertSucceeds(updateDoc(live(db), { updatedAt: now + 1 }));
    }
  });

  test(`${email}: existing partial updates, swap/undo transactions, and stock edits remain valid`, async () => {
    const db = auth(uid, email);
    for (const hoursOverride of [null, { date: "2026-10-19", closed: true }, { date: "2026-10-19", closed: false, open: "11:30", close: "19:00", mode: "close-at" }]) {
      await assertSucceeds(setDoc(live(db), { hoursOverride }, { merge: true }));
    }
    await assertSucceeds(setDoc(live(db), { instagram: { ...fixture().instagram, caption: "Today's update" } }, { merge: true }));
    await assertSucceeds(setDoc(live(db), { catalog: [...fixture().catalog, { ...fixture().catalog[0], id: "new-flavor", name: "New flavor" }], updatedAt: now + 2 }, { merge: true }));
    await assertSucceeds(updateDoc(live(db), { lastNotice: { id: "notice-1", message: "Closing at 7 tonight", at: now } }));
    await assertSucceeds(runTransaction(db, async transaction => {
      const state = (await transaction.get(live(db))).data();
      transaction.update(live(db), swapPatch(state, 0, "f8", "f0", "swap-1", now + 3));
    }));
    await assertSucceeds(runTransaction(db, async transaction => {
      const state = (await transaction.get(live(db))).data();
      transaction.update(live(db), undoPatch(state, "swap-1", now + 4));
    }));
    await assertSucceeds(runTransaction(db, async transaction => {
      const state = (await transaction.get(live(db))).data();
      transaction.update(live(db), { availability: { ...state.availability, f0: { pintsAvailable: true, runningLow: true, at: now + 5 } } });
    }));
    const result = (await getDoc(live(db))).data();
    assert.equal(result.caseIds[0], "f0");
    assert.equal(result.lastSwap.kind, "undo");
    assert.equal(result.availability.f0.pintsAvailable, true);
    assert.equal(result.lastNotice.id, "notice-1");
  });
}

test("swap and undo patches pass rules with missing, null, malformed, and valid incoming stock", async () => {
  for (const identity of staff) {
    const db = auth(...identity), ref = live(db);
    for (const entry of [undefined, null, false, 0, "stock", [], {}, { soldOut: true, runningLow: true, pintsAvailable: true, at: now }]) {
      const initial = fixture();
      initial.availability = { f0: { soldOut: true, pintsAvailable: true, at: now }, f1: { soldOut: true, at: now } };
      if (entry !== undefined) initial.availability.f8 = entry;
      await seed(initial);
      // Missing entries are already legal; explicit null/non-map entries are not.
      const caseIds = ["f8", ...initial.caseIds.slice(1)];
      if (entry !== undefined && (entry === null || typeof entry !== "object" || Array.isArray(entry))) {
        await assertFails(updateDoc(ref, { caseIds }));
      }
      await assertSucceeds(runTransaction(db, async transaction => {
        const state = (await transaction.get(ref)).data();
        transaction.update(ref, swapPatch(state, 0, "f8", "f0", "stock-swap", now));
      }));
      const swapped = (await getDoc(ref)).data();
      for (const id of swapped.caseIds) assert.equal(typeof swapped.availability[id].soldOut, "boolean");
      assert.equal(swapped.availability.f8.soldOut, false);
      assert.deepEqual(swapped.availability.f1, initial.availability.f1);
      await assertSucceeds(runTransaction(db, async transaction => {
        const state = (await transaction.get(ref)).data();
        transaction.update(ref, undoPatch(state, "stock-swap", now + 1));
      }));
      const undone = (await getDoc(ref)).data();
      for (const id of undone.caseIds) assert.equal(typeof undone.availability[id].soldOut, "boolean");
      assert.deepEqual(undone.availability.f0, initial.availability.f0, "valid saved sold-out and pint labels are restored");
    }
  }
});

test("legacy undo repairs absent or malformed returning stock before rules evaluate active pans", async () => {
  const db = auth(...staff[0]), ref = live(db);
  for (const entry of [undefined, null, false, "stock", [], { pintsAvailable: true, at: now }]) {
    const initial = fixture();
    const swapped = { ...initial, ...swapPatch(initial, 0, "f8", "f0", "legacy", now) };
    swapped.lastSwap.previousOutAvailability = entry ?? null;
    if (entry === undefined) delete swapped.availability.f0;
    else swapped.availability.f0 = entry;
    await seed(swapped);
    await assertSucceeds(runTransaction(db, async transaction => {
      const state = (await transaction.get(ref)).data();
      transaction.update(ref, undoPatch(state, "legacy", now + 1));
    }));
    const saved = (await getDoc(ref)).data();
    assert.equal(saved.caseIds[0], "f0");
    for (const id of saved.caseIds) assert.equal(typeof saved.availability[id].soldOut, "boolean");
  }
});

test("only approved accounts may create a missing live board", async () => {
  for (const [uid, email] of staff) {
    await env.clearFirestore();
    await assertFails(setDoc(live(env.unauthenticatedContext().firestore()), fixture()));
    await assertFails(setDoc(live(auth("replacement-id", email)), fixture()));
    await assertSucceeds(setDoc(live(auth(uid, email)), fixture()));
  }
});

test("dated hours pass shape checks while anonymous schedule writes remain denied", async () => {
  const patch = { scheduledHours: { "2026-12-25": { closed: true }, "2026-12-24": { closed: false, open: "10:00", close: "16:00" } }, updatedAt: now };
  await assertFails(updateDoc(live(env.unauthenticatedContext().firestore()), patch));
  for (const identity of staff) {
    const db = auth(...identity);
    await assertSucceeds(updateDoc(live(db), patch));
    assert.deepEqual((await getDoc(live(db))).data().scheduledHours, patch.scheduledHours);
    await assertSucceeds(updateDoc(live(db), { scheduledHours: {} }));
  }
});

test("optional case freshness, sold-out and archive fields preserve staff authorization", async () => {
  const db = auth(...staff[0]);
  const catalog = fixture().catalog.map(f => f.id === "f8" ? { ...f, archived: true } : f);
  const patch = { catalog, caseUpdatedAt: now, availability: { f0: { soldOut: true, pintsAvailable: false, runningLow: false, at: now } } };
  await assertFails(updateDoc(live(env.unauthenticatedContext().firestore()), patch));
  await assertSucceeds(updateDoc(live(db), patch));
  const saved = (await getDoc(live(db))).data();
  assert.equal(saved.caseUpdatedAt, now);
  assert.equal(saved.availability.f0.soldOut, true);
  assert.equal(saved.catalog.find(f => f.id === "f8").archived, true);
});

test("scheduled hours allow zero through 60 entries and reject wrong types or 61 entries", async () => {
  const ref = live(auth(...staff[0]));
  const schedule = count => Object.fromEntries(Array.from({ length: count }, (_, i) => [addDays("2026-10-19", i), { closed: true }]));
  for (const scheduledHours of [{}, schedule(60)]) await assertSucceeds(updateDoc(ref, { scheduledHours }));
  for (const scheduledHours of [schedule(61), null, [], "hours", 42, true]) await assertFails(updateDoc(ref, { scheduledHours }));
  await assertSucceeds(updateDoc(ref, { scheduledHours: deleteField() }));
});

test("case freshness must be numeric when present, with missing legacy values still valid", async () => {
  const ref = live(auth(...staff[0]));
  for (const caseUpdatedAt of [0, now, now + 0.5]) await assertSucceeds(updateDoc(ref, { caseUpdatedAt }));
  for (const caseUpdatedAt of [String(now), null, false, [], {}]) await assertFails(updateDoc(ref, { caseUpdatedAt }));
  await assertSucceeds(updateDoc(ref, { caseUpdatedAt: deleteField() }));
});

test("stock map is bounded and soldOut is boolean for every active pan", async () => {
  const ref = live(auth(...staff[0]));
  for (const id of fixture().caseIds) {
    for (const soldOut of [true, false]) await assertSucceeds(updateDoc(ref, { availability: { [id]: { soldOut, at: now } } }));
    for (const soldOut of [null, "false", 0, [], {}]) await assertFails(updateDoc(ref, { availability: { [id]: { soldOut } } }));
    await assertSucceeds(updateDoc(ref, { availability: { [id]: { at: now } } }));
    await assertFails(updateDoc(ref, { availability: { [id]: null } }));
  }
  const stock = count => Object.fromEntries(Array.from({ length: count }, (_, i) => [`f${i}`, { soldOut: false }]));
  await assertSucceeds(updateDoc(ref, { availability: stock(500) }));
  for (const availability of [stock(501), null, [], "stock", false]) await assertFails(updateDoc(ref, { availability }));
  await assertSucceeds(updateDoc(ref, { availability: deleteField() }));
});

test("current app patches pass together without rewriting a sparse legacy document", async () => {
  for (const identity of staff) {
    const ref = live(auth(...identity));
    const current = fixture();
    Object.assign(current, scheduledHoursPatch(current, "2026-10-19", { closed: false, open: "11:30", close: "19:00" }, null, "2026-10-19", now));
    Object.assign(current, archivePatch(current, "f9", true, now));
    Object.assign(current, { availability: { f0: { soldOut: true, runningLow: false, pintsAvailable: true, at: now } }, instagram: { ...current.instagram, source: "manual" } });
    Object.assign(current, swapPatch(current, 0, "f8", "f0", "shape-swap", now));
    await assertSucceeds(setDoc(ref, current));
    await assertSucceeds(updateDoc(ref, undoPatch(current, "shape-swap", now + 1)));
    await assertSucceeds(updateDoc(ref, archivePatch(current, "f9", false, now + 2)));
    await assertSucceeds(updateDoc(ref, { lastNotice: { message: "Open today" } }));
    assert.equal((await getDoc(ref)).data().availability.f0.soldOut, true);
    // The app's archive writer emits booleans; rules cannot iterate all catalog entries.
    for (const input of [true, false, "false", null, 1]) {
      assert.equal(typeof archivePatch(fixture(), "f9", input, now).catalog[9].archived, "boolean");
    }
  }
});

test("Instagram source is absent or manual, never a malformed or automatic marker", async () => {
  const ref = live(auth(...staff[0]));
  for (const source of [null, false, 7, [], {}, "", "auto", "oauth", "x".repeat(100)]) {
    await assertFails(updateDoc(ref, { instagram: { ...fixture().instagram, source } }));
  }
  await assertSucceeds(updateDoc(ref, { instagram: { ...fixture().instagram, source: "manual" } }));
  await assertSucceeds(updateDoc(ref, { instagram: fixture().instagram }));
});

test("staff cannot delete the board, remove required fields, or save invalid board shapes", async () => {
  const db = auth(...staff[0]);
  await assertFails(deleteDoc(live(db)));
  for (const patch of [
    { catalog: deleteField() }, { caseIds: [] }, { caseIds: "invalid" },
    { updatedAt: "invalid" }, { catalog: {} }, { catalog: Array(501).fill({ id: "x" }) },
  ]) await assertFails(updateDoc(live(db), patch));
});

test("sibling documents, subcollections, and mixed batches remain denied for all callers", async () => {
  for (const db of [env.unauthenticatedContext().firestore(), ...staff.map(pair => auth(...pair))]) {
    for (const path of ["shop/other", "shop/live/private/x", "users/admin"]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { allowed: true }));
    }
    const batch = writeBatch(db);
    batch.update(live(db), { updatedAt: now + 99 });
    batch.set(doc(db, "shop/other"), { allowed: true });
    await assertFails(batch.commit());
    assert.equal((await getDoc(live(db))).data().updatedAt, now);
  }
});

test("every case slot requires a nonempty string", async () => {
  const db = auth(...staff[0]);
  for (let slot = 0; slot < 8; slot++) {
    for (const value of ["", null, 12, false, {}]) {
      const caseIds = [...fixture().caseIds];
      caseIds[slot] = value;
      await assertFails(updateDoc(live(db), { caseIds }));
    }
  }
});

test("Instagram rejects malformed maps and wrong field types", async () => {
  const db = auth(...staff[0]);
  for (const instagram of ["invalid", [], 42, true]) {
    await assertFails(updateDoc(live(db), { instagram }));
  }
  for (const field of ["imageUrl", "caption", "permalink", "handle"]) {
    for (const value of [null, 42, false, [], {}]) {
      await assertFails(updateDoc(live(db), { instagram: { ...fixture().instagram, [field]: value } }));
    }
  }
  await assertFails(updateDoc(live(db), { instagram: { ...fixture().instagram, updatedAt: "invalid" } }));
});

test("narrow shape checks preserve sparse catalogs, optional Instagram fields, and partial writes", async () => {
  const db = auth(...staff[0]);
  for (const instagram of [null, {}, { imageUrl: "", caption: "", permalink: "", handle: "janartys" }, fixture().instagram, { ...fixture().instagram, source: "manual" }]) {
    await assertSucceeds(updateDoc(live(db), { instagram, catalog: [{ id: "f0", name: "Legacy flavor", color: null }] }));
    await assertSucceeds(updateDoc(live(db), { lastNotice: { id: "notice", message: "Open", at: now } }));
    await assertSucceeds(updateDoc(live(db), { hoursOverride: null }));
  }
});

test("notices reject malformed messages and enforce the 100-character boundary", async () => {
  const db = auth(...staff[0]);
  for (const lastNotice of ["invalid", [], 42, true, ...[null, 42, false, [], {}, "x".repeat(101)].map(message => ({ message }))]) {
    await assertFails(updateDoc(live(db), { lastNotice }));
  }
  for (const lastNotice of [null, {}, { message: "" }, { message: "🍦".repeat(50) }, { id: "notice", message: "x".repeat(100), at: now }]) {
    await assertSucceeds(updateDoc(live(db), { lastNotice }));
    await assertSucceeds(updateDoc(live(db), { updatedAt: now + 1 }));
  }
});

test("hours overrides reject non-maps and incorrectly typed fields", async () => {
  const db = auth(...staff[0]);
  for (const hoursOverride of ["invalid", [], 42, true]) {
    await assertFails(updateDoc(live(db), { hoursOverride }));
  }
  for (const field of ["date", "open", "close", "mode"]) {
    for (const value of [null, 42, false, [], {}]) {
      await assertFails(updateDoc(live(db), { hoursOverride: { [field]: value } }));
    }
  }
  for (const closed of [null, "false", 0, [], {}]) {
    await assertFails(updateDoc(live(db), { hoursOverride: { date: "2026-10-23", closed } }));
  }
});

test("nullable and sparse hours overrides remain compatible with unrelated updates", async () => {
  const db = auth(...staff[0]);
  for (const hoursOverride of [
    null, {}, { date: "2026-10-23" }, { date: "2026-10-23", closed: true },
    { date: "2026-10-23", closed: false, open: "11:30", close: "21:00" },
    { date: "2026-10-23", closed: false, open: "11:30", close: "19:00", mode: "close-at" },
  ]) {
    await assertSucceeds(updateDoc(live(db), { hoursOverride }));
    await assertSucceeds(updateDoc(live(db), { lastNotice: { message: "Open today", at: now }, updatedAt: now + 1 }));
  }
});

test("undo snapshot allows absent, null and maps but rejects malformed values", async () => {
  const ref = live(auth(...staff[0]));
  for (const lastSwap of [null, {}, { previousOutAvailability: null }, { previousOutAvailability: { soldOut: false } }, { previousOutAvailability: { soldOut: true } }]) await assertSucceeds(updateDoc(ref, { lastSwap }));
  for (const snapshot of [{}, "bad", false, [], { soldOut: "false" }, { soldOut: null }]) await assertFails(updateDoc(ref, { lastSwap: { previousOutAvailability: snapshot } }));
});
