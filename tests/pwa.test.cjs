const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const origin = "https://game.example";
const source = fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8");
const themes = require("../public/bgs/themes.json");

function worker({ failAsset, offline = false } = {}) {
  const listeners = {};
  const stores = new Map();
  const fetched = [];
  let skipped = false;
  const key = (request) => new URL(typeof request === "string" ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async put(request, response) { store.set(key(request), response.clone()); },
        async match(request) { return store.get(key(request))?.clone(); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    location: { origin },
    addEventListener(name, listener) { listeners[name] = listener; },
    async skipWaiting() { skipped = true; },
    clients: { async claim() {} },
  };
  async function fetch(request) {
    if (offline) throw new TypeError("Offline");
    const pathname = new URL(key(request)).pathname;
    fetched.push(pathname);
    if (pathname === failAsset) return new Response("Missing", { status: 404 });
    if (pathname === "/bgs/themes.json") return Response.json(themes);
    if (pathname === "/" || pathname === "/pass-and-play") {
      return new Response(`<link href="/_next/static/chunks/game.css" rel="stylesheet"><script src="/_next/static/chunks/game.js"></script><main>${pathname}</main>`);
    }
    if (pathname.endsWith(".css")) return new Response("@font-face { src: url('../media/game.woff2') format('woff2'); }");
    return new Response("asset");
  }
  vm.runInNewContext(source, { self, caches, fetch, URL, Response });
  return {
    caches, fetched, stores,
    get skipped() { return skipped; },
    setOffline(value) { offline = value; },
    async dispatch(name, request) {
      const pending = [];
      let response;
      listeners[name]({ request, waitUntil(promise) { pending.push(promise); }, respondWith(promise) { response = promise; } });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
  };
}

test("offline setup includes both games, JavaScript, CSS, fonts and Home Screen assets", async () => {
  const app = worker();
  await app.dispatch("install");
  assert.equal(app.skipped, true);
  for (const asset of ["/", "/pass-and-play", "/_next/static/chunks/game.js", "/_next/static/chunks/game.css", "/_next/static/media/game.woff2", "/manifest.webmanifest", "/favicon.ico", "/icon.svg", "/icons/pips-and-petals-192.png", "/icons/pips-and-petals-512.png", "/apple-icon.png"]) {
    assert.ok(app.fetched.includes(asset), `Missing precached asset ${asset}`);
  }
});

test("a missing script, font or theme prevents activation of an incomplete offline app", async () => {
  for (const failAsset of ["/_next/static/chunks/game.js", "/_next/static/media/game.woff2", "/bgs/themes.json", themes[0].background]) {
    const app = worker({ failAsset });
    await assert.rejects(app.dispatch("install"), /Unable to cache/);
    assert.equal(app.skipped, false);
  }
});

test("every randomly selected background is available for a new game offline", async () => {
  const app = worker();
  await app.dispatch("install");
  app.setOffline(true);
  for (const theme of themes) {
    assert.ok(app.fetched.includes(theme.background), `Missing precached background ${theme.background}`);
    const response = await app.dispatch("fetch", { url: origin + theme.background, method: "GET", destination: "image" });
    assert.equal(await response.text(), "asset");
  }
});

test("both launch routes and their assets work offline, including URL query strings", async () => {
  const app = worker();
  await app.dispatch("install");
  await app.dispatch("activate");
  app.setOffline(true);
  for (const route of ["/", "/pass-and-play"]) {
    const response = await app.dispatch("fetch", { url: origin + route + "?source=home-screen", method: "GET", mode: "navigate" });
    assert.match(await response.text(), new RegExp(`<main>${route}</main>`));
  }
  const response = await app.dispatch("fetch", { url: origin + "/_next/static/chunks/game.js", method: "GET", destination: "script" });
  assert.equal(await response.text(), "asset");
});

test("activation removes old game caches and preserves unrelated caches", async () => {
  const app = worker();
  await app.caches.open("petals-and-pips-shell-v11");
  await app.caches.open("pips-and-petals-shell-v1");
  await app.caches.open("lucky-five-shell-v1");
  await app.caches.open("another-app");
  await app.dispatch("install");
  await app.dispatch("activate");
  const names = await app.caches.keys();
  assert.ok(names.includes("another-app"));
  assert.equal(names.filter((name) => name.startsWith("pips-and-petals-")).length, 1);
  assert.ok(!names.includes("petals-and-pips-shell-v11"));
  assert.ok(!names.includes("pips-and-petals-shell-v1"));
  assert.ok(!names.includes("lucky-five-shell-v1"));
});
