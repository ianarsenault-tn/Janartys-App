/** Native iOS chrome. No-ops on GitHub Pages (no Capacitor runtime). */

if (typeof window !== "undefined" && window.Capacitor) {
  document.documentElement.classList.add("is-native");
}

function setupNativeStatusBar() {
  if (typeof window === "undefined" || !window.Capacitor) return;
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => {
      const overlay = true;
      return Promise.all([
        StatusBar.setStyle({ style: Style.Dark }),
        StatusBar.setOverlaysWebView({ overlay }),
      ]).catch(() => {});
    })
    .catch(() => {});
}

setupNativeStatusBar();
