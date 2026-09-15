# iOS platform

The `ios/` Xcode project is committed (Capacitor 8, Swift Package Manager). On a Mac, after installing dependencies, run the cap:sync script and open the project in Xcode. See README.md **iOS (Xcode)**.

Light haptic feedback uses the Capacitor Haptics plugin when opening a flavor or completing a pan swap. Run `npm run cap:sync` and rebuild the iOS app in Xcode to include the plugin. Browser sessions have no haptic feedback. Reduce Motion disables the decorative animations and haptic feedback.

If you need to regenerate the native project:

```
npx cap add ios
```
