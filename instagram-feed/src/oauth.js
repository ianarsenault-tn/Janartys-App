import { verifyStaff } from "./staff-auth.js";
import { GRAPH, hash, metaJson, TOKEN_KEY } from "./tokens.js";

const ORIGINS = new Set(["https://ianarsenault-tn.github.io", "capacitor://localhost", "https://localhost"]);
const COOKIE = "__Host-janartys-ig";
const TEN_MINUTES = 600000;
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
const opaque = value => /^[a-f0-9]{64}$/.test(value || "");

function ready(env) {
  try {
    const callback = new URL(env.INSTAGRAM_REDIRECT_URI);
    return env.INSTAGRAM_CONNECT_ENABLED === "true" && /^\d+$/.test(env.INSTAGRAM_CLIENT_ID || "")
      && Boolean(env.INSTAGRAM_CLIENT_SECRET && env.FEED && env.OAUTH_DB)
      && env.FIREBASE_PROJECT_ID === "janarty-s" && /^v\d+\.\d+$/.test(env.INSTAGRAM_API_VERSION || "")
      && (!env.INSTAGRAM_USER_ID || /^\d+$/.test(env.INSTAGRAM_USER_ID))
      && callback.protocol === "https:" && !callback.username && !callback.password
      && callback.pathname === "/connect/callback" && !callback.search && !callback.hash;
  } catch { return false; }
}

function cookie(value, age = 600) {
  return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
}

function page(message, status = 200) {
  // All text is fixed by the service: never echo provider errors, code or state.
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Janarty's Instagram</title><body><h1>Janarty's Instagram</h1><p>${message}</p><p>Close this window (Done on iPhone), return to Manager, and select Check connection.</p><p><a href="https://ianarsenault-tn.github.io/Janartys-App/#/staff">Return to Manager on the web</a></p></body></html>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "Set-Cookie": cookie("", 0), "X-Content-Type-Options": "nosniff" },
  });
}

export async function exchangeCode(code, env, request, now) {
  const result = await metaJson("https://api.instagram.com/oauth/access_token", null, request, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.INSTAGRAM_CLIENT_ID, client_secret: env.INSTAGRAM_CLIENT_SECRET,
      grant_type: "authorization_code", redirect_uri: env.INSTAGRAM_REDIRECT_URI, code }),
  });
  const short = result.data?.[0] || result;
  const loginId = String(short.user_id || "");
  if (!/^\d+$/.test(loginId) || typeof short.access_token !== "string" || !short.access_token) throw new Error("Invalid exchange");
  const url = new URL(`${GRAPH}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", env.INSTAGRAM_CLIENT_SECRET);
  url.searchParams.set("access_token", short.access_token);
  const long = await metaJson(url.href, null, request);
  if (!long.access_token || typeof long.access_token !== "string" || !Number.isFinite(long.expires_in) || long.expires_in <= 0) throw new Error("Invalid exchange");
  const profile = await metaJson(`${GRAPH}/${env.INSTAGRAM_API_VERSION}/${loginId}?fields=user_id,username`, long.access_token, request);
  // Resolve the professional account ID from the verified profile; a login-
  // scoped ID returned during exchange need not have the same representation.
  const userId = String(profile.user_id || "");
  if (profile.username?.toLowerCase() !== "janartys" || !/^\d+$/.test(userId)
      || (env.INSTAGRAM_USER_ID && env.INSTAGRAM_USER_ID !== userId)) throw new Error("Wrong account");
  return { source: "oauth", token: long.access_token, userId, refreshedAt: now, expiresAt: now + long.expires_in * 1000 };
}

export function createConnectionHandler({ authenticate = verifyStaff, request: metaRequest = (...args) => fetch(...args), now = Date.now } = {}) {
  return async (request, env) => {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = origin && ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" } : {};
    const reply = (value, status = 200) => Response.json(value, { status, headers: { ...cors, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    if (origin && !ORIGINS.has(origin)) return reply({ error: "Origin not allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!ready(env)) return reply({ error: "Instagram connection setup is not ready yet." }, 503);
    try {
      const limit = await env.CONNECT_RATE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
      if (!limit.success) return reply({ error: "Please wait a minute and try again." }, 429);
    } catch { return reply({ error: "Connection temporarily unavailable." }, 503); }
    try {
      if (url.pathname === "/connect/status" && request.method === "GET") {
        try { await authenticate(request, env.FIREBASE_PROJECT_ID); }
        catch { return reply({ error: "Staff sign-in required." }, 401); }
        const saved = await env.FEED.get(TOKEN_KEY, "json");
        return reply({ connected: saved?.source === "oauth" && saved.expiresAt > now(),
          feedEnabled: env.INSTAGRAM_ENABLED === "true" });
      }
      if (url.pathname === "/connect/start" && request.method === "POST") {
        let staff;
        try { staff = await authenticate(request, env.FIREBASE_PROJECT_ID); }
        catch { return reply({ error: "Staff sign-in required." }, 401); }
        const ticket = random();
        await env.OAUTH_DB.prepare("INSERT INTO oauth_sessions(staff_id, ticket_hash, cookie_hash, expires_at) VALUES (?, ?, NULL, ?) ON CONFLICT(staff_id) DO UPDATE SET ticket_hash=excluded.ticket_hash, cookie_hash=NULL, expires_at=excluded.expires_at")
          .bind(staff, await hash(ticket), now() + TEN_MINUTES).run();
        const next = new URL("/connect/authorize", env.INSTAGRAM_REDIRECT_URI);
        next.searchParams.set("ticket", ticket);
        return reply({ url: next.href });
      }
      if (url.pathname === "/connect/authorize" && request.method === "GET") {
        const ticket = url.searchParams.get("ticket");
        if (!opaque(ticket)) return page("This connection link is invalid. Please start again in Manager.", 400);
        const browser = random();
        const session = await env.OAUTH_DB.prepare("UPDATE oauth_sessions SET cookie_hash=? WHERE ticket_hash=? AND cookie_hash IS NULL AND expires_at>? RETURNING staff_id")
          .bind(await hash(browser), await hash(ticket), now()).first();
        if (!session) return page("This connection link expired or was already opened. Please start again in Manager.", 400);
        const authorize = new URL("https://www.instagram.com/oauth/authorize");
        authorize.search = new URLSearchParams({ client_id: env.INSTAGRAM_CLIENT_ID, redirect_uri: env.INSTAGRAM_REDIRECT_URI,
          response_type: "code", scope: "instagram_business_basic", state: ticket, force_authentication: "1", enable_fb_login: "0" }).toString();
        return new Response(null, { status: 302, headers: { Location: authorize.href, "Set-Cookie": cookie(browser), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
      }
      if (url.pathname === "/connect/callback" && request.method === "GET") {
        const state = url.searchParams.get("state");
        const browser = request.headers.get("Cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
        if (!opaque(state) || !opaque(browser)) return page("Could not verify this connection. Please start again in Manager.", 400);
        // D1 atomically consumes state before exchange. KV eventual consistency
        // cannot provide this replay protection. Bind to this browser's cookie.
        const session = await env.OAUTH_DB.prepare("DELETE FROM oauth_sessions WHERE ticket_hash=? AND cookie_hash=? AND expires_at>? RETURNING staff_id")
          .bind(await hash(state), await hash(browser), now()).first();
        if (!session) return page("This connection expired or was already used. Please start again in Manager.", 400);
        if (url.searchParams.has("error")) return page("Instagram access was not approved. Your existing connection has not changed.");
        const code = url.searchParams.get("code");
        if (!code || code.length > 4096) return page("Instagram did not return a valid approval. Please try again.", 400);
        const token = await exchangeCode(code, env, metaRequest, now());
        // Only a verified @janartys authorization can replace the current token.
        await env.FEED.put(TOKEN_KEY, JSON.stringify(token));
        return page("Connected to @janartys. Your approval was saved securely.");
      }
      return reply({ error: "Not found" }, 404);
    } catch {
      if (url.pathname === "/connect/callback") return page("Could not confirm the connection. Return to Manager to check it or try again with the @janartys business account.", 502);
      return reply({ error: "Could not reach the connection service. Please try again." }, 502);
    }
  };
}

export const connectionHandler = createConnectionHandler();
