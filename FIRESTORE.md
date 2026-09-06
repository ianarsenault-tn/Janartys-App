# Firestore rules (janarty-s)

The web `apiKey` in `src/firebase.js` is public by design. These rules are what stop strangers from rewriting the live case.

**Do not publish the hardened block until Firebase Authentication is wired** and at least one staff email can sign in. Publishing staff-only writes today will make Manager show “Couldn’t reach the case server” while customers can still read.

## Current (open writes — sync-only)

Anyone with the client config can read and write `shop/live`. Enough for phone sync; not App Store–ready.

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

## Hardened (draft — publish after Auth)

- Customers: **read** `shop/live` only.
- Staff: **create/update** only when signed in with a verified email on the allowlist.
- No deletes. No other collections. Default deny.

Replace `you@example.com` with real staff addresses (Ian, Marty, etc.). Keep the list short.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isStaff() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in [
          "you@example.com"
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

### Publish

1. Firebase Console → project **janarty-s** → Authentication → enable **Email/Password**.
2. Add each staff user (Authentication → Users). Have them verify email.
3. Put those exact emails in `isStaff()` above.
4. Firestore → **Rules** → paste the hardened block → **Publish**.
5. App change (required): after the Manager password unlock, call `signInWithEmailAndPassword` (or a custom token). The 7-tap + local password alone does **not** satisfy these rules.
6. Authentication → Settings → Authorized domains: include `ianarsenault-tn.github.io` (and localhost for dev).

### First seed

If `shop/live` is missing, a signed-out phone can no longer create it. Seed once while signed in as staff (open Manager after Auth is wired), or create the doc once in Console.

## Optional: tighten the public API key

Console → Google Cloud → APIs & Services → Credentials → the Browser key used by Firebase:

- Application restrictions → **HTTP referrers**: `https://ianarsenault-tn.github.io/*`
- Plus iOS bundle restriction for `com.janartys.app` if you use a separate iOS-restricted key later
- API restrictions → limit to Firebase / Firestore related APIs

This does not replace rules. It only reduces drive-by reuse of the key from random sites.

## Capacitor / iOS

Same web config in the webview. Staff Auth must run in that webview too. No native Firebase SDK required for these rules.
