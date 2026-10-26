export function isIosHomeScreen({ userAgent = "", platform = "", maxTouchPoints = 0, standalone = false, displayMode = false, native = false } = {}) {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  return ios && !native && (standalone === true || displayMode === true);
}

export function setupHomeScreenChrome(win = window, doc = document) {
  const mode = win.matchMedia("(display-mode: standalone)");
  const update = () => doc.documentElement.classList.toggle("ios-home-screen", isIosHomeScreen({
    userAgent: win.navigator.userAgent,
    platform: win.navigator.platform,
    maxTouchPoints: win.navigator.maxTouchPoints,
    standalone: win.navigator.standalone,
    displayMode: mode.matches,
    native: win.Capacitor?.isNativePlatform?.() === true,
  }));
  update();
  mode.addEventListener("change", update);
}
