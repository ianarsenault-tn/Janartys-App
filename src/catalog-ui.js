import { duplicateFlavors } from "./catalog-actions.js";
import { esc } from "./customer-ui.js";

export function duplicateWarning(catalog, draft, id, prefix) {
  const duplicates = duplicateFlavors(catalog, draft.name, id, draft.dairyFree);
  if (!duplicates.length) return "";
  return `<p class="staff-message" role="status">This name already exists: ${duplicates.map(f => `${esc(f.name)}${f.archived ? " (archived)" : ""}`).join(", ")}. Review the existing flavor before adding another.</p><label class="check-row"><input type="checkbox" data-act="${prefix}-duplicate" ${draft.allowDuplicate ? "checked" : ""}/>This is a different flavor with the same name</label>`;
}

export function catalogSheet(state, ui, controls) {
  const needle = ui.catalogSearch.trim().toLocaleLowerCase("en");
  const flavors = state.catalog.filter(f => `${f.name} ${f.note}`.toLocaleLowerCase("en").includes(needle));
  return `<button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet"></button>
    <aside class="sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="Manage flavors">${controls}
      <div class="sheet-kicker">Catalog</div><div class="sheet-title">Manage flavors</div>
      <label class="search"><span class="sr-only">Search catalog</span><input type="search" data-act="catalog-search" placeholder="Search flavors" value="${esc(ui.catalogSearch)}"/></label>
      <div class="catalog">${flavors.map(f => `<button class="row" type="button" data-act="edit-flavor" data-id="${esc(f.id)}"><div><div class="row-name">${esc(f.name)}${f.archived ? " · Archived" : ""}${f.dairyFree ? " · Dairy-free" : ""}</div><div class="row-note">${esc(f.note)}</div></div></button>`).join("") || '<p class="empty-cat">No flavors match.</p>'}</div>
    </aside>`;
}

export function editSheet(state, ui, controls) {
  const { id, draft, original, confirmArchive } = ui.edit;
  const current = state.catalog.find(f => f.id === id);
  const inCase = state.caseIds.includes(id);
  return `<button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet"></button>
    <aside class="sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="Edit flavor">${controls}
      <div class="sheet-kicker">Catalog${current?.archived ? " · Archived" : ""}</div><div class="sheet-title">Edit flavor</div>
      <div class="form">
        <label class="field-label">Name<input class="field" data-act="edit-name" maxlength="40" value="${esc(draft.name)}"/></label>
        ${(draft.name !== original.name || draft.dairyFree !== original.dairyFree) ? duplicateWarning(state.catalog, draft, id, "edit") : ""}
        <label class="field-label">Short note<textarea class="field" data-act="edit-note" maxlength="80">${esc(draft.note)}</textarea></label>
        <label class="field-label">Flavor story<textarea class="field" data-act="edit-story" maxlength="2000">${esc(draft.story)}</textarea></label>
        <label class="field-label">Tags (separate with commas)<input class="field" data-act="edit-tags" maxlength="300" value="${esc(draft.tagsText)}"/></label>
        <label class="check-row"><input type="checkbox" data-act="edit-df" ${draft.dairyFree ? "checked" : ""}/>Dairy-free</label>
      </div>
      <div class="sheet-footer">
        ${ui.operationMessage ? `<p class="staff-message" role="status">${esc(ui.operationMessage)}</p>` : ""}
        <button class="primary-btn" type="button" data-act="save-flavor" ${!draft.name.trim() || ui.operationBusy ? "disabled" : ""}>${ui.operationBusy ? "Saving…" : "Save changes"}</button>
        ${current?.archived ? '<button class="text-button" type="button" data-act="restore-flavor">Restore flavor</button>' : inCase ? '<p class="swap-sub">Swap this flavor out of its pan before archiving it.</p>' : confirmArchive ? '<p class="staff-message">Archive this flavor? It will be hidden from the library and swap choices. Saved favorites remain. Unsaved edits will be discarded.</p><button class="text-button" type="button" data-act="confirm-archive">Yes, archive flavor</button><button class="text-button" type="button" data-act="cancel-archive">Cancel archive</button>' : '<button class="text-button" type="button" data-act="archive-flavor">Archive flavor</button>'}
      </div>
    </aside>`;
}
