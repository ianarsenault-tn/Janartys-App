import { privacyContent, SUPPORT_EMAIL } from "./privacy-content.js";
import { SHOP_PHONE_TEL } from "./data.js";

export function aboutButton() {
  return '<button class="text-button about-link" type="button" data-act="open-about">About, help &amp; privacy</button>';
}

export function aboutSheet(privacy, controls) {
  const version = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "development";
  return `<button class="veil" type="button" tabindex="-1" aria-hidden="true" data-act="close-sheet"></button>
    <aside class="sheet about-sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="${privacy ? "Privacy policy" : "About and help"}">${controls}
      <h1 class="sheet-title">${privacy ? "Privacy policy" : "About Janarty’s"}</h1>
      <div class="about-content">${privacy ? privacyContent() : `<p>See what’s in the freezer at Janarty’s Homemade Ice Cream, explore flavors, and save your favorites.</p>
        <h2>Need help?</h2><p>For app help, shop questions or privacy requests, <a href="mailto:${SUPPORT_EMAIL}">email ${SUPPORT_EMAIL}</a> or <a href="tel:${SHOP_PHONE_TEL}">call 615-918-0085</a>.</p>
        <h2>Your favorites</h2><p>Favorites and alert preferences stay on this device. No customer account is needed, and choices do not sync between devices. Tap a saved heart to remove a favorite. Clearing local app or website data can erase saved choices.</p>
        <h2>Checking availability</h2><p>The freezer shows the latest shop information the app has received. A saved or offline view may be out of date. If flavors have not loaded, reconnect or call the shop.</p>
        <p>App content version ${version}</p><a class="text-button" href="#/privacy" data-act="open-privacy">Privacy policy</a>`}</div>
      ${privacy ? '<button class="text-button" type="button" data-act="back-about">Back to About and help</button>' : ""}
    </aside>`;
}
