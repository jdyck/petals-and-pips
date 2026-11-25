const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");
const { transpile } = require("./transpile.cjs");
const context = { exports: {}, URL };
vm.runInNewContext(transpile(fs.readFileSync("app/lib/development-service-worker.ts", "utf8")), context);
const { removeDevelopmentServiceWorker } = context.exports;

test("development removes only the game worker and reloads a controlled page", async () => {
  let removed = 0, otherRemoved = 0, reloads = 0;
  const scriptURL = "http://localhost:3000/sw.js";
  const serviceWorker = { controller: { scriptURL }, getRegistrations: async () => [
    { active: { scriptURL }, unregister: async () => { removed++; return true; } },
    { active: { scriptURL: "http://localhost:3000/other/sw.js" }, unregister: async () => { otherRemoved++; return true; } },
  ] };
  await removeDevelopmentServiceWorker(serviceWorker, "http://localhost:3000", () => reloads++);
  assert.equal(removed, 1); assert.equal(otherRemoved, 0); assert.equal(reloads, 1);
});

test("development does not reload an uncontrolled page", async () => {
  let reloads = 0;
  await removeDevelopmentServiceWorker({ controller: null, getRegistrations: async () => [] }, "http://localhost:3000", () => reloads++);
  assert.equal(reloads, 0);
});
