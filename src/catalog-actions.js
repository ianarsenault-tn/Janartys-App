const nameKey = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

export function duplicateFlavors(catalog, name, exceptId, dairyFree = false) {
  const key = nameKey(name);
  return key ? catalog.filter(f => f.id !== exceptId && nameKey(f.name) === key && (f.dairyFree === true) === (dairyFree === true)) : [];
}

export function checkDuplicate(catalog, name, exceptId, allowed, dairyFree = false) {
  if (!allowed && duplicateFlavors(catalog, name, exceptId, dairyFree).length) {
    throw new Error("A flavor with this name already exists. Review it or confirm this is a different flavor before saving.");
  }
}

// Update only edited fields, and refuse to overwrite a newer edit to those fields.
export function catalogEditPatch(current, id, original, changes, allowDuplicate = false, now = Date.now(), hydrate = f => f) {
  const flavor = current.catalog.find(f => f.id === id);
  if (!flavor) throw new Error("That flavor is no longer in the catalog.");
  const patch = {};
  for (const key of ["name", "note", "story", "dairyFree", "tags"]) {
    if (!(key in changes) || JSON.stringify(changes[key]) === JSON.stringify(original[key])) continue;
    if (JSON.stringify(hydrate(flavor)[key]) !== JSON.stringify(original[key])) throw new Error("That flavor changed while you were editing. Close and reopen it to review the latest version.");
    patch[key] = changes[key];
  }
  if ("name" in patch) {
    patch.name = String(patch.name).trim();
    if (!patch.name) throw new Error("Enter a flavor name.");
  }
  if ("name" in patch || "dairyFree" in patch) {
    const next = { ...hydrate(flavor), ...patch };
    checkDuplicate(current.catalog.map(hydrate), next.name, id, allowDuplicate, next.dairyFree);
  }
  return { catalog: current.catalog.map(f => f.id === id ? { ...f, ...patch } : f), updatedAt: now,
    ...(current.caseIds.includes(id) && Object.keys(patch).length ? { caseUpdatedAt: now } : {}) };
}

export function archivePatch(current, id, archived, now = Date.now()) {
  if (!current.catalog.some(f => f.id === id)) throw new Error("That flavor is no longer in the catalog.");
  if (archived && current.caseIds.includes(id)) throw new Error("Swap this flavor out of its pan before archiving it.");
  return { catalog: current.catalog.map(f => f.id === id ? { ...f, archived: archived === true } : f), updatedAt: now };
}
