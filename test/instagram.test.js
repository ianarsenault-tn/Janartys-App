import assert from "node:assert/strict";
import test from "node:test";
import { SEED_INSTAGRAM } from "../src/data.js";
import { INSTAGRAM_FEED_URL } from "../src/instagram-config.js";
import { createInstagramFeed, featuredInstagram, validFeedPost, FEED_REFRESH_MS, FEED_MAX_AGE_MS } from "../src/instagram-feed.js";

const now = 1793000000000;
const automatic = { imageUrl: "https://cdn.example/post.jpg", caption: "Today's post", permalink: "https://www.instagram.com/p/latest/", handle: "janartys", fetchedAt: now };

test("feed is opt-in and disabled without making requests", async () => {
  assert.equal(INSTAGRAM_FEED_URL, "");
  let requests = 0;
  const feed = createInstagramFeed({ url: INSTAGRAM_FEED_URL, onChange: () => {}, request: () => { requests++; } });
  await feed.refresh();
  assert.equal(requests, 0);
  assert.equal(feed.current(), null);
});

test("manual saves (including seed-valued saves) and legacy custom cards override automatic posts", () => {
  for (const manual of [{ ...SEED_INSTAGRAM, source: "manual" }, { ...SEED_INSTAGRAM, caption: "Staff choice" }]) {
    assert.equal(featuredInstagram(manual, automatic, now), manual);
  }
  assert.equal(featuredInstagram(SEED_INSTAGRAM, automatic, now), automatic);
  assert.equal(featuredInstagram(null, null, now), SEED_INSTAGRAM);
  assert.equal(featuredInstagram(SEED_INSTAGRAM, automatic, now + FEED_MAX_AGE_MS + 1), SEED_INSTAGRAM);
});

test("automatic cards reject unsafe links, foreign accounts, malformed or stale payloads", () => {
  for (const patch of [
    { imageUrl: "javascript:alert(1)" }, { permalink: "https://instagram.com.evil.test/p/post/" },
    { permalink: "https://instagram.com/accounts/login/" }, { handle: "another-shop" },
    { caption: 42 }, { caption: "x".repeat(2201) }, { fetchedAt: now - FEED_MAX_AGE_MS - 1 },
    { fetchedAt: now + 60_001 }, { fetchedAt: "today" },
  ]) assert.equal(validFeedPost({ ...automatic, ...patch }, now), false);
  assert.equal(validFeedPost(automatic, now), true);
});

test("refresh is deduplicated and throttled, retains good data on failure, clears empty feeds", async () => {
  let time = now, calls = 0, changes = 0, release;
  let response = () => new Promise(resolve => { release = resolve; });
  const feed = createInstagramFeed({
    url: "https://feed.example/latest", now: () => time, onChange: () => changes++,
    request: (_url, options) => { calls++; assert.equal(options.credentials, "omit"); return response(); },
  });
  const first = feed.refresh();
  const second = feed.refresh();
  assert.equal(calls, 1);
  release(Response.json(automatic));
  await Promise.all([first, second]);
  assert.deepEqual(feed.current(), automatic);
  response = async () => { throw new Error("offline"); };
  await feed.refresh();
  assert.equal(calls, 1);
  time += FEED_REFRESH_MS;
  await feed.refresh();
  assert.deepEqual(feed.current(), automatic);
  time += FEED_REFRESH_MS;
  response = async () => Response.json({ ...automatic, imageUrl: "data:bad" });
  await feed.refresh();
  assert.deepEqual(feed.current(), automatic);
  time += FEED_REFRESH_MS;
  response = async () => Response.json(null);
  await feed.refresh();
  assert.equal(feed.current(), null);
  assert.equal(changes, 4);
});

test("outage beyond the maximum age falls back instead of displaying indefinitely stale content", async () => {
  let time = now, fail = false;
  const feed = createInstagramFeed({ url: "https://feed.example/latest", now: () => time, onChange: () => {},
    request: async () => fail ? new Response(null, { status: 503 }) : Response.json(automatic) });
  await feed.refresh();
  time += FEED_MAX_AGE_MS + 1;
  fail = true;
  await feed.refresh();
  assert.equal(feed.current(), null);
});
