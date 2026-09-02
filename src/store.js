import { SEED_CATALOG, SEED_CASE, SEED_INSTAGRAM, STORAGE_KEY } from "./data.js";

const listeners = new Set();

function cloneInstagram(ig = SEED_INSTAGRAM) {
  return {
    imageUrl: ig.imageUrl,
    caption: ig.caption,
    permalink: ig.permalink,
    handle: ig.handle || SEED_INSTAGRAM.handle,
    updatedAt: ig.updatedAt || Date.now(),
  };
}

function seedState() {
  return {
    catalog: SEED_CATALOG.map((f) => ({ ...f })),
    caseIds: [...SEED_CASE],
    updatedAt: Date.now(),
    lastSwap: null,
    lastNotice: null,
    instagram: cloneInstagram(SEED_INSTAGRAM),
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
    return {
      catalog: parsed.catalog,
      caseIds: parsed.caseIds,
      updatedAt: parsed.updatedAt || Date.now(),
      lastSwap: parsed.lastSwap || null,
      lastNotice: parsed.lastNotice || null,
      instagram: parsed.instagram
        ? cloneInstagram(parsed.instagram)
        : cloneInstagram(SEED_INSTAGRAM),
    };
  } catch {
    return seedState();
  }
}

let state = load();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  for (const fn of listeners) fn(state);
}

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
  persist();
  emit();
}

export function resetInstagram() {
  state = {
    ...state,
    instagram: cloneInstagram({ ...SEED_INSTAGRAM, updatedAt: Date.now() }),
  };
  persist();
  emit();
}

export function swapPan(slot, inId) {
  if (slot < 0 || slot > 7) return false;
  const outId = state.caseIds[slot];
  if (outId === inId) return false;
  if (state.caseIds.includes(inId)) return false;
  const incoming = flavorById(inId);
  const outgoing = flavorById(outId);
  if (!incoming || !outgoing) return false;

  const next = [...state.caseIds];
  next[slot] = inId;
  state = {
    ...state,
    caseIds: next,
    updatedAt: Date.now(),
    lastSwap: {
      slot,
      outId,
      inId,
      outName: outgoing.name,
      inName: incoming.name,
      at: Date.now(),
    },
  };
  persist();
  emit();
  return true;
}

export function sendNotice(message) {
  const trimmed = String(message ?? "").trim();
  if (!trimmed) return null;
  const notice = {
    message: trimmed.slice(0, 100),
    at: Date.now(),
  };
  state = {
    ...state,
    lastNotice: notice,
  };
  persist();
  emit();
  return notice;
}

function slugify(name) {
  const base = name
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
  const flavor = {
    id: slugify(trimmed),
    name: trimmed,
    note: (note || "").trim() || "A new house flavor.",
    scoopColor: scoopFromHex(color || "#A948A6"),
    dairyFree: Boolean(dairyFree),
    color: color || "#A948A6",
  };
  state = {
    ...state,
    catalog: [...state.catalog, flavor],
    updatedAt: Date.now(),
  };
  persist();
  emit();
  return flavor;
}

export function availableForSwap(exceptSlot) {
  const inCase = new Set(state.caseIds);
  if (exceptSlot != null) inCase.delete(state.caseIds[exceptSlot]);
  return state.catalog.filter((f) => !inCase.has(f.id));
}

window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  try {
    const parsed = JSON.parse(e.newValue);
    if (!Array.isArray(parsed.catalog) || !Array.isArray(parsed.caseIds)) return;
    const prevSwapAt = state.lastSwap?.at || 0;
    const prevNoticeAt = state.lastNotice?.at || 0;
    state = {
      catalog: parsed.catalog,
      caseIds: parsed.caseIds,
      updatedAt: parsed.updatedAt || Date.now(),
      lastSwap: parsed.lastSwap || null,
      lastNotice: parsed.lastNotice || null,
      instagram: parsed.instagram
        ? cloneInstagram(parsed.instagram)
        : cloneInstagram(SEED_INSTAGRAM),
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
