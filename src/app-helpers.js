import "./styles.css";
import {
  FAVORITE_IDS,
  HOURS_BLURB,
  SHOP_MAPS_URL,
  SHOP_PHONE_TEL,
  STAFF_SESSION_KEY,
} from "./data.js";
import {
  isStaffSignedIn,
  resetStaffPassword,
  signInStaff,
  staffAuthErrorMessage,
  staffResetMessage,
  whenAuthReady,
} from "./staff-auth.js";
import {
  addFlavor,
  availableForSwap,
  caseFlavors,
  chicagoDate,
  clearHoursOverride,
  flavorById,
  formatClock,
  getHoursOverride,
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

export const root = document.querySelector("#app");

/** Filled by app-views.js to avoid a circular import. */
let render = () => {};
export function setRender(fn) {
  render = fn;
}


const STAFF_FAIL_KEY = "janartys-staff-fails";
const STAFF_LOCK_KEY = "janartys-staff-lock-until";
const MAX_FAILS = 5;
const LOCK_MS = 2 * 60 * 1000;
const LOGO_TAPS_NEEDED = 7;
const LOGO_TAP_GAP_MS = 2800;
const JUST_OUT_MS = 30 * 60 * 1000;

export function justOutSwap() {
  const swap = getState().lastSwap;
  if (!swap?.inId || swap.at == null) return null;
  const at = typeof swap.at === "number" ? swap.at : Date.parse(swap.at);
  if (!Number.isFinite(at)) return null;
  if (Date.now() - at >= JUST_OUT_MS) return null;
  return swap;
}

export function scheduleJustOutClear() {
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

export const ui = {
  view: "case", // case | login | manager
  selectedPan: null,
  pickId: null,
  search: "",
  sheet: null, // null | swap | add | story | hours | maps
  storyId: null,
  email: "",
  password: "",
  staffError: "",
  staffBusy: false,
  toast: null, // { kind, html, sub }
  add: { name: "", note: "", dairyFree: false, color: "#A948A6" },
  ig: null, // { imageUrl, caption, permalink } draft in Manager
  notice: "",
  lastSeenSwapAt: 0,
  lastSeenNoticeAt: 0,
  logoTaps: 0,
  logoTapAt: 0,
};

export function coneSvg(cls = "nav-mark") {
  return `<span class="${cls}" aria-hidden="true"></span>`;
}

export function toastCone() {
  return `<span class="toast-mark" aria-hidden="true"></span>`;
}


export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function closeAtValue() {
  const o = getHoursOverride();
  if (o && !o.closed && o.close) return o.close;
  return "19:00";
}

export function normalizeTime(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function applyClosingAt(hhmm) {
  const close = normalizeTime(hhmm) || "19:00";
  const o = getHoursOverride();
  const same = o && !o.closed && o.mode === "close-at" && o.close === close;
  setHoursOverride({
    date: chicagoDate(),
    closed: false,
    open: "11:30",
    close,
    mode: "close-at",
  });
  if (same) return;
  const notice = sendNotice(`Closing at ${formatClock(close)} tonight.`);
  if (!notice) return;
  ui.lastSeenNoticeAt = notice.at;
  onNoticeSuccess(notice);
}

export function safeHref(url) {
  try {
    const u = new URL(String(url || "").trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* fall through */
  }
  return "https://www.instagram.com/janartys/";
}

export function igDraft() {
  if (ui.ig) return ui.ig;
  const ig = getInstagram();
  return {
    imageUrl: ig.imageUrl || "",
    caption: ig.caption || "",
    permalink: ig.permalink || "",
  };
}

export function ensureIgDraft() {
  if (!ui.ig) ui.ig = igDraft();
  return ui.ig;
}

export function igCardHtml() {
  const ig = getInstagram();
  const href = safeHref(ig.permalink);
  const handle = ig.handle || "janartys";
  const src = ig.imageUrl || "";
  return `<a class="ig-card" href="${esc(href)}" target="_blank" rel="noopener noreferrer">
    <div class="ig-card-head">
      <span class="ig-avatar" aria-hidden="true"><span class="nav-mark"></span></span>
      <span class="ig-card-label">From @${esc(handle)}</span>
      <span class="ig-heart" aria-hidden="true"></span>
    </div>
    <div class="ig-card-photo">
      <img src="${esc(src)}" alt="" />
    </div>
    <p class="ig-card-caption">${esc(ig.caption)}</p>
  </a>`;
}

export function relativeTime(ts) {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 20) return "Updated just now";
  if (sec < 60) return `Updated ${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min === 1) return "Updated 1 min ago";
  if (min < 60) return `Updated ${min} min ago`;
  const hr = Math.round(min / 60);
  return hr === 1 ? "Updated 1 hr ago" : `Updated ${hr} hr ago`;
}

export function isStaffRoute() {
  const raw = (location.hash || "").replace(/^#/, "").replace(/\/+$/, "");
  return raw === "/staff" || raw === "staff";
}

export function isStaffUnlocked() {
  if (!isStaffSignedIn()) {
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    return false;
  }
  sessionStorage.setItem(STAFF_SESSION_KEY, "ok");
  return true;
}

export function lockUntil() {
  const n = Number(sessionStorage.getItem(STAFF_LOCK_KEY) || 0);
  return Number.isFinite(n) ? n : 0;
}

export function isLocked() {
  return Date.now() < lockUntil();
}

export function failCount() {
  const n = Number(sessionStorage.getItem(STAFF_FAIL_KEY) || 0);
  return Number.isFinite(n) ? n : 0;
}

export function scheduleUnlockRender() {
  clearTimeout(scheduleUnlockRender._t);
  const ms = lockUntil() - Date.now();
  if (ms <= 0) return;
  scheduleUnlockRender._t = setTimeout(() => {
    if (ui.view === "login") {
      ui.staffError = "";
      render();
    }
  }, ms + 30);
}

export function recordFail() {
  const n = failCount() + 1;
  if (n >= MAX_FAILS) {
    sessionStorage.setItem(STAFF_LOCK_KEY, String(Date.now() + LOCK_MS));
    sessionStorage.setItem(STAFF_FAIL_KEY, "0");
    scheduleUnlockRender();
  } else {
    sessionStorage.setItem(STAFF_FAIL_KEY, String(n));
  }
}

export function clearFails() {
  sessionStorage.removeItem(STAFF_FAIL_KEY);
  sessionStorage.removeItem(STAFF_LOCK_KEY);
}

export function dismissSheet() {
  const sheet = root.querySelector(".sheet");
  const veil = root.querySelector(".veil");
  const finish = () => {
    ui.sheet = null;
    ui.selectedPan = null;
    ui.pickId = null;
    ui.storyId = null;
    render();
  };
  if (!sheet) {
    finish();
    return;
  }
  if (sheet.classList.contains("out")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }
  sheet.classList.add("out");
  veil?.classList.add("out");
  root.querySelector(".screen")?.classList.add("thaw");
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    finish();
  };
  sheet.addEventListener("animationend", end, { once: true });
  setTimeout(end, 340);
}

export function goCase() {
  ui.view = "case";
  ui.sheet = null;
  ui.storyId = null;
  ui.selectedPan = null;
  ui.pickId = null;
  ui.search = "";
  ui.email = "";
  ui.password = "";
  ui.staffError = "";
  history.replaceState(null, "", "#/");
  render();
}

export function goStaff() {
  ui.storyId = null;
  if (!isStaffUnlocked()) {
    ui.view = "login";
    ui.password = "";
    ui.staffError = isLocked()
      ? "Too many tries. Pause for a couple of minutes."
      : "";
    ui.sheet = null;
    if (isLocked()) scheduleUnlockRender();
  } else {
    ui.view = "manager";
  }
  history.replaceState(null, "", "#/staff");
  render();
  if (ui.view === "login") {
    requestAnimationFrame(() => {
      root.querySelector("[data-act=staff-email]")?.focus();
    });
  }
}

export function onLogoTap() {
  const now = Date.now();
  if (now - ui.logoTapAt > LOGO_TAP_GAP_MS) ui.logoTaps = 0;
  ui.logoTaps += 1;
  ui.logoTapAt = now;
  if (ui.logoTaps >= LOGO_TAPS_NEEDED) {
    ui.logoTaps = 0;
    goStaff();
  }
}

export function showToast(kind, html, sub = "") {
  ui.toast = { kind, html, sub, at: Date.now() };
  render();
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    ui.toast = null;
    render();
  }, 3200);
}

export function onSwapSuccess(swap) {
  const customerHtml = `<strong>${esc(swap.inName)}</strong> just came out`;
  if (ui.view === "case") {
    showToast("customer", customerHtml);
  } else {
    showToast(
      "manager",
      `<em>Customers notified</em>`,
      `${swap.outName} out, ${swap.inName} in`
    );
    setTimeout(() => {
      ui.view = "case";
      ui.sheet = null;
      ui.selectedPan = null;
      ui.pickId = null;
      history.replaceState(null, "", "#/");
      showToast("customer", customerHtml);
    }, 1400);
  }
}

export function onNoticeSuccess(notice) {
  const customerHtml = `<strong>${esc(notice.message)}</strong>`;
  if (ui.view === "case") {
    showToast("customer", customerHtml);
  } else {
    showToast("manager", `<em>Customers notified</em>`, notice.message);
    setTimeout(() => {
      ui.view = "case";
      ui.sheet = null;
      ui.selectedPan = null;
      ui.pickId = null;
      history.replaceState(null, "", "#/");
      showToast("customer", customerHtml);
    }, 1200);
  }
}

export function toastHtml() {
  if (!ui.toast) return "";
  const t = ui.toast;
  const sub = t.sub ? `<div class="toast-sub">${esc(t.sub)}</div>` : "";
  return `<div class="toast ${t.kind}" role="status">${toastCone()}
    <div class="toast-text">${t.html}${sub}</div>
  </div>`;
}

export function flavorTagsHtml(f) {
  const tags = [`<span class="story-tag gf">Gluten free</span>`];
  if (f.dairyFree) tags.push(`<span class="story-tag df">Dairy-free</span>`);
  for (const t of f.tags || []) {
    tags.push(`<span class="story-tag">${esc(t)}</span>`);
  }
  return tags.join("");
}

export function renderStorySheet() {
  const f = flavorById(ui.storyId);
  if (!f) return "";
  return `
    <button class="veil" type="button" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet story-sheet" aria-label="${esc(f.name)}">
      <button class="grabber" type="button" data-act="close-sheet" aria-label="Close sheet"></button>
      <div class="sheet-kicker">On the board</div>
      <div class="story-head">
        <span class="story-scoop" style="background: ${esc(f.scoopColor)}"></span>
        <div class="sheet-title">${esc(f.name)}</div>
      </div>
      <p class="story-body">${esc(f.story || f.note)}</p>
      <div class="story-tags">${flavorTagsHtml(f)}</div>
    </aside>
  `;
}

export function renderHoursSheet() {
  const status = getShopStatus();
  const apple = SHOP_MAPS_URL.replace("?q=", "?daddr=");
  const google =
    "https://www.google.com/maps/dir/?api=1&destination=111%20Front%20Street%2C%20Smyrna%2C%20TN%2037167";
  const waze =
    "https://waze.com/ul?q=111%20Front%20Street%20Smyrna%20TN&navigate=yes";
  return `
    <button class="veil" type="button" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet hours-sheet" aria-label="Hours">
      <button class="grabber" type="button" data-act="close-sheet" aria-label="Close sheet"></button>
      <div class="sheet-kicker">Hours</div>
      <div class="sheet-title">When we’re here</div>
      <p class="story-body">${esc(HOURS_BLURB)}</p>
      <p class="hours-today">${esc(status.todayLine)}</p>
      <div class="hours-visit-label">Call</div>
      <div class="maps-list">
        <a class="maps-row" href="tel:${esc(SHOP_PHONE_TEL)}">615-918-0085</a>
      </div>
      <div class="hours-visit-label">Directions</div>
      <p class="hours-addr">111 Front Street, Smyrna</p>
      <div class="maps-list">
        <a class="maps-row" href="${esc(apple)}" target="_blank" rel="noopener noreferrer">Apple Maps</a>
        <a class="maps-row" href="${esc(google)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
        <a class="maps-row" href="${esc(waze)}" target="_blank" rel="noopener noreferrer">Waze</a>
      </div>
    </aside>
  `;
}

export function renderMapsSheet() {
  const apple = SHOP_MAPS_URL.replace("?q=", "?daddr=");
  const google =
    "https://www.google.com/maps/dir/?api=1&destination=111%20Front%20Street%2C%20Smyrna%2C%20TN%2037167";
  const waze =
    "https://waze.com/ul?q=111%20Front%20Street%20Smyrna%20TN&navigate=yes";
  return `
    <button class="veil" type="button" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet maps-sheet" aria-label="Get directions">
      <button class="grabber" type="button" data-act="close-sheet" aria-label="Close sheet"></button>
      <div class="sheet-kicker">111 Front Street</div>
      <div class="sheet-title">Get directions</div>
      <div class="maps-list">
        <a class="maps-row" href="${esc(apple)}" target="_blank" rel="noopener noreferrer">Apple Maps</a>
        <a class="maps-row" href="${esc(google)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
        <a class="maps-row" href="${esc(waze)}" target="_blank" rel="noopener noreferrer">Waze</a>
      </div>
    </aside>
  `;
}

