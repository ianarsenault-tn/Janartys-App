import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHandler, verifyStaff } from "../src/index.js";
import { validateEvent, buildMessage } from "../src/message.js";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { STAFF_IDENTITIES } from "../src/staff-identities.js";

function database() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../migrations/0001_events.sql", import.meta.url), "utf8"));
  return { prepare(query) { return { bind(...args) { const stmt = sql.prepare(query); return { async run() { return stmt.run(...args); }, async first() { return stmt.get(...args) || null; } }; } }; } };
}
const event = () => ({ id: crypto.randomUUID(), at: Date.now(), kind: "flavor", flavorId: "lavender", name: "Blueberry Lavender" });
const request = data => new Request("https://relay.test/publish", { method: "POST", headers: { Origin: "https://ianarsenault-tn.github.io", "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" }, body: JSON.stringify(data) });
const environment = () => ({ FIREBASE_PROJECT_ID: "janarty-s", PUSH_ENABLED: "true", FCM_SERVICE_ACCOUNT: "test-secret", DB: database(), REQUEST_RATE_LIMITER: { limit: async () => ({ success: true }) }, STAFF_RATE_LIMITER: { limit: async () => ({ success: true }) } });

test("real token verification binds staff email to the approved account", async t => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "local-test", alg: "RS256" };
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(String(url), "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    return Response.json({ keys: [jwk] });
  });
  const pairs = STAFF_IDENTITIES;
  const tokenRequest = async (claims, { issuer = "https://securetoken.google.com/janarty-s", audience = "janarty-s", expires = "5m", key = privateKey } = {}) => {
    const token = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "local-test" })
      .setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expires).sign(key);
    const req = request(event());
    req.headers.set("Authorization", `Bearer ${token}`);
    return req;
  };
  let sent = 0;
  const handler = createHandler({ verifyStaff, accessToken: async () => "test", send: async () => { sent++; return new Response(); } });
  for (const [uid, email] of pairs) {
    await t.test(`approved account ${uid}`, async () => {
      const req = await tokenRequest({ sub: uid, email, email_verified: true });
      assert.equal(await verifyStaff(req, "janarty-s"), uid);
      assert.equal((await handler.fetch(req, environment())).status, 200);
    });
    for (const claims of [
      { sub: "recreated-account", email, email_verified: true },
      { sub: uid, email: pairs.find(pair => pair[0] !== uid)[1], email_verified: true },
      { sub: uid, email: "outsider@example.com", email_verified: true },
      { sub: uid, email: email.toUpperCase(), email_verified: true },
      { sub: uid, email, email_verified: false },
      { sub: uid, email, email_verified: "true" },
      { sub: uid, email: [email], email_verified: true },
      { sub: uid, email: 123, email_verified: true },
      { sub: uid, email },
    ]) {
      await t.test(`reject ${JSON.stringify(claims)}`, async () => {
        const req = await tokenRequest(claims);
        await assert.rejects(verifyStaff(req, "janarty-s"));
        const env = environment();
        env.DB = { prepare() { throw new Error("unauthorized request reached D1"); } };
        env.STAFF_RATE_LIMITER = { limit() { throw new Error("unauthorized request reached staff limiter"); } };
        assert.equal((await handler.fetch(req, env)).status, 401);
      });
    }
  }
  for (const claims of [{ email: pairs[0][1], email_verified: true }, { sub: "unknown", email_verified: true }, { sub: pairs[0][0], email_verified: true }]) {
    await assert.rejects(verifyStaff(await tokenRequest(claims), "janarty-s"));
  }
  const claims = { sub: pairs[0][0], email: pairs[0][1], email_verified: true };
  const other = await generateKeyPair("RS256");
  for (const options of [{ issuer: "https://securetoken.google.com/other" }, { audience: "other" }, { expires: "-1m" }, { key: other.privateKey }]) {
    await assert.rejects(verifyStaff(await tokenRequest(claims, options), "janarty-s"));
  }
  assert.equal(sent, pairs.length);
});

test("messages use one topic condition for favorites and all-new-flavor followers", () => {
  const message = buildMessage(validateEvent(event()));
  assert.match(message.condition, /'new-flavors' in topics \|\| 'flavor-/);
  assert.equal(message.data.flavorId, "lavender");
  assert.equal(message.apns.headers["apns-push-type"], "alert");
  assert.equal(buildMessage({ ...event(), kind: "announcement", message: "Open late" }).topic, "shop-announcements");
  assert.throws(() => validateEvent({ ...event(), at: Date.now() - 3600000 }));
  assert.throws(() => validateEvent({ ...event(), kind: "undo" }));
});
test("disabled relay fails closed and never sends", async () => {
  const handler = createHandler({ verifyStaff: async () => { throw new Error("must not verify"); }, accessToken: async () => "test", send: async () => { throw new Error("must not send"); } });
  assert.equal((await handler.fetch(request(event()), { ...environment(), PUSH_ENABLED: "false" })).status, 503);
});
test("missing/forged staff credentials and unapproved origins cannot send", async () => {
  await assert.rejects(verifyStaff(new Request("https://relay.test"), "janarty-s"));
  await assert.rejects(verifyStaff(new Request("https://relay.test", { headers: { Authorization: "Bearer fake.jwt.token" } }), "janarty-s"));
  const handler = createHandler({ verifyStaff: async () => { throw new Error("denied"); }, accessToken: async () => "", send: async () => new Response() });
  assert.equal((await handler.fetch(request(event()), environment())).status, 401);
  const untrusted = request(event()); untrusted.headers.set("Origin", "https://untrusted.test");
  assert.equal((await handler.fetch(untrusted, environment())).status, 403);
});
test("duplicate events send exactly once using a real SQLite unique constraint", async () => {
  let sent = 0;
  const handler = createHandler({ verifyStaff: async () => "staff-one", accessToken: async () => "test", send: async () => { sent++; return new Response('{}'); } });
  const env = environment(), data = event();
  const responses = await Promise.all([handler.fetch(request(data), env), handler.fetch(request(data), env)]);
  assert.equal(sent, 1);
  assert.ok(responses.some(response => response.status === 200));
  assert.equal((await handler.fetch(request(data), env)).status, 200);
  assert.equal(sent, 1);
});
test("failed sends are not retried and the daily cap stops extra sends", async () => {
  let sent = 0;
  const handler = createHandler({ verifyStaff: async () => "staff-one", accessToken: async () => "test", send: async () => { sent++; return new Response('', { status: 500 }); } });
  const env = environment(), data = event();
  assert.equal((await handler.fetch(request(data), env)).status, 502);
  assert.equal((await handler.fetch(request(data), env)).status, 409);
  assert.equal(sent, 1);
  for (let i = 0; i < 99; i++) await env.DB.prepare("INSERT INTO events(id,created_at) VALUES(?,?)").bind(`seed-${i}`, Date.now()).run();
  assert.equal((await handler.fetch(request(event()), env)).status, 429);
  assert.equal(sent, 1);
});
test("oversized and invalid payloads are rejected before any database write", async () => {
  const handler = createHandler({ verifyStaff: async () => "staff-one", accessToken: async () => "test", send: async () => new Response() });
  assert.equal((await handler.fetch(request({ ...event(), message: "x".repeat(3000) }), environment())).status, 413);
  assert.equal((await handler.fetch(request({}), environment())).status, 400);
});
