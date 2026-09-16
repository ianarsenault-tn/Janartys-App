import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";

const allowed = () => ({ limit: async () => ({ success: true }) });
function fixture() {
  const calls = { auth: 0, body: 0, db: 0, token: 0, send: 0 };
  const handler = createHandler({
    verifyStaff: async () => { calls.auth++; return "verified-staff-id"; },
    accessToken: async () => { calls.token++; throw new Error("Unexpected sender access"); },
    send: async () => { calls.send++; throw new Error("Unexpected send"); },
  });
  const env = {
    FIREBASE_PROJECT_ID: "janarty-s", PUSH_ENABLED: "true", FCM_SERVICE_ACCOUNT: "test-only",
    REQUEST_RATE_LIMITER: allowed(), STAFF_RATE_LIMITER: allowed(),
    DB: { prepare() { calls.db++; throw new Error("Unexpected database access"); } },
  };
  const request = new Request("https://relay.test/publish", {
    method: "POST", headers: { Origin: "https://ianarsenault-tn.github.io", "CF-Connecting-IP": "192.0.2.1" }, body: "{}",
  });
  Object.defineProperty(request, "body", { get() { calls.body++; throw new Error("Unexpected body read"); } });
  return { calls, handler, env, request };
}

test("excess traffic stops before auth, payload reads, database work, or sending, even while disabled", async () => {
  for (const enabled of ["true", "false"]) {
    const { calls, handler, env, request } = fixture();
    env.PUSH_ENABLED = enabled;
    env.REQUEST_RATE_LIMITER = { limit: async () => ({ success: false }) };
    const response = await handler.fetch(request, env);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://ianarsenault-tn.github.io");
    assert.equal(response.headers.get("Access-Control-Expose-Headers"), "Retry-After");
    assert.deepEqual(calls, { auth: 0, body: 0, db: 0, token: 0, send: 0 });
  }
});

test("anonymous buckets resist path, query, token, and forwarded-header rotation", async () => {
  const { handler, env } = fixture();
  const keys = [];
  env.REQUEST_RATE_LIMITER = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
  for (const [path, method] of [["/health?client=1", "GET"], ["/publish?client=2", "POST"], ["/unknown", "GET"], ["/publish", "OPTIONS"]]) {
    const response = await handler.fetch(new Request(`https://relay.test${path}`, {
      method, headers: { "CF-Connecting-IP": "192.0.2.1", "X-Forwarded-For": crypto.randomUUID(), "X-Real-IP": crypto.randomUUID(), Authorization: `Bearer ${crypto.randomUUID()}` },
    }), env);
    assert.equal(response.status, 429);
  }
  assert.equal(new Set(keys).size, 1);
  assert.match(keys[0], /:192\.0\.2\.1$/);
  await handler.fetch(new Request("https://relay.test/health", { headers: { "CF-Connecting-IP": "192.0.2.2" } }), env);
  assert.notEqual(keys.at(-1), keys[0]);
  await handler.fetch(new Request("https://relay.test/health", { headers: { "X-Forwarded-For": "spoofed" } }), env);
  assert.match(keys.at(-1), /:unknown$/);
});

test("missing or failed request limiter fails closed without exposing internal errors", async () => {
  for (const limiter of [undefined, { limit: async () => { throw new Error("private diagnostic"); } }]) {
    const { calls, handler, env, request } = fixture();
    env.REQUEST_RATE_LIMITER = limiter;
    const response = await handler.fetch(request, env);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private diagnostic/);
    assert.deepEqual(calls, { auth: 0, body: 0, db: 0, token: 0, send: 0 });
  }
});

test("staff limit uses the verified identity across tokens and IPs and blocks protected work", async () => {
  const { calls, handler, env } = fixture();
  const keys = [];
  env.STAFF_RATE_LIMITER = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
  for (const ip of ["192.0.2.1", "192.0.2.2"]) {
    const request = new Request("https://relay.test/publish", { method: "POST", headers: { Origin: "capacitor://localhost", "CF-Connecting-IP": ip, Authorization: `Bearer ${crypto.randomUUID()}` }, body: "{}" });
    Object.defineProperty(request, "body", { get() { calls.body++; throw new Error("Unexpected body read"); } });
    const response = await handler.fetch(request, env);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");
  }
  assert.deepEqual(keys, ["janartys-push-relay:staff:verified-staff-id", "janartys-push-relay:staff:verified-staff-id"]);
  assert.deepEqual(calls, { auth: 2, body: 0, db: 0, token: 0, send: 0 });
});

test("invalid authentication never consumes a staff bucket", async () => {
  const { env, request } = fixture();
  let staffCalls = 0;
  env.STAFF_RATE_LIMITER = { limit: async () => { staffCalls++; return { success: true }; } };
  const handler = createHandler({ verifyStaff: async () => { throw new Error("denied"); }, accessToken: async () => "unused", send: async () => new Response() });
  assert.equal((await handler.fetch(request, env)).status, 401);
  assert.equal(staffCalls, 0);
});

test("missing or failed staff limiter fails closed after authentication", async () => {
  for (const limiter of [undefined, { limit: async () => { throw new Error("private diagnostic"); } }]) {
    const { calls, handler, env, request } = fixture();
    env.STAFF_RATE_LIMITER = limiter;
    const response = await handler.fetch(request, env);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private diagnostic/);
    assert.deepEqual(calls, { auth: 1, body: 0, db: 0, token: 0, send: 0 });
  }
});

test("normal health and browser preflight requests remain available without staff authentication", async () => {
  const { calls, handler, env } = fixture();
  env.PUSH_ENABLED = "false";
  let staffCalls = 0;
  env.STAFF_RATE_LIMITER = { limit: async () => { staffCalls++; return { success: false }; } };
  const headers = { Origin: "https://ianarsenault-tn.github.io", "CF-Connecting-IP": "192.0.2.1" };
  const health = await handler.fetch(new Request("https://relay.test/health", { headers }), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ready: false });
  const preflight = await handler.fetch(new Request("https://relay.test/publish", { method: "OPTIONS", headers }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");
  assert.equal(staffCalls, 0);
  assert.deepEqual(calls, { auth: 0, body: 0, db: 0, token: 0, send: 0 });
});
