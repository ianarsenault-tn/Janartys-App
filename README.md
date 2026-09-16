# Janarty’s · What’s Out

A mobile-first flavor board for Janarty’s Homemade Ice Cream in Smyrna, Tennessee. Customers can see the eight flavors in the freezer, explore the flavor library, save favorites, and check shop updates. Staff manage the case and shop information from Manager.

**[Open the live app](https://ianarsenault-tn.github.io/Janartys-App/)**

The web app is published on GitHub Pages. A Capacitor iOS project is included for native builds. **Background push alerts are implemented but disabled pending Apple/APNs and Firebase sender setup.**

## Contents

- [Customer features](#customer-features)
- [Staff features](#staff-features)
- [Design, interaction, and accessibility](#design-interaction-and-accessibility)
- [Notifications](#notifications)
- [Data, synchronization, and cost](#data-synchronization-and-cost)
- [Local development](#local-development)
- [iOS (Xcode)](#ios-xcode)
- [Validation and deployment](#validation-and-deployment)
- [Project structure](#project-structure)
- [Current scope and limitations](#current-scope-and-limitations)

## Customer features

Customers do not need an account. Four bottom-navigation tabs organize the experience:

| Tab | Functionality |
| --- | --- |
| **Freezer** | The current eight pans, flavor descriptions, shop status, notices, and the featured Instagram card. |
| **Flavors** | The complete available catalog, alphabetical browsing, search, and combined freezer/dairy-free filters. |
| **Favorites** | Flavors saved with the heart button, including their current freezer status. |
| **Alerts** | Separate choices for favorite flavors, new flavors, and shop announcements. |

### The freezer

- Eight flavor cards sit inside a reusable, top-down freezer frame made with CSS. Scoop colors and descriptions represent each flavor; individual flavor photos are not required.
- Cards show the flavor name, a short description, and a dairy-free chip where applicable. The page also presents the shop’s gluten-free message.
- Staff-maintained **Pints available** and **Running low** labels appear when active.
- The latest incoming flavor receives a **Just out** badge for 30 minutes, with an arrival animation and accessible announcement. Undoing a swap does not create a fresh-arrival badge.
- **Last updated** describes the case/catalog update time in the shop’s time zone. **Connected**, **Saved view**, and **Offline** distinguish live data from cached information.
- Tap a flavor to open its story, dietary/flavor tags, availability labels, favorite control, and **Notify me** action.

### Flavor library and favorites

- Browse the full catalog received from the live shop document, including flavors not currently in the freezer.
- Search by flavor name, description, or tags. Combine **In the freezer** and **Dairy-free** filters, including within Favorites.
- Each library card retains its scoop color and description and indicates whether the flavor is currently in the freezer.
- Heart or unheart a flavor from its library card or detail sheet. Favorites persist across app launches on that device/browser.
- Empty favorites and unmatched searches offer a route back to the library or a way to clear filters.
- Favorites use local device storage. They do not create Firebase customer accounts, synchronize between devices, or reserve a flavor.

### Hours, notices, and visiting

- The status card shows whether the shop is open, its closing time, or its next scheduled opening. Tap it for today’s hours and the regular schedule.
- The configured schedule is Wednesday–Sunday, 11:30am–9pm, with Monday and Tuesday closed. Staff can override today’s schedule. Time calculations use `America/Chicago`.
- The hours sheet includes a tap-to-call link and directions through Apple Maps, Google Maps, or Waze for the configured shop address.
- A **From the shop** banner displays the latest active notice above the freezer. Posting another notice replaces it; notices expire at midnight in the shop’s time zone.
- The **From @janartys** card shows a staff-selected image and caption and links to the configured Instagram post/profile.

## Staff features

Manager is separate from customer navigation. Staff sign in with an allowlisted email/password through Firebase Authentication; there is no customer-facing account registration. See [FIRESTORE.md](FIRESTORE.md) for Auth and database-rule setup.

### Manage the eight pans

1. Tap the pan to replace.
2. Search the replacement catalog or choose a staff shortcut. Flavors already in the freezer are excluded from replacement choices.
3. Select a flavor and confirm **Swap in …**.
4. After the server confirms the change, connected customers receive the updated case. Manager stays open and offers **Undo swap**.

Swaps check the current server state before saving. If another staff member has already changed that pan, the stale selection is rejected instead of overwriting it.

**Undo swap** restores the most recent swap for up to five minutes, provided the case still matches that swap. It preserves unrelated shop information and subsequent stock edits. It cannot undo an older swap after a newer one, and it cannot recall an already delivered push notification.

### Maintain today’s availability

Inside a pan’s sheet, staff can toggle **Pints available** and **Running low** for its flavor. These labels appear in customer cards and details; Manager also shows compact stock indicators.

Labels expire at shop midnight. Replacing a pan clears its running-low flag. These are manual labels, not inventory counts or automatic stock detection.

### Add a flavor

The **Add flavor** form accepts a name, short note, scoop color, and dairy-free choice. The app creates a flavor ID and adds the flavor to the alphabetical catalog, ready to be selected for a pan. A new flavor uses its note as its initial story. No image upload is needed.

### Preview and post notices

- Write a message of up to 100 characters and select **Preview notice**.
- Review the customer banner, choose **Keep editing**, or confirm **Post shop notice**.
- Opening the preview does not post the notice. A failed save leaves the preview/draft available for another attempt.
- When push is activated, a confirmed post also attempts an alert to shop-announcement subscribers. Save status and push-delivery status are reported separately.

### Adjust hours and the featured post

| Control | Behavior |
| --- | --- |
| **Follow normal hours** | Removes today’s override and returns to the configured weekly schedule. |
| **Closed today** | Marks the shop closed for the current shop date. |
| **Open today** | Uses an 11:30am–9pm window for the current shop date. |
| **Closing at** | Saves the selected closing time for today and opens a suggested notice for preview. The hours change is separate from posting that notice. |
| **Instagram** | Saves an image URL, caption, and post/profile link, or resets the card to its default content. |

Hours overrides apply only to their stored shop date. The Instagram card is maintained manually; it does not automatically fetch the latest Instagram post.

### Staff session controls

- Sign-in includes readable errors, a password-reset action for allowlisted staff, and a local cooldown after repeated failed attempts.
- Firebase Auth may persist a signed-in session across reloads. Closing a tab alone does not guarantee sign-out.
- Explicit **Log out** ends the session. Manager also signs staff out after 15 minutes of inactivity while Manager is open.
- Production Firestore rules must enforce write access. A hidden Manager entry point and client-side allowlist are not substitutes for those rules.

## Design, interaction, and accessibility

- A branded splash appears for roughly one second on each page/app launch, with a bounded fallback so it cannot remain indefinitely.
- The freezer has inner padding around its responsive card grid. Longer words, such as **Butterscotch**, scale only as needed; multiword names wrap between words. On narrow cards, long names can use the full card width below the scoop to preserve readable type.
- Phone and iPad layouts support portrait, landscape, dynamic viewport height, and safe-area insets around notches and the home indicator. Wider app windows use a tablet layout capped at 1280px.
- Subtle card presses, freezer entrance/arrival motion, and animated detail sheets provide feedback. Supported native devices add light haptics for flavor/favorite interactions and successful swaps.
- Sheets support close buttons, backdrop dismissal, dragging the handle down, and Escape. Keyboard focus is contained within an open sheet and restored to the triggering control where available; background content becomes inactive.
- Search fields preserve focus during filtering. Controls expose labels and selected states, and status changes use accessible announcements.
- The system’s **Reduce Motion** preference disables decorative motion and haptic feedback.

### iPad layout

The same application and Firebase document serve both iPhone and iPad. Layouts respond to available window space rather than device detection:

- Windows at least 700px wide and 501px tall use larger typography, roomier cards, and a horizontal icon-and-label navigation bar.
- The freezer keeps two columns in portrait and switches to four columns in landscape when the window is at least 1000px wide. The eight pan IDs retain their order.
- The flavor library and Favorites use two columns on smaller tablets and three at widths of 1000px or more.
- The Instagram card places its image beside the caption. Alerts places preferences beside setup controls, and Manager places hours beside notice editing.
- Detail and staff sheets are centered horizontally, capped at 640px, and remain scrollable. Search, favorites, staff controls, and existing sheet interactions are shared with the phone view.
- Narrow multitasking windows and short landscape windows use the compact layout. Resizing or rotating does not reset the current view or require additional Firestore queries.

Tablet layouts can be previewed in the browser. Native iPad builds require the usual Capacitor sync/Xcode build, with final device checks for safe areas, rotation, touch gestures, and multitasking.

## Notifications

### Customer choices

| Choice | Intended alert |
| --- | --- |
| **Favorite flavors** | A saved flavor joins the freezer. |
| **New flavors** | Any flavor joins the freezer, including returning flavors and favorites. |
| **Shop announcements** | A staff notice, such as a change of hours. |

All choices start off. **Notify me** in a flavor’s detail sheet saves that flavor as a favorite, selects the favorite-flavor category, and opens Alerts. Only the Alerts-screen **Notify me** action can request system notification permission, after checking that native push and the relay are configured. Browsing, hearting a flavor, or toggling categories does not prompt for permission.

Preferences remain editable. Once enabled on iOS, topic subscriptions follow those choices; **Turn off all alerts** removes the messaging token. Flavor notifications open the corresponding flavor’s details, while shop announcements open the freezer.

### Current status and delivery path

**Push delivery is not active yet.** The web app saves notification choices and explains that delivery requires the configured iOS app. The native messaging plugin is deliberately excluded until its real Firebase configuration file is installed.

The prepared delivery path is:

1. Staff successfully save a swap or notice to Firestore.
2. The app submits the event to a Cloudflare Worker using the staff member’s Firebase ID token.
3. The Worker validates staff authorization and reserves the event ID in D1 to prevent duplicate attempts.
4. Firebase Cloud Messaging (FCM) sends a topic-based message through Apple Push Notification service (APNs) to opted-in iPhones.

The relay has a cap of 100 new send attempts per rolling 24 hours. A single topic condition avoids duplicate flavor alerts for customers following both favorite and new-flavor categories. Uncertain sends are not retried automatically; messages expire after 30 minutes. Manual edits in Firebase Console do not trigger pushes, and undo does not send another flavor alert.

Cloudflare rate-limit bindings also allow 120 incoming requests per minute per IP and 20 publish attempts per minute per verified staff member, enforced approximately per Cloudflare location. Excess traffic receives HTTP 429 before protected work, with a 60-second retry hint. These checks use no Firebase calls or database counters. Incoming Worker requests still consume Cloudflare request quota; this is not a global billing cap. See [request rate limits](PUSH_NOTIFICATIONS.md#request-rate-limits).

See [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) for Apple/APNs configuration, Firebase sender credentials, relay activation, delivery limitations, and physical-device acceptance checks. Permission, background delivery, and notification taps still require testing on a signed iPhone build before production activation.

## Data, synchronization, and cost

### Shared shop state

Firebase project `janarty-s`, Firestore document `shop/live`, is the shared source of truth:

| Field | Purpose |
| --- | --- |
| `catalog` | Flavor IDs, names, descriptions/stories, scoop colors, dietary flags, and tags. |
| `caseIds` | Ordered IDs for the eight active pans. |
| `updatedAt` | Case/catalog update timestamp. |
| `lastSwap` | Latest swap or undo, including information needed for a guarded undo. |
| `lastNotice` | Latest shop announcement and its timestamp. |
| `hoursOverride` | Optional override for a particular shop date. |
| `instagram` | Featured image URL, caption, permalink, and handle. |
| `availability` | Optional flavor-level pints/running-low flags and timestamps. |

Clients listen to this existing document for updates. Customer launches never create or backfill Firestore documents. Library search, filters, favorites, and alert choices reuse the loaded catalog rather than adding database queries.

Swaps, undo, and availability changes use server transactions; notice posting waits for a successful server update. Other Manager forms update locally while saving and expose a server warning if the write fails.

### Device storage and offline behavior

| Local storage key | Purpose |
| --- | --- |
| `janartys-case-v1` | Last available shop snapshot. |
| `janartys-customer-v1` | This device’s favorites, notification choices, and alert-enabled preference. |
| `janartys-push-topics-v1` | Native messaging token/topic bookkeeping; never a Firestore customer record. |

After the app loads, cached shop data remains browsable if Firestore is unreachable. A small bundled seed supplies an initial fallback when no cache exists; the full library needs a successful live load first. The web app does not include a service worker that guarantees an offline page launch.

Clearing device storage removes local favorites/preferences and cached data. Live shop state remains in Firestore. Cached information is not a guarantee of current availability, and staff transaction/notice saves require connectivity.

### Cost controls

- Favorites and preferences stay on the device: no customer Auth records, per-user Firestore documents, or extra Firestore writes for those actions.
- The alert architecture uses [no-cost FCM](https://firebase.google.com/pricing) and a Cloudflare relay instead of Firebase Cloud Functions. It does not require a Firebase billing upgrade.
- The relay uses features available on [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/). D1 stores event IDs/statuses, not customer profiles or device lists; there are no scheduled polling jobs.
- Staff edits and the existing Firestore listener still consume normal Firestore quota. Cloudflare quotas are also shared with other applications on the account. This design does not guarantee zero charges for an account already using paid plans or exceeding included usage. See the detailed [cost boundary](PUSH_NOTIFICATIONS.md#cost-boundary).

## Local development

Use Node.js 22 or a compatible newer version, plus npm. GitHub Actions uses Node.js 22.

```sh
npm ci
npm run dev
```

Vite defaults to port **5173**. Build and preview the production bundle with:

```sh
npm run build
npm run preview
```

The build is written to `dist/`; preview defaults to port **4173**. Vite uses relative asset URLs so the build works under the GitHub Pages project path and inside Capacitor.

**The checked-in Firebase configuration points to the live shop project.** Local development does not automatically use an emulator. Use a separate Firebase test project or deliberately blocked/mocked backend calls for mutation testing.

Before using Manager against a new Firebase project, configure email/password Auth, authorized domains, staff accounts, appropriate Firestore rules, and an initial `shop/live` document. Follow [FIRESTORE.md](FIRESTORE.md). The Firebase web configuration is public client configuration; sender service-account credentials and APNs private keys must never be added to client code or committed.

## iOS (Xcode)

The repository includes a Capacitor 8 iOS project using Swift Package Manager. On a Mac with Xcode:

```sh
npm ci
npm run cap:sync
npx cap open ios
```

`cap:sync` rebuilds the web app and copies it into the native project. In Xcode, select the **App** target, configure your signing team, select a simulator or connected iPhone, and run. The bundle ID is `com.janartys.app`.

Native status-bar, splash-screen, and haptics plugins are included. See [IOS.md](IOS.md) for native notes. Push setup is a separate step: install the correct Firebase iOS plist with App target membership, complete Apple/APNs configuration, then follow [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) before running `npm run ios:enable-push` and syncing again.

The app icon uses Janarty’s heart-and-cone mark with its blue/purple-to-pink gradient on warm cream, matching the app’s palette. The [1024×1024 PNG](public/brand/janartys-app-icon.png) is included in the iOS AppIcon asset catalog; matching browser and Apple home-screen icons are linked from the web app. See [branding assets](public/brand/README.md) for file sizes and update instructions.

GitHub Pages publishing does not update an installed iOS binary. Native changes require another sync/build and the appropriate iOS distribution process.

## Validation and deployment

### Checks

```sh
npm test
npm ci --prefix push-relay
npm run check --prefix push-relay
npm run test:relay
npm run build
```

- App tests cover the app/data structure, staff allowlist, catalog behavior, display timestamps, notice expiry, favorites/filtering/topic consent, stale-swap protection, undo, and availability expiry.
- Relay checks generate Worker types and run TypeScript validation. Relay tests cover message construction, invalid authorization/origins, duplicate prevention, failed-send handling, payload limits, and the daily send cap.
- The September 2026 feature release also received local browser checks for the full 152-flavor catalog across 14 phone-sized portrait/landscape viewports, favorites persistence, notification choices/deep links, and staff workflows using mocked saves. These were release checks, not an automated Xcode/device test suite.
- For future UI changes, check narrow and large phone layouts, landscape scrolling, long names, reduced motion, sheet dismissal/focus, and safe-area behavior. Validate native delivery on a real signed device when push is activated.

### Publishing

[The Pages workflow](.github/workflows/pages.yml) runs on pushes to `main` or manual dispatch. It installs locked dependencies, runs app and relay checks/tests, builds the web app, and deploys `dist/` to GitHub Pages.

The Cloudflare relay is deployed separately from `push-relay/`:

```sh
npx wrangler d1 migrations apply janartys-push-events --remote
npm run deploy
```

These commands affect the configured Cloudflare resources. Keep `PUSH_ENABLED=false` until credentials and device validation are ready; store sender credentials only as Worker secrets. Pages deployment does not publish Firestore rules, configure Firebase Auth, enable push, or distribute the iOS app.

## Project structure

| Path | Responsibility |
| --- | --- |
| `index.html` | Page shell and branded startup splash. |
| `src/app.js` | Customer/Manager views, routing, sheets, and UI event handling. |
| `src/store.js`, `src/firebase.js` | Shared shop state, Firestore synchronization, staff writes, and cache. |
| `src/data.js` | Small seed catalog/case, shop details, weekly hours, and staff allowlist. |
| `src/customer-model.js`, `src/customer-store.js`, `src/customer-ui.js` | Favorites/preferences, catalog filters, topic selection, and customer navigation/views. |
| `src/case-actions.js`, `src/presentation.js` | Swap/undo rules, stock expiry, notice/freshness logic, and status labels. |
| `src/notifications.js`, `src/push-config.js` | Native notification consent/topics, tap handling, and relay calls. |
| `src/flavor-name-fit.js` | Responsive whole-word fitting for freezer titles. |
| `src/staff-auth.js`, `src/staff-idle.js` | Staff authentication, password reset, and Manager idle sign-out. |
| `src/sheet-interactions.js`, `src/feedback.js`, `src/native-chrome.js` | Sheet gestures/keyboard behavior, haptics, and native chrome. |
| `src/*.css`, including `src/tablet.css` | Brand styling, freezer frame, phone/tablet layouts, and motion. |
| `public/`, `ios/` | Static assets and the native Xcode project. |
| `push-relay/` | Cloudflare Worker, D1 migration, configuration, and relay tests. |
| `scripts/enable-ios-push.mjs` | Validates the Firebase iOS plist before enabling the messaging plugin. |
| `test/`, `.github/workflows/pages.yml` | App tests and web deployment pipeline. |

## Current scope and limitations

- The app supports flavor discovery and shop updates. Ordering, checkout, payments, reservations, loyalty rewards, and automated inventory are not implemented.
- Customer favorites/preferences are device-local. There is no customer login or cloud backup/sync for favorites.
- The current catalog UI supports browsing and adding flavors; editing/deleting existing catalog entries is not exposed in Manager.
- Native push activation and physical-iPhone delivery verification remain outstanding. Browser push notifications are not implemented.
- Instagram updates are manual. [INSTAGRAM.md](INSTAGRAM.md) contains earlier planning notes for a possible automatic integration, not a deployed service; its Cloud Function proposal would need revisiting under the current cost constraint.
- The iOS project supports iPhone and iPad. An Android native project is not included.

For operational detail, use [FIRESTORE.md](FIRESTORE.md), [IOS.md](IOS.md), and [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md).
