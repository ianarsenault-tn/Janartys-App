import { filterLibrary } from "./customer-model.js";
import { availabilityFor } from "./case-actions.js";
export const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const paths = {
  case: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M12 10v10"/>',
  library: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  favorites: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  alerts: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
export function customerNav(view) {
  return `<nav class="customer-nav" aria-label="Explore Janarty’s">${[["case", "Freezer"], ["library", "Flavors"], ["favorites", "Favorites"], ["alerts", "Alerts"]].map(([id, title]) => `<button type="button" data-act="customer-tab" data-id="${id}" ${view === id ? 'aria-current="page"' : ""}>${icon(id)}<span>${title}</span></button>`).join("")}</nav>`;
}
export function availabilityChips(state, id) {
  const item = availabilityFor(state, id);
  return `${item.pintsAvailable ? '<span class="stock-chip">Pints available</span>' : ""}${item.runningLow ? '<span class="stock-chip low">Running low</span>' : ""}`;
}
export function favoriteButton(flavor, favorites, label = false) {
  const selected = favorites.includes(flavor.id);
  return `<button type="button" class="favorite-button ${selected ? "selected" : ""}" data-act="favorite" data-id="${esc(flavor.id)}" aria-pressed="${selected}" aria-label="${selected ? "Remove" : "Save"} ${esc(flavor.name)} ${selected ? "from" : "to"} favorites">${icon("favorites")}${label ? `<span>${selected ? "Saved favorite" : "Save favorite"}</span>` : ""}</button>`;
}
export function libraryHtml(state, customer, ui) {
  const favoritesOnly = ui.view === "favorites";
  const flavors = filterLibrary(state.catalog, { query: ui.librarySearch, favoritesOnly, favorites: customer.favorites, inCaseOnly: ui.inCaseOnly, caseIds: state.caseIds, dairyFree: ui.dairyFreeOnly });
  const empty = favoritesOnly && !customer.favorites.length;
  return `<header class="collection-header"><span class="collection-kicker">Janarty’s homemade ice cream</span><h1>${favoritesOnly ? "Your favorites" : "Find your next favorite"}</h1><p>${favoritesOnly ? "A little collection of the flavors you love." : "Every flavor has a story. Find yours."}</p></header>
    <div class="library-tools">
      <label class="library-search"><span class="sr-only">Search flavors</span><input type="search" data-act="library-search" placeholder="Search flavors" value="${esc(ui.librarySearch)}" /></label>
      <div class="filter-chips"><button type="button" data-act="filter-case" aria-pressed="${ui.inCaseOnly}">In the freezer</button><button type="button" data-act="filter-dairy" aria-pressed="${ui.dairyFreeOnly}">Dairy-free</button></div>
    </div>
    <p class="result-count" role="status">${flavors.length} ${flavors.length === 1 ? "flavor" : "flavors"}${ui.librarySearch || ui.inCaseOnly || ui.dairyFreeOnly ? " found" : " to explore"}</p>
    <div class="flavor-library">${flavors.map(f => `<article class="library-card">
      <button class="library-detail" type="button" data-act="open-story" data-id="${esc(f.id)}" aria-label="${esc(f.name)} — flavor story"><span class="library-scoop" style="background:${esc(f.scoopColor)}"></span><span class="library-copy"><strong>${esc(f.name)}</strong><span class="library-note">${esc(f.note)}</span><span class="library-badges"><span class="case-chip ${state.caseIds.includes(f.id) ? "available" : ""}">${state.caseIds.includes(f.id) ? "In the freezer" : "Not in the freezer"}</span>${f.dairyFree ? '<span class="stock-chip dairy">Dairy-free</span>' : ""}${availabilityChips(state, f.id)}</span></span></button>
      ${favoriteButton(f, customer.favorites)}</article>`).join("") || `<div class="library-empty">${icon("favorites")}<h2>${empty ? "Make room for your favorites" : "No flavors found"}</h2><p>${empty ? "Tap a heart in the flavor library to save something delicious." : "Try another search or clear the filters."}</p><button type="button" class="text-button" data-act="${empty ? "customer-tab" : "clear-filters"}" data-id="library">${empty ? "Explore flavors" : "Clear filters"}</button></div>`}</div>
    <p class="device-note">Favorites are saved on this device.</p>`;
}
export function alertsHtml(customer, status) {
  const options = [
    ["favorites", "Favorite flavors", "When a flavor you’ve saved joins the freezer."],
    ["newFlavors", "New flavors", "Any flavor joining the freezer, including your favorites."],
    ["announcements", "Shop announcements", "Hours changes and messages from the shop."],
  ];
  return `<header class="collection-header"><span class="collection-kicker">A little heads-up</span><h1>Your scoop, your alerts</h1><p>Choose what you’d like to hear about.</p></header>
    <section class="alert-options" aria-label="Notification preferences">${options.map(([key, title, description]) => `<label class="alert-option"><span><strong>${title}</strong><small>${description}</small></span><input type="checkbox" role="switch" data-act="alert-preference" data-id="${key}" ${customer.alerts[key] ? "checked" : ""}/></label>`).join("")}</section>
    <div class="alert-setup"><p class="alert-status" role="status">${esc(status.message)}</p>${customer.alerts.favorites && !customer.favorites.length ? '<p class="device-note">Save a favorite to choose which flavors you’ll hear about.</p>' : ""}<button type="button" class="primary-btn" data-act="enable-alerts" ${status.busy || !Object.values(customer.alerts).some(Boolean) ? "disabled" : ""}>${status.busy ? "Setting up…" : customer.enabled && status.active ? "Update alerts" : "Notify me"}</button>${customer.enabled ? '<button type="button" class="text-button" data-act="disable-alerts">Turn off all alerts</button>' : ""}<p class="device-note">Notification permission is requested only after you tap Notify me. You can change these choices anytime.</p></div>`;
}
