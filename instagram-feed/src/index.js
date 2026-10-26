const GRAPH = "https://graph.instagram.com";
const MAX_AGE = 24 * 60 * 60 * 1000;
const REFRESH_AFTER = 7 * 24 * 60 * 60 * 1000;
const PUBLIC_KEY = "latest";
const TOKEN_KEY = "private-token";

function configured(env) {
  return env.INSTAGRAM_ENABLED === "true" && /^\d+$/.test(env.INSTAGRAM_USER_ID || "")
    && /^v\d+\.\d+$/.test(env.INSTAGRAM_API_VERSION || "")
    && Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.FEED);
}

function https(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function selectPost(items, now) {
  const sorted = [...items].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  for (const item of sorted) {
    const timestamp = Date.parse(item.timestamp);
    const permalink = https(item.permalink);
    if (!Number.isFinite(timestamp) || !permalink) continue;
    const link = new URL(permalink);
    if (!["instagram.com", "www.instagram.com"].includes(link.hostname)
        || !/^\/(p|reel|tv)\/[^/]+\/?$/.test(link.pathname)) continue;
    const media = item.media_type === "CAROUSEL_ALBUM" ? item.children?.data?.[0] : item;
    const imageUrl = https(media?.media_type === "VIDEO" ? media.thumbnail_url : media?.media_url);
    if (!imageUrl || !["IMAGE", "VIDEO"].includes(media?.media_type)) continue;
    return {
      imageUrl, permalink, handle: "janartys",
      caption: typeof item.caption === "string" ? item.caption.slice(0, 2200) : "",
      publishedAt: timestamp, fetchedAt: now,
    };
  }
  return null;
}

async function metaJson(url, token, request) {
  const response = await request(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  // Never throw/log upstream bodies or URLs: they can contain access tokens.
  if (!response.ok) throw new Error("Instagram request failed");
  return response.json();
}

async function tokenFor(env, now, request) {
  const bytes = new TextEncoder().encode(env.INSTAGRAM_ACCESS_TOKEN);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const seed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  let saved = await env.FEED.get(TOKEN_KEY, "json");
  if (!saved || saved.seed !== seed) {
    saved = { seed, token: env.INSTAGRAM_ACCESS_TOKEN, refreshedAt: now };
    await env.FEED.put(TOKEN_KEY, JSON.stringify(saved));
  }
  if (now - saved.refreshedAt >= REFRESH_AFTER) {
    const url = new URL(`${GRAPH}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", saved.token);
    const renewed = await metaJson(url.href, null, request);
    if (typeof renewed.access_token !== "string" || !renewed.access_token
        || !Number.isFinite(renewed.expires_in) || renewed.expires_in <= 0) throw new Error("Token renewal failed");
    saved = { seed, token: renewed.access_token, refreshedAt: now };
    await env.FEED.put(TOKEN_KEY, JSON.stringify(saved));
  }
  return saved.token;
}

export async function syncInstagram(env, { request = fetch, now = Date.now() } = {}) {
  if (!configured(env)) return { status: "disabled" };
  try {
    const token = await tokenFor(env, now, request);
    const base = `${GRAPH}/${env.INSTAGRAM_API_VERSION}`;
    const profile = await metaJson(`${base}/${env.INSTAGRAM_USER_ID}?fields=user_id,username`, token, request);
    if (String(profile.user_id) !== env.INSTAGRAM_USER_ID || profile.username?.toLowerCase() !== "janartys") {
      throw new Error("Wrong Instagram account");
    }
    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}";
    const url = new URL(`${base}/${env.INSTAGRAM_USER_ID}/media`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "25");
    const result = await metaJson(url.href, token, request);
    if (!Array.isArray(result.data)) throw new Error("Invalid media response");
    const post = selectPost(result.data, now);
    // Empty feed clears deleted/archived posts. Errors retain yesterday's good
    // result for at most 24 hours; customer requests never trigger Meta calls.
    if (result.data.length && !post) throw new Error("No supported media");
    await env.FEED.put(PUBLIC_KEY, JSON.stringify(post));
    return { status: "updated" };
  } catch {
    // Keep tokens and upstream responses out of logs and public diagnostics.
    return { status: "unavailable" };
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    if (path !== "/latest" && path !== "/health") return json({ error: "Not found" }, 404);
    if (!configured(env)) return path === "/health" ? json({ enabled: false, ready: false }) : json(null, 503);
    try {
      const post = await env.FEED.get(PUBLIC_KEY, "json");
      const fresh = post && Number.isFinite(post.fetchedAt) && Date.now() - post.fetchedAt <= MAX_AGE;
      if (path === "/health") return json({ enabled: true, ready: Boolean(fresh) });
      // Only explicitly public fields leave the service, never the private KV record.
      if (!fresh) return json(null, post === null ? 200 : 503);
      const { imageUrl, caption, permalink, handle, publishedAt, fetchedAt } = post;
      return json({ imageUrl, caption, permalink, handle, publishedAt, fetchedAt });
    } catch { return json(null, 503); }
  },
  async scheduled(_event, env) {
    const result = await syncInstagram(env);
    if (result.status === "unavailable") throw new Error("Instagram sync unavailable; check owner authorization and configuration.");
  },
};
