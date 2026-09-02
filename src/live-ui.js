import { getSyncStatus, subscribe } from "./store.js";

function paint() {
  if (typeof document === "undefined") return;
  const { writeError } = getSyncStatus();
  const hint = document.querySelector(".hint");
  let warn = document.querySelector(".sync-warn");
  if (writeError && hint && !warn) {
    warn = document.createElement("p");
    warn.className = "sync-warn";
    warn.textContent = "Couldn’t reach the case server.";
    hint.insertAdjacentElement("afterend", warn);
  }
  if (!writeError && warn) warn.remove();
}

subscribe(paint);
paint();
setInterval(paint, 2000);
