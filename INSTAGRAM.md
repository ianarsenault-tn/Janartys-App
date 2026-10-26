# Instagram latest post

## Status: prepared, not connected

The owners confirmed `@janartys` is a Business account. This integration is
**disabled pending their authorization**. This change does not create a Meta
app, authorize an account, provision Cloudflare resources, deploy a Worker, or
change production Firestore data. Merging or deploying Pages cannot enable it.

Three deliberate gates remain: `src/instagram-config.js` has an empty public URL;
`instagram-feed/wrangler.jsonc` has `INSTAGRAM_ENABLED=false`; and its cron list
is empty. The KV ID is a nonfunctional placeholder. No tokens are committed.

## Behavior

- A separate Cloudflare Worker reads recent media using **Instagram API with
  Instagram Login**, with `instagram_business_basic` access. This route does
  not require a linked Facebook Page. It does not publish, read messages or
  manage comments. Customers do not sign in to Instagram.
- Every 30 minutes after activation, it selects the newest supported recent
  item: a photo, a Reel/video's cover, or the first image/cover in a carousel.
  It provides an image, caption and post link, not an interactive player or Stories.
- `/latest` serves only cached public fields. Customer requests never call Meta.
  `/health` exposes only `enabled` and `ready`. No public sync/token/write routes exist.
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
2. Approve showing the latest image/cover, caption and Instagram link. Confirm
   that a cover linking to Instagram is sufficient for Reels.
3. Create/select a business-controlled Meta developer app; invite the developer
   with the needed role. Add Instagram Login and the account through Meta's
   dashboard. The owner accepts any invitation and authorizes basic media access.
   Check access-level, app-review, business-verification and privacy/data-deletion
   requirements for this exact setup. A test token does not prove production eligibility.

## Activation (only after owner approval)

Commands run from the repository root. The existing `push-relay` development
dependency provides Wrangler; the Instagram Worker needs no runtime packages.

1. Complete Meta authorization above. Obtain a **fresh long-lived Instagram
   Login token** through Meta's official dashboard/Business Login flow. Exchange
   a short-lived token before use. Keep tokens out of chat, screenshots, git,
   app bundles and public Firestore documents. This single-account integration
   uses operator-assisted setup, not a new public OAuth connection screen.
2. Confirm the professional `user_id` and username using Meta's official tools.
   Select a supported Graph API version; verify `/{user_id}?fields=user_id,username`
   and `/{user_id}/media` with `instagram_business_basic`. The Worker checks the
   ID and `janartys` username. Set `INSTAGRAM_USER_ID` and `INSTAGRAM_API_VERSION`.
3. Verify the Cloudflare plan, shared allowances and available cron slots.
   Create a dedicated private KV namespace and replace the placeholder ID:

   ```sh
   npm ci --prefix push-relay
   node push-relay/node_modules/wrangler/bin/wrangler.js kv namespace create janartys-instagram-feed
   ```

4. Deploy with the enable flag false and no cron, then enter the long-lived
   token at the interactive secret prompt:

   ```sh
   node push-relay/node_modules/wrangler/bin/wrangler.js deploy --config instagram-feed/wrangler.jsonc
   node push-relay/node_modules/wrangler/bin/wrangler.js secret put INSTAGRAM_ACCESS_TOKEN --config instagram-feed/wrangler.jsonc
   ```

   The bootstrap token is a Worker secret. Renewed tokens live in the dedicated
   KV key `private-token`, accessible only to its server binding and authorized
   Cloudflare administrators. Do not share the namespace with other Workers
   or enable raw request/response logging. Tokens refresh weekly. Revocation or
   expiry requires reauthorization; replacing the bootstrap secret makes the
   next scheduled run use the new token.
5. Set `INSTAGRAM_ENABLED` to `"true"` and `triggers.crons` to `["*/30 * * * *"]`;
   deploy this Worker only. After a scheduled run, inspect `/health`, `/latest`,
   account identity and invocation CPU/errors. Failures expose only generic
   errors. Verify the configured version, fields and token renewal with Meta
   during authorized activation; fixture tests do not prove live API compatibility.
6. Set `INSTAGRAM_FEED_URL` to the Worker's HTTPS `/latest` URL in a reviewed
   activation change. Test photos, Reels, carousel covers, fallback and override/reset.
   Use isolated Firestore fixtures for Manager write tests. Update privacy disclosures.
7. Deploy Pages after review. Native release also needs `cap:sync`, a signed Xcode
   build and real-iPhone checks; Pages cannot update an installed iOS binary.

If all recent posts are unsupported, sync fails and retains the bounded last
good result. KV is eventually consistent: allow propagation after a sync or
secret replacement. Existing custom Manager content overrides the feed until
staff explicitly choose **Use latest post**.

## Free-tier design

No Firebase billing upgrade, paid widget, Cloud Function, extra Firestore
reads/writes or push activation is required. Workers Free includes 100,000
requests/day, 10 ms CPU/invocation and five cron triggers/account. KV Free
includes 100,000 reads/day, 1,000 writes/day and 1 GB storage. A 30-minute
schedule uses 48 runs, about 96 Meta reads and 48 public-cache writes/day, plus
occasional token writes. Each enabled public endpoint request uses one KV read.
There is no image proxy/video storage; images load from Instagram media URLs.

Normal shop traffic is expected to fit these allowances. They are shared with
other applications; paid plans can bill beyond their included usage. Free-tier
exhaustion stops service and the app falls back. Do not change plans or enable
paid services without approval. This is not a zero-cost guarantee for the
account's other services or future traffic. Verify real scheduled CPU usage
before activation; local tests cannot establish free-tier runtime capacity.

## Verification and rollback

```sh
npm test
npm run build
npm ci --prefix push-relay
node push-relay/node_modules/wrangler/bin/wrangler.js deploy --config instagram-feed/wrangler.jsonc --dry-run --outdir instagram-feed/.wrangler/build
```

Tests replace Meta, KV and Firestore with fixtures. PR checks do not deploy.
For rollback, clear the app URL and rebuild, disable the Worker flag and empty
its cron list, then deploy the disabled Worker. To disconnect permanently,
remove the secret and private token key and revoke Meta authorization. Manual
and default cards remain usable. Keep credentials only while owners authorize access.

References: [Meta Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login),
[Business Login/token lifecycle](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[KV allowances](https://developers.cloudflare.com/kv/platform/pricing/).
