/** Pointer and keyboard interactions shared by customer and staff sheets. */
export function setupSheetInteractions(root, dismiss) {
  let drag = null;
  let suppressClickUntil = 0;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.addEventListener("keydown", (event) => {
    const sheet = root.querySelector('.sheet[role="dialog"]');
    if (!sheet) return;
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
    }
    if (event.key !== "Tab") return;
    const items = [...sheet.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = items[0];
    const last = items.at(-1);
    if (!first) { event.preventDefault(); sheet.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === sheet)) {
      event.preventDefault(); first.focus();
    }
  });

  root.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".grabber");
    const sheet = handle?.closest(".sheet");
    if (!sheet || sheet.classList.contains("out") || !event.isPrimary || event.button !== 0) return;
    suppressClickUntil = 0;
    drag = { sheet, handle, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, distance: 0, moved: 0 };
    handle.setPointerCapture(event.pointerId);
    sheet.classList.add("dragging");
  });
  root.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.distance = Math.max(0, event.clientY - drag.startY);
    drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
    if (!reducedMotion()) drag.sheet.style.transform = `translateY(${drag.distance}px)`;
  });
  const finish = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const current = drag;
    drag = null;
    current.sheet.classList.remove("dragging");
    current.sheet.style.transform = "";
    if (current.moved > 5) suppressClickUntil = performance.now() + 400;
    if (event.type === "pointerup" && current.distance >= Math.min(80, current.sheet.offsetHeight * 0.25)) {
      current.sheet.style.setProperty("--sheet-start", reducedMotion() ? "0px" : `${current.distance}px`);
      dismiss();
    }
  };
  root.addEventListener("pointerup", finish);
  root.addEventListener("pointercancel", finish);
  root.addEventListener("lostpointercapture", finish);
  root.addEventListener("click", event => {
    if (event.target.closest(".grabber") && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}
