# Instagram latest post

## Status: prepared, not connected

The owners confirmed `@janartys` is a Business account. This integration is
**disabled pending their authorization**. This change does not create a Meta
app, authorize an account, provision Cloudflare resources, deploy a Worker, or
change production Firestore data. Merging or deploying Pages cannot enable it.

The public feed and Manager connection URLs in `src/instagram-config.js` are
empty. The Worker has both `INSTAGRAM_ENABLED=false` and
`INSTAGRAM_CONNECT_ENABLED=false`, with no schedule. KV/D1 IDs are placeholders;
the Meta client ID, redirect URI and API version are blank. No credentials are
committed. Manager displays **Connect Instagram** disabled with a setup message
until its endpoint is configured and confirms readiness.

## Behavior

- A separate Cloudflare Worker reads recent media using **Instagram API with
  Instagram Login**, with `instagram_business_basic` access. This route does
  not require a linked Facebook Page. It does not publish, read messages or
  manage comments. Customers do not sign in to Instagram.
- Every 30 minutes after activation, it selects the newest supported recent
  item: a photo, a Reel/video, or the first item in a carousel. Photos remain
  linked image cards. Videos show a cover and **Play video** button; playback
  starts inline only after a tap, with native pause, sound and fullscreen controls.
  Stories and browsing multiple carousel items are not included.
- Video URLs are loaded only after a tap, not on page load. Navigation, opening
  a drawer, leaving the page or a refreshed/replaced card stops playback.
  **Open in Instagram** is always available on video cards. Missing URLs,
  playback failures (including expired CDN URLs), and a 15-second initial load
  timeout retain the cover/caption/link and show fallback guidance.
- `/latest` serves only cached public fields. Customer requests never call Meta.
  `/health` exposes only `enabled` and `ready`. No public sync/token routes exist.
- Automatic content stays in a dedicated KV namespace, **not `shop/live`**.
  Firestore permissions, case updates, and the push relay are unchanged.
- Saved Manager posts always win. New saves carry `source: "manual"`; custom
  legacy cards also win. Existing rules already allow the optional source field.
  Reset removes the override. When configured, the reset button reads **Use
  latest post**; otherwise it stays **Reset to default**. Feed arrivals preserve drafts.
- API failures retain the last good post for at most 24 hours after the last
  successful sync, regardless of its publication age. Empty media lists clear
  the cached post. Stale data or a broken automatic image falls back to the
  whole manual/default card. The app refreshes on opening, foregrounding or a
  visible 30-minute interval, with throttling.

## Owner meeting

1. Identify who controls `@janartys`; have them available with their sign-in and
   two-factor verification method. Do not request their password.
2. Confirm displaying the latest photo or tap-to-play video, caption and
   Instagram fallback link. Verify an actual authorized Reel on an iPhone
   (including the Home Screen app) before activation.
3. Create/select a business-controlled Meta developer app; invite the developer
   with the needed role. Add Instagram Login and the account through Meta's
   dashboard. The owner accepts any invitation and authorizes basic media access.
   Check access-level, app-review, business-verification and privacy/data-deletion
   requirements for this exact setup. A test token does not prove production eligibility.

## Connect Instagram in Manager

Once server setup is complete, staff sign into Manager and select **Connect
Instagram**. The service verifies their Firebase ID token against the same
approved UID/email pairs as the push relay. It opens Instagram in a new web tab
or the iOS system browser view. Owners approve basic access there; their password
and Instagram tokens never enter the Janarty's app. Manager drafts stay intact.

The owner closes the browser/returns to Manager and selects **Check connection**
if needed. **Reconnect Instagram** repeats authorization when access expires or
is revoked. The callback verifies `@janartys` (and the configured account ID,
if supplied) before saving a long-lived token privately. Denial, wrong account,
expired state or exchange failure cannot replace the existing token. A failed
storage acknowledgement requires checking status; it is not reported as success.

Connection status means an unexpired authorization is stored, not that a fresh
Meta request has just succeeded. Revoked access may require reconnecting even
before its nominal expiry. Connecting does **not** enable the feed, alter the
schedule, reset a manual post, write Firestore, or activate push.

One-time state is atomically consumed in a separate D1 database before token
exchange, and bound to a Secure/HttpOnly/SameSite=Lax browser cookie. Links expire
in ten minutes; a new attempt replaces that staff member's previous attempt.
There is at most one row per approved staff member. KV's eventual consistency
is not used for replay prevention. Connection requests are rate limited and
fail closed if protection is unavailable. Callback pages never echo provider
errors/codes/tokens and send no-store/no-referrer/CSP headers.

## Server setup and owner-approved activation

Commands run from the repository root. The existing `push-relay` development
dependencies provide Wrangler and the shared Firebase token verifier (`jose`).
Install `npm ci --prefix push-relay` before running the Instagram tests/bundle.

1. Configure Meta's Instagram Login app with `instagram_business_basic`. Set its
   valid OAuth redirect URI to `https://<worker-host>/connect/callback`, exactly
   matching `INSTAGRAM_REDIRECT_URI`. Set `INSTAGRAM_CLIENT_ID` and a supported
   `INSTAGRAM_API_VERSION`. Set `INSTAGRAM_USER_ID` if known; otherwise the owner
   flow discovers the ID from the verified `@janartys` token. Complete applicable
   Meta production access/review/privacy/data-deletion requirements.
2. Keep both enable flags false and the schedule empty during setup. The owner
   does not need to generate or paste a token. The server will exchange the
   approved code and obtain a long-lived token. Keep all secrets out of chat,
   screenshots, source, app bundles, and public Firestore.
3. Verify the Cloudflare plan, shared allowances and available cron slots.
   Create dedicated KV and D1 resources; replace their placeholder binding IDs:

   ```sh
   npm ci --prefix push-relay
   node push-relay/node_modules/wrangler/bin/wrangler.js kv namespace create janartys-instagram-feed
   node push-relay/node_modules/wrangler/bin/wrangler.js d1 create janartys-instagram-oauth
   node push-relay/node_modules/wrangler/bin/wrangler.js d1 migrations apply janartys-instagram-oauth --remote --config instagram-feed/wrangler.jsonc
   ```

4. Deploy with both flags false and no cron, then enter the Instagram app's
   client secret at Wrangler's interactive prompt:

   ```sh
   node push-relay/node_modules/wrangler/bin/wrangler.js deploy --config instagram-feed/wrangler.jsonc
   node push-relay/node_modules/wrangler/bin/wrangler.js secret put INSTAGRAM_CLIENT_SECRET --config instagram-feed/wrangler.jsonc
   ```

   Authorized/renewed tokens live in the dedicated KV key `private-token`, accessible
   only to its server binding and Cloudflare administrators. Do not share the
   namespace or enable raw request/response logging. Tokens refresh weekly while
   scheduled sync runs. Before feed activation, no cron means no token renewal.
   The older operator-supplied `INSTAGRAM_ACCESS_TOKEN` path remains compatible;
   an owner-approved OAuth connection takes precedence over that bootstrap secret.
5. When ready for the owners, set `INSTAGRAM_CONNECT_ENABLED` to `"true"`, deploy
   the Worker, and set `INSTAGRAM_CONNECT_URL` to its HTTPS origin in a reviewed
   app change. Keep `INSTAGRAM_ENABLED=false`, the public feed URL empty, and no
   cron. The owner now uses **Connect Instagram** in Manager. Verify success,
   denial, reconnect, wrong-account rejection, and return from the iOS browser.
6. Only after approval/verification, set `INSTAGRAM_ENABLED` to `"true"` and `triggers.crons` to `["*/30 * * * *"]`;
   deploy this Worker only. After a scheduled run, inspect `/health`, `/latest`,
   account identity and invocation CPU/errors. Failures expose only generic
   errors. Verify the configured version, fields and token renewal with Meta
   during authorized activation; fixture tests do not prove live API compatibility.
7. Set `INSTAGRAM_FEED_URL` to the Worker's HTTPS `/latest` URL in a reviewed
   activation change. Test photos, inline Reels, the first carousel item, expired
   video/error fallback and override/reset on a real iPhone, including Home Screen mode.
   Use isolated Firestore fixtures for Manager write tests. Update privacy disclosures.
8. Deploy Pages after review. Native release also needs `cap:sync`, a signed Xcode
   build and real-iPhone checks; Pages cannot update an installed iOS binary.

If all recent posts are unsupported, sync fails and retains the bounded last
good result. KV is eventually consistent: allow propagation after a sync or
authorization or secret replacement. Existing custom Manager content overrides the feed until
staff explicitly choose **Use latest post**.

## Free-tier design

No Firebase billing upgrade, paid widget, Cloud Function, extra Firestore
reads/writes or push activation is required. Workers Free includes 100,000
requests/day, 10 ms CPU/invocation and five cron triggers/account. KV Free
includes 100,000 reads/day, 1,000 writes/day and 1 GB storage. A 30-minute
schedule uses 48 runs, about 96 Meta reads and 48 public-cache writes/day, plus
occasional token writes. Each enabled public endpoint request uses one KV read.
There is no image proxy/video storage; images and tapped videos load directly
from Instagram media URLs. Both the updated Worker and Pages build are needed
for inline playback; an older Worker response still renders as a linked cover.
OAuth adds a tiny D1 database (at most two current staff-session rows). D1 Free
includes 5 million rows read/day, 100,000 rows written/day and 5 GB total storage.
The official Capacitor Browser plugin adds no paid service. These are shared
allowances, not a billing guarantee.

Normal shop traffic is expected to fit these allowances. They are shared with
other applications; paid plans can bill beyond their included usage. Free-tier
exhaustion stops service and the app falls back. Do not change plans or enable
paid services without approval. This is not a zero-cost guarantee for the
account's other services or future traffic. Verify real scheduled CPU usage
before activation; local tests cannot establish free-tier runtime capacity.

## Verification and rollback

```sh
npm ci --prefix push-relay
npm test
npm run test:relay
npm run build
node push-relay/node_modules/wrangler/bin/wrangler.js deploy --config instagram-feed/wrangler.jsonc --dry-run --outdir instagram-feed/.wrangler/build
```

Tests replace Meta, KV and Firestore with fixtures. PR checks do not deploy.
For rollback, clear both app URLs and rebuild, disable both Worker flags and empty
its cron list, then deploy the disabled Worker. To disconnect permanently,
remove the secrets, private token and pending OAuth sessions, and revoke Meta authorization. Manual
and default cards remain usable. Keep credentials only while owners authorize access.

References: [Meta Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login),
[Business Login/token lifecycle](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[KV allowances](https://developers.cloudflare.com/kv/platform/pricing/),
[D1 allowances](https://developers.cloudflare.com/d1/platform/pricing/),
[iOS Browser plugin](https://capacitorjs.com/docs/apis/browser).
