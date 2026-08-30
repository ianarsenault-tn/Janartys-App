# Janartys Whats Out

Playable mobile-first web app for Janartys Homemade Ice Cream (Smyrna).

One live case of 8 pans. Customers see Whats Out. Staff update the case from a hidden login — access is not documented here.

No cart, no loyalty, no ordering. The product is the case.

## Run

Install dependencies, then start the Vite dev server.

## How to tap through

1. Customer Whats Out is the default. Eight cards, dairy-free chips, just-out on the last swap.
2. Staff access is hidden and is not documented in this README.
3. After unlock: tap a pan. Pick a replacement from the catalog (flavors already in the case are hidden). Tap Swap pan.
4. A staff toast fires, then the app jumps back to Whats Out with the new card on the board.
5. Add flavor (staff): name, note, dairy-free, scoop color. It lands in the catalog so you can swap it in.

On desktop the app is a 393px phone column, centered on cream.

Open a second tab to the same URL: a swap in one tab toasts and updates the eight cards in the other (localStorage plus storage events).

## Data

One source of truth: in-memory store mirrored to localStorage key janartys-case-v1. Refresh keeps the case.

Staff unlock lasts for the browser tab (sessionStorage). Close the tab to require sign-in again.

## Stack

Vite plus vanilla JS.
