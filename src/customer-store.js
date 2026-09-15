import { ALERT_KEYS, CUSTOMER_KEY, normalizeCustomer } from "./customer-model.js";

let customer;
let storageAvailable = true;
try { customer = normalizeCustomer(JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "{}")); }
catch { customer = normalizeCustomer(); }
const listeners = new Set();
export const getCustomer = () => customer;
export const customerStorageAvailable = () => storageAvailable;
export const subscribeCustomer = callback => { listeners.add(callback); return () => listeners.delete(callback); };
function save(next) {
  customer = normalizeCustomer(next);
  try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer)); storageAvailable = true; }
  catch { storageAvailable = false; }
  for (const callback of listeners) callback(customer);
}
export function toggleFavorite(id) {
  save({ ...customer, favorites: customer.favorites.includes(id) ? customer.favorites.filter(value => value !== id) : [...customer.favorites, id] });
}
export function setAlertPreference(key, enabled) {
  if (ALERT_KEYS.includes(key)) save({ ...customer, alerts: { ...customer.alerts, [key]: Boolean(enabled) } });
}
export function setAlertsEnabled(enabled) { save({ ...customer, enabled }); }
window.addEventListener("storage", event => {
  if (event.key !== CUSTOMER_KEY) return;
  try { customer = normalizeCustomer(JSON.parse(event.newValue || "{}")); }
  catch { return; }
  for (const callback of listeners) callback(customer);
});
