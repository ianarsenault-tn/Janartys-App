import {
  doc,
  onSnapshot,
  setDoc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { availabilityFor, swapPatch, undoPatch } from "./case-actions.js";
import {
  HOURS_DETAIL,
  SEED_CATALOG,
  SEED_CASE,
  SEED_HOURS,
  SEED_INSTAGRAM,
  SHOP_TZ,
  STORAGE_KEY,
} from "./data.js";
import { db } from "./firebase.js";

const listeners = new Set();

const LIVE_REF = doc(db, "shop", "live");

const syncStatus = {
  live: false,
  writeError: null,
};

export function getSyncStatus() {
  return syncStatus;
}


const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function cloneInstagram(ig = SEED_INSTAGRAM) {
  return {
    imageUrl: ig.imageUrl,
    caption: ig.caption,
    permalink: ig.permalink,
    handle: ig.handle || SEED_INSTAGRAM.handle,
    updatedAt: ig.updatedAt || Date.now(),
  };
}

function mergeSeedCatalog(catalog) {
  // Do not re-inflate the full seed into Firestore. Only backfill flavors
  // referenced by the current case if a document is missing them.
  const ids = new Set(catalog.map((f) => f.id));
  const needed = SEED_CASE.filter((id) => !ids.has(id));
  const extra = needed
    .map((id) => SEED_CATALOG.find((s) => s.id === id))
    .filter(Boolean)
    .map((f) => ({
      ...f,
      tags: Array.isArray(f.tags) ? [...f.tags] : [],
    }));
  const next = extra.length ? [...catalog, ...extra] : [...catalog];
  next.sort(byFlavorName);
  return { catalog: next, added: extra.length };
}

function hydrateFlavor(f) {
  const seed = SEED_CATALOG.find((s) => s.id === f.id);
  if (!seed) {
    return {
      ...f,
      story: f.story || f.note || "A house flavor.",
      tags: Array.isArray(f.tags) ? f.tags : [],
    };
  }
  return {
    ...f,
    name: seed.name,
    note: seed.note,
    story: seed.story,
    scoopColor: f.scoopColor || seed.scoopColor,
    dairyFree: seed.dairyFree,
    tags: Array.isArray(seed.tags) ? [...seed.tags] : [],
  };
}

function seedState() {
  return {
    catalog: SEED_CATALOG.map((f) => ({
      ...f,
      tags: Array.isArray(f.tags) ? [...f.tags] : [],
    })).sort(byFlavorName),
    caseIds: [...SEED_CASE],
    updatedAt: Date.now(),
    lastSwap: null,
    lastNotice: null,
    instagram: cloneInstagram(SEED_INSTAGRAM),
    hoursOverride: null,
    availability: {},
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.catalog) || !Array.isArray(parsed.caseIds)) {
      return seedState();
    }
    if (parsed.caseIds.length !== 8) return seedState();
    const merged = mergeSeedCatalog(parsed.catalog.map(hydrateFlavor));
    return {
      catalog: merged.catalog,
      caseIds: parsed.caseIds,
      updatedAt: parsed.updatedAt || Date.now(),
      lastSwap: parsed.lastSwap || null,
      lastNotice: parsed.lastNotice || null,
      instagram: parsed.instagram
        ? cloneInstagram(parsed.instagram)
        : cloneInstagram(SEED_INSTAGRAM),
      hoursOverride: parsed.hoursOverride ?? null,
      availability: parsed.availability || {},
    };
  } catch {
    return seedState();
  }
}

let state = load();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* A failed optional cache must not turn a successful server save into a failure. */ }
}

function emit() {
  for (const fn of listeners) fn(state);
}

function livePayload() {
  return {
    catalog: state.catalog.map((f) => ({
      id: f.id,
      name: f.name,
      note: f.note || "",
      story: f.story || f.note || "",
      scoopColor: f.scoopColor || "",
      dairyFree: Boolean(f.dairyFree),
      color: f.color || null,
      tags: Array.isArray(f.tags) ? f.tags : [],
    })),
    caseIds: [...state.caseIds],
    updatedAt: state.updatedAt || Date.now(),
    lastSwap: state.lastSwap || null,
    lastNotice: state.lastNotice || null,
    hoursOverride: state.hoursOverride || null,
    instagram: cloneInstagram(state.instagram),
    availability: state.availability || {},
  };
}

function applyRemote(data) {
  if (!data || !Array.isArray(data.catalog) || !Array.isArray(data.caseIds)) {
    return false;
  }
  if (data.caseIds.length !== 8) return false;
  const prevSwapAt = state.lastSwap?.at || 0;
  const prevNoticeAt = state.lastNotice?.at || 0;
  const merged = mergeSeedCatalog(data.catalog.map(hydrateFlavor));
  state = {
    catalog: merged.catalog,
    caseIds: data.caseIds,
    updatedAt: data.updatedAt || Date.now(),
    lastSwap: data.lastSwap || null,
    lastNotice: data.lastNotice || null,
    instagram: data.instagram
      ? cloneInstagram(data.instagram)
      : cloneInstagram(SEED_INSTAGRAM),
    hoursOverride: data.hoursOverride ?? null,
    availability: data.availability || {},
  };
  persist();
  emit();
  if (state.lastSwap && state.lastSwap.at !== prevSwapAt) {
    window.dispatchEvent(
      new CustomEvent("janartys-remote-swap", { detail: state.lastSwap })
    );
  }
  if (state.lastNotice && state.lastNotice.at !== prevNoticeAt) {
    window.dispatchEvent(
      new CustomEvent("janartys-remote-notice", { detail: state.lastNotice })
    );
  }
  return true;
}

async function pushLive(patch = livePayload()) {
  try {
    await setDoc(LIVE_REF, patch, { merge: true });
    if (syncStatus.writeError) {
      syncStatus.writeError = null;
      emit();
    }
  } catch (err) {
    syncStatus.writeError = err;
    emit();
  }
}

function persistLocalAndPush(patch) {
  persist();
  emit();
  pushLive(patch);
}

function startLiveSync() {
  try {
    if (typeof window !== "undefined" && window.__janartysLiveUnsub) {
      window.__janartysLiveUnsub();
    }
    const unsub = onSnapshot(
      LIVE_REF,
      { includeMetadataChanges: true },
      (snap) => {
        const wasLive = syncStatus.live;
        syncStatus.live = !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        if (!snap.exists()) {
          if (wasLive !== syncStatus.live) emit();
          return;
        }
        applyRemote(snap.data());
        if (wasLive !== syncStatus.live) emit();
      },
      () => {
        if (syncStatus.live) {
          syncStatus.live = false;
          emit();
        }
      }
    );
    if (typeof window !== "undefined") window.__janartysLiveUnsub = unsub;
  } catch {
    syncStatus.live = false;
  }
}

startLiveSync();
window.addEventListener("offline", () => {
  syncStatus.live = false;
  emit();
});

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function flavorById(id) {
  return state.catalog.find((f) => f.id === id) || null;
}

export function caseFlavors() {
  return state.caseIds.map((id) => flavorById(id)).filter(Boolean);
}

export function getInstagram() {
  return state.instagram || cloneInstagram(SEED_INSTAGRAM);
}

export function setInstagram({ imageUrl, caption, permalink }) {
  const prev = getInstagram();
  const nextUrl = String(imageUrl ?? "").trim();
  const nextCap = String(caption ?? "").trim();
  const nextLink = String(permalink ?? "").trim();
  state = {
    ...state,
    instagram: {
      imageUrl: nextUrl || SEED_INSTAGRAM.imageUrl,
      caption: nextCap,
      permalink: nextLink || SEED_INSTAGRAM.permalink,
      handle: prev.handle || SEED_INSTAGRAM.handle,
      updatedAt: Date.now(),
    },
  };
  persistLocalAndPush({ instagram: state.instagram });
}

export function resetInstagram() {
  state = {
    ...state,
    instagram: cloneInstagram({ ...SEED_INSTAGRAM, updatedAt: Date.now() }),
  };
  persistLocalAndPush({ instagram: state.instagram });
}

export function chicagoNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    weekday: weekdayMap[get("weekday")],
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute: Number(get("minute")),
    minutes: hour * 60 + Number(get("minute")),
  };
}

export function chicagoDate(date = new Date()) {
  return chicagoNow(date).date;
}

function parseMinutes(hhmm) {
  const [h, m] = String(hhmm)
    .split(":")
    .map((n) => Number(n));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function formatClock(hhmm) {
  const [hStr, mStr] = String(hhmm).split(":");
  let h = Number(hStr);
  const m = Number(mStr) || 0;
  if (!Number.isFinite(h)) return hhmm;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function activeOverride(clock) {
  const o = state.hoursOverride;
  if (!o || o.date !== clock.date) return null;
  return o;
}

function windowFor(clock) {
  const override = activeOverride(clock);
  if (override) {
    if (override.closed) {
      return { closed: true, forced: true, open: null, close: null };
    }
    return {
      closed: false,
      forced: true,
      open: override.open || "11:30",
      close: override.close || "21:00",
    };
  }
  const weekly = SEED_HOURS[clock.weekday];
  if (!weekly) return { closed: true, forced: false, open: null, close: null };
  return { closed: false, forced: false, open: weekly[0], close: weekly[1] };
}

function nextOpen(clock) {
  for (let i = 0; i < 8; i++) {
    const day = (clock.weekday + i) % 7;
    const hours = SEED_HOURS[day];
    if (!hours) continue;
    if (i === 0) {
      if (clock.minutes < parseMinutes(hours[0])) {
        return { weekday: day, open: hours[0], today: true };
      }
      continue;
    }
    return { weekday: day, open: hours[0], today: false };
  }
  return { weekday: 3, open: "11:30", today: false };
}

export function getHoursOverride(date = new Date()) {
  const clock = chicagoNow(date);
  return activeOverride(clock);
}

export function hoursMode(date = new Date()) {
  const o = getHoursOverride(date);
  if (!o) return "normal";
  if (o.closed) return "closed";
  if (o.mode === "close-at") return "early";
  if (o.close && o.close !== "21:00") return "early";
  return "open";
}

export function getShopStatus(nowDate = new Date()) {
  const clock = chicagoNow(nowDate);
  const win = windowFor(clock);
  const detail = HOURS_DETAIL;
  const todayLine = win.closed
    ? "Today: Closed"
    : `Today: ${formatClock(win.open)}–${formatClock(win.close)}`;

  if (win.closed && win.forced) {
    return {
      open: false,
      label: "Closed today",
      headline: "Closed",
      sub: "Closed today",
      detail,
      todayLine,
    };
  }

  if (!win.closed) {
    const start = parseMinutes(win.open);
    const end = parseMinutes(win.close);
    if (clock.minutes >= start && clock.minutes < end) {
      return {
        open: true,
        label: `Open · until ${formatClock(win.close)}`,
        headline: "Open",
        sub: `Until ${formatClock(win.close)}`,
        detail,
        todayLine,
      };
    }
  }

  const next = nextOpen(clock);
  const when = next.today ? "today" : DAY_NAMES[next.weekday];
  return {
    open: false,
    label: `Closed · opens ${when} ${formatClock(next.open)}`,
    headline: "Closed",
    sub: `Opens ${when} ${formatClock(next.open)}`,
    detail,
    todayLine,
  };
}

export function setHoursOverride(override) {
  state = {
    ...state,
    hoursOverride: override,
  };
  persistLocalAndPush({ hoursOverride: state.hoursOverride });
}

export function clearHoursOverride() {
  state = {
    ...state,
    hoursOverride: null,
  };
  persistLocalAndPush({ hoursOverride: null });
}

async function changeLive(makePatch) {
  const patch = await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(LIVE_REF);
    if (!snapshot.exists()) throw new Error("The live case is unavailable. Please reconnect and try again.");
    const patch = makePatch(snapshot.data());
    transaction.update(LIVE_REF, patch);
    return patch;
  });
  state = { ...state, ...patch };
  syncStatus.writeError = null;
  persist();
  emit();
  return patch;
}

export async function swapPan(slot, inId, expectedOutId = state.caseIds[slot]) {
  const id = crypto.randomUUID();
  const patch = await changeLive(current => swapPatch(current, slot, inId, expectedOutId, id));
  return patch.lastSwap;
}

export async function undoLastSwap(expectedId) {
  const patch = await changeLive(current => undoPatch(current, expectedId));
  return patch.lastSwap;
}

export async function setFlavorAvailability(id, key, enabled) {
  if (!["pintsAvailable", "runningLow"].includes(key)) return;
  await changeLive(current => {
    if (!current.catalog.some(f => f.id === id)) throw new Error("That flavor is no longer in the catalog.");
    if (key === "runningLow" && !current.caseIds.includes(id)) throw new Error("That flavor is no longer in the freezer.");
    return { availability: { ...current.availability, [id]: { ...availabilityFor(current, id), [key]: enabled === true, at: Date.now() } } };
  });
}

export async function sendNotice(message) {
  const trimmed = String(message ?? "").trim();
  if (!trimmed) return null;
  const notice = {
    id: crypto.randomUUID(),
    message: trimmed.slice(0, 100),
    at: Date.now(),
  };
  await updateDoc(LIVE_REF, { lastNotice: notice });
  state = { ...state, lastNotice: notice };
  syncStatus.writeError = null;
  persist();
  emit();
  return notice;
}

function slugify(name) {
  const base =
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "flavor";
  let id = base;
  let n = 2;
  const ids = new Set(state.catalog.map((f) => f.id));
  while (ids.has(id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

export function lightenHex(hex, amt = 42) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function scoopFromHex(hex) {
  const deep = hex || "#A948A6";
  return `radial-gradient(circle at 35% 30%, ${lightenHex(deep)}, ${deep})`;
}

export function addFlavor({ name, note, dairyFree, color }) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const blurb = (note || "").trim() || "A new house flavor.";
  const flavor = {
    id: slugify(trimmed),
    name: trimmed,
    note: blurb,
    story: blurb,
    scoopColor: scoopFromHex(color || "#A948A6"),
    dairyFree: Boolean(dairyFree),
    color: color || "#A948A6",
    tags: [],
  };
  state = {
    ...state,
    catalog: [...state.catalog, flavor].sort(byFlavorName),
    updatedAt: Date.now(),
  };
  persistLocalAndPush({ catalog: state.catalog, updatedAt: state.updatedAt });
  return flavor;
}

function byFlavorName(a, b) {
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

export function availableForSwap(exceptSlot) {
  const inCase = new Set(state.caseIds);
  if (exceptSlot != null) inCase.delete(state.caseIds[exceptSlot]);
  return state.catalog.filter((f) => !inCase.has(f.id)).sort(byFlavorName);
}

window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  try {
    const parsed = JSON.parse(e.newValue);
    if (!Array.isArray(parsed.catalog) || !Array.isArray(parsed.caseIds)) return;
    const prevSwapAt = state.lastSwap?.at || 0;
    const prevNoticeAt = state.lastNotice?.at || 0;
    state = {
      catalog: parsed.catalog.map(hydrateFlavor),
      caseIds: parsed.caseIds,
      updatedAt: parsed.updatedAt || Date.now(),
      lastSwap: parsed.lastSwap || null,
      lastNotice: parsed.lastNotice || null,
      instagram: parsed.instagram
        ? cloneInstagram(parsed.instagram)
        : cloneInstagram(SEED_INSTAGRAM),
      hoursOverride: parsed.hoursOverride ?? null,
      availability: parsed.availability || {},
    };
    emit();
    if (state.lastSwap && state.lastSwap.at !== prevSwapAt) {
      window.dispatchEvent(
        new CustomEvent("janartys-remote-swap", { detail: state.lastSwap })
      );
    }
    if (state.lastNotice && state.lastNotice.at !== prevNoticeAt) {
      window.dispatchEvent(
        new CustomEvent("janartys-remote-notice", { detail: state.lastNotice })
      );
    }
  } catch {
    /* ignore malformed storage */
  }
});
