import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createConnectionHandler } from "../src/oauth.js";
import { tokenFor, metaJson } from "../src/tokens.js";

const origin = "https://ianarsenault-tn.github.io";
test("Meta numeric account IDs retain their full precision", async () => {
  const data = await metaJson("https://graph.instagram.com/example", null, async () => new Response('{"user_id":17841400000000001,"expires_in":5184000}'));
  assert.equal(data.user_id, "17841400000000001");
  assert.equal(data.expires_in, 5184000);
});
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../migrations/0001_oauth_sessions.sql", import.meta.url), "utf8"));
  const values = new Map();
  const calls = [];
  let time = Date.now();
  const env = {
    INSTAGRAM_CONNECT_ENABLED: "true", INSTAGRAM_ENABLED: "false", INSTAGRAM_CLIENT_ID: "123",
    INSTAGRAM_CLIENT_SECRET: "private-client-secret", INSTAGRAM_REDIRECT_URI: "https://feed.test/connect/callback",
    INSTAGRAM_API_VERSION: "v24.0", FIREBASE_PROJECT_ID: "janarty-s", INSTAGRAM_USER_ID: "",
    CONNECT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    FEED: { get: async key => values.has(key) ? JSON.parse(values.get(key)) : null, put: async (key, value) => values.set(key, value) },
    OAUTH_DB: { prepare(query) { return { bind(...args) { const statement = sql.prepare(query); return { run: async () => statement.run(...args), first: async () => statement.get(...args) || null }; } }; } },
  };
  const meta = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("api.instagram.com/oauth/access_token")) return Response.json({ access_token: "short-test-token", user_id: "1234" });
    if (url.includes("/access_token?")) return Response.json({ access_token: "long-test-token", expires_in: 5184000 });
    return Response.json({ user_id: "1234", username: "janartys" });
  };
  const deps = { now: () => time, request: (...args) => meta(...args), authenticate: async request => {
    if (request.headers.get("Authorization") !== "Bearer staff-token") throw new Error("Not staff");
    return "approved-staff";
  } };
  const api = createConnectionHandler(deps);
  const request = (path, method = "GET", headers = {}) => new Request(`https://feed.test${path}`, { method, headers });
  const staffRequest = (path, method = "GET") => request(path, method, { Origin: origin, Authorization: "Bearer staff-token" });
  async function start() {
    const response = await api(staffRequest("/connect/start", "POST"), env);
    assert.equal(response.status, 200);
    const link = (await response.json()).url;
    const redirect = await api(new Request(link), env);
    assert.equal(redirect.status, 302);
    const state = new URL(redirect.headers.get("Location")).searchParams.get("state");
    const cookie = redirect.headers.get("Set-Cookie").split(";")[0];
    return { link, redirect, state, cookie, callback: (suffix = "&code=approval") => request(`/connect/callback?state=${state}${suffix}`, "GET", { Cookie: cookie }) };
  }
  return { env, values, calls, deps, api, request, staffRequest, start, advance: ms => { time += ms; } };
}

test("connection is separately disabled by default and requires staff authentication and allowed origins", async () => {
  const h = fixture();
  h.env.INSTAGRAM_CONNECT_ENABLED = "false";
  assert.equal((await h.api(h.staffRequest("/connect/start", "POST"), h.env)).status, 503);
  assert.equal(h.calls.length, 0);
  h.env.INSTAGRAM_CONNECT_ENABLED = "true";
  assert.equal((await h.api(h.request("/connect/start", "POST"), h.env)).status, 401);
  assert.equal((await h.api(h.request("/connect/status"), h.env)).status, 401);
  assert.equal((await h.api(h.request("/connect/start", "POST", { Origin: "https://evil.test", Authorization: "Bearer staff-token" }), h.env)).status, 403);
  const preflight = await h.api(h.request("/connect/start", "OPTIONS", { Origin: origin }), h.env);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  h.env.CONNECT_RATE_LIMITER = null;
  assert.equal((await h.api(h.staffRequest("/connect/start", "POST"), h.env)).status, 503);
});

test("browser-bound approval exchanges server-side and never enables the feed or exposes tokens", async () => {
  const h = fixture();
  const attempt = await h.start();
  const target = new URL(attempt.redirect.headers.get("Location"));
  assert.equal(target.origin, "https://www.instagram.com");
  assert.equal(target.searchParams.get("scope"), "instagram_business_basic");
  assert.equal(target.searchParams.get("redirect_uri"), h.env.INSTAGRAM_REDIRECT_URI);
  assert.match(attempt.redirect.headers.get("Set-Cookie"), /Secure; HttpOnly; SameSite=Lax/);
  const response = await h.api(attempt.callback(), h.env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Connected to @janartys/);
  assert.doesNotMatch(html, /test-token|private-client-secret|code=approval/);
  const token = JSON.parse(h.values.get("private-token"));
  assert.equal(token.source, "oauth");
  assert.equal(token.userId, "1234");
  assert.equal(token.token, "long-test-token");
  assert.equal(h.env.INSTAGRAM_ENABLED, "false");
  assert.equal(h.values.has("latest"), false);
  const status = await h.api(h.staffRequest("/connect/status"), h.env);
  assert.deepEqual(await status.json(), { connected: true, feedEnabled: false });
  assert.equal(h.calls[0].options.body.get("client_secret"), "private-client-secret");
  assert.equal(h.calls[0].options.body.get("code"), "approval");
  assert.equal((await tokenFor(h.env, Date.now(), h.deps.request)).token, "long-test-token", "scheduled feed can use owner-authorized token without a bootstrap secret");
});

test("wrong cookie and expired/replayed state cannot exchange codes; parallel callbacks exchange only once", async () => {
  const h = fixture();
  const attempt = await h.start();
  const bad = h.request(`/connect/callback?state=${attempt.state}&code=approval`, "GET", { Cookie: `__Host-janartys-ig=${"0".repeat(64)}` });
  assert.equal((await h.api(bad, h.env)).status, 400);
  assert.equal(h.calls.length, 0);
  const responses = await Promise.all([h.api(attempt.callback(), h.env), h.api(attempt.callback(), h.env)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
  assert.equal(h.calls.filter(c => c.url.includes("api.instagram.com")).length, 1);
  assert.equal((await h.api(new Request(attempt.link), h.env)).status, 400);
  const expired = await h.start();
  h.advance(600001);
  assert.equal((await h.api(expired.callback(), h.env)).status, 400);
  assert.equal(h.calls.length, 3);
});

test("denial, malformed codes, wrong accounts and exchange failures preserve an existing connection", async () => {
  for (const mode of ["denied", "missing-code", "wrong-account", "failed-exchange"]) {
    const h = fixture();
    h.values.set("private-token", JSON.stringify({ token: "existing", source: "oauth" }));
    const before = h.values.get("private-token");
    if (mode === "wrong-account") h.deps.request = async url => url.includes("api.instagram.com")
      ? Response.json({ access_token: "short", user_id: "1234" })
      : url.includes("/access_token?") ? Response.json({ access_token: "long", expires_in: 5184000 })
      : Response.json({ user_id: "1234", username: "other" });
    if (mode === "failed-exchange") h.deps.request = async () => { throw new Error("sensitive-provider-error"); };
    const handler = createConnectionHandler(h.deps);
    const attempt = await h.start();
    const response = await handler(attempt.callback(mode === "denied" ? "&error=access_denied&error_description=untrusted" : mode === "missing-code" ? "" : undefined), h.env);
    assert.equal(h.values.get("private-token"), before);
    assert.doesNotMatch(await response.text(), /sensitive-provider-error|untrusted|token/);
  }
});

test("renewal retains OAuth identity and updates expiry without requiring an operator token", async () => {
  const h = fixture();
  const attempt = await h.start();
  await h.api(attempt.callback(), h.env);
  const before = JSON.parse(h.values.get("private-token"));
  const after = await tokenFor(h.env, before.refreshedAt + 8 * 86400000, async () => Response.json({ access_token: "renewed", expires_in: 5184000 }));
  assert.equal(after.source, "oauth");
  assert.equal(after.userId, "1234");
  assert.equal(after.token, "renewed");
  assert.ok(after.expiresAt > before.expiresAt);
});

test("authorization resolves the professional profile ID and enforces an optional pinned account ID", async () => {
  for (const expected of ["1234", "9999"]) {
    const h = fixture();
    h.env.INSTAGRAM_USER_ID = expected;
    const original = h.deps.request;
    const handler = createConnectionHandler({ ...h.deps, request: async (url, options) => url.includes("api.instagram.com")
      ? Response.json({ data: [{ access_token: "short", user_id: "9876" }] }) : original(url, options) });
    const attempt = await h.start();
    const response = await handler(attempt.callback(), h.env);
    assert.equal(response.status, expected === "1234" ? 200 : 502);
    if (expected === "1234") assert.equal(JSON.parse(h.values.get("private-token")).userId, "1234");
    else assert.equal(h.values.has("private-token"), false);
  }
});
