import { Capacitor } from "@capacitor/core";
import { desiredTopics } from "./customer-model.js";
import { getCustomer, setAlertsEnabled, subscribeCustomer } from "./customer-store.js";
import { currentStaffUser } from "./staff-auth.js";
import { PUSH_RELAY_URL } from "./push-config.js";

const native = Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("FirebaseMessaging");
const listeners = new Set();
const state = { busy: false, active: false, message: "Choose your alerts, then tap Notify me. Your preferences stay on this device." };
const pushKey = "janartys-push-topics-v1";
let plugin;
let syncing = Promise.resolve();
let timer;
let transport = { token: "", topics: [] };
try { const stored = JSON.parse(localStorage.getItem(pushKey) || "{}"); if (typeof stored.token === "string" && Array.isArray(stored.topics)) transport = stored; } catch { /* optional cache */ }
const persist = () => { try { localStorage.setItem(pushKey, JSON.stringify(transport)); } catch { /* retry topic subscriptions on next launch */ } };
const update = patch => { Object.assign(state, patch); listeners.forEach(fn => fn()); };
export const notificationStatus = () => state;
export const subscribeNotifications = fn => { listeners.add(fn); return () => listeners.delete(fn); };
async function messaging() { return plugin ||= (await import("@capacitor-firebase/messaging")).FirebaseMessaging; }
async function relayReady() {
  if (!PUSH_RELAY_URL) return false;
  const response = await fetch(`${PUSH_RELAY_URL}/health`, { signal: AbortSignal.timeout(6000) });
  return response.ok && (await response.json()).ready === true;
}

function synchronize() {
  syncing = syncing.catch(() => {}).then(async () => {
    if (!native) return;
    const api = await messaging();
    if (!getCustomer().enabled) {
      if (transport.token) await api.deleteToken();
      transport = { token: "", topics: [] }; persist();
      update({ active: false, message: "Alerts are off. Your favorites and preferences are saved." });
      return;
    }
    if ((await api.checkPermissions()).receive !== "granted") {
      update({ active: false, message: "Notifications are disabled in iPhone Settings. You can enable them for Janarty’s there." });
      return;
    }
    const { token } = await api.getToken();
    if (transport.token !== token) transport = { token, topics: [] };
    const wanted = desiredTopics(getCustomer());
    for (const topic of [...transport.topics]) if (!wanted.includes(topic)) {
      await api.unsubscribeFromTopic({ topic });
      transport.topics = transport.topics.filter(value => value !== topic); persist();
    }
    for (const topic of wanted) if (!transport.topics.includes(topic)) {
      await api.subscribeToTopic({ topic }); transport.topics.push(topic); persist();
    }
    update({ active: true, message: wanted.length ? "You’re all set. We’ll let you know when there’s something for you." : "No alerts selected. Choose a category or save a favorite." });
  }).catch(() => update({ active: false, message: "Your choices are saved. Reconnect and tap Notify me to finish updating alerts." }));
  return syncing;
}

export async function enableNotifications() {
  if (state.busy) return;
  if (!native) {
    update({ message: "Your choices are saved. Push alerts will be available in the iOS app once notification setup is complete." });
    return;
  }
  update({ busy: true });
  try {
    if (!await relayReady()) { update({ message: "Your choices are saved. Shop notifications are not active yet." }); return; }
    const api = await messaging();
    let permission = await api.checkPermissions();
    // This is the only permission request, reached only through the Notify me button.
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") permission = await api.requestPermissions();
    if (permission.receive !== "granted") { update({ active: false, message: "Notifications are off. You can allow them in iPhone Settings whenever you’re ready." }); return; }
    setAlertsEnabled(true);
    await synchronize();
  } catch { update({ message: "Couldn’t connect to notifications. Your choices are saved; please try again." }); }
  finally { update({ busy: false }); if (getCustomer().enabled) scheduleSync(); }
}

export async function disableNotifications() {
  setAlertsEnabled(false);
  if (native) await synchronize();
  else update({ active: false, message: "Alerts are off. Your favorites and preferences are saved." });
}

export async function initializeNotifications() {
  if (!native) return;
  try {
    const api = await messaging();
    await api.addListener("notificationActionPerformed", event => {
      const id = event.notification?.data?.flavorId;
      window.dispatchEvent(new CustomEvent("janartys-open-notification", { detail: { flavorId: typeof id === "string" ? id : null } }));
    });
    await api.addListener("tokenReceived", () => { if (!state.busy) scheduleSync(); });
    if (getCustomer().enabled || transport.token) await synchronize();
  } catch { update({ active: false, message: "Notification setup is unavailable. Your preferences are saved." }); }
}
function scheduleSync() { clearTimeout(timer); timer = setTimeout(() => { void synchronize(); }, 250); }
subscribeCustomer(() => { if (native && !state.busy && (getCustomer().enabled || transport.token)) scheduleSync(); });
window.addEventListener("online", () => { if (native) scheduleSync(); });
document.addEventListener("visibilitychange", () => { if (native && document.visibilityState === "visible" && (getCustomer().enabled || transport.token)) scheduleSync(); });

export async function publishShopEvent(event) {
  if (!PUSH_RELAY_URL) return "The case is saved. Push alerts are awaiting setup.";
  const user = currentStaffUser();
  if (!user) return "The case is saved. Sign in again to send push alerts.";
  try {
    const response = await fetch(`${PUSH_RELAY_URL}/publish`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(event), signal: AbortSignal.timeout(12000),
    });
    if (response.status === 503) return "Saved. Push alerts are awaiting notification setup.";
    if (!response.ok) return "Saved. Push alerts could not be confirmed; they were not retried automatically.";
    return "Saved. Push alerts were submitted.";
  } catch { return "Saved. Push delivery could not be confirmed; it was not retried automatically."; }
}
