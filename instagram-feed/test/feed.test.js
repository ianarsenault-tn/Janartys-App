import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import worker, { selectPost, syncInstagram } from "../src/index.js";

const photo = { id: "post", media_type: "IMAGE", media_url: "https://cdn.example/photo.jpg", caption: "Fresh scoops", permalink: "https://www.instagram.com/p/test/", timestamp: "2026-10-25T12:00:00Z" };
function fixture() {
  const values = new Map();
  const reads = [], writes = [], calls = [];
  const env = {
    INSTAGRAM_ENABLED: "true", INSTAGRAM_USER_ID: "1234", INSTAGRAM_API_VERSION: "v24.0", INSTAGRAM_ACCESS_TOKEN: "owner-approved-test-token",
    FEED: {
      async get(key) { reads.push(key); return values.has(key) ? JSON.parse(values.get(key)) : null; },
      async put(key, value) { writes.push(key); values.set(key, value); },
    },
  };
  const request = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("?fields=user_id,username")) return Response.json({ user_id: "1234", username: "janartys" });
    if (url.includes("refresh_access_token")) return Response.json({ access_token: "renewed-test-token", expires_in: 5184000 });
    return Response.json({ data: [photo] });
  };
  return { env, values, reads, writes, calls, request };
}

test("checked-in configuration cannot connect or schedule itself", async () => {
  const config = JSON.parse((await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")).replace(/^\s*\/\/.*$/gm, ""));
  assert.equal(config.vars.INSTAGRAM_ENABLED, "false");
  assert.equal(config.vars.INSTAGRAM_CONNECT_ENABLED, "false");
  assert.equal(config.vars.INSTAGRAM_CLIENT_ID, "");
  assert.equal(config.vars.INSTAGRAM_REDIRECT_URI, "");
  assert.equal(config.vars.INSTAGRAM_USER_ID, "");
  assert.equal(config.vars.INSTAGRAM_API_VERSION, "");
  assert.deepEqual(config.triggers.crons, []);
  assert.equal(config.kv_namespaces[0].id, "0".repeat(32));
  const h = fixture();
  h.env.INSTAGRAM_ENABLED = "false";
  assert.deepEqual(await syncInstagram(h.env, { request: h.request }), { status: "disabled" });
  assert.equal(h.calls.length + h.reads.length + h.writes.length, 0);
  const response = await worker.fetch(new Request("https://feed.test/health"), h.env);
  assert.deepEqual(await response.json(), { enabled: false, ready: false });
});

test("media selection chooses the newest supported post with a video cover or first carousel image", () => {
  const older = { ...photo, timestamp: "2026-10-20T00:00:00Z" };
  const video = { ...photo, media_type: "VIDEO", thumbnail_url: "https://cdn.example/cover.jpg" };
  assert.equal(selectPost([video, older], 10).imageUrl, video.thumbnail_url);
  const carousel = { ...photo, media_type: "CAROUSEL_ALBUM", children: { data: [video, older] } };
  assert.equal(selectPost([carousel], 10).imageUrl, video.thumbnail_url);
  assert.equal(selectPost([{ ...photo, media_url: "javascript:bad" }], 10), null);
  assert.equal(selectPost([{ ...photo, permalink: "https://evil.test/p/post" }], 10), null);
  assert.equal(selectPost([{ ...photo, timestamp: "invalid" }], 10), null);
  assert.equal(selectPost([], 10), null);
});

test("video and first-carousel video retain playable HTTPS media without changing photo selection", () => {
  const video = { ...photo, media_type: "VIDEO", media_url: "https://cdn.example/reel.mp4", thumbnail_url: "https://cdn.example/cover.jpg" };
  for (const item of [video, { ...photo, media_type: "CAROUSEL_ALBUM", children: { data: [video, photo] } }]) {
    const post = selectPost([item], 10);
    assert.equal(post.mediaType, "VIDEO");
    assert.equal(post.videoUrl, video.media_url);
    assert.equal(post.imageUrl, video.thumbnail_url);
    assert.equal(post.permalink, photo.permalink);
  }
  assert.equal(selectPost([photo], 10).mediaType, "IMAGE");
  assert.equal(selectPost([photo], 10).videoUrl, undefined);
  for (const media_url of [undefined, "javascript:bad", "http://cdn.example/video.mp4", "https://secret@cdn.example/video.mp4"]) {
    const post = selectPost([{ ...video, media_url }], 10);
    assert.equal(post.videoUrl, undefined);
    assert.equal(post.mediaType, "VIDEO", "retain cover/link fallback when no safe video URL is available");
  }
});

test("public video payload includes only safe media fields, never private token properties", async () => {
  const h = fixture();
  const post = { ...selectPost([photo], Date.now()), mediaType: "VIDEO", videoUrl: "https://cdn.example/video.mp4", access_token: "private-secret" };
  h.values.set("latest", JSON.stringify(post));
  const body = await (await worker.fetch(new Request("https://feed.test/latest"), h.env)).json();
  assert.equal(body.videoUrl, post.videoUrl);
  assert.equal(body.mediaType, "VIDEO");
  assert.equal(body.access_token, undefined);
  for (const patch of [{ videoUrl: "javascript:bad" }, { mediaType: "IMAGE" }]) {
    h.values.set("latest", JSON.stringify({ ...post, ...patch }));
    assert.equal((await (await worker.fetch(new Request("https://feed.test/latest"), h.env)).json()).videoUrl, undefined);
  }
  assert.equal(h.calls.length, 0);
});

test("sync verifies the account, reads Meta only on schedule, and exposes only public media fields", async () => {
  const h = fixture();
  assert.deepEqual(await syncInstagram(h.env, { request: h.request }), { status: "updated" });
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].options.headers.Authorization, "Bearer owner-approved-test-token");
  assert.ok(h.calls.every(call => !call.url.includes(h.env.INSTAGRAM_ACCESS_TOKEN)));
  assert.deepEqual(h.writes, ["private-token", "latest"]);
  // Even unexpected private properties in a public record must not escape.
  const record = JSON.parse(h.values.get("latest"));
  h.values.set("latest", JSON.stringify({ ...record, access_token: "must-not-leak" }));
  for (const path of ["/latest", "/health"]) {
    const response = await worker.fetch(new Request(`https://feed.test${path}`), h.env);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.doesNotMatch(body, /token|must-not-leak/);
  }
  assert.equal(h.calls.length, 2, "public reads cannot call Meta");
  assert.equal(h.reads.filter(key => key === "private-token").length, 1);
});

test("wrong account, network errors, and malformed responses preserve the last confirmed post", async () => {
  for (const request of [
    async () => Response.json({ user_id: "999", username: "other" }),
    async () => { throw new Error("network includes secret"); },
    async url => url.includes("?fields=user_id,username") ? Response.json({ user_id: "1234", username: "janartys" }) : Response.json({ error: "bad" }),
    async () => new Response("secret upstream error", { status: 401 }),
  ]) {
    const h = fixture();
    await syncInstagram(h.env, { request: h.request });
    const previous = h.values.get("latest");
    assert.deepEqual(await syncInstagram(h.env, { request }), { status: "unavailable" });
    assert.equal(h.values.get("latest"), previous);
  }
});

test("tokens refresh weekly, survive restarts, and reconnecting replaces the old saved token", async () => {
  const h = fixture();
  const first = Date.now();
  await syncInstagram(h.env, { request: h.request, now: first });
  await syncInstagram(h.env, { request: h.request, now: first + 8 * 86400000 });
  assert.equal(JSON.parse(h.values.get("private-token")).token, "renewed-test-token");
  assert.equal(h.calls.at(-1).options.headers.Authorization, "Bearer renewed-test-token");
  h.env.INSTAGRAM_ACCESS_TOKEN = "replacement-owner-token";
  await syncInstagram(h.env, { request: h.request, now: first + 9 * 86400000 });
  assert.equal(h.calls.at(-1).options.headers.Authorization, "Bearer replacement-owner-token");
});

test("failed token renewal preserves previous token and public post without leaking errors", async () => {
  const h = fixture();
  const now = Date.now();
  await syncInstagram(h.env, { request: h.request, now });
  const before = new Map(h.values);
  const result = await syncInstagram(h.env, { now: now + 8 * 86400000, request: async () => Response.json({ access_token: "bad" }) });
  assert.equal(result.status, "unavailable");
  assert.deepEqual(h.values, before);
});

test("empty feed clears old posts, stale data expires, and HTTP routes cannot change state", async () => {
  const h = fixture();
  await syncInstagram(h.env, { request: h.request, now: Date.now() - 25 * 3600000 });
  assert.equal((await worker.fetch(new Request("https://feed.test/latest"), h.env)).status, 503);
  assert.deepEqual(await (await worker.fetch(new Request("https://feed.test/health"), h.env)).json(), { enabled: true, ready: false });
  await syncInstagram(h.env, { request: async (url, options) => url.includes("/media?") ? Response.json({ data: [] }) : h.request(url, options) });
  assert.equal(await (await worker.fetch(new Request("https://feed.test/latest"), h.env)).json(), null);
  const writes = h.writes.length;
  for (const path of ["/latest", "/sync", "/private-token"]) {
    assert.equal((await worker.fetch(new Request(`https://feed.test${path}`, { method: "POST" }), h.env)).status, 405);
  }
  assert.equal((await worker.fetch(new Request("https://feed.test/private-token"), h.env)).status, 404);
  assert.equal(h.writes.length, writes);
});
