// NUKE Remote's service worker.
//  1. Opens fast: what the page needs is kept on the phone.
//     • the page: from the internet when it answers quickly (so a new version arrives the first time), else the
//       copy kept here (slow or no internet) — and the new one is kept for next time
//     • the Supabase library, jsQR and the font files: fixed versions that never change → straight from here
//     • the icon, the manifest and the font list: from here, refreshed behind
//     Only remote.html and its own files: the other pages next to it (admin.html…) are never touched.
//     A new caching way = a new CACHE name; the old ones are deleted when it starts.
//  2. Shows the notifications the PC sends (Web Push):
//     • short title + one line; a newer one of the same kind replaces the older (`tag`), so they don't pile up
//     • tapping one opens the page on its tab (e.g. «الحالة» for "the RAM is full")
const CACHE = "nk-remote-v1";
const PAGE_WAIT = 1500; // ms the internet gets before the kept page is shown

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["remote.html", "remote-icon.png", "remote-app.png", "remote.webmanifest"]))
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let u;
  try {
    u = new URL(req.url);
  } catch {
    return;
  }
  if (fixed(u)) return event.respondWith(keptFirst(req));
  if (here(u) && /\/remote\.html$/.test(u.pathname)) return event.respondWith(pageFirst(event, req, pageKey(u)));
  if ((here(u) && /\/remote-(icon|app)\.png$|\/remote\.webmanifest$/.test(u.pathname)) || u.hostname === "fonts.googleapis.com") return event.respondWith(keptThenFresh(event, req));
});

// good answers only (a broken one would stick)
const good = (res) => res && res.ok && (res.type === "basic" || res.type === "cors" || res.type === "default");

async function pageFirst(event, req, key) {
  const c = await caches.open(CACHE);
  const net = fetch(req).then((res) => {
    if (good(res)) c.put(key, res.clone()).catch(() => {});
    return res;
  });
  event.waitUntil(net.catch(() => {}));
  const kept = await c.match(key);
  if (!kept) return net; // the first time: the internet
  return Promise.race([net.then((res) => (good(res) ? res : kept)).catch(() => kept), new Promise((r) => setTimeout(() => r(kept), PAGE_WAIT))]);
}

async function keptFirst(req) {
  const c = await caches.open(CACHE);
  const kept = await c.match(req);
  if (kept) return kept;
  const res = await fetch(req);
  if (good(res)) c.put(req, res.clone()).catch(() => {});
  return res;
}

async function keptThenFresh(event, req) {
  const c = await caches.open(CACHE);
  const kept = await c.match(req, { ignoreSearch: here(new URL(req.url)) });
  const net = fetch(req)
    .then((res) => {
      if (good(res)) c.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => kept || Response.error());
  event.waitUntil(net.catch(() => {}));
  return kept || net;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "NUKE Mods", {
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
