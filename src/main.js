import "./styles.css";
import {
  FAVORITE_IDS,
  HOURS_BLURB,
  SHOP_MAPS_URL,
  SHOP_PHONE_TEL,
  STAFF_PASSWORD_HASH,
  STAFF_SESSION_KEY,
} from "./data.js";
import {
  addFlavor,
  availableForSwap,
  caseFlavors,
  chicagoDate,
  clearHoursOverride,
  flavorById,
  getInstagram,
  getShopStatus,
  getState,
  getSyncStatus,
  hoursMode,
  resetInstagram,
  scoopFromHex,
  sendNotice,
  setHoursOverride,
  setInstagram,
  subscribe,
  swapPan,
} from "./store.js";

const root = document.querySelector("#app");

const STAFF_FAIL_KEY = "janartys-staff-fails";
const STAFF_LOCK_KEY = "janartys-staff-lock-until";
const MAX_FAILS = 5;
const LOCK_MS = 2 * 60 * 1000;
const LOGO_TAPS_NEEDED = 7;
const LOGO_TAP_GAP_MS = 2800;
const JUST_OUT_MS = 30 * 60 * 1000;

function justOutSwap() {
  const swap = getState().lastSwap;
  if (!swap?.inId || swap.at == null) return null;
  const at = typeof swap.at === "number" ? swap.at : Date.parse(swap.at);
  if (!Number.isFinite(at)) return null;
  if (Date.now() - at >= JUST_OUT_MS) return null;
  return swap;
}

function scheduleJustOutClear() {
  clearTimeout(scheduleJustOutClear._t);
  const swap = getState().lastSwap;
  if (!swap?.at) return;
  const at = typeof swap.at === "number" ? swap.at : Date.parse(swap.at);
  if (!Number.isFinite(at)) return;
  const left = JUST_OUT_MS - (Date.now() - at);
  if (left <= 0) return;
  scheduleJustOutClear._t = setTimeout(() => {
    if (ui.view === "case") render();
  }, left + 30);
}
