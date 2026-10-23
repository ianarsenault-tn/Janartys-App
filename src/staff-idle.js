import { isStaffSignedIn } from "./staff-auth.js";

/** Manager idle sign-out after this many ms with no interaction. */
export const STAFF_IDLE_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "input",
  "click",
  "scroll",
];

/**
 * Arms a 15-minute idle timer while Manager is open and staff are signed in.
 * Any pointer/key/input activity resets the timer. The callback owns sign-out
 * and navigation, so manual logout and idle logout use the same path.
 *
 * @param {{
 *   isManagerActive: () => boolean,
 *   onTimeout: () => void | Promise<void>,
 * }} opts
 */
export function setupStaffIdleTimeout({ isManagerActive, onTimeout }) {
  let timer = null;
  let wasActive = false;

  function clearTimer() {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function arm() {
    clearTimer();
    if (!isManagerActive() || !isStaffSignedIn()) {
      wasActive = false;
      return;
    }
    wasActive = true;
    timer = setTimeout(() => {
      void (async () => {
        if (!isManagerActive() || !isStaffSignedIn()) return;
        clearTimer();
        try {
          await onTimeout();
        } finally {
          // If sign-out failed, retry after another idle period, not every second.
          arm();
        }
      })();
    }, STAFF_IDLE_MS);
  }

  function onActivity() {
    if (isManagerActive() && isStaffSignedIn()) arm();
    else clearTimer();
  }

  for (const type of ACTIVITY_EVENTS) {
    document.addEventListener(type, onActivity, { capture: true, passive: true });
  }

  // Catch Manager entry even if they don't touch yet (e.g. after unlock).
  setInterval(() => {
    const active = isManagerActive() && isStaffSignedIn();
    if (active && !wasActive) arm();
    if (!active && wasActive) {
      clearTimer();
      wasActive = false;
    }
  }, 1000);

  return { bump: arm, stop: clearTimer };
}
