# Janartys App

Live ice cream case for Janarty's Homemade Ice Cream in Smyrna, TN.

Customers see What's Out (today's eight pans). Staff swap a pan behind a PIN, and can add new flavors to the catalog. No cart, no ordering. The product is the case.

Repo: https://github.com/ianarsenault-tn/Janartys-App

## Run

    npm install
    npm run dev

Open the URL Vite prints. On a phone it fills the screen. On a computer it shows as a phone-width column.

## Try it

1. What's Out is the home screen.
2. Tap Manager. PIN is **2018**.
3. Tap a pan, pick a replacement, tap Swap pan. Customers get a toast.
4. Add flavor (name, note, dairy-free, color), then swap it into the case.

Open a second tab at the same URL: a swap in one tab updates the other.

## Seed case

Double Chocolate, Andes Mint, Campfire, Thai Tea, Strawberries and Cream, Coffee (8th and Roast), Okinawa Sweet Potato, Butter Pecan.

Clear localStorage key janartys-case-v1 to restore the seed.
