// Video sources are attached only inside the tap handler, preserving iPhone's
// user gesture and avoiding any video download before the customer presses play.
export function setupInstagramVideo(root) {
  const pending = new WeakMap();
  function reset(video) {
    clearTimeout(pending.get(video)?.timer);
    pending.delete(video);
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.hidden = true;
    const card = video.closest(".ig-card");
    card.querySelector("[data-ig-photo]").hidden = false;
    card.querySelector("[data-ig-play]").hidden = false;
  }
  function failed(video) {
    if (!video.isConnected || !pending.has(video)) return;
    const focused = document.activeElement === video;
    reset(video);
    const card = video.closest(".ig-card");
    card.querySelector("[data-ig-play]").hidden = true;
    card.querySelector("[data-ig-video-error]").hidden = false;
    if (focused) card.querySelector(".ig-video-link").focus({ preventScroll: true });
  }
  root.addEventListener("click", event => {
    const button = event.target.closest("[data-ig-play]");
    if (!button) return;
    const card = button.closest(".ig-card"), video = card.querySelector("video");
    if (!video || pending.has(video)) return;
    event.preventDefault();
    const state = {};
    pending.set(video, state);
    button.hidden = true;
    card.querySelector("[data-ig-photo]").hidden = true;
    video.hidden = false;
    video.src = video.dataset.videoUrl;
    video.load();
    state.timer = setTimeout(() => failed(video), 15000);
    // Do not await network work before play(): Safari needs the original tap.
    try {
      video.play()?.catch(() => { if (pending.get(video) === state) failed(video); });
    } catch { failed(video); }
    if (!video.hidden) video.focus({ preventScroll: true });
  });
  root.addEventListener("playing", event => {
    if (event.target.matches?.("[data-ig-video]")) clearTimeout(pending.get(event.target)?.timer);
  }, true);
  root.addEventListener("error", event => {
    if (event.target.matches?.("[data-ig-video]")) failed(event.target);
  }, true);
  const stop = () => root.querySelectorAll("[data-ig-video]").forEach(video => {
    if (pending.has(video)) reset(video);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", stop);
  return { stop };
}
