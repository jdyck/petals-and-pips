// Bump this version when deploying a new build so its entire shell is cached.
const CACHE_NAME = "petals-and-pips-shell-v11";
const APP_ROOT = "/";
const APP_ROUTES = [APP_ROOT, "/pass-and-play"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const assets = new Set(["/manifest.webmanifest", "/icon", "/apple-icon"]);
    const themesResponse = await fetch("/bgs/themes.json", { cache: "reload" });
    if (!themesResponse.ok) throw new Error("Unable to cache game themes.");
    await cache.put("/bgs/themes.json", themesResponse.clone());
    const themes = await themesResponse.json();
    for (const theme of themes) assets.add(theme.background);
    for (const route of APP_ROUTES) {
      const response = await fetch(route, { cache: "reload" });
      if (!response.ok) throw new Error("Unable to cache Petals & Pips.");
      await cache.put(route, response.clone());
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/g)) {
        if (match[1].startsWith("/")) assets.add(match[1].replace(/&amp;/g, "&"));
      }
    }

    // Do not activate a partial shell: it would look installed but fail offline.
    async function cacheAsset(asset) {
      const response = await fetch(asset, { cache: "reload" });
      if (!response.ok) throw new Error("Unable to cache " + asset);
      await cache.put(asset, response.clone());
      if (asset.endsWith(".css")) {
        const css = await response.text();
        const fonts = new Set();
        for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
          const url = new URL(match[1], new URL(asset, self.location.origin));
          if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) fonts.add(url.pathname);
        }
        await Promise.all([...fonts].map(cacheAsset));
      }
    }
    await Promise.all([...assets].map(cacheAsset));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => (name.startsWith("lucky-five-") || name.startsWith("petals-and-pips-")) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request)
      .then((response) => {
        if (!response.ok) throw new Error("Game is unavailable.");
        const copy = response.clone();
        if (response.ok && APP_ROUTES.includes(url.pathname)) {
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(url.pathname)) || (await cache.match(APP_ROOT)) || Response.error();
      }));
    return;
  }

  if (url.pathname === "/manifest.webmanifest" || request.destination === "script" || request.destination === "style" || request.destination === "image" || request.destination === "font") {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(cache.put(request, copy));
        }
        return response;
      });
    }));
  }
});
