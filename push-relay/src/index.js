import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from "jose";
import { validateEvent, buildMessage } from "./message.js";

const staff = new Set(["ian.arsenault@yahoo.com", "janartys@gmail.com"]);
const origins = new Set(["https://ianarsenault-tn.github.io", "capacitor://localhost", "https://localhost"]);
// Only Google's public signing keys are cached. No request/customer state is global.
const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

/** @param {Request} request @param {string} project */
export async function verifyStaff(request, project) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Unauthorized");
  const { payload } = await jwtVerify(authorization.slice(7), keys, { algorithms: ["RS256"], issuer: `https://securetoken.google.com/${project}`, audience: project });
  if (!payload.sub || !staff.has(String(payload.email)) || payload.email_verified !== true) throw new Error("Unauthorized");
}

/** @param {Env & { FCM_SERVICE_ACCOUNT?: string }} env */
async function accessToken(env) {
  const service = JSON.parse(env.FCM_SERVICE_ACCOUNT || "{}");
  if (service.project_id !== env.FIREBASE_PROJECT_ID || typeof service.client_email !== "string" || typeof service.private_key !== "string") throw new Error("Sender unavailable");
  const key = await importPKCS8(service.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(service.client_email)
    .setAudience("https://oauth2.googleapis.com/token").setIssuedAt().setExpirationTime("5m").sign(key);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Sender unavailable");
  const data = /** @type {{access_token?: string}} */ (await response.json());
  if (!data.access_token) throw new Error("Sender unavailable");
  return data.access_token;
}

/** Dependencies are injectable for local tests; production uses Google's verified tokens. */
export function createHandler(dependencies = { verifyStaff, accessToken, send: fetch }) {
  return {
    /** @param {Request} request @param {Env & { FCM_SERVICE_ACCOUNT?: string }} env */
    async fetch(request, env) {
      const origin = request.headers.get("Origin");
      const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin", ...(origin && origins.has(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } : {}) };
      const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
      if (origin && !origins.has(origin)) return reply(403, { error: "Origin not allowed" });
      const path = new URL(request.url).pathname;
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
      const ready = String(env.PUSH_ENABLED) === "true" && Boolean(env.FCM_SERVICE_ACCOUNT);
      if (path === "/health" && request.method === "GET") return reply(200, { ready });
      if (path !== "/publish" || request.method !== "POST") return reply(404, { error: "Not found" });
      if (!ready) return reply(503, { error: "Notifications are not active" });
      try { await dependencies.verifyStaff(request, env.FIREBASE_PROJECT_ID); }
      catch { return reply(401, { error: "Staff sign-in required" }); }
      let event;
      try {
        // Bound the body even for requests using chunked transfer encoding.
        const reader = request.body?.getReader();
        if (!reader) return reply(400, { error: "Missing event" });
        let text = "", bytes = 0;
        const decoder = new TextDecoder();
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 2048) { await reader.cancel(); return reply(413, { error: "Event too large" }); }
          text += decoder.decode(part.value, { stream: true });
        }
        text += decoder.decode(); event = validateEvent(JSON.parse(text));
      } catch { return reply(400, { error: "Invalid event" }); }
      try {
        const now = Date.now();
        await env.DB.prepare("DELETE FROM events WHERE created_at < ?").bind(now - 86400000).run();
        const claimed = await env.DB.prepare("INSERT OR IGNORE INTO events(id, created_at) SELECT ?, ? WHERE (SELECT COUNT(*) FROM events) < 100 RETURNING id").bind(event.id, now).first();
        if (!claimed) {
          const previous = await env.DB.prepare("SELECT status FROM events WHERE id = ?").bind(event.id).first();
          return previous ? reply(previous.status === "sent" ? 200 : 409, { status: previous.status }) : reply(429, { error: "Daily notification limit reached" });
        }
        // At most one send attempt per ID. An uncertain response is not blindly retried.
        const token = await dependencies.accessToken(env);
        const response = await dependencies.send(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: buildMessage(event) }), signal: AbortSignal.timeout(7000) });
        await env.DB.prepare("UPDATE events SET status = ? WHERE id = ?").bind(response.ok ? "sent" : "failed", event.id).run();
        console.log(JSON.stringify({ action: "push", eventId: event.id, status: response.ok ? "sent" : "failed" }));
        return reply(response.ok ? 200 : 502, { status: response.ok ? "sent" : "failed" });
      } catch {
        console.error(JSON.stringify({ action: "push", eventId: event.id, status: "unconfirmed" }));
        return reply(502, { error: "Delivery could not be confirmed" });
      }
    },
  };
}
export default createHandler();
