import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, runTransaction, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { swapPatch, undoPatch } from "../src/case-actions.js";
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

test("only approved accounts may create a missing live board", async () => {
  for (const [uid, email] of staff) {
    await env.clearFirestore();
    await assertFails(setDoc(live(env.unauthenticatedContext().firestore()), fixture()));
    await assertFails(setDoc(live(auth("replacement-id", email)), fixture()));
    await assertSucceeds(setDoc(live(auth(uid, email)), fixture()));
  }
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
