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
  {
    id: "key-lime-pie",
    name: "Key Lime Pie",
    note: "Tart lime, graham-sweet.",
    story:
      "Tart lime, graham-sweet. A house flavor from the binder.",
    scoopColor: scoop("#F0FFA4", "#C6E27A"),
    dairyFree: false,
  },
  {
    id: "candy-bar-blast",
    name: "Candy Bar Blast",
    note: "Chocolate, nougat, a little crunch.",
    story:
      "Chocolate, nougat, a little crunch. A house flavor from the binder.",
    scoopColor: scoop("#EEB474", "#C48A4A"),
    dairyFree: false,
  },
  {
    id: "birthday-cake",
    name: "Birthday Cake",
    note: "Frosting-sweet, party sprinkle energy.",
    story:
      "Frosting-sweet, party sprinkle energy. A house flavor from the binder.",
    scoopColor: scoop("#FFDEFA", "#F4B4D0"),
    dairyFree: false,
  },
  {
    id: "cookies-cream-df",
    name: "Cookies N Cream (Dairy-Free)",
    note: "Cookie crunch in a dairy-free base.",
    story:
      "Cookie crunch in a dairy-free base. A house flavor from the binder.",
    scoopColor: scoop("#FFFFFF", "#F2EEE8"),
    dairyFree: true,
  },
  {
    id: "bananas-foster",
    name: "Bananas Foster",
    note: "Caramelized banana, warm rum-brown sugar.",
    story:
      "Caramelized banana, warm rum-brown sugar. A house flavor from the binder.",
    scoopColor: scoop("#FFED94", "#F0C36A"),
    dairyFree: false,
  },
  {
    id: "candy-cane",
    name: "Candy Cane",
    note: "Peppermint, cool and Christmas-bright.",
    story:
      "Peppermint, cool and Christmas-bright. A house flavor from the binder.",
    scoopColor: scoop("#FF8494", "#E85A6A"),
    dairyFree: false,
  },
  {
    id: "caramel-apple",
    name: "Caramel Apple",
    note: "Green apple, caramel dip.",
    story:
      "Green apple, caramel dip. A house flavor from the binder.",
    scoopColor: scoop("#FEB364", "#D4893A"),
    dairyFree: false,
  },
  {
    id: "cherry-blossom",
    name: "Cherry Blossom",
    note: "Soft floral cherry, spring-pink.",
    story:
      "Soft floral cherry, spring-pink. A house flavor from the binder.",
    scoopColor: scoop("#FFDEF2", "#F4B4C8"),
    dairyFree: false,
  },
  {
    id: "chocolate-orange",
    name: "Chocolate Orange",
    note: "Cocoa with a bright peel finish.",
    story:
      "Cocoa with a bright peel finish. A house flavor from the binder.",
    scoopColor: scoop("#EE8452", "#C45A28"),
    dairyFree: false,
  },
  {
    id: "caramel-crunch",
    name: "Caramel Crunch",
    note: "Buttery caramel with a snap.",
    story:
      "Buttery caramel with a snap. A house flavor from the binder.",
    scoopColor: scoop("#FFCA74", "#E0A04A"),
    dairyFree: false,
  },
  {
    id: "cherry-cola",
    name: "Cherry Cola",
    note: "Soda-shop cherry, a little fizz in the flavor.",
    story:
      "Soda-shop cherry, a little fizz in the flavor. A house flavor from the binder.",
    scoopColor: scoop("#B54869", "#8B1E3F"),
    dairyFree: false,
  },
  {
    id: "chocolate-coconut-curry",
    name: "Chocolate Coconut Curry",
    note: "Cocoa, coconut, a warm spice edge.",
    story:
      "Cocoa, coconut, a warm spice edge. A house flavor from the binder.",
    scoopColor: scoop("#B5784E", "#8B4E24"),
    dairyFree: false,
  },
  {
    id: "thin-mint",
    name: "Thin Mint",
    note: "Crisp mint cookie, dark chocolate.",
    story:
      "Crisp mint cookie, dark chocolate. A house flavor from the binder.",
    scoopColor: scoop("#579479", "#2D6A4F"),
    dairyFree: false,
  },
  {
    id: "valentines-day-cake",
    name: "Valentine's Day Cake",
    note: "Pink cake, frosting, heart-box energy.",
    story:
      "Pink cake, frosting, heart-box energy. A house flavor from the binder.",
    scoopColor: scoop("#FF84A4", "#E85A7A"),
    dairyFree: false,
  },
  {
    id: "watermelon",
    name: "Watermelon",
    note: "Juicy, cold, summer-stand simple.",
    story:
      "Juicy, cold, summer-stand simple. A house flavor from the binder.",
    scoopColor: scoop("#FF8494", "#E85A6A"),
    dairyFree: false,
  },
  {
    id: "white-chocolate-candy-cane",
    name: "White Chocolate Candy Cane",
    note: "White cocoa and peppermint.",
    story:
      "White cocoa and peppermint. A house flavor from the binder.",
    scoopColor: scoop("#FFFAFE", "#F4D0D4"),
    dairyFree: false,
  },
  {
    id: "cinnamon-peach",
    name: "Cinnamon Peach",
    note: "Ripe peach, warm cinnamon.",
    story:
      "Ripe peach, warm cinnamon. A house flavor from the binder.",
    scoopColor: scoop("#FFA454", "#E07A2A"),
    dairyFree: false,
  },
  {
    id: "jasmine-yuzu",
    name: "Jasmine Yuzu",
    note: "Floral tea, citrus snap.",
    story:
      "Floral tea, citrus snap. A house flavor from the binder.",
    scoopColor: scoop("#FFFEB4", "#E8D48A"),
    dairyFree: false,
  },
  {
    id: "strawberry-guava-colada",
    name: "Strawberry Guava Colada",
    note: "Strawberry, guava, coconut.",
    story:
      "Strawberry, guava, coconut. A house flavor from the binder.",
    scoopColor: scoop("#FFA484", "#E07A5A"),
    dairyFree: false,
  },
  {
    id: "strawberry-lemon",
    name: "Strawberry Lemon",
    note: "Berry and lemon, bright and clean.",
    story:
      "Berry and lemon, bright and clean. A house flavor from the binder.",
    scoopColor: scoop("#FFCAD2", "#F4A0A8"),
    dairyFree: false,
  },
  {
    id: "strawberry-milk",
    name: "Strawberry Milk",
    note: "Soft pink, childhood-carton sweet.",
    story:
      "Soft pink, childhood-carton sweet. A house flavor from the binder.",
    scoopColor: scoop("#FFDEEA", "#F4B4C0"),
    dairyFree: false,
  },
  {
    id: "strawberry-rhubarb",
    name: "Strawberry Rhubarb",
    note: "Berry and tart stalk, pie-adjacent.",
    story:
      "Berry and tart stalk, pie-adjacent. A house flavor from the binder.",
    scoopColor: scoop("#FE8494", "#D45A6A"),
    dairyFree: false,
  },
  {
    id: "strawberry-shortcake",
    name: "Strawberry Shortcake",
    note: "Biscuit, cream, strawberries.",
    story:
      "Biscuit, cream, strawberries. A house flavor from the binder.",
    scoopColor: scoop("#FFD2DE", "#F4A8B4"),
    dairyFree: false,
  },
  {
    id: "sugar-plum-berry",
    name: "Sugar Plum Berry",
    note: "Plum-berry, a little fairy-tale.",
    story:
      "Plum-berry, a little fairy-tale. A house flavor from the binder.",
    scoopColor: scoop("#B574D2", "#8B4AA8"),
    dairyFree: false,
  },
  {
    id: "sweet-lemon",
    name: "Sweet Lemon",
    note: "Soft lemon, not a pucker.",
    story:
      "Soft lemon, not a pucker. A house flavor from the binder.",
    scoopColor: scoop("#FFFFA4", "#F6E27A"),
    dairyFree: false,
  },
  {
    id: "sweet-potato-toasted-marshmallow",
    name: "Sweet Potato with Toasted Marshmallow",
    note: "Roasted sweet potato, campfire marshmallow.",
    story:
      "Roasted sweet potato, campfire marshmallow. A house flavor from the binder.",
    scoopColor: scoop("#FFCA84", "#E8A05A"),
    dairyFree: false,
  },
  {
    id: "alices-blueberry-muffin",
    name: "Alice's Blueberry Muffin",
    note: "Blueberry muffin, bakery-case sweet.",
    story:
      "Blueberry muffin, bakery-case sweet. A house flavor from the binder.",
    scoopColor: scoop("#8694DA", "#5C6AB0"),
    dairyFree: false,
  },
  {
    id: "apple-bourbon",
    name: "Apple Bourbon",
    note: "Baked apple, a little oak.",
    story:
      "Baked apple, a little oak. A house flavor from the binder.",
    scoopColor: scoop("#EE8452", "#C45A28"),
    dairyFree: false,
    tags: ["Bourbon"],
  },
  {
    id: "apple-cinnamon",
    name: "Apple Cinnamon",
    note: "Orchard apple, warm spice.",
    story:
      "Orchard apple, warm spice. A house flavor from the binder.",
    scoopColor: scoop("#EEA264", "#C4783A"),
    dairyFree: false,
  },
  {
    id: "backyard-mint",
    name: "Backyard Mint",
    note: "Garden mint, cooler than the case.",
    story:
      "Garden mint, cooler than the case. A house flavor from the binder.",
    scoopColor: scoop("#579479", "#2D6A4F"),
    dairyFree: false,
  },
  {
    id: "banana-split",
    name: "Banana Split",
    note: "Banana, strawberry, sundae energy.",
    story:
      "Banana, strawberry, sundae energy. A house flavor from the binder.",
    scoopColor: scoop("#FFEAA4", "#F6C07A"),
    dairyFree: false,
  },
  {
    id: "blueberry-matcha-muffin",
    name: "Blueberry Matcha Muffin",
    note: "Blueberry muffin with a green-tea lift.",
    story:
      "Blueberry muffin with a green-tea lift. A house flavor from the binder.",
    scoopColor: scoop("#99C594", "#6F9B6A"),
    dairyFree: false,
  },
  {
    id: "blueberry-muffin",
    name: "Blueberry Muffin",
    note: "Bakery blueberry, breakfast-as-a-scoop.",
    story:
      "Bakery blueberry, breakfast-as-a-scoop. A house flavor from the binder.",
    scoopColor: scoop("#8694DA", "#5C6AB0"),
    dairyFree: false,
  },
  {
    id: "cherry-goat-cheese",
    name: "Cherry Goat Cheese",
    note: "Cherry over a tangy goat-cheese base.",
    story:
      "Cherry over a tangy goat-cheese base. A house flavor from the binder.",
    scoopColor: scoop("#EE6584", "#C43B5A"),
    dairyFree: false,
  },
  {
    id: "cherry-limemade",
    name: "Cherry Limemade",
    note: "Cherry and lime, stand-in-the-sun.",
    story:
      "Cherry and lime, stand-in-the-sun. A house flavor from the binder.",
    scoopColor: scoop("#F0FFA4", "#C6E27A"),
    dairyFree: false,
  },
  {
    id: "chili-candy",
    name: "Chili Candy",
    note: "Sweet heat, candy-shop chile.",
    story:
      "Sweet heat, candy-shop chile. A house flavor from the binder.",
    scoopColor: scoop("#FF8452", "#E05A28"),
    dairyFree: false,
  },
  {
    id: "chipotle-mango",
    name: "Chipotle Mango",
    note: "Ripe mango, smoky chile.",
    story:
      "Ripe mango, smoky chile. A house flavor from the binder.",
    scoopColor: scoop("#FFA454", "#E07A2A"),
    dairyFree: false,
  },
  {
    id: "chocolate-brownie",
    name: "Chocolate Brownie",
    note: "Cocoa with brownie chunks.",
    story:
      "Cocoa with brownie chunks. A house flavor from the binder.",
    scoopColor: scoop("#865D41", "#5C3317"),
    dairyFree: false,
  },
  {
    id: "chocolate-coconut-cake",
    name: "Chocolate Coconut Cake",
    note: "Layer-cake cocoa and coconut.",
    story:
      "Layer-cake cocoa and coconut. A house flavor from the binder.",
    scoopColor: scoop("#A4745C", "#7A4A32"),
    dairyFree: false,
  },
  {
    id: "chai-coffee",
    name: "Chai Coffee",
    note: "Chai spice in a coffee scoop.",
    story:
      "Chai spice in a coffee scoop. A house flavor from the binder.",
    scoopColor: scoop("#B59474", "#8B6A4A"),
    dairyFree: false,
  },
  {
    id: "chocolate-peppermint-pattie",
    name: "Chocolate Peppermint Pattie",
    note: "Dark chocolate, cool peppermint center.",
    story:
      "Dark chocolate, cool peppermint center. A house flavor from the binder.",
    scoopColor: scoop("#745644", "#4A2C1A"),
    dairyFree: false,
  },
  {
    id: "red-velvet",
    name: "Red Velvet",
    note: "Cocoa-cake red, a little cream cheese.",
    story:
      "Cocoa-cake red, a little cream cheese. A house flavor from the binder.",
    scoopColor: scoop("#D24869", "#A81E3F"),
    dairyFree: false,
  },
  {
    id: "raspberry-chocolate",
    name: "Raspberry with Chocolate",
    note: "Raspberry with chocolate shards.",
    story:
      "Raspberry with chocolate shards. A house flavor from the binder.",
    scoopColor: scoop("#B54869", "#8B1E3F"),
    dairyFree: false,
  },
  {
    id: "rose-berry-hibiscus",
    name: "Rose Berry Hibiscus",
    note: "Rose, berry, hibiscus tart.",
    story:
      "Rose, berry, hibiscus tart. A house flavor from the binder.",
    scoopColor: scoop("#F395B4", "#C96B8A"),
    dairyFree: false,
  },
  {
    id: "roys-peanut-butter",
    name: "Roy's Peanut Butter",
    note: "House peanut butter, extra nutty.",
    story:
      "House peanut butter, extra nutty. A house flavor from the binder.",
    scoopColor: scoop("#EEB464", "#C48A3A"),
    dairyFree: false,
  },
  {
    id: "salted-caramel",
    name: "Salted Caramel",
    note: "Buttery caramel, a salt snap.",
    story:
      "Buttery caramel, a salt snap. A house flavor from the binder.",
    scoopColor: scoop("#FECA41", "#D4A017"),
    dairyFree: false,
  },
  {
    id: "salted-caramel-coffee",
    name: "Salted Caramel Coffee",
    note: "Coffee under salted caramel.",
    story:
      "Coffee under salted caramel. A house flavor from the binder.",
    scoopColor: scoop("#B5784E", "#8B4E24"),
    dairyFree: false,
  },
  {
    id: "salted-caramel-corn",
    name: "Salted Caramel Corn",
    note: "Caramel corn in a scoop.",
    story:
      "Caramel corn in a scoop. A house flavor from the binder.",
    scoopColor: scoop("#FFCA74", "#E0A04A"),
    dairyFree: false,
  },
  {
    id: "summer-melon",
    name: "Summer Melon",
    note: "Honeydew-cool, porch-weather.",
    story:
      "Honeydew-cool, porch-weather. A house flavor from the binder.",
    scoopColor: scoop("#D2FEB4", "#A8D48A"),
    dairyFree: false,
  },
  {
    id: "salted-pretzel-heath",
    name: "Salted Pretzel Heath",
    note: "Pretzel salt, toffee crunch.",
    story:
      "Pretzel salt, toffee crunch. A house flavor from the binder.",
    scoopColor: scoop("#EEB474", "#C48A4A"),
    dairyFree: false,
  },
  {
    id: "cotton-candy",
    name: "Cotton Candy",
    note: "Fair-stand pink and blue.",
    story:
      "Fair-stand pink and blue. A house flavor from the binder.",
    scoopColor: scoop("#F3E0FF", "#C9B6F2"),
    dairyFree: false,
  },
  {
    id: "cookie-dough",
    name: "Cookie Dough",
    note: "Vanilla base, dough chunks.",
    story:
      "Vanilla base, dough chunks. A house flavor from the binder.",
    scoopColor: scoop("#FFEEB4", "#E8C48A"),
    dairyFree: false,
  },
  {
    id: "cookies-n-scream",
    name: "Cookies N' Scream",
    note: "Cookies and cream, Halloween-spooky.",
    story:
      "Cookies and cream, Halloween-spooky. A house flavor from the binder.",
    scoopColor: scoop("#443C3A", "#1A1210"),
    dairyFree: false,
  },
  {
    id: "salted-peanut-butter-honey",
    name: "Salted Peanut Butter Honey",
    note: "Peanut butter, honey, a little salt.",
    story:
      "Peanut butter, honey, a little salt. A house flavor from the binder.",
    scoopColor: scoop("#FECA84", "#D4A05A"),
    dairyFree: false,
  },
  {
    id: "crunchie-honeycomb-bar",
    name: "Crunchie Honeycomb Bar",
    note: "Honeycomb crunch, chocolate-bar snap.",
    story:
      "Honeycomb crunch, chocolate-bar snap. A house flavor from the binder.",
    scoopColor: scoop("#FFCA74", "#E0A04A"),
    dairyFree: false,
  },
  {
    id: "dark-cherry",
    name: "Dark Cherry",
    note: "Deep cherry, not candy-red.",
    story:
      "Deep cherry, not candy-red. A house flavor from the binder.",
    scoopColor: scoop("#953C52", "#6B1228"),
    dairyFree: false,
  },
  {
    id: "earl-grey-cranberry-rum",
    name: "Earl Grey Cranberry Rum",
    note: "Tea, cranberry, a rum warmth.",
    story:
      "Tea, cranberry, a rum warmth. A house flavor from the binder.",
    scoopColor: scoop("#A495C4", "#7A6B9A"),
    dairyFree: false,
    tags: ["Bourbon"],
  },
  {
    id: "orange-dreamsicle",
    name: "Orange Dreamsicle",
    note: "Orange cream, popsicle nostalgia.",
    story:
      "Orange cream, popsicle nostalgia. A house flavor from the binder.",
    scoopColor: scoop("#FFCA84", "#F6A05A"),
    dairyFree: false,
  },
  {
    id: "orange-5-spice",
    name: "Orange 5-Spice",
    note: "Orange peel, star anise, warm spice.",
    story:
      "Orange peel, star anise, warm spice. A house flavor from the binder.",
    scoopColor: scoop("#FFA454", "#E07A2A"),
    dairyFree: false,
  },
  {
    id: "peach-iced-tea",
    name: "Peach Iced Tea",
    note: "Peach over sweet tea.",
    story:
      "Peach over sweet tea. A house flavor from the binder.",
    scoopColor: scoop("#FFF3B4", "#F3C98A"),
    dairyFree: false,
  },
  {
    id: "peachy-keen",
    name: "Peachy Keen",
    note: "Ripe peach, simple and sunny.",
    story:
      "Ripe peach, simple and sunny. A house flavor from the binder.",
    scoopColor: scoop("#FFCA84", "#F6A05A"),
    dairyFree: false,
  },
  {
    id: "peanut-butter-banana",
    name: "Peanut Butter Banana",
    note: "PB and banana, lunchbox classic.",
    story:
      "PB and banana, lunchbox classic. A house flavor from the binder.",
    scoopColor: scoop("#FFEEB4", "#E8C48A"),
    dairyFree: false,
  },
  {
    id: "peanut-butter-cup",
    name: "Peanut Butter Cup",
    note: "Chocolate cup, peanut butter center.",
    story:
      "Chocolate cup, peanut butter center. A house flavor from the binder.",
    scoopColor: scoop("#A4745C", "#7A4A32"),
    dairyFree: false,
  },
  {
    id: "peanut-butter-jelly",
    name: "Peanut Butter and Jelly",
    note: "PB&J in a scoop.",
    story:
      "PB&J in a scoop. A house flavor from the binder.",
    scoopColor: scoop("#B574D2", "#8B4AA8"),
    dairyFree: false,
  },
  {
    id: "pina-colada",
    name: "Piña Colada",
    note: "Pineapple, coconut, vacation.",
    story:
      "Pineapple, coconut, vacation. A house flavor from the binder.",
    scoopColor: scoop("#FFFFA4", "#F6E27A"),
    dairyFree: false,
  },
  {
    id: "honey-jalapeno",
    name: "Honey Jalapeño",
    note: "Honey-sweet, jalapeño heat.",
    story:
      "Honey-sweet, jalapeño heat. A house flavor from the binder.",
    scoopColor: scoop("#F0FFA4", "#C6E27A"),
    dairyFree: false,
  },
  {
    id: "huckleberry",
    name: "Huckleberry",
    note: "Wild berry, a little mountain.",
    story:
      "Wild berry, a little mountain. A house flavor from the binder.",
    scoopColor: scoop("#8674D2", "#5C4AA8"),
    dairyFree: false,
  },
  {
    id: "jalapeno-bacon",
    name: "Jalapeño Bacon",
    note: "Smoke, heat, breakfast-adjacent.",
    story:
      "Smoke, heat, breakfast-adjacent. A house flavor from the binder.",
    scoopColor: scoop("#D28652", "#A85C28"),
    dairyFree: false,
  },
  {
    id: "lemon-basil",
    name: "Lemon Basil",
    note: "Lemon and garden basil.",
    story:
      "Lemon and garden basil. A house flavor from the binder.",
    scoopColor: scoop("#F0FFA4", "#C6E27A"),
    dairyFree: false,
  },
  {
    id: "lemon-lavender",
    name: "Lemon Lavender",
    note: "Lemon with a lavender lift.",
    story:
      "Lemon with a lavender lift. A house flavor from the binder.",
    scoopColor: scoop("#FEF2FF", "#D4C8E8"),
    dairyFree: false,
  },
  {
    id: "lemon-poppy-seed",
    name: "Lemon Poppy Seed",
    note: "Lemon cake, poppy crunch.",
    story:
      "Lemon cake, poppy crunch. A house flavor from the binder.",
    scoopColor: scoop("#FFFFA4", "#F6E27A"),
    dairyFree: false,
  },
  {
    id: "lemon-pound-cake",
    name: "Lemon Pound Cake",
    note: "Buttery lemon cake.",
    story:
      "Buttery lemon cake. A house flavor from the binder.",
    scoopColor: scoop("#FFFEB4", "#F0D48A"),
    dairyFree: false,
  },
  {
    id: "lemon-strawberry-cake",
    name: "Lemon Strawberry Cake",
    note: "Lemon cake, strawberry.",
    story:
      "Lemon cake, strawberry. A house flavor from the binder.",
    scoopColor: scoop("#FFD2DE", "#F4A8B4"),
    dairyFree: false,
  },
  {
    id: "earl-grey-berry",
    name: "Earl Grey Berry",
    note: "Earl Grey with mixed berry.",
    story:
      "Earl Grey with mixed berry. A house flavor from the binder.",
    scoopColor: scoop("#A495C4", "#7A6B9A"),
    dairyFree: false,
  },
  {
    id: "egg-nog",
    name: "Egg Nog",
    note: "Holiday nog, nutmeg on top.",
    story:
      "Holiday nog, nutmeg on top. A house flavor from the binder.",
    scoopColor: scoop("#FFFEB4", "#F0D48A"),
    dairyFree: false,
    tags: ["Contains egg"],
  },
  {
    id: "franken-mint",
    name: "Franken-Mint",
    note: "Mint, Halloween-green.",
    story:
      "Mint, Halloween-green. A house flavor from the binder.",
    scoopColor: scoop("#579479", "#2D6A4F"),
    dairyFree: false,
  },
  {
    id: "fruity-pebbles",
    name: "Fruity Pebbles",
    note: "Cereal crunch, Saturday-morning.",
    story:
      "Cereal crunch, Saturday-morning. A house flavor from the binder.",
    scoopColor: scoop("#FF84A4", "#E85A7A"),
    dairyFree: false,
  },
  {
    id: "gingerbread-cookie",
    name: "Gingerbread Cookie",
    note: "Ginger cookie, December spice.",
    story:
      "Ginger cookie, December spice. A house flavor from the binder.",
    scoopColor: scoop("#D28652", "#A85C28"),
    dairyFree: false,
  },
  {
    id: "guava-cheesecake",
    name: "Guava Cheesecake",
    note: "Guava over cheesecake.",
    story:
      "Guava over cheesecake. A house flavor from the binder.",
    scoopColor: scoop("#FFA4B4", "#E07A8A"),
    dairyFree: false,
  },
  {
    id: "hot-apple-chai",
    name: "Hot Apple Chai",
    note: "Baked apple, chai spice.",
    story:
      "Baked apple, chai spice. A house flavor from the binder.",
    scoopColor: scoop("#EEA264", "#C4783A"),
    dairyFree: false,
  },
  {
    id: "honey-lavender",
    name: "Honey Lavender",
    note: "Honey and lavender, quiet floral.",
    story:
      "Honey and lavender, quiet floral. A house flavor from the binder.",
    scoopColor: scoop("#FFFEB4", "#E8D48A"),
    dairyFree: false,
  },
  {
    id: "smoked-cardamom-pistachio",
    name: "Smoked Cardamom Pistachio",
    note: "Pistachio, smoked cardamom.",
    story:
      "Pistachio, smoked cardamom. A house flavor from the binder.",
    scoopColor: scoop("#99C594", "#6F9B6A"),
    dairyFree: false,
  },
  {
    id: "spiced-caramel-latte",
    name: "Spiced Caramel Latte",
    note: "Latte, caramel, a little spice.",
    story:
      "Latte, caramel, a little spice. A house flavor from the binder.",
    scoopColor: scoop("#B5784E", "#8B4E24"),
    dairyFree: false,
  },
  {
    id: "spiced-coconut",
    name: "Spiced Coconut",
    note: "Coconut with cinnamon and cardamom.",
    story:
      "Coconut with cinnamon and cardamom. A house flavor from the binder.",
    scoopColor: scoop("#FFEEB4", "#E8C48A"),
    dairyFree: false,
  },
  {
    id: "spiced-cranberry-orange",
    name: "Spiced Cranberry Orange",
    note: "Cranberry, orange, holiday spice.",
    story:
      "Cranberry, orange, holiday spice. A house flavor from the binder.",
    scoopColor: scoop("#EE6574", "#C43B4A"),
    dairyFree: false,
  },
  {
    id: "strawberry-banana",
    name: "Strawberry Banana",
    note: "Strawberry and banana, smoothie-simple.",
    story:
      "Strawberry and banana, smoothie-simple. A house flavor from the binder.",
    scoopColor: scoop("#FFDEEA", "#F4B4C0"),
    dairyFree: false,
  },
  {
    id: "strawberry-basil",
    name: "Strawberry Basil",
    note: "Strawberry with a basil snap.",
    story:
      "Strawberry with a basil snap. A house flavor from the binder.",
    scoopColor: scoop("#FF84A4", "#E85A7A"),
    dairyFree: false,
  },
  {
    id: "strawberry-cheesecake",
    name: "Strawberry Cheesecake",
    note: "Cheesecake, strawberry on top.",
    story:
      "Cheesecake, strawberry on top. A house flavor from the binder.",
    scoopColor: scoop("#FFDEEA", "#F4B4C0"),
    dairyFree: false,
  },
  {
    id: "strawberry-chocolate",
    name: "Strawberry with Chocolate",
    note: "Strawberry, chocolate-dipped.",
    story:
      "Strawberry, chocolate-dipped. A house flavor from the binder.",
    scoopColor: scoop("#B54869", "#8B1E3F"),
    dairyFree: false,
  },
  {
    id: "blackberry",
    name: "Blackberry",
    note: "Dark berry, a little tart.",
    story:
      "Dark berry, a little tart. A house flavor from the binder.",
    scoopColor: scoop("#745694", "#4A2C6A"),
    dairyFree: false,
  },
  {
    id: "blackberry-chocolate",
    name: "Blackberry Chocolate",
    note: "Blackberry over cocoa.",
    story:
      "Blackberry over cocoa. A house flavor from the binder.",
    scoopColor: scoop("#745644", "#4A2C1A"),
    dairyFree: false,
  },
  {
    id: "blackberry-sweet-corn-swirl",
    name: "Blackberry Sweet Corn Swirl",
    note: "Blackberry with a sweet-corn swirl.",
    story:
      "Blackberry with a sweet-corn swirl. A house flavor from the binder.",
    scoopColor: scoop("#FEDA54", "#D4B02A"),
    dairyFree: false,
  },
  {
    id: "bloody-cherry",
    name: "Bloody Cherry",
    note: "Deep cherry, a little gothic.",
    story:
      "Deep cherry, a little gothic. A house flavor from the binder.",
    scoopColor: scoop("#953C52", "#6B1228"),
    dairyFree: false,
  },
  {
    id: "blood-orange",
    name: "Blood Orange",
    note: "Dark orange, a little wine-y.",
    story:
      "Dark orange, a little wine-y. A house flavor from the binder.",
    scoopColor: scoop("#EE8452", "#C45A28"),
    dairyFree: false,
  },
  {
    id: "blueberry-cheesecake",
    name: "Blueberry Cheesecake",
    note: "Blueberry over cheesecake.",
    story:
      "Blueberry over cheesecake. A house flavor from the binder.",
    scoopColor: scoop("#8694DA", "#5C6AB0"),
    dairyFree: false,
  },
  {
    id: "banana-cream-pie",
    name: "Banana Cream Pie",
    note: "Banana, custard, pie crust energy.",
    story:
      "Banana, custard, pie crust energy. A house flavor from the binder.",
    scoopColor: scoop("#FFFFA4", "#F6E27A"),
    dairyFree: false,
  },
  {
    id: "butterscotch",
    name: "Butterscotch",
    note: "Buttery gold candy.",
    story:
      "Buttery gold candy. A house flavor from the binder.",
    scoopColor: scoop("#FFCA74", "#E0A04A"),
    dairyFree: false,
  },
  {
    id: "mango",
    name: "Mango",
    note: "Ripe mango, straight up.",
    story:
      "Ripe mango, straight up. A house flavor from the binder.",
    scoopColor: scoop("#FFCA84", "#F6A05A"),
    dairyFree: false,
  },
  {
    id: "maple-bacon-bourbon",
    name: "Maple Bacon Bourbon",
    note: "Maple, bacon, a bourbon warmth.",
    story:
      "Maple, bacon, a bourbon warmth. A house flavor from the binder.",
    scoopColor: scoop("#B5784E", "#8B4E24"),
    dairyFree: false,
    tags: ["Bourbon"],
  },
  {
    id: "maple-pear",
    name: "Maple Pear",
    note: "Pear and maple, fall-soft.",
    story:
      "Pear and maple, fall-soft. A house flavor from the binder.",
    scoopColor: scoop("#F2FEB4", "#C8D48A"),
    dairyFree: false,
  },
  {
    id: "maraschino-cherry",
    name: "Maraschino Cherry",
    note: "Sundae cherry, bright and classic.",
    story:
      "Sundae cherry, bright and classic. A house flavor from the binder.",
    scoopColor: scoop("#EE6574", "#C43B4A"),
    dairyFree: false,
  },
  {
    id: "mojito",
    name: "Mojito",
    note: "Mint, lime, porch-drink cold.",
    story:
      "Mint, lime, porch-drink cold. A house flavor from the binder.",
    scoopColor: scoop("#99C594", "#6F9B6A"),
    dairyFree: false,
  },
  {
    id: "mint-oreo",
    name: "Mint Oreo",
    note: "Mint and cookies.",
    story:
      "Mint and cookies. A house flavor from the binder.",
    scoopColor: scoop("#579479", "#2D6A4F"),
    dairyFree: false,
  },
  {
    id: "mixed-berry",
    name: "Mixed Berry",
    note: "A handful of berries.",
    story:
      "A handful of berries. A house flavor from the binder.",
    scoopColor: scoop("#956494", "#6B3A6A"),
    dairyFree: false,
  },
  {
    id: "mexican-hot-chocolate",
    name: "Mexican Hot Chocolate",
    note: "Cocoa, cinnamon, a chile whisper.",
    story:
      "Cocoa, cinnamon, a chile whisper. A house flavor from the binder.",
    scoopColor: scoop("#A4745C", "#7A4A32"),
    dairyFree: false,
  },
  {
    id: "pistachio",
    name: "Pistachio",
    note: "Classic pistachio, a little salty.",
    story:
      "Classic pistachio, a little salty. A house flavor from the binder.",
    scoopColor: scoop("#99C594", "#6F9B6A"),
    dairyFree: false,
  },
  {
    id: "pistachio-cranberry",
    name: "Pistachio Cranberry",
    note: "Pistachio with cranberry tart.",
    story:
      "Pistachio with cranberry tart. A house flavor from the binder.",
    scoopColor: scoop("#EE6574", "#C43B4A"),
    dairyFree: false,
  },
  {
    id: "pistachio-mixed-berry",
    name: "Pistachio Mixed Berry",
    note: "Pistachio under mixed berry.",
    story:
      "Pistachio under mixed berry. A house flavor from the binder.",
    scoopColor: scoop("#99C594", "#6F9B6A"),
    dairyFree: false,
  },
  {
    id: "pistachio-rose",
    name: "Pistachio Rose",
    note: "Pistachio and rose.",
    story:
      "Pistachio and rose. A house flavor from the binder.",
    scoopColor: scoop("#F395B4", "#C96B8A"),
    dairyFree: false,
  },
  {
    id: "pumpkin-spice",
    name: "Pumpkin Spice",
    note: "Pumpkin, spice, October.",
    story:
      "Pumpkin, spice, October. A house flavor from the binder.",
    scoopColor: scoop("#FFA454", "#E07A2A"),
    dairyFree: false,
  },
  {
    id: "root-beer-float",
    name: "Root Beer Float",
    note: "Root beer and vanilla foam.",
    story:
      "Root beer and vanilla foam. A house flavor from the binder.",
    scoopColor: scoop("#866A5D", "#5C4033"),
    dairyFree: false,
  },
  {
    id: "raspberry-swirl",
    name: "Raspberry Swirl",
    note: "Raspberry ribbon through the scoop.",
    story:
      "Raspberry ribbon through the scoop. A house flavor from the binder.",
    scoopColor: scoop("#EE6584", "#C43B5A"),
    dairyFree: false,
  },
  {
    id: "red-hot-cinnamon",
    name: "Red Hot Cinnamon",
    note: "Cinnamon candy heat.",
    story:
      "Cinnamon candy heat. A house flavor from the binder.",
    scoopColor: scoop("#EE6574", "#C43B4A"),
    dairyFree: false,
  },
  {
    id: "red-queen-chocolate-cherry",
    name: "Red Queen Chocolate Cherry",
    note: "Chocolate cherry, a little dramatic.",
    story:
      "Chocolate cherry, a little dramatic. A house flavor from the binder.",
    scoopColor: scoop("#953C52", "#6B1228"),
    dairyFree: false,
  },
  {
    id: "banana-rama",
    name: "Banana Rama",
    note: "Big banana, playful and loud.",
    story:
      "Big banana, playful and loud. A house flavor from the binder.",
    scoopColor: scoop("#FFFFA4", "#F6E27A"),
    dairyFree: false,
  },
  {
    id: "maple-bourbon-peach",
    name: "Maple Bourbon Peach",
    note: "Peach, maple, bourbon.",
    story:
      "Peach, maple, bourbon. A house flavor from the binder.",
    scoopColor: scoop("#FFA454", "#E07A2A"),
    dairyFree: false,
    tags: ["Bourbon"],
  },
  {
    id: "bourbon-egg-nog",
    name: "Bourbon Egg Nog",
    note: "Nog with a bourbon kick.",
    story:
      "Nog with a bourbon kick. A house flavor from the binder.",
    scoopColor: scoop("#FFFEB4", "#F0D48A"),
    dairyFree: false,
    tags: ["Bourbon", "Contains egg"],
  },
  {
    id: "bourbon-peach",
    name: "Bourbon Peach",
    note: "Peach and bourbon, porch weather.",
    story:
      "Peach and bourbon, porch weather. A house flavor from the binder.",
    scoopColor: scoop("#FFA454", "#E07A2A"),
    dairyFree: false,
    tags: ["Bourbon"],
  },
  {
    id: "bourbon-pecan",
    name: "Bourbon Pecan",
    note: "Pecan, bourbon, toasted.",
    story:
      "Pecan, bourbon, toasted. A house flavor from the binder.",
    scoopColor: scoop("#B5784E", "#8B4E24"),
    dairyFree: false,
    tags: ["Bourbon"],
  },
  {
    id: "brown-butter",
    name: "Brown Butter",
    note: "Nutty brown butter, simple and deep.",
    story:
      "Nutty brown butter, simple and deep. A house flavor from the binder.",
    scoopColor: scoop("#EEB464", "#C48A3A"),
    dairyFree: false,
  },
  {
    id: "buttermint",
    name: "Buttermint",
    note: "Buttery mint candy.",
    story:
      "Buttery mint candy. A house flavor from the binder.",
    scoopColor: scoop("#FFFEB4", "#F0D48A"),
    dairyFree: false,
  },
  {
    id: "chocolate-spice",
    name: "Chocolate Spice",
    note: "Cocoa with a little heat.",
    story:
      "Cocoa with a little heat. A house flavor from the binder.",
    scoopColor: scoop("#865D41", "#5C3317"),
    dairyFree: false,
  },
  {
    id: "christmas-tree-cake",
    name: "Christmas Tree Cake",
    note: "Snack-cake tree, holiday frosting.",
    story:
      "Snack-cake tree, holiday frosting. A house flavor from the binder.",
    scoopColor: scoop("#579479", "#2D6A4F"),
    dairyFree: false,
  },
  {
    id: "cinnamon-brown-butter-pecan",
    name: "Cinnamon Brown Butter Pecan",
    note: "Cinnamon, brown butter, pecans.",
    story:
      "Cinnamon, brown butter, pecans. A house flavor from the binder.",
    scoopColor: scoop("#D28652", "#A85C28"),
    dairyFree: false,
  },
  {
    id: "cinnamon-cranberry-goat-cheese",
    name: "Cinnamon Cranberry Goat Cheese",
    note: "Cinnamon, cranberry, tangy goat cheese.",
    story:
      "Cinnamon, cranberry, tangy goat cheese. A house flavor from the binder.",
    scoopColor: scoop("#EE6574", "#C43B4A"),
    dairyFree: false,
  },
  {
    id: "cinnamon-peanut-butter-chocolate",
    name: "Cinnamon Peanut Butter Chocolate",
    note: "Cinnamon, PB, cocoa.",
    story:
      "Cinnamon, PB, cocoa. A house flavor from the binder.",
    scoopColor: scoop("#A4745C", "#7A4A32"),
    dairyFree: false,
  },
  {
    id: "grandmas-cinnamon-bun",
    name: "Grandma's Cinnamon Bun",
    note: "Cinnamon roll, icing-sweet.",
    story:
      "Cinnamon roll, icing-sweet. A house flavor from the binder.",
    scoopColor: scoop("#EEA264", "#C4783A"),
    dairyFree: false,
  },
  {
    id: "coffee-brownie",
    name: "Coffee Brownie",
    note: "Coffee ice cream, brownie bits.",
    story:
      "Coffee ice cream, brownie bits. A house flavor from the binder.",
    scoopColor: scoop("#866A5D", "#5C4033"),
    dairyFree: false,
  },
  {
    id: "concord-grape",
    name: "Concord Grape",
    note: "Purple grape, jelly-jar classic.",
    story:
      "Purple grape, jelly-jar classic. A house flavor from the binder.",
    scoopColor: scoop("#8674D2", "#5C4AA8"),
    dairyFree: false,
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

export const STAFF_PASSWORD_HASH =
  "e971c330aab8741082ab062c2d63f754238c6f46aac59291b07beff6b5a87dd7";
export const STORAGE_KEY = "janartys-case-v1";
export const STAFF_SESSION_KEY = "janartys-staff-v2";
