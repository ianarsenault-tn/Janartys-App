const NOT_READY = "Instagram connection setup is not ready yet. You can still choose a post below.";

export function createInstagramConnection({ baseUrl, getToken, prepareBrowser, onChange, request = (...args) => fetch(...args) }) {
  let generation = 0;
  const state = { busy: false, ready: false, connected: false, message: NOT_READY };
  const base = (() => {
    try { const u = new URL(baseUrl); return u.protocol === "https:" && !u.username && !u.password && u.pathname === "/" && !u.search && !u.hash ? u.origin : ""; }
    catch { return ""; }
  })();
  async function call(path, method, token) {
    const response = await request(`${base}${path}`, { method, credentials: "omit", referrerPolicy: "no-referrer",
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Object.assign(new Error("Connection failed"), { status: response.status });
    return response.json();
  }
  async function run(connect) {
    if (!base || state.busy) return;
    const current = generation;
    state.busy = true;
    state.message = connect ? "Opening Instagram for your approval…" : "Checking Instagram connection…";
    onChange();
    let browser;
    try {
      // Reserve a web tab during the click gesture, before token/network awaits.
      if (connect) browser = prepareBrowser();
      const token = await getToken();
      if (!token) throw Object.assign(new Error("Sign in"), { status: 401 });
      if (current !== generation) return;
      const data = await call(connect ? "/connect/start" : "/connect/status", connect ? "POST" : "GET", token);
      if (current !== generation) return;
      if (connect) {
        const url = new URL(data.url);
        if (url.origin !== base || url.pathname !== "/connect/authorize" || url.username || url.password
            || !/^[a-f0-9]{64}$/.test(url.searchParams.get("ticket") || "")) throw new Error("Invalid connection link");
        await browser.open(url.href);
        browser = null;
        if (current !== generation) return;
        state.message = "Approve access on Instagram, then return here and select Check connection.";
      } else {
        if (typeof data.connected !== "boolean" || typeof data.feedEnabled !== "boolean") throw new Error("Invalid status");
        state.ready = true;
        state.connected = data.connected;
        state.message = data.connected
          ? `Connected to @janartys.${data.feedEnabled ? "" : " Automatic posts are not active yet."}`
          : "Connect @janartys to let the app show its latest post. Instagram will ask you to approve access.";
      }
    } catch (error) {
      if (current !== generation) return;
      state.ready = false;
      state.message = error?.code === "popup-blocked" ? "Allow pop-ups for this app, then select Check connection and try again."
        : error?.status === 503 ? NOT_READY : error?.status === 401
        ? "Please sign in to Manager again before connecting Instagram."
        : error?.status === 429 ? "Please wait a minute, then check the connection again."
        : "Could not connect to Instagram. Check your connection and try Check connection again.";
    } finally {
      browser?.cancel();
      if (current === generation) { state.busy = false; onChange(); }
    }
  }
  return {
    state, configured: Boolean(base), refresh: () => run(false), connect: () => run(true),
    reset() { generation++; Object.assign(state, { busy: false, ready: false, connected: false, message: NOT_READY }); },
  };
}
