import { SEED_INSTAGRAM } from "./data.js";
import { safeHttpsUrl } from "./presentation.js";

export const FEED_REFRESH_MS = 30 * 60 * 1000;
export const FEED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function validFeedPost(post, now = Date.now()) {
  if (!post || typeof post.caption !== "string" || post.caption.length > 2200
      || post.handle !== "janartys" || !safeHttpsUrl(post.imageUrl)
      || !safeHttpsUrl(post.permalink) || !Number.isFinite(post.fetchedAt)
      || post.fetchedAt > now + 60_000 || now - post.fetchedAt > FEED_MAX_AGE_MS) return false;
  // Legacy cached photo/cover responses have neither field. Missing video URLs
  // still allow the cover and Instagram link; unsafe URLs never reach a player.
  if (post.mediaType != null && !["IMAGE", "VIDEO"].includes(post.mediaType)) return false;
  if (post.videoUrl != null && (post.mediaType !== "VIDEO" || !safeHttpsUrl(post.videoUrl))) return false;
  if (post.videoUrl && (new URL(post.videoUrl).username || new URL(post.videoUrl).password)) return false;
  const link = new URL(post.permalink);
  return ["instagram.com", "www.instagram.com"].includes(link.hostname)
    && /^\/(p|reel|tv)\/[^/]+\/?$/.test(link.pathname);
}

export function featuredInstagram(manual, automatic, now = Date.now()) {
  // Old saved cards have no source marker. Preserve custom legacy content too.
  const overridden = manual?.source === "manual" || ["imageUrl", "caption", "permalink", "handle"]
    .some(key => manual?.[key] != null && manual[key] !== SEED_INSTAGRAM[key]);
  if (overridden) return manual;
  return validFeedPost(automatic, now) ? automatic : (manual || SEED_INSTAGRAM);
}

export function createInstagramFeed({ url, onChange, request = (...args) => fetch(...args), now = Date.now }) {
  let post = null;
  let pending = null;
  let retryAt = 0;
  return {
    current: () => validFeedPost(post, now()) ? post : null,
    refresh() {
      if (!safeHttpsUrl(url) || now() < retryAt) return pending || Promise.resolve();
      retryAt = now() + FEED_REFRESH_MS;
      pending = (async () => {
        try {
          const response = await request(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(6000) });
          if (!response.ok) throw new Error("Feed unavailable");
          const next = await response.json();
          if (next === null) post = null;
          else if (validFeedPost(next, now())) post = next;
          else throw new Error("Invalid feed");
        } catch {
          // An optional feed must never interrupt the case or a Manager draft.
          if (!validFeedPost(post, now())) post = null;
        } finally {
          pending = null;
          onChange();
        }
      })();
      return pending;
    },
  };
}
