// NUKE Remote: shows the notifications the PC sends (Web Push).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(self.registration.showNotification(data.title || "NUKE Mods", { body: data.body || "", icon: "remote-icon.png", badge: "remote-icon.png", dir: "rtl", lang: "ar" }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("remote.html"));
});
