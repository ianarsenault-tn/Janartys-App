# Janartys Whats Out

Playable mobile-first web app for Janartys Homemade Ice Cream (Smyrna).

One live case of 8 pans. Customers see Whats Out. Staff update the case from a hidden login — access is not documented here.

No cart, no loyalty, no ordering. The product is the case.

Live on GitHub Pages: https://ianarsenault-tn.github.io/Janartys-App/

## Run

Install dependencies, then start the Vite dev server.

```
npm i
npm run dev
```

Production build (also used by GitHub Pages and Capacitor).

```
npm run build
```

## How to tap through

1. Customer Whats Out is the default. Eight cards, dairy-free chips, just-out on the last swap.
2. Staff access is hidden and is not documented in this README.
3. After unlock: tap a pan. Pick a replacement from the catalog (flavors already in the case are hidden). Tap Swap pan.
4. Staff stay in Manager after saving, with Undo swap available for five minutes. The customer freezer marks the incoming flavor Just out. Undo does not create another arrival alert.
5. Add flavor (staff): name, note, dairy-free, scoop color. It lands in the catalog so you can swap it in.
6. Customers use Flavors and Favorites to search the catalog, filter by freezer/dairy-free status, and save favorites on this device. Alerts offers separate favorite, new-flavor, and shop-announcement choices.
7. Staff can mark today's pints availability/running-low status from a pan, and preview a shop notice before posting.

Background iOS push is prepared but disabled until Apple/APNs and sender credentials are configured. See [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) for activation, delivery limits, and the no-paid-Firebase-services design.

On desktop the app is a 393px phone column, centered on cream.

Open two browsers (or a phone and a laptop) to the live app: a swap, notice, hours override, or Instagram save on one updates the other through Firestore. Same-browser tabs still cache in localStorage.

## iOS (Xcode)

Run the same What’s Out app on a simulator or iPhone using a Mac and Xcode. Native push distribution requires the appropriate Apple Developer signing and APNs configuration.

```
npm i
npm run cap:sync
npx cap open ios
```

The `ios/` folder is in this repo. If you ever need to regenerate it:

```
npx cap add ios
```

Then in Xcode:

1. Select the **App** target.
2. Signing & Capabilities → Team → your Apple Developer team.
3. Pick a simulator or a connected iPhone.
4. Run.

App icon: if Xcode still shows the default Capacitor icon, drop `public/heart-icon.png` (or `Janartys1.png` from the brand kit) into `ios/App/App/Assets.xcassets/AppIcon.appiconset`.

## Data

Live source of truth is Firestore document `shop/live` (Firebase project janarty-s): catalog, eight pan ids, last swap, last notice, hours override, Instagram card, and optional availability labels. Phones stay in sync.

localStorage key janartys-case-v1 is a cache and offline fallback. Customers can browse it when offline. Staff swaps, undo, notices, and availability saves require a successful server response. Customer launches never create or backfill Firestore documents; provision `shop/live` before using Manager. Favorites/preferences use a separate local-only `janartys-customer-v1` key.

Publish the rules in FIRESTORE.md (Firebase Console → Firestore → Rules → Publish) or production mode blocks writes.

Clear the localStorage key to drop the cache; the live doc still wins on the next snapshot.

Opening eight:

Double Chocolate, Andes Mint, Campfire, Thai Tea, Strawberries and Cream, Coffee (8th and Roast), Okinawa Sweet Potato, Butter Pecan.

Staff unlock lasts for the browser tab (sessionStorage). Close the tab to require sign-in again.

## Stack

Vite plus vanilla JS, Firebase Firestore for the live case, wrapped with Capacitor for iOS. Mockups and brand tokens live in /workspace/janartys-research/mockups/.


## Tests

```
npm test
```

Tests cover app/data smoke checks, presentation, favorite consent/filtering/topics, swap concurrency guards, undo, and daily availability expiry. Run `npm ci --prefix push-relay` and `npm run test:relay` for authorization, deduplication, and send-cap tests.

## Instagram

Manager can still paste an image URL + caption for What’s Out. Moving to the official Instagram Graph API needs a Meta Business app tied to @janartys, Instagram Graph permissions, and a small server or Cloud Function to refresh tokens — never put a long-lived Meta secret in the Capacitor client. Staff-paste remains the interim.
