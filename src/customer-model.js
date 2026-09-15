export const CUSTOMER_KEY = "janartys-customer-v1";
export const ALERT_KEYS = ["favorites", "newFlavors", "announcements"];

export function normalizeCustomer(value = {}) {
  return {
    favorites: [...new Set((Array.isArray(value?.favorites) ? value.favorites : []).filter(id => typeof id === "string" && id.length > 0 && id.length <= 100))].slice(0, 500),
    alerts: Object.fromEntries(ALERT_KEYS.map(key => [key, value?.alerts?.[key] === true])),
    enabled: value?.enabled === true,
  };
}

export function filterLibrary(catalog, { query = "", favoritesOnly = false, favorites = [], inCaseOnly = false, caseIds = [], dairyFree = false } = {}) {
  const needle = query.trim().toLocaleLowerCase("en");
  return catalog.filter(f => (!favoritesOnly || favorites.includes(f.id)) && (!inCaseOnly || caseIds.includes(f.id)) && (!dairyFree || f.dairyFree) &&
    (!needle || `${f.name} ${f.note || ""} ${(f.tags || []).join(" ")}`.toLocaleLowerCase("en").includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

// Hex encoding preserves arbitrary catalog IDs without topic-name collisions.
export function flavorTopic(id) {
  return `flavor-${Array.from(new TextEncoder().encode(id), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function desiredTopics(customer) {
  if (!customer.enabled) return [];
  const topics = [];
  if (customer.alerts.favorites) topics.push(...customer.favorites.map(flavorTopic));
  if (customer.alerts.newFlavors) topics.push("new-flavors");
  if (customer.alerts.announcements) topics.push("shop-announcements");
  return [...new Set(topics)].sort();
}
