import { SHOP_TZ } from "./data.js";

export const JUST_OUT_MS = 30 * 60 * 1000;

export function safeHttpsUrl(value) {
  if (typeof value !== "string" || !/^https:\/\//i.test(value.trim())) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export const safeImageSrc = safeHttpsUrl;

function timestamp(value) {
  if (value == null || value === "") return NaN;
  const at = typeof value === "number" ? value : Date.parse(value);
  return new Date(at).getTime();
}

function shopDay(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
}

export function updateLabel(value, now = Date.now()) {
  const at = timestamp(value);
  if (!Number.isFinite(at) || at > now + 60000) return "Update time unavailable";
  const age = Math.max(0, now - at);
  if (age < 60000) return "Last updated just now";
  if (age < 3600000) return `Last updated ${Math.floor(age / 60000)} min ago`;
  if (shopDay(at) === shopDay(now)) {
    return `Last updated at ${new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, hour: "numeric", minute: "2-digit" }).format(at)}`;
  }
  const options = age < 6 * 86400000 ? { weekday: "long" } : { month: "short", day: "numeric", ...(new Date(at).getUTCFullYear() !== new Date(now).getUTCFullYear() ? { year: "numeric" } : {}) };
  return `Last updated ${new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, ...options }).format(at)}`;
}

// Notices use the existing timestamp, so older clients and the live document stay compatible.
export function activeNotice(notice, now = Date.now()) {
  const at = timestamp(notice?.at);
  if (typeof notice?.message !== "string" || !notice.message.trim() || !Number.isFinite(at) || at > now || shopDay(at) !== shopDay(now)) return null;
  return notice;
}

export function freshSwap(swap, now = Date.now()) {
  const at = timestamp(swap?.at);
  return swap?.inId && swap.kind !== "undo" && Number.isFinite(at) && at <= now && now - at < JUST_OUT_MS ? swap : null;
}

export function swapKey(swap) {
  return swap ? `${swap.at}:${swap.slot}:${swap.inId}` : "";
}

export function caseUpdateLabel(state, now = Date.now()) {
  if (!state.caseLoaded) return "Current flavors haven’t loaded yet";
  const label = updateLabel(state.caseUpdatedAt, now);
  return label === "Update time unavailable" ? "Case update time unavailable" : label.replace("Last updated", "Case updated");
}

export function connectionLabel(live, online = true, loaded = true) {
  return !online ? "Offline" : live ? "Connected" : loaded ? "Saved view" : "Waiting for shop";
}
