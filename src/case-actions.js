import { SHOP_TZ } from "./data.js";
export const UNDO_MS = 5 * 60 * 1000;
const day = at => new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

export function availabilityFor(state, id, now = Date.now()) {
  const item = state.availability?.[id];
  if (!item || !Number.isFinite(item.at) || item.at > now || day(item.at) !== day(now)) return { pintsAvailable: false, runningLow: false };
  return { pintsAvailable: item.pintsAvailable === true, runningLow: item.runningLow === true && state.caseIds.includes(id) };
}

export function canUndoSwap(state, expectedId = state.lastSwap?.id, now = Date.now()) {
  const swap = state.lastSwap;
  return Boolean(swap?.id && swap.id === expectedId && swap.kind !== "undo" && now >= swap.at && now - swap.at < UNDO_MS &&
    state.caseIds[swap.slot] === swap.inId && !state.caseIds.includes(swap.outId) && state.catalog.some(f => f.id === swap.outId));
}

export function swapPatch(state, slot, inId, expectedOutId, id, now = Date.now()) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 7 || state.caseIds[slot] !== expectedOutId) throw new Error("That pan changed. Close this sheet and choose it again.");
  const incoming = state.catalog.find(f => f.id === inId);
  const outgoing = state.catalog.find(f => f.id === expectedOutId);
  if (!incoming || !outgoing || state.caseIds.includes(inId)) throw new Error("That flavor is already in the freezer or is no longer available.");
  const caseIds = [...state.caseIds];
  caseIds[slot] = inId;
  const availability = { ...state.availability };
  for (const flavorId of [inId, expectedOutId]) if (availability[flavorId]) availability[flavorId] = { ...availability[flavorId], runningLow: false };
  return { caseIds, availability, updatedAt: now, lastSwap: { id, kind: "swap", slot, outId: outgoing.id, inId, outName: outgoing.name, inName: incoming.name, at: now, previousOutAvailability: state.availability?.[outgoing.id] || null } };
}

export function undoPatch(state, expectedId, now = Date.now()) {
  if (!canUndoSwap(state, expectedId, now)) throw new Error("This swap can no longer be undone. The case changed or five minutes passed.");
  const swap = state.lastSwap;
  const caseIds = [...state.caseIds];
  caseIds[swap.slot] = swap.outId;
  const availability = { ...state.availability };
  const before = swap.previousOutAvailability;
  const current = availability[swap.outId];
  // Restore the old low-pan label only if nobody edited its stock after the swap.
  if (before && current?.at === before.at && current.pintsAvailable === before.pintsAvailable && current.runningLow === false) availability[swap.outId] = before;
  return { caseIds, availability, updatedAt: now, lastSwap: { id: `undo-${swap.id}`, kind: "undo", undoOf: swap.id, slot: swap.slot, outId: swap.inId, inId: swap.outId, outName: swap.inName, inName: swap.outName, at: now } };
}
