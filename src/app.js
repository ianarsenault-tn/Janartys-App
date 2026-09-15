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
  signOutStaff,
  staffAuthErrorMessage,
  staffResetMessage,
  whenAuthReady,
} from "./staff-auth.js";
import { setupStaffIdleTimeout } from "./staff-idle.js";
import { activeNotice, connectionLabel, freshSwap, JUST_OUT_MS, swapKey, updateLabel } from "./presentation.js";
import { setupSheetInteractions } from "./sheet-interactions.js";
import { tapFeedback } from "./feedback.js";
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

const root = document.querySelector("#app");


const STAFF_FAIL_KEY = "janartys-staff-fails";
const STAFF_LOCK_KEY = "janartys-staff-lock-until";
const MAX_FAILS = 5;
const LOCK_MS = 2 * 60 * 1000;
const LOGO_TAPS_NEEDED = 7;
const LOGO_TAP_GAP_MS = 2800;
let renderedView = null;
let renderedSheet = "";
let sheetOpener = null;
let caseIntroduced = false;
let readyAnnounced = false;
let renderedData = "";
let seenSwap = "";
try { seenSwap = sessionStorage.getItem("janartys-seen-swap") || ""; } catch { /* storage is optional */ }

function justOutSwap() {
  return freshSwap(getState().lastSwap);
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

const ui = {
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

function coneSvg(cls = "nav-mark") {
  return `<span class="${cls}" aria-hidden="true"></span>`;
}

function toastCone() {
  return `<span class="toast-mark" aria-hidden="true"></span>`;
}


function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function closeAtValue() {
  const o = getHoursOverride();
  if (o && !o.closed && o.close) return o.close;
  return "19:00";
}

function normalizeTime(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function applyClosingAt(hhmm) {
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

function safeHref(url) {
  try {
    const u = new URL(String(url || "").trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* fall through */
  }
  return "https://www.instagram.com/janartys/";
}

function igDraft() {
  if (ui.ig) return ui.ig;
  const ig = getInstagram();
  return {
    imageUrl: ig.imageUrl || "",
    caption: ig.caption || "",
    permalink: ig.permalink || "",
  };
}

function ensureIgDraft() {
  if (!ui.ig) ui.ig = igDraft();
  return ui.ig;
}

function igCardHtml() {
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

function sheetControls() {
  return `<div class="sheet-controls">
    <button class="grabber" type="button" data-act="close-sheet" aria-label="Close sheet"><span aria-hidden="true"></span></button>
    <button class="sheet-close" type="button" data-act="close-sheet" aria-label="Close details"><span aria-hidden="true">×</span></button>
  </div>`;
}

function refreshCaseInfo() {
  const updated = root.querySelector("[data-updated]");
  if (updated) updated.textContent = updateLabel(getState().updatedAt);
  const connection = root.querySelector("[data-connection]");
  if (connection) {
    const label = connectionLabel(getSyncStatus().live, navigator.onLine);
    connection.dataset.state = label.toLowerCase().replace(" ", "-");
    connection.querySelector("[data-connection-label]").textContent = label;
    connection.title = label === "Connected" ? "Receiving updates from the shop" : "Showing the last available flavors; reconnect to check for updates";
  }
  const banner = root.querySelector("[data-shop-notice]");
  if (banner) {
    const notice = activeNotice(getState().lastNotice);
    banner.hidden = !notice;
    const message = notice?.message || "";
    if (banner.querySelector("p").textContent !== message) banner.querySelector("p").textContent = message;
  }
}

function isStaffRoute() {
  const raw = (location.hash || "").replace(/^#/, "").replace(/\/+$/, "");
  return raw === "/staff" || raw === "staff";
}

function isStaffUnlocked() {
  if (!isStaffSignedIn()) {
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    return false;
  }
  sessionStorage.setItem(STAFF_SESSION_KEY, "ok");
  return true;
}

function lockUntil() {
  const n = Number(sessionStorage.getItem(STAFF_LOCK_KEY) || 0);
  return Number.isFinite(n) ? n : 0;
}

function isLocked() {
  return Date.now() < lockUntil();
}

function failCount() {
  const n = Number(sessionStorage.getItem(STAFF_FAIL_KEY) || 0);
  return Number.isFinite(n) ? n : 0;
}

function scheduleUnlockRender() {
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

function recordFail() {
  const n = failCount() + 1;
  if (n >= MAX_FAILS) {
    sessionStorage.setItem(STAFF_LOCK_KEY, String(Date.now() + LOCK_MS));
    sessionStorage.setItem(STAFF_FAIL_KEY, "0");
    scheduleUnlockRender();
  } else {
    sessionStorage.setItem(STAFF_FAIL_KEY, String(n));
  }
}

function clearFails() {
  sessionStorage.removeItem(STAFF_FAIL_KEY);
  sessionStorage.removeItem(STAFF_LOCK_KEY);
}

function dismissSheet() {
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

function goCase() {
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

function goStaff() {
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

function onLogoTap() {
  const now = Date.now();
  if (now - ui.logoTapAt > LOGO_TAP_GAP_MS) ui.logoTaps = 0;
  ui.logoTaps += 1;
  ui.logoTapAt = now;
  if (ui.logoTaps >= LOGO_TAPS_NEEDED) {
    ui.logoTaps = 0;
    goStaff();
  }
}

function showToast(kind, html, sub = "") {
  ui.toast = { kind, html, sub, at: Date.now() };
  render();
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    ui.toast = null;
    render();
  }, 3200);
}

function onSwapSuccess(swap) {
  if (ui.view === "case") {
    render();
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
      ui.toast = null;
      render();
    }, 1400);
  }
}

function onNoticeSuccess(notice) {
  if (ui.view === "case") {
    refreshCaseInfo();
  } else {
    showToast("manager", `<em>Shop notice posted</em>`, notice.message);
    setTimeout(() => {
      ui.view = "case";
      ui.sheet = null;
      ui.selectedPan = null;
      ui.pickId = null;
      history.replaceState(null, "", "#/");
      ui.toast = null;
      render();
    }, 1200);
  }
}

function toastHtml() {
  if (!ui.toast) return "";
  const t = ui.toast;
  const sub = t.sub ? `<div class="toast-sub">${esc(t.sub)}</div>` : "";
  return `<div class="toast ${t.kind}" role="status">${toastCone()}
    <div class="toast-text">${t.html}${sub}</div>
  </div>`;
}

function flavorTagsHtml(f) {
  const tags = [`<span class="story-tag gf">Gluten free</span>`];
  if (f.dairyFree) tags.push(`<span class="story-tag df">Dairy-free</span>`);
  for (const t of f.tags || []) {
    tags.push(`<span class="story-tag">${esc(t)}</span>`);
  }
  return tags.join("");
}

function renderStorySheet() {
  const f = flavorById(ui.storyId);
  if (!f) return "";
  return `
    <button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet story-sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="${esc(f.name)}">
      ${sheetControls()}
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

function renderHoursSheet() {
  const status = getShopStatus();
  const apple = SHOP_MAPS_URL.replace("?q=", "?daddr=");
  const google =
    "https://www.google.com/maps/dir/?api=1&destination=111%20Front%20Street%2C%20Smyrna%2C%20TN%2037167";
  const waze =
    "https://waze.com/ul?q=111%20Front%20Street%20Smyrna%20TN&navigate=yes";
  return `
    <button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet hours-sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="Hours">
      ${sheetControls()}
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

function renderMapsSheet() {
  const apple = SHOP_MAPS_URL.replace("?q=", "?daddr=");
  const google =
    "https://www.google.com/maps/dir/?api=1&destination=111%20Front%20Street%2C%20Smyrna%2C%20TN%2037167";
  const waze =
    "https://waze.com/ul?q=111%20Front%20Street%20Smyrna%20TN&navigate=yes";
  return `
    <button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet maps-sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="Get directions">
      ${sheetControls()}
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


function renderCase() {
  const state = getState();
  const flavors = caseFlavors();
  const fresh = justOutSwap();
  const freshId = fresh?.inId;
  const arrival = !ui.sheet && fresh && swapKey(fresh) !== seenSwap;
  if (arrival) {
    seenSwap = swapKey(fresh);
    try { sessionStorage.setItem("janartys-seen-swap", seenSwap); } catch { /* storage is optional */ }
  }
  const status = getShopStatus();
  const cards = flavors
    .map((f, i) => {
      const fresh = f.id === freshId;
      const chip = f.dairyFree
        ? `<span class="card-chip">Dairy-free</span>`
        : "";
      const badge = fresh ? `<span class="just-out">Just out</span>` : "";
      return `<button class="card ${fresh ? "fresh" : ""} ${fresh && arrival ? "pop" : ""}" type="button" data-act="open-story" data-id="${esc(f.id)}" data-slot="${i}" aria-label="${esc(f.name)} — flavor story">
        ${badge}
        <div class="card-top">
          <span class="scoop" style="background: ${esc(f.scoopColor)}"></span>
          <div class="card-name">${esc(f.name)}</div>
        </div>
        <p class="card-note">${esc(f.note)}</p>
        ${chip}
      </button>`;
    })
    .join("");

  let sheet = "";
  if (ui.sheet === "story") sheet = renderStorySheet();
  if (ui.sheet === "hours") sheet = renderHoursSheet();
  if (ui.sheet === "maps") sheet = renderMapsSheet();

  root.innerHTML = `
    <div class="screen">
      <header class="nav brand">
        <button class="nav-logo" type="button" data-act="logo-tap" aria-label="Janarty’s Homemade Ice Cream">
          ${coneSvg()}
        </button>
        <div class="nav-copy">
          <h1 class="nav-title">Janarty’s</h1>
          <div class="nav-tagline">Homemade Ice Cream</div>
        </div>
        <div class="nav-aside">
          <div class="nav-screen">What’s out</div>
        </div>
      </header>
      <div class="case-meta">
        <span data-updated>${esc(updateLabel(state.updatedAt))}</span>
        <span class="connection" data-connection role="status"><span class="connection-dot" aria-hidden="true"></span><span data-connection-label></span></span>
      </div>
      <div class="status-row">
        <button class="status-cell ${status.open ? "is-open" : "is-closed"}" type="button" data-act="open-hours" data-status-chip>
          <span class="status-kicker"><span class="dot"></span>${esc(status.headline)}</span>
          <span class="status-detail">${esc(status.sub)}</span>
        </button>
        <div class="status-cell gf">
          <span class="status-kicker">100% gluten free</span>
          <span class="status-detail">Every scoop</span>
        </div>
      </div>
      <section class="shop-notice" data-shop-notice aria-label="Shop notice" hidden>
        <span class="shop-notice-label">From the shop</span><p role="status" aria-live="polite"></p>
      </section>
      <div class="case ${!caseIntroduced ? "case-enter" : ""}">${cards}</div>
      <span class="sr-only" role="status">${arrival ? `${esc(fresh.inName || flavorById(fresh.inId)?.name || "A new flavor")} just came out` : ""}</span>
      ${igCardHtml()}
    </div>
    ${sheet}
    ${toastHtml()}
  `;
  caseIntroduced = true;
  refreshCaseInfo();
}

function renderLogin() {
  const locked = isLocked();
  const err = locked
    ? "Too many tries. Pause for a couple of minutes."
    : ui.staffError;
  const disabled = locked || ui.staffBusy ? "disabled" : "";
  const shake = ui.staffError && !locked ? "shake" : "";

  root.innerHTML = `
    <div class="screen">
      <header class="nav">
        ${coneSvg()}
        <div class="nav-copy">
          <div class="nav-kicker">Staff</div>
          <div class="nav-title lg">Unlock</div>
        </div>
        <button class="nav-case" type="button" data-act="go-case">Case</button>
      </header>
      <form class="staff ${shake}" data-act="staff-form" autocomplete="on">
        <p class="staff-sub">Staff email and password for the case.</p>
        <label class="sr-only" for="staff-email">Email</label>
        <input class="field staff-email" id="staff-email" type="email" name="email"
          autocomplete="username" inputmode="email" data-act="staff-email"
          placeholder="Email" value="${esc(ui.email)}" ${disabled} />
        <label class="sr-only" for="staff-pass">Password</label>
        <input class="field staff-pass" id="staff-pass" type="password" name="password"
          autocomplete="current-password" data-act="staff-pass"
          placeholder="Password" value="${esc(ui.password)}" ${disabled} />
        <div class="staff-error">${esc(err)}</div>
        <button class="primary-btn staff-go" type="submit" data-act="staff-submit" ${disabled}>
          Unlock
        </button>
        <button class="staff-forgot" type="button" data-act="staff-forgot" ${disabled}>
          Forgot password?
        </button>
      </form>
    </div>
  `;
}

function renderSwapSheet() {
  const slot = ui.selectedPan;
  const current = caseFlavors()[slot];
  if (!current) return "";
  const q = ui.search.trim().toLowerCase();
  const available = availableForSwap().filter((f) => {
    if (!q) return true;
    return (
      f.name.toLowerCase().includes(q) || f.note.toLowerCase().includes(q)
    );
  });
  const inCase = new Set(getState().caseIds);
  const favs = FAVORITE_IDS.map((id) => flavorById(id)).filter(Boolean);
  const favHtml = favs
    .filter((f) => !inCase.has(f.id))
    .map(
      (f) =>
        `<button class="fav ${ui.pickId === f.id ? "on" : ""}" type="button" data-act="pick" data-id="${esc(f.id)}">${esc(f.name)}</button>`
    )
    .join("");

  const rows = available
    .map((f) => {
      const chosen = ui.pickId === f.id;
      return `<button class="row ${chosen ? "chosen" : ""}" type="button" data-act="pick" data-id="${esc(f.id)}">
        <span class="radio"></span>
        <div>
          <div class="row-name">${esc(f.name)}</div>
          <div class="row-note">${esc(f.note)}</div>
        </div>
        ${chosen ? `<span class="row-check">In</span>` : ""}
      </button>`;
    })
    .join("");

  const pickName = ui.pickId ? flavorById(ui.pickId)?.name : "";
  const disabled = ui.pickId ? "" : "disabled";

  return `
    <button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="Replace flavor">
      ${sheetControls()}
      <div class="sheet-kicker">Pan ${slot + 1}</div>
      <div class="sheet-title">Replace ${esc(current.name)}</div>
      <label class="search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.4" stroke="#8A7C76" stroke-width="1.6"/>
          <path d="M10.4 10.4 L13.4 13.4" stroke="#8A7C76" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <input type="search" placeholder="Search flavors" value="${esc(ui.search)}" data-act="search" />
      </label>
      ${favHtml ? `<div class="fav-label">Favorites</div><div class="favs">${favHtml}</div>` : ""}
      <div class="catalog">${rows || `<p class="empty-cat">No flavors match. Add one below.</p>`}</div>
      <div class="sheet-footer">
        <button class="swap-btn" type="button" data-act="do-swap" ${disabled}>
          ${pickName ? `Swap in ${esc(pickName)}` : "Swap pan"}
        </button>
        <div class="swap-sub">The new flavor appears with a Just out badge</div>
      </div>
    </aside>
  `;
}

function renderAddSheet() {
  const a = ui.add;
  const preview = scoopFromHex(a.color);
  return `
    <button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="Add flavor">
      ${sheetControls()}
      <div class="sheet-kicker">Catalog</div>
      <div class="sheet-title">Add a flavor</div>
      <form class="form" data-act="add-form">
        <div>
          <label class="field-label" for="f-name">Name</label>
          <input class="field" id="f-name" name="name" required maxlength="40" value="${esc(a.name)}" placeholder="Rose Cardamom Pistachio" data-act="add-name" />
        </div>
        <div>
          <label class="field-label" for="f-note">Note</label>
          <textarea class="field" id="f-note" name="note" maxlength="80" placeholder="Floral, nutty, a Saturday night flavor" data-act="add-note">${esc(a.note)}</textarea>
        </div>
        <div>
          <span class="field-label">Scoop color</span>
          <div class="color-row">
            <input type="color" value="${esc(a.color)}" data-act="add-color" aria-label="Scoop color" />
            <span class="color-preview" style="background: ${esc(preview)}"></span>
            <span style="font-size:13px;color:var(--muted)">${esc(a.color)}</span>
          </div>
        </div>
        <label class="check-row">
          <input type="checkbox" data-act="add-df" ${a.dairyFree ? "checked" : ""} />
          Dairy-free
        </label>
      </form>
      <div class="sheet-footer">
        <button class="primary-btn" type="button" data-act="do-add" ${a.name.trim() ? "" : "disabled"}>Add to catalog</button>
        <div class="swap-sub">Then swap it into a pan</div>
      </div>
    </aside>
  `;
}

function renderManager() {
  const pans = caseFlavors()
    .map((f, i) => {
      const selected = ui.selectedPan === i && ui.sheet === "swap";
      const dim = ui.sheet === "swap" && !selected;
      const tag = selected ? `<span class="pan-swap-tag">Swapping</span>` : "";
      return `<button class="pan ${selected ? "selected" : ""} ${dim ? "dim" : ""}" type="button" data-act="tap-pan" data-slot="${i}">
        ${tag}
        <div class="pan-num">Pan ${i + 1}</div>
        <span class="pan-scoop" style="background: ${esc(f.scoopColor)}"></span>
        <div class="pan-name">${esc(f.name)}</div>
      </button>`;
    })
    .join("");

  let sheet = "";
  if (ui.sheet === "swap") sheet = renderSwapSheet();
  if (ui.sheet === "add") sheet = renderAddSheet();

  root.innerHTML = `
    <div class="screen">
      <header class="nav">
        ${coneSvg()}
        <div class="nav-copy">
          <div class="nav-kicker">Staff</div>
          <h1 class="nav-title lg">The case</h1>
        </div>
        <button class="nav-case" type="button" data-act="go-case">Case</button>
      </header>
      <p class="hint">Tap a pan to swap it. New flavors get a Just out badge.</p>
      ${getSyncStatus().writeError ? `<p class="sync-warn">Couldn’t reach the case server.</p>` : ""}
      <div class="pans">${pans}</div>
      <div class="mgr-actions">
        <button class="ghost-btn" type="button" data-act="open-add">Add flavor</button>
      </div>
      <section class="ig-mgr hours-mgr" aria-label="Today’s hours">
        <div class="ig-mgr-kicker">Today’s hours</div>
        <p class="hours-live">${esc(getShopStatus().label)}</p>
        <p class="ig-mgr-sub">${esc(getShopStatus().todayLine)} · ${esc(getShopStatus().detail)}</p>
        <div class="hours-btns">
          <button class="hours-btn ${hoursMode() === "normal" ? "on" : ""}" type="button" data-act="hours-normal">Follow normal hours</button>
          <button class="hours-btn ${hoursMode() === "closed" ? "on" : ""}" type="button" data-act="hours-closed">Closed today</button>
          <button class="hours-btn ${hoursMode() === "open" ? "on" : ""}" type="button" data-act="hours-open">Open today</button>
          <label class="hours-btn hours-close ${hoursMode() === "early" ? "on" : ""}">
            <span>Closing at</span>
            <input class="hours-close-time" type="time" data-act="hours-close-at" value="${esc(closeAtValue())}" aria-label="Closing time" />
          </label>
        </div>
      </section>
      <section class="ig-mgr notice-mgr" aria-label="Tell customers">
        <div class="ig-mgr-kicker">Tell customers</div>
        <p class="ig-mgr-sub">Shown above the freezer until midnight, shop time. Posting again replaces the current notice.</p>
        <form class="ig-form" data-act="notice-form">
          <div>
            <label class="field-label" for="notice-msg">Message</label>
            <input class="field" id="notice-msg" name="message" type="text" maxlength="100"
              value="${esc(ui.notice)}" data-act="notice-msg"
              placeholder="Pints 20% off after 7 tonight." />
          </div>
          <div class="ig-mgr-btns">
            <button class="primary-btn" type="submit" data-act="notice-send" ${ui.notice.trim() ? "" : "disabled"}>Post shop notice</button>
          </div>
        </form>
      </section>
      <section class="ig-mgr" aria-label="Instagram">
        <div class="ig-mgr-kicker">Instagram</div>
        <p class="ig-mgr-sub">Featured photo on What’s Out. No Meta token — paste a URL for now.</p>
        <form class="ig-form" data-act="ig-form">
          <div>
            <label class="field-label" for="ig-image">Image URL</label>
            <input class="field" id="ig-image" name="imageUrl" type="text" inputmode="url"
              value="${esc(igDraft().imageUrl)}" data-act="ig-image" placeholder="https://…" />
          </div>
          <div>
            <label class="field-label" for="ig-caption">Caption</label>
            <textarea class="field" id="ig-caption" name="caption" maxlength="400"
              data-act="ig-caption" placeholder="What’s on the post">${esc(igDraft().caption)}</textarea>
          </div>
          <div>
            <label class="field-label" for="ig-link">Link</label>
            <input class="field" id="ig-link" name="permalink" type="text" inputmode="url"
              value="${esc(igDraft().permalink)}" data-act="ig-link" placeholder="https://www.instagram.com/janartys/" />
          </div>
          <div class="ig-mgr-btns">
            <button class="primary-btn" type="submit" data-act="ig-save">Save</button>
            <button class="ghost-btn" type="button" data-act="ig-reset">Reset to default</button>
          </div>
        </form>
      </section>
      <div class="mgr-logout">
        <button class="ghost-btn mgr-logout-btn" type="button" data-act="staff-logout">Log out</button>
      </div>
    </div>
    ${sheet}
    ${toastHtml()}
  `;
}

function render() {
  const focus = document.activeElement;
  const nextSheet = ui.sheet ? `${ui.sheet}:${ui.storyId || ui.selectedPan || ""}` : "";
  const sameView = renderedView === ui.view;
  const scrollTop = sameView ? root.querySelector(".screen")?.scrollTop || 0 : 0;
  const sheetScroll = nextSheet === renderedSheet ? root.querySelector(".sheet")?.scrollTop || 0 : 0;
  const focusedControl = focus?.closest?.("[data-act]");
  const focusKey = focusedControl ? { act: focusedControl.dataset.act, id: focusedControl.dataset.id, slot: focusedControl.dataset.slot, label: focusedControl.getAttribute("aria-label") } : null;
  const restoreSearch =
    focus && focus.getAttribute && focus.getAttribute("data-act") === "search";
  const restoreAdd = focus && focus.getAttribute && (focus.getAttribute("data-act") || "").startsWith("add-");
  const restoreIg = focus && focus.getAttribute && (focus.getAttribute("data-act") || "").startsWith("ig-");
  const restoreNotice = focus && focus.getAttribute && (focus.getAttribute("data-act") || "").startsWith("notice-");
  const restorePass = focus && focus.getAttribute && focus.getAttribute("data-act") === "staff-pass";
  const restoreEmail = focus && focus.getAttribute && focus.getAttribute("data-act") === "staff-email";
  const restoreStaff = restorePass || restoreEmail;
  const selStart = restoreSearch || restoreAdd || restoreIg || restoreNotice || restoreStaff ? focus.selectionStart : null;
  const selEnd = restoreSearch || restoreAdd || restoreIg || restoreNotice || restoreStaff ? focus.selectionEnd : null;
  const restoreAct = restoreSearch || restoreAdd || restoreIg || restoreNotice || restoreStaff ? focus.getAttribute("data-act") : null;

  if (ui.view === "case") {
    renderCase();
    scheduleJustOutClear();
  } else if (ui.view === "login") renderLogin();
  else renderManager();

  if (restoreAct) {
    const el = root.querySelector(`[data-act="${restoreAct}"]`);
    if (el && typeof el.focus === "function") {
      el.focus();
      if (selStart != null && el.setSelectionRange) {
        try { el.setSelectionRange(selStart, selEnd); } catch { /* color inputs */ }
      }
    }
  }
  root.classList.toggle("has-sheet", Boolean(ui.sheet));
  const screen = root.querySelector(".screen");
  if (screen) { screen.scrollTop = scrollTop; screen.inert = Boolean(nextSheet); }
  const sheet = root.querySelector(".sheet");
  if (sheet) {
    sheet.scrollTop = sheetScroll;
    if (nextSheet === renderedSheet) sheet.classList.add("settled");
  }
  const focusControl = (key, container = root) => {
    if (!key) return false;
    const match = [...container.querySelectorAll("[data-act]")].find(el => el.dataset.act === key.act && el.dataset.id === key.id && el.dataset.slot === key.slot && (key.label == null || el.getAttribute("aria-label") === key.label));
    match?.focus({ preventScroll: true });
    return Boolean(match);
  };
  if (sheet && nextSheet !== renderedSheet) {
    (sheet.querySelector(".sheet-close") || sheet).focus({ preventScroll: true });
  } else if (!nextSheet && renderedSheet && sameView) {
    focusControl(sheetOpener);
  } else if (!restoreAct && sameView) {
    focusControl(focusKey, sheet || root);
  }
  renderedView = ui.view;
  renderedSheet = nextSheet;
  renderedData = JSON.stringify(getState());
  if (!readyAnnounced) {
    readyAnnounced = true;
    window.dispatchEvent(new Event("janartys-ready"));
  }
}

async function requestStaffReset() {
  if (ui.staffBusy || isLocked()) return;
  if (!ui.email.trim()) {
    ui.staffError = "Enter your staff email first.";
    render();
    return;
  }
  ui.staffBusy = true;
  ui.staffError = "";
  render();
  try {
    await resetStaffPassword(ui.email);
    ui.staffBusy = false;
    ui.staffError = staffResetMessage(null);
    render();
  } catch (err) {
    ui.staffBusy = false;
    ui.staffError = staffResetMessage(err);
    render();
  }
}



async function submitPassword() {
  if (ui.staffBusy) return;
  if (isLocked()) {
    ui.staffError = "Too many tries. Pause for a couple of minutes.";
    render();
    return;
  }
  if (!ui.email.trim() || !ui.password) {
    ui.staffError = "Enter your staff email and password.";
    render();
    return;
  }
  ui.staffBusy = true;
  ui.staffError = "";
  render();
  try {
    await signInStaff(ui.email, ui.password);
    clearFails();
    sessionStorage.setItem(STAFF_SESSION_KEY, "ok");
    ui.password = "";
    ui.staffError = "";
    ui.staffBusy = false;
    ui.view = "manager";
    render();
  } catch (err) {
    ui.password = "";
    recordFail();
    ui.staffBusy = false;
    ui.staffError = isLocked()
      ? "Too many tries. Pause for a couple of minutes."
      : staffAuthErrorMessage(err);
    render();
    requestAnimationFrame(() => {
      root.querySelector("[data-act=staff-pass]")?.focus();
    });
  }
}

root.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t) {
    const closeWrap = e.target.closest(".hours-close");
    if (closeWrap) {
      const input = closeWrap.querySelector(".hours-close-time");
      if (input && typeof input.showPicker === "function") {
        try {
          input.showPicker();
        } catch {
          /* picker already open or unsupported */
        }
      }
    }
    return;
  }
  const act = t.getAttribute("data-act");
  if (["open-story", "open-hours", "open-maps", "tap-pan", "open-add"].includes(act)) {
    sheetOpener = { act, id: t.dataset.id, slot: t.dataset.slot };
  }
  if (act === "hours-close-at") {
    if (typeof t.showPicker === "function") {
      try {
        t.showPicker();
      } catch {
        /* picker already open or unsupported */
      }
    }
    return;
  }

  if (act === "logo-tap") {
    onLogoTap();
    return;
  }
  if (act === "go-case") {
    goCase();
    return;
  }
  if (act === "staff-submit") {
    return;
  }
  if (act === "staff-forgot") {
    requestStaffReset();
    return;
  }
  if (act === "staff-logout") {
    void (async () => {
      try {
        await signOutStaff();
      } catch {
        /* still clear local session */
      }
      try {
        sessionStorage.removeItem(STAFF_SESSION_KEY);
      } catch {
        /* private mode */
      }
      ui.password = "";
      ui.sheet = null;
      ui.selectedPan = null;
      ui.pickId = null;
      ui.staffError = "";
      goCase();
    })();
    return;
  }
  if (act === "tap-pan") {
    const slot = Number(t.getAttribute("data-slot"));
    ui.selectedPan = slot;
    ui.pickId = null;
    ui.search = "";
    ui.sheet = "swap";
    render();
    return;
  }
  if (act === "close-sheet") {
    dismissSheet();
    return;
  }
  if (act === "open-story") {
    void tapFeedback();
    ui.storyId = t.getAttribute("data-id");
    ui.sheet = "story";
    render();
    return;
  }
  if (act === "open-hours") {
    ui.sheet = "hours";
    ui.storyId = null;
    render();
    return;
  }
  if (act === "open-maps") {
    ui.sheet = "maps";
    ui.storyId = null;
    render();
    return;
  }
  if (act === "hours-normal") {
    clearHoursOverride();
    return;
  }
  if (act === "hours-closed") {
    setHoursOverride({ date: chicagoDate(), closed: true });
    return;
  }
  if (act === "hours-open") {
    setHoursOverride({
      date: chicagoDate(),
      closed: false,
      open: "11:30",
      close: "21:00",
    });
    return;
  }
  if (act === "pick") {
    ui.pickId = t.getAttribute("data-id");
    render();
    return;
  }
  if (act === "do-swap") {
    if (ui.selectedPan == null || !ui.pickId) return;
    const ok = swapPan(ui.selectedPan, ui.pickId);
    if (ok) {
      void tapFeedback();
      const swap = getState().lastSwap;
      ui.sheet = null;
      ui.selectedPan = null;
      ui.pickId = null;
      ui.lastSeenSwapAt = swap.at;
      onSwapSuccess(swap);
    }
    return;
  }
  if (act === "open-add") {
    ui.sheet = "add";
    ui.selectedPan = null;
    ui.add = { name: "", note: "", dairyFree: false, color: "#A948A6" };
    render();
    return;
  }
  if (act === "do-add") {
    const flavor = addFlavor(ui.add);
    if (flavor) {
      ui.sheet = null;
      ui.add = { name: "", note: "", dairyFree: false, color: "#A948A6" };
      showToast("manager", `<em>${esc(flavor.name)}</em>`, "Added to the catalog — tap a pan to swap it in");
    }
    return;
  }
  if (act === "ig-reset") {
    ui.ig = null;
    resetInstagram();
    showToast("manager", `<em>Instagram reset</em>`, "Default post is back on What’s Out");
    return;
  }
  if (act === "ig-save") {
    return;
  }
  if (act === "notice-send") {
    return;
  }
});

root.addEventListener("submit", (e) => {
  const act = e.target.getAttribute && e.target.getAttribute("data-act");
  if (act === "staff-form") {
    e.preventDefault();
    submitPassword();
  }
  if (act === "add-form") {
    e.preventDefault();
  }
  if (act === "ig-form") {
    e.preventDefault();
    const d = ensureIgDraft();
    ui.ig = null;
    setInstagram(d);
    showToast("manager", `<em>Instagram updated</em>`, "What’s Out shows the new post");
  }
  if (act === "notice-form") {
    e.preventDefault();
    const notice = sendNotice(ui.notice);
    if (!notice) return;
    ui.notice = "";
    ui.lastSeenNoticeAt = notice.at;
    onNoticeSuccess(notice);
  }
});

root.addEventListener("change", (e) => {
  const t = e.target;
  const act = t.getAttribute && t.getAttribute("data-act");
  if (act === "hours-close-at") applyClosingAt(t.value);
});

root.addEventListener("input", (e) => {
  const t = e.target;
  const act = t.getAttribute("data-act");
  if (act === "search") {
    ui.search = t.value;
    render();
  }
  if (act === "staff-email") {
    ui.email = t.value;
    if (ui.staffError) {
      ui.staffError = "";
      const err = root.querySelector(".staff-error");
      if (err) err.textContent = "";
      root.querySelector(".staff")?.classList.remove("shake");
    }
  }
  if (act === "staff-pass") {
    ui.password = t.value;
    if (ui.staffError) {
      ui.staffError = "";
      const err = root.querySelector(".staff-error");
      if (err) err.textContent = "";
      root.querySelector(".staff")?.classList.remove("shake");
    }
  }
  if (act === "add-name") ui.add.name = t.value;
  if (act === "add-note") ui.add.note = t.value;
  if (act === "add-color") {
    ui.add.color = t.value;
    render();
  }
  if (act === "add-df") {
    ui.add.dairyFree = t.checked;
  }
  if (act === "add-name") {
    const btn = root.querySelector("[data-act=do-add]");
    if (btn) btn.disabled = !t.value.trim();
  }
  if (act === "ig-image") ensureIgDraft().imageUrl = t.value;
  if (act === "ig-caption") ensureIgDraft().caption = t.value;
  if (act === "ig-link") ensureIgDraft().permalink = t.value;
  if (act === "notice-msg") {
    ui.notice = t.value;
    const btn = root.querySelector("[data-act=notice-send]");
    if (btn) btn.disabled = !t.value.trim();
  }
});

root.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.getAttribute("data-act") === "add-name") {
    e.preventDefault();
    root.querySelector("[data-act=do-add]")?.click();
  }
});

subscribe(() => {
  if (ui.view === "case" && JSON.stringify(getState()) === renderedData) refreshCaseInfo();
  else render();
});

window.addEventListener("janartys-remote-swap", (e) => {
  const swap = e.detail;
  if (!swap || swap.at === ui.lastSeenSwapAt) return;
  ui.lastSeenSwapAt = swap.at;
  if (ui.view === "case") {
    // The fresh pan and its live announcement already rendered with the store update.
    refreshCaseInfo();
  } else {
    showToast(
      "manager",
      `<em>Case updated</em>`,
      `${swap.outName} out, ${swap.inName} in`
    );
  }
});

window.addEventListener("janartys-remote-notice", (e) => {
  const notice = e.detail;
  if (!notice || notice.at === ui.lastSeenNoticeAt) return;
  ui.lastSeenNoticeAt = notice.at;
  if (ui.view === "case") {
    refreshCaseInfo();
  } else {
    if (activeNotice(notice)) showToast("manager", `<em>Shop notice posted</em>`, notice.message);
  }
});

window.addEventListener("hashchange", () => {
  if (isStaffRoute()) goStaff();
  else goCase();
});

setInterval(() => {
  if (ui.view === "case") {
    refreshCaseInfo();
    const chip = root.querySelector("[data-status-chip]");
    if (chip) {
      const status = getShopStatus();
      chip.className = `status-cell ${status.open ? "is-open" : "is-closed"}`;
      const kicker = chip.querySelector(".status-kicker");
      const detail = chip.querySelector(".status-detail");
      if (kicker) kicker.innerHTML = `<span class="dot"></span>${esc(status.headline)}`;
      if (detail) detail.textContent = status.sub;
    }
    const showing = root.querySelector(".just-out");
    if (showing && !justOutSwap()) render();
  }
}, 15000);


setupStaffIdleTimeout({
  isManagerActive: () => ui.view === "manager",
  onTimeout: () => {
    ui.password = "";
    ui.sheet = null;
    ui.selectedPan = null;
    ui.pickId = null;
    ui.staffError = "Signed out after 15 minutes idle.";
    goStaff();
  },
});

setupSheetInteractions(root, dismissSheet);
window.addEventListener("online", refreshCaseInfo);
window.addEventListener("offline", refreshCaseInfo);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshCaseInfo();
    if (ui.view === "case" && root.querySelector(".just-out") && !justOutSwap()) render();
  }
});
if (!isStaffRoute()) render();

whenAuthReady().then(() => {
  if (isStaffRoute()) goStaff();
  else {
    ui.view = "case";
    if (renderedView === "case") refreshCaseInfo();
    else render();
  }
});

function setupNativeStatusBar() {
  if (typeof window === "undefined" || !window.Capacitor) return;
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => {
      const overlay = true;
      return Promise.all([
        StatusBar.setStyle({ style: Style.Dark }),
        StatusBar.setOverlaysWebView({ overlay }),
      ]).catch(() => {});
    })
    .catch(() => {});
}
setupNativeStatusBar();

