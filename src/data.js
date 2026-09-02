/** Seed catalog and opening case for Janarty’s. */

function scoop(light, deep) {
  return `radial-gradient(circle at 35% 30%, ${light}, ${deep})`;
}

export const SHOP_TZ = "America/Chicago";
export const SHOP_PHONE_TEL = "+16159180085";
export const SHOP_MAPS_URL =
  "https://maps.apple.com/?q=111%20Front%20Street%20Smyrna%20TN%2037167";
export const HOURS_DETAIL = "Wed–Sun 11:30am–9pm";
export const HOURS_BLURB = "Wed–Sun 11:30am–9pm · Closed Mon & Tue";

/** JS getDay: 0=Sun … 6=Sat. null = closed. Times are 24h Chicago. */
export const SEED_HOURS = {
  0: ["11:30", "21:00"],
  1: null,
  2: null,
  3: ["11:30", "21:00"],
  4: ["11:30", "21:00"],
  5: ["11:30", "21:00"],
  6: ["11:30", "21:00"],
};

export const SEED_CATALOG = [
  {
    id: "vanilla",
    name: "Vanilla",
    note: "Classic, clean, the baseline.",
    story:
      "Classic, clean, the baseline. The scoop you get when you just want ice cream, and it never fights the cone.",
    scoopColor: scoop("#FFF6D8", "#E8C98A"),
    dairyFree: false,
  },
  {
    id: "vanilla-bean",
    name: "Vanilla Bean",
    note: "Speckled, quiet, always works.",
    story:
      "Speckled with real bean. Quiet, a little richer than plain vanilla, and it always works.",
    scoopColor: scoop("#F7E7B8", "#D4B56A"),
    dairyFree: false,
  },
  {
    id: "double-chocolate",
    name: "Double Chocolate",
    note: "Deep cocoa. A house favorite, always on the board.",
    story:
      "One of the first flavors from day one. Deep cocoa, still a house favorite — we keep it on the board.",
    scoopColor: scoop("#7A4A32", "#4A2C1A"),
    dairyFree: false,
    tags: ["House favorite"],
  },
  {
    id: "peanut-butter",
    name: "Peanut Butter",
    note: "Salty-sweet, dense and nutty.",
    story:
      "Salty-sweet, dense and nutty. The kind you eat standing at the case before you’ve picked a second scoop.",
    scoopColor: scoop("#E8C48A", "#C48A3A"),
    dairyFree: false,
  },
  {
    id: "butter-pecan",
    name: "Butter Pecan",
    note: "Toasted pecans, brown butter.",
    story:
      "Toasted pecans, brown butter. Warm and a little toasty — a Front Street regular.",
    scoopColor: scoop("#F0D48A", "#D4A017"),
    dairyFree: false,
  },
  {
    id: "strawberries-cream",
    name: "Strawberries & Cream",
    note: "Fresh berry swirl, soft and bright.",
    story:
      "Fresh berry swirl, soft and bright. Tastes like strawberries when they’re actually in season.",
    scoopColor: scoop("#F4B4C0", "#E85A7A"),
    dairyFree: false,
  },
  {
    id: "cookies-cream",
    name: "Cookies & Cream",
    note: "Cookie crunch in a vanilla base.",
    story:
      "Cookie crunch in a vanilla base. Simple, and people ask for it by name.",
    scoopColor: scoop("#F2EEE8", "#6B5B56"),
    dairyFree: false,
  },
  {
    id: "coffee-8th-roast",
    name: "Coffee (8th & Roast)",
    note: "Local beans. Not too sweet.",
    story:
      "Locally roasted Nashville beans from 8th & Roast. Coffee ice cream that isn’t too sweet.",
    scoopColor: scoop("#8B6A4A", "#5C4033"),
    dairyFree: false,
  },
  {
    id: "cinnamon-brown-sugar",
    name: "Cinnamon Brown Sugar",
    note: "Warm spice, caramel edge.",
    story:
      "Warm spice, caramel edge. Like breakfast, but colder, and you don’t have to wait for Sunday.",
    scoopColor: scoop("#E8B878", "#A85C28"),
    dairyFree: false,
  },
  {
    id: "andes-mint",
    name: "Andes Mint",
    note: "Cool mint, dark chocolate shards.",
    story:
      "The other original from day one. Cool mint, dark chocolate shards — we still scoop it like we did then.",
    scoopColor: scoop("#6FCF97", "#2D6A4F"),
    dairyFree: false,
    tags: ["House favorite"],
  },
  {
    id: "banana-bean",
    name: "Banana Bean",
    note: "Ripe banana, vanilla specks.",
    story:
      "Ripe banana, vanilla specks. Soft and a little nostalgic, without tasting like candy.",
    scoopColor: scoop("#F6E27A", "#D4B02A"),
    dairyFree: false,
  },
  {
    id: "okinawa-sweet-potato",
    name: "Okinawa Sweet Potato",
    note: "Earthy, purple-gold, quietly rich.",
    story:
      "Earthy, purple-gold, quietly rich. One of our dairy-free scoops — people are surprised by it.",
    scoopColor: scoop("#C9B6F2", "#8B6BF0"),
    dairyFree: true,
  },
  {
    id: "blueberry-lavender",
    name: "Blueberry Lavender",
    note: "Berry and floral, a little wild.",
    story:
      "Berry and floral, a little wild. Not shy, and not a perfume counter either.",
    scoopColor: scoop("#B9A6E8", "#5C4AA8"),
    dairyFree: false,
  },
  {
    id: "earl-grey-lavender",
    name: "Earl Grey Lavender",
    note: "Tea-forward, citrus and bloom.",
    story:
      "Tea-forward, citrus and bloom. For people who like a slower scoop.",
    scoopColor: scoop("#D4C8E8", "#7A6B9A"),
    dairyFree: false,
  },
  {
    id: "rose-cardamom-pistachio",
    name: "Rose Cardamom Pistachio",
    note: "Floral, nutty, a Saturday night flavor.",
    story:
      "Floral, nutty, a Saturday night flavor. Don’t overthink it — just get the scoop.",
    scoopColor: scoop("#F4C4D0", "#C96B8A"),
    dairyFree: false,
  },
  {
    id: "orange-cardamom",
    name: "Orange Cardamom",
    note: "Bright peel, warm spice.",
    story:
      "Bright peel, warm spice. Clean and a little unexpected, in a good way.",
    scoopColor: scoop("#F6C07A", "#E07A2A"),
    dairyFree: false,
  },
  {
    id: "thai-tea",
    name: "Thai Tea",
    note: "Creamy, floral, a little sweet.",
    story:
      "Creamy, floral, a little sweet. Dairy-free, if that’s how you take it.",
    scoopColor: scoop("#F3C98A", "#D4893A"),
    dairyFree: true,
  },
  {
    id: "campfire",
    name: "Campfire",
    note: "Waffle cone bits and roasted marshmallow.",
    story:
      "Cold-smoked base, chocolate bits of our homemade waffle cones, roasted marshmallows. Tastes like the fire pit after dark.",
    scoopColor: scoop("#F0C36A", "#C4783A"),
    dairyFree: false,
  },
  {
    id: "brown-sugar-bourbon",
    name: "Brown Sugar Bourbon",
    note: "Deep caramel, a hint of oak.",
    story:
      "Infused with real bourbon. Deep caramel, a hint of oak — not a gimmick, just the flavor.",
    scoopColor: scoop("#D4A05A", "#8B4E24"),
    dairyFree: false,
    tags: ["Bourbon"],
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

export const SEED_INSTAGRAM = {
  imageUrl:
    "https://images.squarespace-cdn.com/content/v1/6373c84849d6135c07860be8/12c5500d-f311-422e-8e71-89dd9954c1ca/IMG_6631.jpeg?format=1000w",
  caption:
    "Small batch, on-site, always fresh ✨ Eight pans at a time so you get the good stuff. 100% gluten free · dairy-free options. See you on Front Street!",
  permalink: "https://www.instagram.com/janartys/",
  handle: "janartys",
  updatedAt: Date.now(),
};

export const FAVORITE_IDS = ["double-chocolate", "andes-mint", "vanilla-bean"];

export const STAFF_PASSWORD_HASH =
  "e971c330aab8741082ab062c2d63f754238c6f46aac59291b07beff6b5a87dd7";
export const STORAGE_KEY = "janartys-case-v1";
export const STAFF_SESSION_KEY = "janartys-staff-v2";
