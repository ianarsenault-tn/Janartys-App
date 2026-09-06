import { STAFF_SESSION_KEY } from "./data.js";
import { isStaffSignedIn, signOutStaff } from "./staff-auth.js";

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
 * Any pointer/key/input activity resets the timer. On fire: signOut + callback.
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
        wasActive = false;
        try {
          await signOutStaff();
        } catch {
          /* still clear local session */
        }
        try {
          sessionStorage.removeItem(STAFF_SESSION_KEY);
        } catch {
          /* private mode */
        }
        await onTimeout();
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
