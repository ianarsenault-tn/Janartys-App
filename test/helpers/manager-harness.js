import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { webcrypto } from "node:crypto";
import { SEED_CATALOG, SEED_CASE, SEED_INSTAGRAM, STORAGE_KEY } from "../../src/data.js";

export const copy = value => JSON.parse(JSON.stringify(value));
export const settle = () => new Promise(resolve => setImmediate(resolve));
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export const failure = code => Object.assign(new Error(code), { code });
export function fixture() {
  return {
    catalog: copy(SEED_CATALOG), caseIds: [...SEED_CASE], updatedAt: 1,
    lastSwap: null, lastNotice: null, hoursOverride: null,
    instagram: copy(SEED_INSTAGRAM), availability: {},
  };
}

function events() {
  const handlers = new Map();
  return {
    addEventListener(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    dispatchEvent(event) { for (const fn of handlers.get(event.type) || []) fn(event); },
    async fire(type, event = {}) { for (const fn of handlers.get(type) || []) await fn(event); },
  };
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

// Execute the real ES modules and event handlers. Only external services,
// layout/focus APIs, and the clock are substituted; no production source rewrite
// or live Firebase initialization is involved.
export async function managerHarness({ remote = fixture(), cache, signedIn = true, app = true } = {}) {
  const root = {
    ...events(), innerHTML: "", querySelector: () => null, querySelectorAll: () => [],
    classList: { toggle() {}, add() {}, remove() {} },
  };
  const window = { ...events(), matchMedia: () => ({ matches: true }) };
  const document = { ...events(), activeElement: null, querySelector: selector => selector === "#app" ? root : null };
  const localStorage = storage(cache ? { [STORAGE_KEY]: JSON.stringify(cache) } : {});
  const sessionStorage = storage();
  const location = { hash: "#/staff" };
  const navigator = { onLine: true };
  const timers = new Map();
  let timerId = 0, snapshot;
  const schedule = (fn, ms, interval = false) => { timers.set(++timerId, { fn, ms, interval }); return timerId; };
  const backend = {
    remote: copy(remote), writes: [], attempts: [], gate: null, error: null, retryWith: null,
    signedIn, signOutError: null, signOutCalls: 0,
  };
  function emitSnapshot(data = backend.remote, metadata = {}) {
    snapshot?.({ exists: () => Boolean(data), data: () => copy(data), metadata: { fromCache: false, hasPendingWrites: false, ...metadata } });
  }
  const firestore = {
    doc: () => ({}),
    onSnapshot: (_ref, _options, callback) => { snapshot = callback; return () => {}; },
    async runTransaction(_db, callback) {
      const run = async () => {
        let patch;
        const result = await callback({
          get: async () => ({ exists: () => Boolean(backend.remote), data: () => copy(backend.remote) }),
          update: (_ref, value) => { patch = copy(value); },
        });
        backend.attempts.push(patch);
        return { result, patch };
      };
      let attempt = await run();
      if (backend.gate) await backend.gate.promise;
      if (backend.error) throw backend.error;
      if (backend.retryWith) {
        backend.remote = copy(backend.retryWith);
        backend.retryWith = null;
        attempt = await run();
      }
      backend.remote = { ...backend.remote, ...attempt.patch };
      backend.writes.push(attempt.patch);
      emitSnapshot();
      return attempt.result;
    },
    async updateDoc(_ref, patch) {
      if (backend.gate) await backend.gate.promise;
      if (backend.error) throw backend.error;
      backend.remote = { ...backend.remote, ...copy(patch) };
      backend.writes.push(copy(patch));
      emitSnapshot();
    },
  };
  const noop = () => {};
  const stubs = {
    "firebase/firestore": firestore,
    "firebase.js": { db: {} },
    "staff-auth.js": {
      isStaffSignedIn: () => backend.signedIn,
      whenAuthReady: async () => {},
      signInStaff: async () => { backend.signedIn = true; },
      signOutStaff: async () => {
        backend.signOutCalls++;
        if (backend.signOutError) throw backend.signOutError;
        backend.signedIn = false;
      },
      resetStaffPassword: async () => {}, staffAuthErrorMessage: () => "Sign-in failed", staffResetMessage: () => "Check email",
    },
    "sheet-interactions.js": { setupSheetInteractions: noop },
    "feedback.js": { tapFeedback: async () => {} },
    "flavor-name-fit.js": { fitFlavorNames: noop, setupFlavorNameFitting: noop },
    "notifications.js": {
      enableNotifications: noop, disableNotifications: noop, initializeNotifications: async () => {},
      notificationStatus: () => ({}), subscribeNotifications: noop, publishShopEvent: async () => "Saved. Push is not enabled.",
    },
  };
  const context = createContext({
    window, document, localStorage, sessionStorage, location, navigator,
    history: { replaceState: (_state, _title, hash) => { location.hash = hash; } },
    crypto: webcrypto, URL, console,
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    requestAnimationFrame: fn => fn(),
    setTimeout: (fn, ms) => schedule(fn, ms), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, true), clearInterval: id => timers.delete(id),
  });
  const modules = new Map();
  const base = new URL("../../src/", import.meta.url);
  async function moduleFor(identifier) {
    if (modules.has(identifier)) return modules.get(identifier);
    const key = identifier.startsWith("file:") ? identifier.split("/").pop() : identifier;
    const stub = identifier.endsWith(".css") ? {} : stubs[key];
    const module = stub
      ? new SyntheticModule(Object.keys(stub), function () { for (const [name, value] of Object.entries(stub)) this.setExport(name, value); }, { context, identifier })
      : new SourceTextModule(await readFile(new URL(identifier), "utf8"), { context, identifier });
    modules.set(identifier, module);
    return module;
  }
  const linker = (specifier, ref) => moduleFor(specifier.startsWith(".") ? new URL(specifier, ref.identifier).href : specifier);
  async function load(name) {
    const module = await moduleFor(new URL(name, base).href);
    if (module.status === "unlinked") await module.link(linker);
    if (module.status === "linked") await module.evaluate();
    return module.namespace;
  }
  const store = await load("store.js");
  emitSnapshot();
  if (app) { await load("app.js"); await settle(); }
  const dispatch = (type, act, value, data = {}) => {
    const target = {
      value, checked: value, dataset: { act, ...data },
      getAttribute: name => name === "data-act" ? act : name.startsWith("data-") ? data[name.slice(5)] : null,
      closest: selector => selector === "[data-act]" ? target : null,
    };
    return root.fire(type, { target, preventDefault() {} });
  };
  return {
    store, backend, root, window, document, location, navigator, localStorage, sessionStorage, timers,
    emitSnapshot, load,
    click: (act, data) => dispatch("click", act, undefined, data),
    input: (act, value) => dispatch("input", act, value),
    change: (act, value, data) => dispatch("change", act, value, data),
    submit: act => dispatch("submit", act),
    async fireTimer(ms, interval = false) {
      for (const [id, timer] of [...timers]) if (timer.ms === ms && timer.interval === interval) {
        if (!interval) timers.delete(id);
        await timer.fn();
      }
      await settle();
    },
  };
}
