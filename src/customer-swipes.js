const PAGES = ["case", "library", "favorites", "alerts"];

/** Touch-only paging; native vertical scrolling and pinch zoom keep priority. */
export function setupCustomerSwipes(root, currentView, navigate) {
  let gesture = null;
  let suppressClickUntil = 0;
  const blockedControl = 'input, textarea, select, label, a, video, [contenteditable]:not([contenteditable="false"]), button:not([data-act="open-story"])';

  const active = () => gesture && gesture.screen.isConnected
    && currentView() === gesture.view && !root.classList.contains("has-sheet");
  // A fresh tap/click must work immediately after suppressing a drag's click.
  root.addEventListener("pointerdown", () => { suppressClickUntil = 0; }, { passive: true });
  root.addEventListener("touchstart", event => {
    gesture = null;
    suppressClickUntil = 0;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const screen = event.target.closest(".case-screen, .collection-screen");
    const view = currentView();
    // Leave system back/forward gestures at the screen edges alone.
    if (!screen || root.classList.contains("has-sheet") || !PAGES.includes(view)
        || event.target.closest(blockedControl)
        || touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
    gesture = { screen, view, id: touch.identifier, x: touch.clientX, y: touch.clientY, horizontal: false };
  }, { passive: true });

  // Safari can cancel a pointer stream on slight vertical drift despite pan-y
  // (WebKit #232545). Track one touch stream instead, claiming only horizontal
  // moves with a non-passive listener; never claim a scroll already in progress.
  root.addEventListener("touchmove", event => {
    if (!active() || event.touches.length !== 1 || !event.cancelable) { gesture = null; return; }
    const touch = event.touches[0];
    if (touch.identifier !== gesture.id) { gesture = null; return; }
    const dx = Math.abs(touch.clientX - gesture.x), dy = Math.abs(touch.clientY - gesture.y);
    if (!gesture.horizontal && Math.max(dx, dy) >= 8) {
      // Allow a small diagonal wobble before the finger settles horizontally.
      // Predominantly vertical starts still scroll; completion must be clearly
      // horizontal (the stricter ratio below), not just a diagonal drag.
      if (dx < dy * 0.8) { gesture = null; return; }
      gesture.horizontal = true;
    }
    if (gesture.horizontal) event.preventDefault();
  }, { passive: false });

  root.addEventListener("touchend", event => {
    if (!active() || event.touches.length) { gesture = null; return; }
    const ended = gesture;
    gesture = null;
    const touch = Array.from(event.changedTouches).find(touch => touch.identifier === ended.id);
    if (!ended.horizontal || !touch) return;
    const dx = touch.clientX - ended.x, dy = touch.clientY - ended.y;
    // A horizontal drag on a flavor card must not also open its story, even
    // when it stops short of the page threshold or reaches an end page.
    if (event.cancelable) event.preventDefault();
    suppressClickUntil = performance.now() + 400;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = PAGES[PAGES.indexOf(ended.view) + (dx < 0 ? 1 : -1)];
    if (next) navigate(next);
  }, { passive: false });
  root.addEventListener("touchcancel", () => { gesture = null; }, { passive: true });
  root.addEventListener("click", event => {
    if (event.detail && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}
