# Janarty’s app icon

The icon adapts the supplied Janarty’s logo into a centered heart-and-cone mark with its blue/purple-to-pink gradient on a black square. The full logo used by the startup splash is separate.

| File | Size | Use |
| --- | --- | --- |
| [janartys-app-icon.png](janartys-app-icon.png) | 1024×1024 | Master app icon for reuse/download. |
| [apple-touch-icon.png](apple-touch-icon.png) | 180×180 | Apple home-screen icon for the web app. |
| [favicon-32.png](favicon-32.png) | 32×32 | Browser tab icon. |
| [Janartys-AppIcon.png](../../ios/App/App/Assets.xcassets/AppIcon.appiconset/Janartys-AppIcon.png) | 1024×1024 | Identical native copy referenced by the Xcode AppIcon catalog. |

All icons are opaque RGB PNGs. The square artwork has no pre-drawn outer corner mask. Web references are relative so they work on GitHub Pages and inside Capacitor.

When replacing the master, update the native copy and regenerate the 180px and 32px variants from the same artwork. Run `npm run cap:sync`, then rebuild in Xcode to update an installed iOS app. Publishing GitHub Pages alone cannot update its native icon.

## Artwork provenance

Created on September 16, 2026 using the built-in image-generation tool in edit mode, with the user-supplied Janarty’s logo as the edit target. The generated square artwork was resampled to the required sizes using high-quality bicubic interpolation and saved as RGB PNGs.

Final generation prompt:

> Use case: precise-object-edit.
> Asset type: final iOS app icon, 1024 by 1024 pixels, square PNG.
> Input image 1 is the edit target: Janarty's existing logo. Extract ONLY its existing outlined heart-shaped ice cream scoop and triangular cone mark. Remove all lettering. Preserve the exact distinctive geometry, open gap between scoop and cone, round stroke ends, and blue-violet to purple to bright pink gradient from left to right. Do not redesign the mark or change the colors. Uniformly enlarge and center the mark on a solid pure black square background, with approximately 17 percent side padding and balanced top/bottom padding. Clean crisp smooth lines at icon size. Full opaque square edge-to-edge background, no transparency. Do not draw rounded outer corners, a tile border, drop shadows, mockups, extra shapes, new highlights, typography or watermark. Deliver one single flat square icon image.
