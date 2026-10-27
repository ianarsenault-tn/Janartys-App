const PAGES = ["library", "favorites", "alerts"];

/** Touch-only paging; native vertical scrolling and pinch zoom keep priority. */
export function setupCustomerSwipes(root, currentView, navigate) {
  let gesture = null;
  let suppressClickUntil = 0;
  const blockedControl = 'input, textarea, select, label, a, video, [contenteditable]:not([contenteditable="false"]), button:not(.library-detail)';

  root.addEventListener("pointerdown", event => {
    if (!event.isPrimary) { gesture = null; return; }
    gesture = null;
    suppressClickUntil = 0;
    const screen = event.target.closest(".collection-screen");
    const view = currentView();
    // Leave system back/forward gestures at the screen edges alone.
    if (event.pointerType !== "touch" || event.button !== 0 || !screen
        || root.classList.contains("has-sheet") || !PAGES.includes(view)
        || event.target.closest(blockedControl)
        || event.clientX < 24 || event.clientX > window.innerWidth - 24) return;
    gesture = { screen, view, id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
  }, { passive: true });

  root.addEventListener("pointermove", event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
    if (!gesture.horizontal && Math.max(dx, dy) >= 12) {
      if (dx < dy * 1.5) { gesture = null; return; }
      gesture.horizontal = true;
    }
  }, { passive: true });

  root.addEventListener("pointerup", event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const ended = gesture;
    gesture = null;
    const dx = event.clientX - ended.x, dy = event.clientY - ended.y;
    if (!ended.horizontal || !ended.screen.isConnected || currentView() !== ended.view
        || root.classList.contains("has-sheet")) return;
    // A horizontal drag on a flavor card must not also open its story, even
    // when it stops short of the page threshold or reaches an end page.
    suppressClickUntil = performance.now() + 400;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = PAGES[PAGES.indexOf(ended.view) + (dx < 0 ? 1 : -1)];
    if (next) navigate(next);
  });
  const cancel = () => { gesture = null; };
  root.addEventListener("pointercancel", cancel);
  root.addEventListener("lostpointercapture", cancel);
  root.addEventListener("click", event => {
    if (event.detail && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}
