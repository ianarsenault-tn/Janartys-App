import {
  root, setRender, justOutSwap, scheduleJustOutClear, ui, coneSvg, toastCone, esc, closeAtValue, normalizeTime, applyClosingAt, safeHref, igDraft, ensureIgDraft, igCardHtml, relativeTime, isStaffRoute, isStaffUnlocked, lockUntil, isLocked, failCount, scheduleUnlockRender, recordFail, clearFails, dismissSheet, goCase, goStaff, onLogoTap, showToast, onSwapSuccess, onNoticeSuccess, toastHtml, flavorTagsHtml, renderStorySheet, renderHoursSheet, renderMapsSheet,
} from "./app-helpers.js";
import {
  FAVORITE_IDS,
  HOURS_BLURB,
  SHOP_MAPS_URL,
  SHOP_PHONE_TEL,
} from "./data.js";
import {
  availableForSwap,
  caseFlavors,
  flavorById,
  getHoursOverride,
  getInstagram,
  getShopStatus,
  getState,
  getSyncStatus,
  hoursMode,
  scoopFromHex,
} from "./store.js";
import {
  resetStaffPassword,
  staffResetMessage,
} from "./staff-auth.js";

export function renderCase() {
  const state = getState();
  const flavors = caseFlavors();
  const freshId = justOutSwap()?.inId;
  const status = getShopStatus();
  const cards = flavors
    .map((f, i) => {
      const fresh = f.id === freshId;
      const chip = f.dairyFree
        ? `<span class="card-chip">Dairy-free</span>`
        : "";
      const badge = fresh ? `<span class="just-out">Just out</span>` : "";
      return `<button class="card ${fresh ? "fresh pop" : ""}" type="button" data-act="open-story" data-id="${esc(f.id)}" data-slot="${i}" aria-label="${esc(f.name)} — flavor story">
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
          <span class="nav-meta" data-updated>${esc(relativeTime(getState().updatedAt).replace(/^Updated /, ""))}</span>
        </div>
      </header>
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
      <div class="case">${cards}</div>
      ${igCardHtml()}
    </div>
    ${sheet}
    ${toastHtml()}
  `;
}

export function renderLogin() {
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

export function renderSwapSheet() {
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
        <div class="swap-sub">Customers get a notification the moment you tap</div>
      </div>
    </aside>
  `;
}

export function renderAddSheet() {
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

export function renderManager() {
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
      <p class="hint">Tap a pan to swap it. Customers get a notification.</p>
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
        <p class="ig-mgr-sub">A short notification on What’s Out — same style as a pan swap.</p>
        <form class="ig-form" data-act="notice-form">
          <div>
            <label class="field-label" for="notice-msg">Message</label>
            <input class="field" id="notice-msg" name="message" type="text" maxlength="100"
              value="${esc(ui.notice)}" data-act="notice-msg"
              placeholder="Pints 20% off after 7 tonight." />
          </div>
          <div class="ig-mgr-btns">
            <button class="primary-btn" type="submit" data-act="notice-send" ${ui.notice.trim() ? "" : "disabled"}>Send notification</button>
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

export function render() {
  const focus = document.activeElement;
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
}

export async function requestStaffReset() {
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


setRender(render);
