# Firestore rules (paste into Console)

Firebase projects in **production mode** deny every read and write until you publish rules. The app uses **one document**: `shop/live`. These rules open **only** that document — not the rest of the project.

Staff email auth comes later, before App Store. Until then, anyone with the client config can read and write `shop/live`. That is enough to sync the case across phones.

## Publish

1. Open [Firebase Console](https://console.firebase.google.com/) → project **janarty-s**.
2. Firestore Database → **Rules**.
3. Replace the editor contents with the block below.
4. **Publish**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shop/live {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

Until this is published, Manager writes stay on the phone (localStorage) and show “Couldn’t reach the case server.”

## Authorized domains (later)

Not required for Firestore-only. When you add Firebase Authentication, Authentication → Settings → Authorized domains should include `ianarsenault-tn.github.io`.

## Capacitor / iOS

The same public web config works from the iOS webview. No extra native Firebase SDK.
