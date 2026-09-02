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
4. A staff toast fires, then the app jumps back to Whats Out with "{flavor} just came out" and the new card on the board.
5. Add flavor (staff): name, note, dairy-free, scoop color. It lands in the catalog so you can swap it in.

On desktop the app is a 393px phone column, centered on cream.

Open a second tab to the same URL: a swap in one tab toasts and updates the eight cards in the other (localStorage plus storage events).

## iOS (Xcode)

Run the same What’s Out app on a simulator or iPhone. You need a Mac, Xcode, and an Apple Developer account ($99/year) to run on a physical iPhone.

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

One source of truth: in-memory store mirrored to localStorage key janartys-case-v1. Refresh keeps the case. Clear that key to restore the seed catalog and opening eight:

Double Chocolate, Andes Mint, Campfire, Thai Tea, Strawberries and Cream, Coffee (8th and Roast), Okinawa Sweet Potato, Butter Pecan.

Staff unlock lasts for the browser tab (sessionStorage). Close the tab to require sign-in again.

## Stack

Vite plus vanilla JS, wrapped with Capacitor for iOS. Mockups and brand tokens live in /workspace/janartys-research/mockups/.
