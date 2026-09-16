# iOS platform

The `ios/` Xcode project is committed (Capacitor 8, Swift Package Manager). On a Mac, after installing dependencies, run the cap:sync script and open the project in Xcode. See README.md **iOS (Xcode)**.

Light haptic feedback uses the Capacitor Haptics plugin when opening a flavor or completing a pan swap. Run `npm run cap:sync` and rebuild the iOS app in Xcode to include the plugin. Browser sessions have no haptic feedback. Reduce Motion disables the decorative animations and haptic feedback.

## iPad

The App target already includes iPhone and iPad, and its Info.plist supports all four iPad orientations. The shared web UI now adapts to the available app window: a two-column portrait freezer, a four-column freezer in wide landscape windows, two/three-column flavor browsing, larger controls, and bounded detail sheets. Narrow multitasking windows fall back to the compact layout.

No separate catalog, Firebase project, or iPad-specific images are needed. After `npm run cap:sync`, build the App target for an iPad simulator or signed iPad. Browser viewport checks cover resizing and interactions; also verify real-device safe areas, keyboard presentation, rotation with a sheet open, and multitasking before distribution. Native compilation and device validation require Xcode on a Mac.

If you need to regenerate the native project:

```
npx cap add ios
```
