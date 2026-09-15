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

// Minimal offline seed. Full catalog lives in Firestore shop/live after staff use.
export const SEED_CATALOG = [
  {
    id: "andes-mint",
    name: "Andes Mint",
    note: "Cool mint, dark chocolate shards.",
    story: "The other original from day one. Cool mint, dark chocolate shards \u2014 we still scoop it like we did then.",
    scoopColor: "radial-gradient(circle at 35% 30%, #6FCF97, #2D6A4F)",
    dairyFree: false,
    color: null,
    tags: ["House favorite"],
  },
  {
    id: "butter-pecan",
    name: "Butter Pecan",
    note: "Toasted pecans, brown butter.",
    story: "Toasted pecans, brown butter. Warm and a little toasty \u2014 a Front Street regular.",
    scoopColor: "radial-gradient(circle at 35% 30%, #F0D48A, #D4A017)",
    dairyFree: false,
    color: null,
    tags: [],
  },
  {
    id: "campfire",
    name: "Campfire",
    note: "Waffle cone bits and roasted marshmallow.",
    story: "Cold-smoked base, chocolate bits of our homemade waffle cones, roasted marshmallows. Tastes like the fire pit after dark.",
    scoopColor: "radial-gradient(circle at 35% 30%, #F0C36A, #C4783A)",
    dairyFree: false,
    color: null,
    tags: [],
  },
  {
    id: "coffee-8th-roast",
    name: "Coffee (8th & Roast)",
    note: "Local beans. Not too sweet.",
    story: "Locally roasted Nashville beans from 8th & Roast. Coffee ice cream that isn\u2019t too sweet.",
    scoopColor: "radial-gradient(circle at 35% 30%, #8B6A4A, #5C4033)",
    dairyFree: false,
    color: null,
    tags: [],
  },
  {
    id: "cookies-cream",
    name: "Cookies & Cream",
    note: "Cookie crunch in a vanilla base.",
    story: "Cookie crunch in a vanilla base. Simple, and people ask for it by name.",
    scoopColor: "radial-gradient(circle at 35% 30%, #F2EEE8, #6B5B56)",
    dairyFree: false,
    color: null,
    tags: [],
  },
  {
    id: "double-chocolate",
    name: "Double Chocolate",
    note: "Deep cocoa. A house favorite, always on the board.",
    story: "One of the first flavors from day one. Deep cocoa, still a house favorite \u2014 we keep it on the board.",
    scoopColor: "radial-gradient(circle at 35% 30%, #7A4A32, #4A2C1A)",
    dairyFree: false,
    color: null,
    tags: ["House favorite"],
  },
  {
    id: "okinawa-sweet-potato",
    name: "Okinawa Sweet Potato",
    note: "Earthy, purple-gold, quietly rich.",
    story: "Earthy, purple-gold, quietly rich. One of our dairy-free scoops \u2014 people are surprised by it.",
    scoopColor: "radial-gradient(circle at 35% 30%, #C9B6F2, #8B6BF0)",
    dairyFree: true,
    color: null,
    tags: [],
  },
  {
    id: "salted-caramel",
    name: "Salted Caramel",
    note: "Buttery caramel, a salt snap.",
    story: "Buttery caramel, a salt snap. A house flavor from the binder.",
    scoopColor: "radial-gradient(circle at 35% 30%, #FECA41, #D4A017)",
    dairyFree: false,
    color: null,
    tags: [],
  },
  {
    id: "strawberries-cream",
    name: "Strawberries & Cream",
    note: "Fresh berry swirl, soft and bright.",
    story: "Fresh berry swirl, soft and bright. Tastes like strawberries when they\u2019re actually in season.",
    scoopColor: "radial-gradient(circle at 35% 30%, #F4B4C0, #E85A7A)",
    dairyFree: false,
    color: null,
    tags: [],
  },
  {
    id: "thai-tea",
    name: "Thai Tea",
    note: "Creamy, floral, a little sweet.",
    story: "Creamy, floral, a little sweet. Dairy-free, if that\u2019s how you take it.",
    scoopColor: "radial-gradient(circle at 35% 30%, #F3C98A, #D4893A)",
    dairyFree: true,
    color: null,
    tags: [],
  },
  {
    id: "vanilla-bean",
    name: "Vanilla Bean",
    note: "Speckled, quiet, always works.",
    story: "Speckled with real bean. Quiet, a little richer than plain vanilla, and it always works.",
    scoopColor: "radial-gradient(circle at 35% 30%, #F7E7B8, #D4B56A)",
    dairyFree: false,
    color: null,
    tags: [],
  }
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

export const STAFF_EMAILS = [
  "ian.arsenault@yahoo.com",
  "janartys@gmail.com",
];
export const STORAGE_KEY = "janartys-case-v1";
export const STAFF_SESSION_KEY = "janartys-staff-v2";
