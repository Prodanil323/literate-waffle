// Offline support. The page itself is network-first (so updates show on the next open) and falls
// back to the saved copy when offline; icons and the manifest come from the cache and refresh quietly.
const CACHE = "the-standard-v35";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  const isPage = req.mode === "navigate";
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = isPage ? "./index.html" : req;
    const cached = await cache.match(key, {ignoreSearch: isPage});
    // always check with the server (no-cache revalidates instead of trusting the 10-minute HTTP cache)
    const fresh = fetch(req, {cache: "no-cache"}).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    });
    if (!isPage) { fresh.catch(() => {}); return cached || fresh; }
    // the page: use the network, but don't hang for long if the signal is bad
    const slow = new Promise(r => setTimeout(r, 3500)).then(() => cached || fresh);
    return Promise.race([fresh.catch(() => cached || Response.error()), slow]);
  }));
});
