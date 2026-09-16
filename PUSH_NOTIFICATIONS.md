# Customer features and iOS notifications

## Current release

- Freezer, searchable flavor library, device-local favorites, and three alert choices are implemented.
- Staff can undo the latest pan swap for five minutes, preview a notice before posting, and mark current flavors as pints available or running low. Labels expire at midnight in America/Chicago; swapping a pan clears its running-low label.
- The Cloudflare Worker and D1 database are deployed. **Sending is disabled** (`PUSH_ENABLED=false`); no sender credentials are installed. `/health` reports `ready:false`.
- Apple/APNs and Firebase iOS configuration are still required. The browser saves preferences but does not receive background push alerts.
- The iOS messaging plugin is excluded from `includePlugins` until the real Firebase plist is installed. Firebase's native SDK otherwise attempts configuration on launch and can crash an unconfigured app.

## Cost boundary

Favorites and notification preferences use `janartys-customer-v1` in localStorage. They have no Firebase customer accounts, profile documents, database writes, or cross-device sync. Library browsing, searching, filtering, and favorites reuse the existing `shop/live` snapshot. Customer launches no longer attempt to seed or backfill Firestore.

[Firebase Cloud Messaging is a no-cost product](https://firebase.google.com/pricing). Devices subscribe directly to FCM topics. Signed-in staff call the Cloudflare relay after a Firestore save succeeds. The relay verifies Firebase ID tokens against Google's public signing keys; it does not read Firestore or use Firebase Cloud Functions. This design requires no Firebase billing upgrade.

Staff swaps, undo, and availability changes use a transaction on the existing document (normally one read and one write, with possible retries). Posting a notice uses one write. Connected customers receive changes through their existing listener. These operations consume the existing Firestore quota. This release does **not** guarantee that a project already on paid Blaze billing can never incur charges; check its billing plan and existing traffic in Firebase Console. Keep Spark if a hard no-Firebase-charge boundary is required. Do not enable paid services to activate push.

The relay uses features available on [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/). No scheduled jobs or per-customer records are used. D1 stores only event IDs, timestamps, and status, retains a rolling day of events, and caps new send attempts at 100 per 24 hours. Requests still consume Cloudflare account quotas, shared with other apps. No billing plan changes are part of this release.

## Activate on iOS

Use a Mac with Xcode for the native build. Complete these steps before production sends:

1. In Firebase project **janarty-s**, register the iOS app with bundle ID **com.janartys.app**. Download its real `GoogleService-Info.plist`. Add it to `ios/App/App` through Xcode with **App target membership**. Do not commit credentials or APNs private keys.
2. Configure the App ID and Apple Developer signing team. Add **Push Notifications** in Xcode Signing & Capabilities. Create an APNs authentication key and upload it, its Key ID, and Team ID in Firebase Project Settings → Cloud Messaging → the iOS app. Apple account requirements are separate from Firebase pricing.
3. Run `npm run ios:enable-push`, then `npm run cap:sync`. The script checks the plist's bundle/project IDs before including the plugin. Commit the resulting non-secret Capacitor/native project changes. Resolve Swift packages in Xcode. AppDelegate forwarding and foreground alert/sound settings are already included. These visible alerts do not require background polling.
4. Enable the Firebase Cloud Messaging API in Google Cloud if needed. Create a dedicated sender service account with **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`), or a custom role containing only `cloudmessaging.messages.create`. Do not grant Owner, Editor, or Firestore access. See [FCM HTTP v1 authorization](https://firebase.google.com/docs/cloud-messaging/auth-server).
5. Install the service account JSON as the Worker secret **FCM_SERVICE_ACCOUNT** using Cloudflare's dashboard secret editor or `npx wrangler secret put FCM_SERVICE_ACCOUNT` from `push-relay`. Never put it in app JavaScript, a `VITE_` variable, git, or chat. It must belong to `janarty-s`.
6. With no customer subscriptions yet, set `PUSH_ENABLED` to `"true"` in `push-relay/wrangler.jsonc` and run `npm run deploy` from that directory. `/health` should return `ready:true`. This reports configuration only; it does not prove APNs delivery.
7. On a signed physical iPhone build, verify launch/category changes never request permission. Tap **Notify me**, accept permission, and confirm receipt while foregrounded, backgrounded, and closed. Test favorite-only, new-flavors, both together (one notification), and announcements separately. Tap a flavor push to open its details. Turn alerts off and confirm delivery stops. Test denied permission and returning from Settings. Use an agreed test window for staff publishes: the case/notices are public.

If end-to-end delivery fails, set `PUSH_ENABLED` back to `"false"` and redeploy. Library and staff tools continue working.

Native reference: [Capawesome Firebase Cloud Messaging](https://capawesome.io/docs/sdks/capacitor/firebase/cloud-messaging/). Do not add a second push plugin with competing native delegates.

## Delivery behavior

### Request rate limits

The Worker uses Cloudflare rate-limit bindings with no Firebase calls or database counters:

- **120 requests per 60 seconds per IP address**, before authentication, body parsing, D1, or FCM. Health checks, browser preflights, unknown routes, and requests while sending is disabled all count. The key uses Cloudflare's `CF-Connecting-IP`, never a client-supplied forwarded address or token. Missing IP metadata shares an `unknown` bucket.
- **20 publish attempts per 60 seconds per verified staff UID**, after authentication and before reading the body or accessing D1. Refreshing a token or changing networks does not reset that staff identity's bucket within a Cloudflare location.
- Rejections return **HTTP 429**, `Retry-After: 60`, and the usual CORS headers for approved origins. The app does not automatically retry a push. Staff's already-saved shop edit is unaffected.
- If a limiter is missing or unavailable, the Worker stops processing and returns 502. Authentication and the existing 100-event daily send cap remain separate controls.

The anonymous IP limit is deliberately generous because customers/staff can share shop Wi-Fi or a mobile-network address. Ordinary customer browsing does not call this relay; native notification setup checks `/health`.

Cloudflare enforces these approximate limits per location with eventually consistent counters. They are abuse controls, not a strict global billing limit. Rejected requests still invoke the Worker and count toward its request usage; the limiter reduces downstream authentication, D1, and FCM work. It does not add a Cloudflare Access login gate, a Firebase service, or a paid plan upgrade. See [Cloudflare's rate-limit binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

### Notification events

- **Favorite flavors** follows saved IDs. **New flavors** means any flavor joining the freezer, including returning flavors. **Shop announcements** follows staff notices. All choices start off.
- A single FCM OR condition covers favorite plus new-flavor subscribers, avoiding duplicate messages for people choosing both. Topics contain public shop information, not private customer data.
- Flavor pushes open `#/flavor/<id>`; announcements open the freezer. Flavors removed from today's case remain in the library.
- The relay requires a valid, verified staff email. Keep `src/data.js`, Firestore rules, and `push-relay/src/index.js` staff lists aligned. Browser origin checks supplement authentication.
- A successful save precedes each push attempt. Only this updated staff app emits push events; Firebase Console edits do not. Closing the device or losing connectivity after saving may miss delivery. No always-running backend or paid function watches Firestore.
- Each event ID gets at most one send attempt. Uncertain delivery is reported without automatic retries. D1 retains failed/reserved IDs for a day. Messages expire after 30 minutes; delivery is best effort, not an inventory guarantee.
- Undo changes the case without another flavor alert or Just out badge. Already delivered notifications cannot be recalled.
- Clearing app data removes local favorites/preferences; reinstalling requires fresh consent. No token or device list is stored in Firestore or D1.

## Operations and verification

Worker: `https://janartys-push-relay.ian-arsenault.workers.dev`

From the repo root:

```sh
npm ci
npm test
npm ci --prefix push-relay
npm run check --prefix push-relay
npm run test:relay
npm run build
```

From `push-relay`, apply migrations only to the named database before deploying:

```sh
npx wrangler d1 migrations apply janartys-push-events --remote
npm run deploy
```

Tests cover consent/filter/topics, stale swap protection, undo/expiry, message construction, invalid authorization, deduplication, the send cap, and request/staff rate-limit rejection before protected work. Rate-limit tests also cover CORS/retry headers, stable identity keys, normal health/preflight handling, and unavailable bindings. Local UI checks use blocked Firestore traffic and mocked staff saves. They do not replace signed iPhone/APNs delivery or authenticated production staff testing.
