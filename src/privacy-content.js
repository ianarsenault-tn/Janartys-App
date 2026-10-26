export const SUPPORT_EMAIL = "janartys@gmail.com";
export const PRIVACY_UPDATED = "October 26, 2026";

// Shared by the in-app sheet and the standalone, JavaScript-free policy page.
export function privacyContent() {
  return `<p>Last updated: ${PRIVACY_UPDATED}</p>
    <p>This policy describes Janarty’s What’s Out app for Janarty’s Homemade Ice Cream in Smyrna, Tennessee.</p>
    <h2>Browsing and favorites</h2>
    <p>You do not need an account to browse flavors or shop updates. Favorites and alert preferences are saved on this device using local storage. They do not sync between devices. The app also caches shop information so a saved view can remain available when disconnected. Clearing the app’s website data or removing its local app data can erase these choices.</p>
    <h2>Services that deliver the app</h2>
    <p>GitHub Pages delivers the web app, and Google Firebase delivers shop information and handles staff sign-in. Images may load from external image hosts, including Squarespace or Instagram/Meta. These providers receive ordinary connection information, such as your IP address and request details, to deliver and protect their services. This app does not include advertising or analytics tracking code.</p>
    <h2>Optional notifications</h2>
    <p>When notification delivery is available in the iPhone app, choosing Notify me and granting permission lets Firebase and Apple process a device messaging token and your selected notification topics. If you choose favorite-flavor alerts, those topic subscriptions identify the flavors you follow. They are separate from the favorites list stored on your device. The shop’s notification relay uses Cloudflare to process staff announcements.</p>
    <p>You can turn off all alerts in the Alerts screen. When connected, this requests removal of the messaging token. You can also revoke notification permission in iPhone Settings. Turning off alerts keeps your local favorites. If removal cannot finish while offline, reconnect to complete it.</p>
    <h2>Staff and Instagram connections</h2>
    <p>Approved staff sign in using Firebase Authentication. Firebase processes their email address, account identifier and sign-in credentials. Shop edits are stored in Firestore and are visible to customers. Staff accounts are managed by the shop; customers cannot register an account.</p>
    <p>If the shop enables automatic Instagram posts, its authorized connection is managed on a Cloudflare server. Shop connection credentials stay on that server until an administrator removes them; owners can revoke access through Meta. Customers do not need to connect an Instagram account. Opening an Instagram post takes you to Instagram, where Meta’s policies apply.</p>
    <h2>Links, retention and your choices</h2>
    <p>Call, email, map and social links open the service you select. The app passes the shop destination to map services and does not request your device location. Those services may request their own permissions.</p>
    <p>Local preferences remain until you change them or clear local data. Staff account and shop records remain until the shop administrator updates or removes them. Service providers manage their operational logs under their own retention practices. For help with access, correction or deletion of information held by the shop, contact us below. We cannot recover favorites that were stored only on your device.</p>
    <h2>Contact</h2>
    <p>Janarty’s Homemade Ice Cream<br/>111 Front Street, Smyrna, TN 37167<br/><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><br/><a href="tel:+16159180085">615-918-0085</a></p>
    <p>We will update this page when the app’s data practices change.</p>`;
}
