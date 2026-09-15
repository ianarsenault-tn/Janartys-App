# Firestore rules (janarty-s)

The web apiKey in src/firebase.js is public by design. These rules stop strangers from rewriting the live case.

Do not publish the hardened block until Email/Password Auth works for both staff users. Publishing early will block Manager writes.

## Staff allowlist

- ian.arsenault@yahoo.com
- janartys@gmail.com

Keep this list identical to `STAFF_EMAILS` in `src/data.js` and the relay allowlist in `push-relay/src/index.js`. Adding staff means updating all three. Push additionally requires `email_verified` in their Firebase ID token.

## Console setup (required once)

1. Firebase Console -> project janarty-s -> Authentication.
2. Sign-in method -> enable Email/Password -> Save.
3. Users -> Add user for each staff email. Set a strong password (share privately). Console-created users are usually already verified.
4. Authentication -> Settings -> Authorized domains: include ianarsenault-tn.github.io (and localhost for local Vite).
5. After a successful Manager unlock in the app, publish the hardened rules (Firestore -> Rules -> Publish).

## Current (open writes - keep until Auth unlock works)

```
rules_version = "2";
service cloud.firestore {
  match /databases/{database}/documents {
    match /shop/live {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

## Hardened (publish after Auth works)

```
rules_version = "2";
service cloud.firestore {
  match /databases/{database}/documents {

    function isStaff() {
      return request.auth != null
        && request.auth.token.email in [
          "ian.arsenault@yahoo.com",
          "janartys@gmail.com"
        ];
    }

    function isLiveShape() {
      let d = request.resource.data;
      return d.keys().hasAll([
          "catalog", "caseIds", "updatedAt", "lastSwap",
          "lastNotice", "hoursOverride", "instagram"
        ])
        && d.catalog is list
        && d.caseIds is list
        && d.caseIds.size() == 8
        && d.updatedAt is number
        && d.catalog.size() <= 500;
    }

    match /shop/live {
      allow read: if true;
      allow create, update: if isStaff() && isLiveShape();
      allow delete: if false;
    }
  }
}
```

Create the Auth users with those exact lowercase emails so the token email matches the allowlist.

## App behavior

Favorites, library filters, and notification preferences do not create Firebase customer records or writes. Optional `availability` and the richer `lastSwap` fields share the existing `shop/live` document and are compatible with the shape rule above. Staff saves consume the existing Firestore quota; no Cloud Functions are required. See [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md).

After 7 taps on the heart, Manager unlock uses Firebase Email/Password for the allowlisted emails only. Auth persists in the browser so Firestore writes stay authenticated.

## Optional API key restrictions

Defense in depth only — Firestore rules are the real lock.

1. Open [Google Cloud Console](https://console.cloud.google.com/) for project **janarty-s**.
2. APIs & Services → Credentials → the Browser key used by this web app (same as `apiKey` in `src/firebase.js`).
3. Application restrictions → **HTTP referrers**.
4. Add:
   - `https://ianarsenault-tn.github.io/*`
   - `http://localhost:*` (local Vite)
   - Capacitor/App Store builds do not use referrers the same way; leave a note if you later need iOS unrestricted or a separate iOS key.
5. Save. Confirm What’s Out still loads and Manager swaps still work.

Does not replace Auth + Firestore rules.
