/** Seed catalog and opening case for Janarty’s. */

function scoop(light, deep) {
  return `radial-gradient(circle at 35% 30%, ${light}, ${deep})`;
}

export const SEED_CATALOG = [
  {
    id: "vanilla",
    name: "Vanilla",
    note: "Classic, clean, the baseline.",
    scoopColor: scoop("#FFF6D8", "#E8C98A"),
    dairyFree: false,
  },
  {
    id: "vanilla-bean",
    name: "Vanilla Bean",
    note: "Speckled, quiet, always works.",
    scoopColor: scoop("#F7E7B8", "#D4B56A"),
    dairyFree: false,
  },
  {
    id: "double-chocolate",
    name: "Double Chocolate",
    note: "Deep cocoa. A house favorite, always on the board.",
    scoopColor: scoop("#7A4A32", "#4A2C1A"),
    dairyFree: false,
  },
  {
    id: "peanut-butter",
    name: "Peanut Butter",
    note: "Salty-sweet, dense and nutty.",
    scoopColor: scoop("#E8C48A", "#C48A3A"),
    dairyFree: false,
  },
  {
    id: "butter-pecan",
    name: "Butter Pecan",
    note: "Toasted pecans, brown butter.",
    scoopColor: scoop("#F0D48A", "#D4A017"),
    dairyFree: false,
  },
  {
    id: "strawberries-cream",
    name: "Strawberries & Cream",
    note: "Fresh berry swirl, soft and bright.",
    scoopColor: scoop("#F4B4C0", "#E85A7A"),
    dairyFree: false,
  },
  {
    id: "cookies-cream",
    name: "Cookies & Cream",
    note: "Cookie crunch in a vanilla base.",
    scoopColor: scoop("#F2EEE8", "#6B5B56"),
    dairyFree: false,
  },
  {
    id: "coffee-8th-roast",
    name: "Coffee (8th & Roast)",
    note: "Local beans. Not too sweet.",
    scoopColor: scoop("#8B6A4A", "#5C4033"),
    dairyFree: false,
  },
  {
    id: "cinnamon-brown-sugar",
    name: "Cinnamon Brown Sugar",
    note: "Warm spice, caramel edge.",
    scoopColor: scoop("#E8B878", "#A85C28"),
    dairyFree: false,
  },
  {
    id: "andes-mint",
    name: "Andes Mint",
    note: "Cool mint, dark chocolate shards.",
    scoopColor: scoop("#6FCF97", "#2D6A4F"),
    dairyFree: false,
  },
  {
    id: "banana-bean",
    name: "Banana Bean",
    note: "Ripe banana, vanilla specks.",
    scoopColor: scoop("#F6E27A", "#D4B02A"),
    dairyFree: false,
  },
  {
    id: "okinawa-sweet-potato",
    name: "Okinawa Sweet Potato",
    note: "Earthy, purple-gold, quietly rich.",
    scoopColor: scoop("#C9B6F2", "#8B6BF0"),
    dairyFree: true,
  },
  {
    id: "blueberry-lavender",
    name: "Blueberry Lavender",
    note: "Berry and floral, a little wild.",
    scoopColor: scoop("#B9A6E8", "#5C4AA8"),
    dairyFree: false,
  },
  {
    id: "earl-grey-lavender",
    name: "Earl Grey Lavender",
    note: "Tea-forward, citrus and bloom.",
    scoopColor: scoop("#D4C8E8", "#7A6B9A"),
    dairyFree: false,
  },
  {
    id: "rose-cardamom-pistachio",
    name: "Rose Cardamom Pistachio",
    note: "Floral, nutty, a Saturday night flavor.",
    scoopColor: scoop("#F4C4D0", "#C96B8A"),
    dairyFree: false,
  },
  {
    id: "orange-cardamom",
    name: "Orange Cardamom",
    note: "Bright peel, warm spice.",
    scoopColor: scoop("#F6C07A", "#E07A2A"),
    dairyFree: false,
  },
  {
    id: "thai-tea",
    name: "Thai Tea",
    note: "Creamy, floral, a little sweet.",
    scoopColor: scoop("#F3C98A", "#D4893A"),
    dairyFree: true,
  },
  {
    id: "campfire",
    name: "Campfire",
    note: "Waffle cone bits and roasted marshmallow.",
    scoopColor: scoop("#F0C36A", "#C4783A"),
    dairyFree: false,
  },
  {
    id: "brown-sugar-bourbon",
    name: "Brown Sugar Bourbon",
    note: "Deep caramel, a hint of oak.",
    scoopColor: scoop("#D4A05A", "#8B4E24"),
    dairyFree: false,
  },
];

export const SEED_CASE = [
  "double-chocolate",
  "andes-mint",
  "campfire",
  "thai-tea",
  "strawberries-cream",
  "coffee-8th-roast",
  "okinawa-sweet-potato",
  "butter-pecan",
];

export const FAVORITE_IDS = ["double-chocolate", "andes-mint", "vanilla-bean"];

export const STAFF_PASSWORD_HASH =
  "e971c330aab8741082ab062c2d63f754238c6f46aac59291b07beff6b5a87dd7";
export const STORAGE_KEY = "janartys-case-v1";
export const STAFF_SESSION_KEY = "janartys-staff-v3";
