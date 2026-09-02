import { getSyncStatus, subscribe } from "./store.js";

const CSS = `.nav-live{display:inline;margin-left:2px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);opacity:.65}.sync-warn{padding:0 20px 10px;font-size:13px;color:var(--muted)}`;

if (typeof document !== "undefined" && !document.getElementById("janartys-live-css")) {
  const el = document.createElement("style");
  el.id = "janartys-live-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

function paint() {
  if (typeof document === "undefined") return;
  const { live, writeError } = getSyncStatus();
  const meta = document.querySelector(".nav-meta");
  if (meta) {
    let chip = meta.querySelector(".nav-live");
    if (live && !chip) {
      chip = document.createElement("span");
      chip.className = "nav-live";
      chip.textContent = "Live";
      meta.append(" ", chip);
    }
    if (!live && chip) chip.remove();
  }
  const hint = document.querySelector(".hint");
  let warn = document.querySelector(".sync-warn");
  if (writeError && hint && !warn) {
    warn = document.createElement("p");
    warn.className = "sync-warn";
    warn.textContent = "Couldn\u2019t reach the case server.";
    hint.insertAdjacentElement("afterend", warn);
  }
  if (!writeError && warn) warn.remove();
}

subscribe(paint);
paint();
setInterval(paint, 2000);
