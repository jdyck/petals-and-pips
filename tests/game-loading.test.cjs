const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function loader(decode) {
  const images = [];
  const context = {
    exports: {},
    Image: class {
      constructor() { images.push(this); }
      decode() { return decode(this); }
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/lib/game-loading.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return { load: context.exports.loadGameBackground, images };
}

test("background preparation waits for image decoding, not just the download", async () => {
  let finishDecode;
  const { load, images } = loader(() => new Promise((resolve) => { finishDecode = resolve; }));
  let ready = false;
  const loading = load("/bgs/flower.webp").then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(images[0].src, "/bgs/flower.webp");
  assert.equal(images[0].decoding, "async");
  assert.equal(ready, false);
  finishDecode();
  await loading;
  assert.equal(ready, true);
});

test("missing or corrupt backgrounds reject so the loading screen can offer retry", async () => {
  const error = new Error("Image decoding failed");
  const { load } = loader(() => Promise.reject(error));
  await assert.rejects(load("/bgs/missing.webp"), error);
});

test("cached backgrounds can finish immediately without an artificial delay", async () => {
  const { load } = loader(() => Promise.resolve());
  await load("/bgs/cached.webp");
});
