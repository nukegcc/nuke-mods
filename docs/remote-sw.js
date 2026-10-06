// NUKE Remote: shows the notifications the PC sends (Web Push).
//  • short title + one line; a newer one of the same kind replaces the older (`tag`), so they don't pile up
//  • tapping one opens the page on its tab (e.g. «الحالة» for "the RAM is full")
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
      badge: "remote-icon.png",
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
