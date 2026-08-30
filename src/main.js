import "./styles.css";
import { FAVORITE_IDS, PIN, PIN_SESSION_KEY } from "./data.js";
import {
  addFlavor,
  availableForSwap,
  caseFlavors,
  flavorById,
  getState,
  scoopFromHex,
  subscribe,
  swapPan,
} from "./store.js";

const root = document.querySelector("#app");

const ui = {
  view: "case", // case | pin | manager
  selectedPan: null,
  pickId: null,
  search: "",
  sheet: null, // null | swap | add
  pin: "",
  pinError: false,
  toast: null, // { kind, html, sub }
  add: { name: "", note: "", dairyFree: false, color: "#A948A6" },
  lastSeenSwapAt: 0,
};

let uid = 0;
function coneSvg(cls = "nav-mark") {
  const id = `coneG${++uid}`;
  return `<svg class="${cls}" viewBox="0 0 64 76" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="32" y1="8" x2="32" y2="74" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#3B82F6"/>
        <stop offset="0.48" stop-color="#E83E8C"/>
        <stop offset="1" stop-color="#7B2CBF"/>
      </linearGradient>
    </defs>
    <path stroke="url(#${id})" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"
      d="M13.8 28.2 C13.8 19.2 21.2 13 29.2 13 C33 13 35.8 14.8 37.4 18 C39 14.8 41.8 13 45.6 13 C53.6 13 61 19.2 61 28.2 C61 37 54.2 44.6 37.4 55 C20.6 44.6 13.8 37 13.8 28.2 Z"/>
    <path stroke="url(#${id})" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"
      d="M24.2 61.2 L37.4 74.2 L50.6 61.2 Z"/>
  </svg>`;
}

function toastCone() {
  const id = `coneT${++uid}`;
  return `<svg class="toast-mark" viewBox="0 0 64 76" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="32" y1="8" x2="32" y2="74" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#7EB6FF"/>
        <stop offset="0.48" stop-color="#FF7AB3"/>
        <stop offset="1" stop-color="#C084FC"/>
      </linearGradient>
    </defs>
    <path stroke="url(#${id})" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
      d="M13.8 28.2 C13.8 19.2 21.2 13 29.2 13 C33 13 35.8 14.8 37.4 18 C39 14.8 41.8 13 45.6 13 C53.6 13 61 19.2 61 28.2 C61 37 54.2 44.6 37.4 55 C20.6 44.6 13.8 37 13.8 28.2 Z"/>
    <path stroke="url(#${id})" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
      d="M24.2 61.2 L37.4 74.2 L50.6 61.2 Z"/>
  </svg>`;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function relativeTime(ts) {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 20) return "Updated just now";
  if (sec < 60) return `Updated ${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min === 1) return "Updated 1 min ago";
  if (min < 60) return `Updated ${min} min ago`;
  const hr = Math.round(min / 60);
  return hr === 1 ? "Updated 1 hr ago" : `Updated ${hr} hr ago`;
}

function isManagerUnlocked() {
  return sessionStorage.getItem(PIN_SESSION_KEY) === "ok";
}

function goCase() {
  ui.view = "case";
  ui.sheet = null;
  ui.selectedPan = null;
  ui.pickId = null;
  ui.search = "";
  history.replaceState(null, "", "#/");
  render();
}

function goManager() {
  if (!isManagerUnlocked()) {
    ui.view = "pin";
    ui.pin = "";
    ui.pinError = false;
    ui.sheet = null;
  } else {
    ui.view = "manager";
  }
  history.replaceState(null, "", "#/manager");
  render();
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

function tabbar(active) {
  return `<nav class="tabbar" aria-label="App">
    <button class="tab ${active === "case" ? "active" : ""}" data-act="tab-case" type="button">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="8.5" height="8.5" rx="2.2" fill="currentColor"/>
        <rect x="14.5" y="3" width="8.5" height="8.5" rx="2.2" fill="currentColor" opacity="0.45"/>
        <rect x="3" y="14.5" width="8.5" height="8.5" rx="2.2" fill="currentColor" opacity="0.45"/>
        <rect x="14.5" y="14.5" width="8.5" height="8.5" rx="2.2" fill="currentColor" opacity="0.45"/>
      </svg>
      <span class="tab-label">Case</span>
    </button>
    <button class="tab ${active === "manager" || active === "pin" ? "active" : ""}" data-act="tab-manager" type="button">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="7.2" y="11.5" width="11.6" height="9.2" rx="2" stroke="currentColor" stroke-width="1.7"/>
        <path d="M9.4 11.5 V9.2 a3.6 3.6 0 0 1 7.2 0 v2.3" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      </svg>
      <span class="tab-label">Manager</span>
    </button>
  </nav>`;
}

function toastHtml() {
  if (!ui.toast) return "";
  const t = ui.toast;
  const sub = t.sub ? `<div class="toast-sub">${esc(t.sub)}</div>` : "";
  return `<div class="toast ${t.kind}" role="status">${toastCone()}
    <div class="toast-text">${t.html}${sub}</div>
  </div>`;
}

function renderCase() {
  const state = getState();
  const flavors = caseFlavors();
  const freshId = state.lastSwap?.inId;
  const cards = flavors
    .map((f, i) => {
      const fresh = f.id === freshId;
      const chip = f.dairyFree
        ? `<span class="card-chip">Dairy-free</span>`
        : "";
      const badge = fresh ? `<span class="just-out">Just out</span>` : "";
      return `<article class="card ${fresh ? "fresh pop" : ""}" data-slot="${i}">
        ${badge}
        <div class="card-top">
          <span class="scoop" style="background: ${esc(f.scoopColor)}"></span>
          <div class="card-name">${esc(f.name)}</div>
        </div>
        <p class="card-note">${esc(f.note)}</p>
        ${chip}
      </article>`;
    })
    .join("");

  root.innerHTML = `
    <div class="screen">
      <header class="nav">
        ${coneSvg()}
        <div class="nav-copy">
          <div class="nav-title">What’s Out</div>
          <div class="nav-meta">${relativeTime(state.updatedAt)}</div>
        </div>
      </header>
      <div class="hero">
        <div class="hero-kicker">Janarty’s · Smyrna</div>
        <h1 class="hero-title">Today’s case</h1>
        <div class="hero-row">
          <span class="chip chip-open"><span class="dot"></span>Open · until 9pm</span>
          <span class="chip chip-gf">100% gluten free</span>
        </div>
      </div>
      <div class="case">${cards}</div>
      ${tabbar("case")}
    </div>
    ${toastHtml()}
  `;
}

function renderPin() {
  const filled = ui.pin.length;
  const dots = [0, 1, 2, 3]
    .map((i) => `<span class="pin-dot ${i < filled ? "filled" : ""}"></span>`)
    .join("");
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"]
    .map((k) => {
      if (k === "") return `<span></span>`;
      const ghost = k === "⌫" ? "ghost" : "";
      const val = k === "⌫" ? "del" : k;
      return `<button class="pad-key ${ghost}" type="button" data-act="pin" data-k="${val}">${k}</button>`;
    })
    .join("");

  root.innerHTML = `
    <div class="screen">
      <header class="nav">
        ${coneSvg()}
        <div class="nav-copy">
          <div class="nav-kicker">Staff</div>
          <div class="nav-title lg">Manager</div>
        </div>
      </header>
      <div class="pin ${ui.pinError ? "shake" : ""}">
        <div class="pin-title">Enter PIN</div>
        <p class="pin-sub">Four digits. Customers never see this screen.</p>
        <div class="pin-dots" aria-hidden="true">${dots}</div>
        <div class="pin-error">${ui.pinError ? "Try again" : ""}</div>
        <div class="pin-pad">${keys}</div>
      </div>
      ${tabbar("pin")}
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
    <button class="veil" type="button" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet" aria-label="Replace flavor">
      <button class="grabber" type="button" data-act="close-sheet" aria-label="Close sheet"></button>
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
        <div class="swap-sub">Customers get a toast the moment you tap</div>
      </div>
    </aside>
  `;
}

function renderAddSheet() {
  const a = ui.add;
  const preview = scoopFromHex(a.color);
  return `
    <button class="veil" type="button" data-act="close-sheet" aria-label="Close"></button>
    <aside class="sheet" aria-label="Add flavor">
      <button class="grabber" type="button" data-act="close-sheet" aria-label="Close sheet"></button>
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
          <div class="nav-kicker">Manager</div>
          <h1 class="nav-title lg">The case</h1>
        </div>
        <div class="nav-meta">Open · 9pm</div>
      </header>
      <p class="hint">Tap a pan to swap it. Customers get a toast.</p>
      <div class="pans">${pans}</div>
      <div class="mgr-actions">
        <button class="ghost-btn" type="button" data-act="open-add">Add flavor</button>
      </div>
      ${tabbar("manager")}
    </div>
    ${sheet}
    ${toastHtml()}
  `;
}

function render() {
  const focus = document.activeElement;
  const restoreSearch =
    focus && focus.getAttribute && focus.getAttribute("data-act") === "search";
  const restoreAdd = focus && focus.getAttribute && (focus.getAttribute("data-act") || "").startsWith("add-");
  const selStart = restoreSearch || restoreAdd ? focus.selectionStart : null;
  const selEnd = restoreSearch || restoreAdd ? focus.selectionEnd : null;
  const restoreAct = restoreSearch || restoreAdd ? focus.getAttribute("data-act") : null;

  if (ui.view === "case") renderCase();
  else if (ui.view === "pin") renderPin();
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
}

function submitPin() {
  if (ui.pin === PIN) {
    sessionStorage.setItem(PIN_SESSION_KEY, "ok");
    ui.view = "manager";
    ui.pin = "";
    ui.pinError = false;
    render();
  } else {
    ui.pinError = true;
    ui.pin = "";
    render();
    setTimeout(() => {
      ui.pinError = false;
      render();
    }, 500);
  }
}

root.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const act = t.getAttribute("data-act");

  if (act === "tab-case") {
    goCase();
    return;
  }
  if (act === "tab-manager") {
    goManager();
    return;
  }
  if (act === "pin") {
    const k = t.getAttribute("data-k");
    if (k === "del") ui.pin = ui.pin.slice(0, -1);
    else if (ui.pin.length < 4) ui.pin += k;
    ui.pinError = false;
    if (ui.pin.length === 4) submitPin();
    else render();
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
    ui.sheet = null;
    ui.selectedPan = null;
    ui.pickId = null;
    render();
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
});

root.addEventListener("input", (e) => {
  const t = e.target;
  const act = t.getAttribute("data-act");
  if (act === "search") {
    ui.search = t.value;
    render();
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
});

root.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.getAttribute("data-act") === "add-name") {
    e.preventDefault();
    root.querySelector("[data-act=do-add]")?.click();
  }
});

subscribe(() => {
  render();
});

window.addEventListener("janartys-remote-swap", (e) => {
  const swap = e.detail;
  if (!swap || swap.at === ui.lastSeenSwapAt) return;
  ui.lastSeenSwapAt = swap.at;
  if (ui.view === "case") {
    showToast("customer", `<strong>${esc(swap.inName)}</strong> just came out`);
  } else {
    showToast(
      "manager",
      `<em>Case updated</em>`,
      `${swap.outName} out, ${swap.inName} in`
    );
  }
});

window.addEventListener("hashchange", () => {
  if (location.hash.includes("manager")) goManager();
  else goCase();
});

setInterval(() => {
  if (ui.view === "case") {
    const meta = root.querySelector(".nav-meta");
    if (meta) meta.textContent = relativeTime(getState().updatedAt);
  }
}, 15000);

if (location.hash.includes("manager")) goManager();
else {
  ui.view = "case";
  render();
}
