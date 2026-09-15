import { Capacitor } from "@capacitor/core";

// Pages stays silent; native feedback is available after syncing the iOS project.
const nativeHaptics = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics")
  ? import("@capacitor/haptics").catch(() => null)
  : null;
let lastFeedback = -Infinity;

export async function tapFeedback() {
  if (!nativeHaptics || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const now = performance.now();
  if (now - lastFeedback < 150) return;
  lastFeedback = now;
  try {
    const plugin = await nativeHaptics;
    if (plugin) await plugin.Haptics.impact({ style: plugin.ImpactStyle.Light });
  } catch { /* Devices without a haptic engine still complete the interaction. */ }
}
