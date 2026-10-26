# Firestore access (janarty-s)

The authoritative rules are [firestore.rules](firestore.rules), deployed using [firebase.json](firebase.json). The Firebase web API key is public client configuration; the database rules enforce access. Never publish unrestricted writes, even temporarily while setting up sign-in.

## Production deployment and verification — October 26, 2026

Backend deployment verification is complete for [main commit `3c2784119549f02451e8de3f0e96bf72c47990df`](https://github.com/ianarsenault-tn/Janartys-App/commit/3c2784119549f02451e8de3f0e96bf72c47990df). The rules and relay are current for that revision; their deployment is not outstanding. This is a dated verification record, not an automatic deployment guarantee for later changes.

- **Firestore:** At 12:55 PM CDT (America/Chicago), Firebase CLI deployed only `firestore:rules` to `janarty-s`, adding the missing notice length/type and hours field-type checks. The active rules were then retrieved through the Firebase Rules API and matched the checked-in file after line-ending normalization. Console also showed the new active revision.
- **Relay:** The existing October 23 deployment, version `035a9e74-bd99-4b07-875c-6d0fa0e5f1a3`, was downloaded and compared with a Wrangler dry-run build from the reviewed commit. The JavaScript bundles were byte-for-byte identical, and the deployed project, database, rate limits, and runtime configuration matched. No relay redeployment was necessary.
- **Sending remains disabled:** The deployed relay has `PUSH_ENABLED=false`, no `FCM_SERVICE_ACCOUNT` binding, and `/health` returned `{"ready":false}`. Native messaging remains excluded and APNs was not enabled. No publish requests or notifications were sent. Health alone is not version proof; the bundle comparison above establishes the deployed-code match.
- **Validation:** All 16 repository rules tests plus 3 release-only compatibility tests against a local copy of `shop/live` passed in the `demo-janartys-rules` emulator. Both approved staff identities could make valid partial updates; anonymous writes and invalid notice/hours values were rejected. These additional compatibility checks are not part of the standard 16-test suite.
- **Production preservation:** The complete live document and its update timestamp were unchanged before and after deployment. The customer app showed Connected, rendered all eight flavors, and produced no browser error logs. Production staff writes were not attempted; authorization was tested in the emulator. No production document cleanup or migration was needed.

Release identifiers and comparison hashes:

| Evidence | Value |
| --- | --- |
| Active ruleset | `projects/janarty-s/rulesets/981e7e2c-b456-4aed-a284-eddb8b12a9a5` |
| Previous ruleset retained for rollback | `projects/janarty-s/rulesets/10052f33-c908-43bd-b9e7-a2250b8f637c` |
| Rules SHA-256 (CRLF normalized to LF; surrounding whitespace trimmed) | `d4248c99411c95c59188530bc584e3a1a0ad2059d7400f93593df535962fbbd3` |
| Deployed/main relay bundle SHA-256 | `90dc67ae703f56e9c6aafcf56c26df2ffea688972a999cd0636065eb2e430bf0` |

The previous October 23 rules revision remains in Firebase Console history. Copies of the previous rules, relay code/configuration, deployment metadata, live-document snapshots, and test logs were also preserved locally for rollback and audit. GitHub Pages remains a separate deployment and was not redeployed as part of this backend release.

## Authorized staff

Only these existing Firebase Authentication accounts may create or update `shop/live`. Both the UID and its matching email must be present in the authenticated Firebase token:

| Staff email | Approved Firebase UID |
| --- | --- |
| `ian.arsenault@yahoo.com` | `KcRs37Q7yVbLiZNuk2m0q0Rqjx72` |
| `janartys@gmail.com` | `7a7vnB6g64Yxnp1pXROYYOUoKzz2` |

These identities were checked in the project's Authentication console on October 19, 2026. UIDs identify accounts; they are not passwords or bearer credentials. A newly created account cannot gain access just by claiming a listed email. Recreating a deleted staff account gives it a different UID and requires explicit approval and a rules update.

Firestore access is based on these approved account identities and does not additionally require email verification, preserving existing staff sign-in. The notification relay separately requires a verified email; do not remove that requirement when configuring push.

The browser's `STAFF_EMAILS` in `src/data.js` controls the Manager sign-in UI and password-reset eligibility. It cannot grant database access. The relay uses the same exact UID/email pairs from `push-relay/src/staff-identities.js`. `npm test` checks that those pairs match the rules, this table, and the UI email list; relay tests exercise signed tokens for both approved and rejected identities.

## What the rules allow

- Anyone may read the public flavor board at exactly `shop/live`.
- Only the two approved UID/email pairs may create or update it.
- Staff updates must preserve the existing required fields, eight nonempty string case IDs, numeric update timestamp, and catalog limit of 500 entries.
- Instagram may be null (use the default card) or a map. Its image URL, caption, permalink, and handle must be strings when present; its optional update timestamp must be numeric. Empty text and missing optional fields remain valid.
- Notices may be null or a map; the message, when present, must be a string of at most 100 characters. Hours overrides may be null or a map; date, open, close, and mode must be strings when present, and closed must be boolean. Sparse legacy maps and closed days without opening/closing times remain valid.
- Catalog validation remains limited to the list type and 500-entry cap. Sparse legacy entries and nullable colors remain supported; these rules do not exhaustively validate catalog elements or URL schemes. The app validates HTTPS image URLs and permalinks on save; rendering rejects unsafe schemes in older data.
- Validation checks the resulting document, so partial hours, notice, catalog, Instagram, stock, swap, and undo updates remain supported. Optional `availability` and richer `lastSwap` fields remain compatible.
- No app client, including staff, may delete the live board.
- All other documents and subcollections are denied by default.

Google Cloud/Firebase administrators and server service accounts with IAM privileges bypass client Security Rules. Keep those administrative permissions limited to trusted operators; these rules govern customer/staff app requests, not console administrator access.

## Staff setup and removal

1. Enable Email/Password sign-in in Firebase Authentication for project `janarty-s`.
2. Provision each approved staff account using its exact lowercase email and a strong password shared privately.
3. Verify the account's actual UID in Authentication; never authorize a UID supplied by an untrusted client.
4. Add the same exact UID/email pair to `firestore.rules` and `push-relay/src/staff-identities.js` only when a new staff member is authorized. Update this table, the UI's `STAFF_EMAILS`, and regression tests. Recreated accounts require this explicit approval too.
5. Keep the web app's authorized domain configured. Run `npm test`, `npm run test:rules`, and `npm run test:relay`, then deploy the rules and relay separately. Preserve `PUSH_ENABLED=false` while sending is disabled. Do not open database writes to troubleshoot.
6. When removing staff, remove their pair from both the rules and relay and publish both, then disable their Auth account/revoke sessions and remove the UI entry. Deleting or disabling an account alone does not immediately invalidate an already issued ID token.

Favorites and alert preferences remain on the device and require no customer database writes. This change adds no Firebase service, billing upgrade, or per-request database lookup.

## Test and deploy

Install Node.js and Java 21 or later, then:

```sh
npm ci
npm run test:rules
```

The test command starts only a local Firestore emulator with the non-production project `demo-janartys-rules`. The tests refuse to run without `FIRESTORE_EMULATOR_HOST=127.0.0.1:8087`; they never use the production Firebase configuration. Tests cover unauthorized writes, newly created accounts claiming staff emails, exact UID/email matching, both existing staff accounts, partial updates, transactions, create/delete restrictions, invalid shapes, sibling paths, subcollections, and atomic batch rejection. GitHub Pages CI runs this suite before publishing the app.

Before deploying stricter shape checks, inspect the existing live document for compatibility: an invalid legacy field can block unrelated partial updates. After reviewing and testing a rules change, deploy only Firestore rules to the explicit project:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project janarty-s
```

Alternatively, paste the exact contents of `firestore.rules` into the Firebase Console Rules editor, test in Rules Playground, and publish. Confirm the published rules match this file. Keep the previous published version in Console history for rollback, and never revert to an unrestricted configuration.

GitHub Pages deployment does not deploy database rules. Check the live published rules separately after every rules deployment. Use the emulator/Rules Playground for authorization checks so testing does not change customer-visible flavors or send notifications.

On October 19, 2026, the live baseline already had staff email restrictions, shape checks, and delete denial. The outdated open-write example in this document did not reflect that live baseline; it has been removed. The checked-in rules add exact account-ID binding.

The account-ID rules were published to `janarty-s` on October 19, 2026 at 10:30 AM America/Chicago. The published version was checked in Console. Rules Playground allowed public reads and updates under both approved identities, while denying anonymous updates and an unapproved UID claiming a staff email. Local emulator tests also verified all staff editing workflows and rejected invalid or unauthorized writes. These checks did not write to the live flavor board or send notifications.


## Optional catalog and case metadata

Manager supports optional `catalog[].archived`, `availability[id].soldOut`, and `caseUpdatedAt` fields within `shop/live`. Existing deployed rules allow these fields; no rules deployment, migration, or seed rewrite is required for this change. Emulator regression coverage verifies staff writes and denial of anonymous writes with the new fields.

`caseUpdatedAt` advances only on swaps, undo, pan stock changes, and edits to a flavor occupying a pan. Older documents show an unknown case-update time rather than borrowing the general `updatedAt`. The local cache records `caseLoaded` after loading a valid shop snapshot; this marker is not written to Firestore. Older unmarked local caches require a shop snapshot before showing current pans. Older app versions do not maintain or display the new fields, so staff should reload the app before using these controls.

Archiving preserves the entry and ID, hides it from ordinary browsing/swap choices, and keeps saved favorites. It is blocked for occupied pans. Sold-out status persists past midnight until staff restock or replace the pan. This implementation does not change the live catalog or resolve existing duplicate entries; that remains pending Marty’s confirmation.

## Optional dated hours

`shop/live.scheduledHours` maps Chicago calendar dates (`YYYY-MM-DD`) to `{ closed: true }` or `{ closed: false, open: 'HH:mm', close: 'HH:mm' }`. Missing maps preserve existing weekly hours. App validation permits today through 366 days ahead, at most 60 upcoming exceptions, and same-day opening times before closing times. Expired entries are ignored for display and pruned only during an explicit scheduled-hours save.

Transactions preserve other dates and reject a stale draft if the selected date changed remotely. Today's quick `hoursOverride` takes priority; saving today's dated entry clears the captured quick override, rejecting the save if that override changed meanwhile. **Follow normal hours** removes today's scheduled entry and quick override while retaining future dates. These writes update `updatedAt`, not `caseUpdatedAt`, and do not edit the catalog or send notifications.

Existing deployed rules allow this optional field; no migration or rules deployment is required. The app validates date/time contents; the rules continue to enforce staff authorization and the existing live-document shape, rather than the new per-date limits. Emulator tests cover authorized staff writes and anonymous denial. Opening the planner or loading the new app does not write this field.
