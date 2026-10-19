# Firestore access (janarty-s)

The authoritative rules are [firestore.rules](firestore.rules), deployed using [firebase.json](firebase.json). The Firebase web API key is public client configuration; the database rules enforce access. Never publish unrestricted writes, even temporarily while setting up sign-in.

## Authorized staff

Only these existing Firebase Authentication accounts may create or update `shop/live`. Both the UID and its matching email must be present in the authenticated Firebase token:

| Staff email | Approved Firebase UID |
| --- | --- |
| `ian.arsenault@yahoo.com` | `KcRs37Q7yVbLiZNuk2m0q0Rqjx72` |
| `janartys@gmail.com` | `7a7vnB6g64Yxnp1pXROYYOUoKzz2` |

These identities were checked in the project's Authentication console on October 19, 2026. UIDs identify accounts; they are not passwords or bearer credentials. A newly created account cannot gain access just by claiming a listed email. Recreating a deleted staff account gives it a different UID and requires explicit approval and a rules update.

Firestore access is based on these approved account identities and does not additionally require email verification, preserving existing staff sign-in. The notification relay separately requires a verified email; do not remove that requirement when configuring push.

The browser's `STAFF_EMAILS` in `src/data.js` controls the Manager sign-in UI and password-reset eligibility. It cannot grant database access. The relay's allowlist is in `push-relay/src/index.js`.

## What the rules allow

- Anyone may read the public flavor board at exactly `shop/live`.
- Only the two approved UID/email pairs may create or update it.
- Staff updates must preserve the existing required fields, eight-pan list, numeric update timestamp, and catalog limit of 500 entries.
- Validation checks the resulting document, so partial hours, notice, catalog, Instagram, stock, swap, and undo updates remain supported. Optional `availability` and richer `lastSwap` fields remain compatible.
- No app client, including staff, may delete the live board.
- All other documents and subcollections are denied by default.

Google Cloud/Firebase administrators and server service accounts with IAM privileges bypass client Security Rules. Keep those administrative permissions limited to trusted operators; these rules govern customer/staff app requests, not console administrator access.

## Staff setup and removal

1. Enable Email/Password sign-in in Firebase Authentication for project `janarty-s`.
2. Provision each approved staff account using its exact lowercase email and a strong password shared privately.
3. Verify the account's actual UID in Authentication; never authorize a UID supplied by an untrusted client.
4. Add an exact UID/email pair to `firestore.rules` only when a new staff member is authorized. Update the UI/relay email lists and regression tests as appropriate.
5. Keep the web app's authorized domain configured. Verify sign-in and rules tests before deployment; do not open database writes to troubleshoot.
6. When removing staff, remove their UID from the rules and publish, then disable their Auth account/revoke sessions and remove applicable UI/relay access. Deleting or disabling an account alone does not immediately invalidate an already issued ID token.

Favorites and alert preferences remain on the device and require no customer database writes. This change adds no Firebase service, billing upgrade, or per-request database lookup.

## Test and deploy

Install Node.js and Java 21 or later, then:

```sh
npm ci
npm run test:rules
```

The test command starts only a local Firestore emulator with the non-production project `demo-janartys-rules`. The tests refuse to run without `FIRESTORE_EMULATOR_HOST=127.0.0.1:8087`; they never use the production Firebase configuration. Tests cover unauthorized writes, newly created accounts claiming staff emails, exact UID/email matching, both existing staff accounts, partial updates, transactions, create/delete restrictions, invalid shapes, sibling paths, subcollections, and atomic batch rejection. GitHub Pages CI runs this suite before publishing the app.

After reviewing and testing a rules change, deploy only Firestore rules to the explicit project:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project janarty-s
```

Alternatively, paste the exact contents of `firestore.rules` into the Firebase Console Rules editor, test in Rules Playground, and publish. Confirm the published rules match this file. Keep the previous published version in Console history for rollback, and never revert to an unrestricted configuration.

GitHub Pages deployment does not deploy database rules. Check the live published rules separately after every rules deployment. Use the emulator/Rules Playground for authorization checks so testing does not change customer-visible flavors or send notifications.

On October 19, 2026, the live baseline already had staff email restrictions, shape checks, and delete denial. The outdated open-write example in this document did not reflect that live baseline; it has been removed. The checked-in rules add exact account-ID binding.

The account-ID rules were published to `janarty-s` on October 19, 2026 at 10:30 AM America/Chicago. The published version was checked in Console. Rules Playground allowed public reads and updates under both approved identities, while denying anonymous updates and an unapproved UID claiming a staff email. Local emulator tests also verified all staff editing workflows and rejected invalid or unauthorized writes. These checks did not write to the live flavor board or send notifications.
