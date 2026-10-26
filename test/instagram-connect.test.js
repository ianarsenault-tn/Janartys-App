import test from "node:test";
import assert from "node:assert/strict";
import { createInstagramConnection } from "../src/instagram-connect.js";
import { INSTAGRAM_CONNECT_URL } from "../src/instagram-config.js";

test("disabled connection performs no auth or network work", async () => {
  assert.equal(INSTAGRAM_CONNECT_URL, "");
  const unexpected = () => assert.fail("No work while disabled");
  const connection = createInstagramConnection({ baseUrl: "", getToken: unexpected, prepareBrowser: unexpected, onChange: unexpected, request: unexpected });
  await connection.refresh();
  await connection.connect();
  assert.equal(connection.state.ready, false);
  assert.match(connection.state.message, /not ready yet/);
});

test("status and start use bearer auth, open only the service URL, and distinguish connection from activation", async () => {
  const calls = [], opens = [], events = [];
  const connection = createInstagramConnection({ baseUrl: "https://feed.test", getToken: async () => { events.push("token"); return "staff"; }, onChange() {},
    prepareBrowser: () => { events.push("browser"); return { open: async url => opens.push(url), cancel() {} }; },
    request: async (url, options) => {
      calls.push({ url, options });
      return Response.json(url.endsWith("/status") ? { connected: true, feedEnabled: false } : { url: `https://feed.test/connect/authorize?ticket=${"a".repeat(64)}` });
    } });
  await connection.refresh();
  assert.equal(connection.state.ready, true);
  assert.match(connection.state.message, /Automatic posts are not active yet/);
  events.length = 0;
  await connection.connect();
  assert.deepEqual(events, ["browser", "token"]);
  assert.equal(opens.length, 1);
  assert.ok(calls.every(c => c.options.headers.Authorization === "Bearer staff" && c.options.credentials === "omit"));
  assert.equal(calls[1].options.method, "POST");
  assert.match(connection.state.message, /Approve access on Instagram/);
});

test("logout during connection cancels the reserved browser and suppresses stale results", async () => {
  let resolve;
  let opened = false, closed = false;
  const connection = createInstagramConnection({ baseUrl: "https://feed.test", getToken: () => new Promise(done => { resolve = done; }), onChange() {},
    prepareBrowser: () => ({ open: async () => { opened = true; }, cancel: () => { closed = true; } }), request: () => assert.fail("No request after logout") });
  const pending = connection.connect();
  connection.reset();
  resolve("old-session-token");
  await pending;
  assert.equal(opened, false);
  assert.equal(closed, true);
  assert.equal(connection.state.busy, false);
});

test("malicious redirects, unavailable setup, auth failures and rate limits give safe retry feedback", async () => {
  for (const status of [200, 401, 429, 503]) {
    let closed = false;
    const connection = createInstagramConnection({ baseUrl: "https://feed.test", getToken: async () => "staff", onChange() {},
      prepareBrowser: () => ({ open: () => assert.fail("Must not navigate"), cancel: () => { closed = true; } }),
      request: async () => Response.json({ url: "https://evil.test/steal", error: "untrusted" }, { status }) });
    await connection.connect();
    assert.equal(closed, true);
    assert.equal(connection.state.ready, false);
    assert.doesNotMatch(connection.state.message, /untrusted|evil/);
    assert.equal(connection.state.busy, false);
  }
});
