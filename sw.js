// Service worker minimal : coquille de l'app en cache pour l'installation et un démarrage rapide.
// Les données (Supabase) ne sont jamais mises en cache ici : elles viennent toujours de la base.
// Chemins relatifs : l'app peut être servie sous un sous-chemin (GitHub Pages).
const CACHE = "aplomb-v2";
const SHELL = ["./", "manifest.webmanifest", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Supabase est sur une autre origine : jamais mis en cache.
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    // Réseau d'abord pour la page, cache si hors ligne.
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put("./", copy));
      return r;
    }).catch(() => caches.match("./")));
    return;
  }
  if (url.pathname.includes("/assets/") || url.pathname.includes("/icons/")) {
    // Fichiers versionnés : cache d'abord.
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    })));
  }
});

// Notifications envoyées par la tâche horaire (Web Push). url : route de l'app (#/o/12).
self.addEventListener("push", (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { title: "Aplomb", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(p.title || "Aplomb", {
    body: p.body || "",
    tag: p.tag,
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    data: { url: new URL(p.url || "#/", self.registration.scope).href },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data && e.notification.data.url;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.registration.scope));
    if (open) return open.navigate(url).then((c) => (c || open).focus());
    return self.clients.openWindow(url);
  }));
});
