// NUKE Remote's service worker.
//  1. Opens fast: what the page needs is kept on the phone.
//     • the page: from the internet when it answers quickly (so a new version arrives the first time), else the
//       copy kept here (slow or no internet) — and the new one is kept for next time
//     • the Supabase library (only when there's no relay of ours) and the font files: fixed versions that never change →
//       straight from here
//     • the logo, the icons, the manifest, the game / QR scripts next to it (rx-game.js, jsqr.js) and the font list: from
//       here, refreshed behind
//     • a cache that fails (storage full, a private window, a store gone bad) never stops anything: then from the internet
//     Only remote.html and its own files: the other pages next to it (admin.html…) are never touched.
//     A new caching way = a new CACHE name; the old ones are deleted when it starts. Every publish is a new name too (its
//     build's version, filled in by scripts/remote-page.mjs), and the page asks for its scripts by that version
//     (rx-game.js?v=…): a page fresh from a publish never runs with an older script kept here (mission 10 M3).
//  2. Shows the notifications the PC sends (Web Push):
//     • short title + one line; a newer one of the same kind replaces the older (`tag`), so they don't pile up
//     • tapping one opens the page on its tab (e.g. «الحالة» for "the RAM is full")
const CACHE = "nk-remote-v4-9144dbcc97";
const PAGE_WAIT = 1500; // ms the internet gets before the kept page is shown

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["remote.html", "remote-logo.webp", "remote-icon.png", "remote-app.png", "remote.webmanifest"]))
      .catch(() => {}), // (kept on the first visit instead)
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith("nk-remote-") && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

// an exact version (…/npm/@supabase/supabase-js@2.117.2/+esm, …/npm/jsqr@1.4.0/…) or a font file: never changes
const fixed = (u) => (u.hostname === "cdn.jsdelivr.net" && /^\/npm\/(@[^/]+\/)?[^/@]+@\d+\.\d+\.\d+[^/]*\//.test(u.pathname)) || u.hostname === "fonts.gstatic.com";
const here = (u) => u.origin === self.location.origin;
const pageKey = (u) => `${u.origin}${u.pathname}`; // ?tab=… / a shared link: the same page

// big files straight to Downloads: the page says "dl" with a port; the bytes it sends on the port become the
// download's body (null = the end, "abort" = cut off)
const downloads = new Map();
self.addEventListener("message", (event) => {
  const m = event.data;
  const port = event.ports?.[0];
  if (m?.t !== "dl" || !port || typeof m.id !== "string") return;
  let ctrl;
  const stream = new ReadableStream({ start: (c) => (ctrl = c) });
  port.onmessage = (e) => {
    try {
      if (e.data === null) ctrl.close();
      else if (e.data === "abort") ctrl.error(new Error("cut off"));
      else ctrl.enqueue(e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data));
    } catch {}
  };
  downloads.set(m.id, { stream, name: String(m.name || "file"), size: Number(m.size) || 0, type: String(m.type || "") });
  setTimeout(() => downloads.delete(m.id), 60e3);
  port.postMessage("ok");
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let u;
  try {
    u = new URL(req.url);
  } catch {
    return;
  }
  // a big file from the PC, written into the phone's Downloads as its pieces arrive (see the "dl" message below)
  const dl = here(u) && /\/nk-dl\/([0-9a-f-]{36})$/.exec(u.pathname);
  if (dl) {
    const d = downloads.get(dl[1]);
    downloads.delete(dl[1]);
    if (!d) return event.respondWith(new Response("", { status: 404 }));
    return event.respondWith(
      new Response(d.stream, {
        headers: {
          "Content-Type": d.type || "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
          ...(d.size ? { "Content-Length": String(d.size) } : {}),
        },
      }),
    );
  }
  // the pages for friends next to it (send.html, challenge.html) load their own files from the internet as usual: they
  // are opened by people who never installed anything, and nothing of theirs is kept on this phone
  if (/\/(send|challenge)\.html/.test(req.referrer || "")) return;
  if (fixed(u)) return event.respondWith(keptFirst(req));
  if (here(u) && /\/remote\.html$/.test(u.pathname)) return event.respondWith(pageFirst(event, req, pageKey(u)));
  if ((here(u) && /\/remote-(icon|app)\.png$|\/remote-logo\.webp$|\/(tab|ban)-[a-z]+\.jpg$|\/remote\.webmanifest$|\/(rx-game|jsqr)\.js$/.test(u.pathname)) || u.hostname === "fonts.googleapis.com") return event.respondWith(keptThenFresh(event, req));
});

// good answers only (a broken one would stick)
const good = (res) => res && res.ok && (res.type === "basic" || res.type === "cors" || res.type === "default");
// The phone's cache can fail (storage full, a private window, a store gone bad: "UnknownError"): then everything simply
// comes from the internet as if this worker weren't here — a cache error never stops the page from opening (QA,
// 2026-10-13: the page, its logo and the friends' pages all failed while caches.open() kept rejecting).
const openCache = () => caches.open(CACHE).catch(() => null);
const keepIn = (c, key, res) => {
  if (!c || !good(res)) return;
  try {
    c.put(key, res.clone()).catch(() => {});
  } catch {}
};
const matchIn = (c, req, opts) => (c ? c.match(req, opts).catch(() => undefined) : Promise.resolve(undefined));

async function pageFirst(event, req, key) {
  try {
    const c = await openCache();
    // asked past the browser's own cache (GitHub Pages lets it keep the page 10 minutes): the server answers "not changed"
    // in a few bytes when it isn't
    // (an answer that came through a redirect — a captive portal, a moved page — can't answer a page load: asked plainly then,
    // and never kept)
    const net = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => {
      if (res.redirected) return fetch(req);
      keepIn(c, key, res);
      return res;
    });
    event.waitUntil(net.catch(() => {}));
    const kept = await matchIn(c, key);
    if (!kept) return net; // the first time (or no cache): the internet
    return Promise.race([net.then((res) => (good(res) ? res : kept)).catch(() => kept), new Promise((r) => setTimeout(() => r(kept), PAGE_WAIT))]);
  } catch {
    return fetch(req);
  }
}

async function keptFirst(req) {
  try {
    const c = await openCache();
    const kept = await matchIn(c, req);
    if (kept) return kept;
    const res = await fetch(req);
    keepIn(c, req, res);
    return res;
  } catch {
    return fetch(req);
  }
}

async function keptThenFresh(event, req) {
  try {
    const c = await openCache();
    // (a versioned script, rx-game.js?v=…: only that exact version; the rest of this site's files whatever their ?…)
    const u = new URL(req.url);
    const kept = await matchIn(c, req, { ignoreSearch: here(u) && !u.searchParams.has("v") });
    const net = fetch(req)
      .then((res) => {
        keepIn(c, req, res);
        return res;
      })
      .catch(() => kept || Response.error());
    event.waitUntil(net.catch(() => {}));
    return kept || net;
  } catch {
    return fetch(req);
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "NUKE GG", {
      body: data.body || "",
      icon: "remote-icon.png",
      // (no badge: Android paints it as a flat white shape, and the full-colour icon would be a white square)
      dir: "rtl",
      lang: "ar",
      timestamp: Date.now(),
      ...(data.tag ? { tag: data.tag, renotify: true } : {}),
      data: { tab: data.tab || null },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tab = event.notification.data?.tab || null;
  event.waitUntil(
    (async () => {
      const open = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).find((c) => c.url.includes("remote.html"));
      if (open) {
        await open.focus();
        if (tab) open.postMessage({ tab });
        return;
      }
      await self.clients.openWindow(tab ? `remote.html?tab=${tab}` : "remote.html");
    })(),
  );
});
