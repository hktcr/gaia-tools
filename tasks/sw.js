const CACHE_NAME = "gaia-tasks-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.mjs",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./lib/codec.mjs",
  "./lib/attention.mjs",
  "./lib/crypto.mjs",
  "./lib/model.mjs",
  "./lib/revision.mjs",
  "./lib/store.mjs",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("gaia-tasks-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Offline och resursen saknas i cache");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes("/tasks/data/")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate" || SHELL.some((path) => new URL(path, self.registration.scope).href === url.href)) {
    event.respondWith(networkFirst(request));
  }
});
