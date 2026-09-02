/** Seed catalog and opening case for Janarty’s. */

function scoop(light, deep) {
  return `radial-gradient(circle at 35% 30%, ${light}, ${deep})`;
}

export const SHOP_TZ = "America/Chicago";
export const SHOP_PHONE_TEL = "+16159180085";
export const SHOP_MAPS_URL =
  "https://maps.apple.com/?q=111%20Front%20Street%20Smyrna%20TN%2037167";
export const HOURS_DETAIL = "Wed\u2013Sun 11:30am\u20139pm";
export const HOURS_BLURB = "Wed\u2013Sun 11:30am\u20139pm \u00b7 Closed Mon & Tue";

/** JS getDay: 0=Sun \u2026 6=Sat. null = closed. Times are 24h Chicago. */
export const SEED_HOURS = {
  0: ["11:30", "21:00"],
  1: null,
  2: null,
  3: ["11:30", "21:00"],
  4: ["11:30", "21:00"],
  5: ["11:30", "21:00"],
  6: ["11:30", "21:00"],
};
