export const GRAPH = "https://graph.instagram.com";
export const TOKEN_KEY = "private-token";

export async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function metaJson(url, token, request, options = {}) {
  const response = await request(url, {
    ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  // Never log upstream errors or URLs, including token-exchange query strings.
  if (!response.ok) throw new Error("Instagram request failed");
  return JSON.parse(await response.text(), (key, value, context) => {
    // Meta can encode large account IDs as JSON numbers. Preserve their source
    // digits instead of rounding them through JavaScript's Number type.
    if ((key === "user_id" || key === "id") && typeof value === "number") {
      if (context?.source) return context.source;
      if (!Number.isSafeInteger(value)) throw new Error("Invalid account ID");
      return String(value);
    }
    return value;
  });
}

export async function tokenFor(env, now, request) {
  let saved = await env.FEED.get(TOKEN_KEY, "json");
  if (saved?.source !== "oauth") {
    if (!env.INSTAGRAM_ACCESS_TOKEN || !/^\d+$/.test(env.INSTAGRAM_USER_ID || "")) throw new Error("Not connected");
    const seed = await hash(env.INSTAGRAM_ACCESS_TOKEN);
    if (!saved || saved.seed !== seed) {
      saved = { seed, token: env.INSTAGRAM_ACCESS_TOKEN, userId: env.INSTAGRAM_USER_ID, refreshedAt: now };
      await env.FEED.put(TOKEN_KEY, JSON.stringify(saved));
    }
    saved.userId = env.INSTAGRAM_USER_ID;
  }
  if (!saved.token || !/^\d+$/.test(saved.userId || "")
      || (env.INSTAGRAM_USER_ID && saved.userId !== env.INSTAGRAM_USER_ID)) throw new Error("Not connected");
  if (now - saved.refreshedAt >= 7 * 86400000) {
    const url = new URL(`${GRAPH}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", saved.token);
    const renewed = await metaJson(url.href, null, request);
    if (typeof renewed.access_token !== "string" || !renewed.access_token
        || !Number.isFinite(renewed.expires_in) || renewed.expires_in <= 0) throw new Error("Token renewal failed");
    saved = { ...saved, token: renewed.access_token, refreshedAt: now, expiresAt: now + renewed.expires_in * 1000 };
    await env.FEED.put(TOKEN_KEY, JSON.stringify(saved));
  }
  return saved;
}
