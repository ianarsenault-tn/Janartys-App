import {
  root, ui, justOutSwap, esc, applyClosingAt, ensureIgDraft, relativeTime, isStaffRoute, isLocked, recordFail, clearFails, dismissSheet, goCase, goStaff, onLogoTap, showToast, onSwapSuccess, onNoticeSuccess,
} from "./app-helpers.js";
import { render, requestStaffReset } from "./app-views.js";
import { STAFF_SESSION_KEY } from "./data.js";
import {
  signInStaff,
  signOutStaff,
  staffAuthErrorMessage,
  whenAuthReady,
  resetStaffPassword,
  staffResetMessage,
} from "./staff-auth.js";
import { setupStaffIdleTimeout } from "./staff-idle.js";
import {
  addFlavor,
  caseFlavors,
  chicagoDate,
  clearHoursOverride,
  flavorById,
  getState,
  getShopStatus,
  getSyncStatus,
  resetInstagram,
  sendNotice,
  setHoursOverride,
  setInstagram,
  subscribe,
  swapPan,
} from "./store.js";

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

window.addEventListener("janartys-remote-notice", (e) => {
  const notice = e.detail;
  if (!notice || notice.at === ui.lastSeenNoticeAt) return;
  ui.lastSeenNoticeAt = notice.at;
  if (ui.view === "case") {
    showToast("customer", `<strong>${esc(notice.message)}</strong>`);
  } else {
    showToast("manager", `<em>Customers notified</em>`, notice.message);
  }
});

window.addEventListener("hashchange", () => {
  if (isStaffRoute()) goStaff();
  else goCase();
});

setInterval(() => {
  if (ui.view === "case") {
    const updated = root.querySelector("[data-updated]");
    if (updated) updated.textContent = relativeTime(getState().updatedAt).replace(/^Updated /, "");
    const live = root.querySelector(".nav-live");
    if (live) {
      const on = getSyncStatus().live;
      live.className = on ? "nav-live" : "nav-live off";
      live.textContent = on ? "Live" : "Offline";
    }
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

whenAuthReady().then(() => {
  if (isStaffRoute()) goStaff();
  else {
    ui.view = "case";
    render();
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

