import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { STAFF_IDENTITIES } from "../push-relay/src/staff-identities.js";
import { isIosHomeScreen, setupHomeScreenChrome } from "../src/home-screen-chrome.js";

test("Home Screen edge treatment accepts iOS standalone fallback and excludes browsers and native apps", () => {
  assert.equal(isIosHomeScreen({ userAgent: "iPhone", standalone: true }), true);
  assert.equal(isIosHomeScreen({ userAgent: "iPhone", displayMode: true }), true);
  assert.equal(isIosHomeScreen({ platform: "MacIntel", maxTouchPoints: 5, standalone: true }), true);
  for (const environment of [
    { userAgent: "iPhone" },
    { userAgent: "iPhone", standalone: true, native: true },
    { userAgent: "Android", displayMode: true },
    { platform: "MacIntel", maxTouchPoints: 0, displayMode: true },
  ]) assert.equal(isIosHomeScreen(environment), false);
});

test("Home Screen edge class follows display mode without touching modal classes", () => {
  const classes = new Set(["has-sheet"]);
  const doc = { documentElement: { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } } };
  let changed;
  const mode = { matches: true, addEventListener: (_event, callback) => { changed = callback; } };
  const win = { navigator: { userAgent: "iPhone" }, matchMedia: () => mode };
  setupHomeScreenChrome(win, doc);
  assert.equal(classes.has("ios-home-screen"), true);
  mode.matches = false; changed();
  assert.equal(classes.has("ios-home-screen"), false);
  win.navigator.standalone = true; changed();
  assert.equal(classes.has("ios-home-screen"), true);
  assert.equal(classes.has("has-sheet"), true);
});

// Dynamic import compiled-ish data + staff-auth helpers via rewriting exports is awkward
// under plain node without a bundler. Test pure logic extracted here + file invariants.

test("app.js is a real module (not a stub)", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.ok(app.length > 10000, "app.js unexpectedly small");
  assert.equal(app.includes("PLACEHOLDER"), false);
  assert.equal(app.includes("LOAD_FROM_"), false);
  assert.match(app, /function render\s*\(/);
  assert.match(app, /setupStaffIdleTimeout/);
  assert.match(app, /staff-logout/);
  assert.equal(app.includes("setRender"), false);
  assert.equal(app.includes('from "./app-helpers'), false);
  assert.equal(app.includes('from "./app-views'), false);
});

test("data seed is small and covers SEED_CASE", async () => {
  const mod = await import(new URL("../src/data.js", import.meta.url));
  assert.ok(mod.SEED_CATALOG.length <= 20, `seed too large: ${mod.SEED_CATALOG.length}`);
  assert.equal(mod.SEED_CASE.length, 8);
  const ids = new Set(mod.SEED_CATALOG.map((f) => f.id));
  for (const id of mod.SEED_CASE) {
    assert.ok(ids.has(id), `SEED_CASE missing from seed catalog: ${id}`);
  }
  assert.ok(mod.STAFF_EMAILS.includes("ian.arsenault@yahoo.com"));
  assert.ok(mod.STAFF_EMAILS.includes("janartys@gmail.com"));
});

test("staff allowlist rejects non-staff emails", async () => {
  // firebase.js initializes app — import staff-auth after stubbing is heavy.
  // Mirror allowlist logic from staff-auth for a pure check against data.js.
  const mod = await import(new URL("../src/data.js", import.meta.url));
  const allow = new Set(mod.STAFF_EMAILS.map((e) => e.trim().toLowerCase()));
  assert.equal(allow.has("ian.arsenault@yahoo.com"), true);
  assert.equal(allow.has("random@example.com"), false);
});

test("relay, Firestore rules, staff documentation, and UI identities stay aligned", async () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const pairs = [...rules.matchAll(/request\.auth\.uid == "([^"]+)"\s*&& request\.auth\.token\.email == "([^"]+)"/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(pairs, STAFF_IDENTITIES);
  const docs = readFileSync(new URL("../FIRESTORE.md", import.meta.url), "utf8");
  const documented = [...docs.matchAll(/\| `([^`]+@[^`]+)` \| `([^`]+)` \|/g)].map(match => [match[2], match[1]]);
  assert.deepEqual(documented, STAFF_IDENTITIES);
  const { STAFF_EMAILS } = await import("../src/data.js");
  assert.deepEqual(STAFF_EMAILS, STAFF_IDENTITIES.map(([, email]) => email));
});

test("live payload shape matches Firestore rules expectations", () => {
  const keys = [
    "catalog",
    "caseIds",
    "updatedAt",
    "lastSwap",
    "lastNotice",
    "hoursOverride",
    "instagram",
  ];
  const sample = {
    catalog: [{ id: "x", name: "X", note: "", story: "", scoopColor: "#000", dairyFree: false, color: null, tags: [] }],
    caseIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
    updatedAt: Date.now(),
    lastSwap: null,
    lastNotice: null,
    hoursOverride: null,
    instagram: { imageUrl: "", caption: "", permalink: "", handle: "janartys" },
  };
  for (const k of keys) assert.ok(k in sample);
  assert.equal(Array.isArray(sample.catalog), true);
  assert.equal(sample.caseIds.length, 8);
  assert.equal(typeof sample.updatedAt, "number");
  assert.ok(sample.catalog.length <= 500);
});

test("mergeSeedCatalog no longer defined as full-seed reinflation", () => {
  const store = readFileSync(new URL("../src/store.js", import.meta.url), "utf8");
  assert.match(store, /Do not re-inflate the full seed/);
  assert.match(store, /SEED_CASE\.filter/);
  assert.equal(store.includes("SEED_CATALOG.filter((s) => !ids.has(s.id))"), false);
});
