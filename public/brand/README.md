# Janarty’s app icon

The icon adapts the supplied Janarty’s logo into a centered heart-and-cone mark with its blue/purple-to-pink gradient on a warm cream square. The background uses the app’s `--cream: #fff8f0` palette as its reference. The full logo used by the startup splash is separate.

| File | Size | Use |
| --- | --- | --- |
| [janartys-app-icon.png](janartys-app-icon.png) | 1024×1024 | Master app icon for reuse/download. |
| [apple-touch-icon.png](apple-touch-icon.png) | 180×180 | Apple home-screen icon for the web app. |
| [favicon-32.png](favicon-32.png) | 32×32 | Browser tab icon. |
| [Janartys-AppIcon.png](../../ios/App/App/Assets.xcassets/AppIcon.appiconset/Janartys-AppIcon.png) | 1024×1024 | Identical native copy referenced by the Xcode AppIcon catalog. |

All icons are opaque RGB PNGs. The square artwork has no pre-drawn outer corner mask. Web references are relative so they work on GitHub Pages and inside Capacitor.

When replacing the master, update the native copy and regenerate the 180px and 32px variants from the same artwork. Bump the version query on the web icon links in `index.html` to refresh browser caches. Run `npm run cap:sync`, then rebuild in Xcode to update an installed iOS app. Publishing GitHub Pages alone cannot update its native icon.

## Artwork provenance

Updated on September 16, 2026 using the built-in image-generation tool in edit mode. The previous black icon, derived from the user-supplied Janarty’s logo, was the edit target for the cream background revision. The generated square artwork was resampled to the required sizes using high-quality bicubic interpolation and saved as RGB PNGs.

Final generation prompt:

> Use case: precise-object-edit.
> Asset type: Janarty's final square app icon, 1024 x 1024 pixels.
> Input image 1 is the current app icon and the edit target. Change ONLY the black background, including the negative space inside the heart scoop and triangular cone, to a uniform solid warm cream color #FFF8F0 (RGB 255,248,240), matching the app's cream palette. Preserve the existing centered outlined heart-and-cone mark exactly: the same size, position, geometry, stroke thickness, rounded ends, gap, and blue-violet/purple-to-pink gradient. Keep the cream flat across the entire square; no texture, shading, glow or gradient in the background. Crisp smooth edges with no black fringe. Opaque RGB square, no transparency, no outer corner mask, no border, no shadows, no text or extra elements. Deliver only the finished square icon, not a device mockup.
