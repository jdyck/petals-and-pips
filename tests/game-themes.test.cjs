const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const themes = require("../public/bgs/themes.json");
const context = { exports: {}, require: () => themes, Math: Object.create(Math) };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/lib/game-themes.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, context);
const { randomGameTheme, gameThemeStyle } = context.exports;

test("every supplied floral background has a theme and an optimized image", () => {
  const originals = fs.readdirSync(path.join(__dirname, "../public/bgs")).filter((file) => /^\d\d-.*\.png$/.test(file));
  assert.equal(themes.length, 30);
  assert.equal(new Set(themes.map((theme) => theme.id)).size, originals.length);
  for (const original of originals) {
    const theme = themes.find((theme) => theme.id === original.slice(0, -4));
    assert.ok(theme, original);
    assert.ok(fs.existsSync(path.join(__dirname, "../public", theme.background)));
  }
});

test("random selection reaches every theme and never repeats the current game", () => {
  for (let index = 0; index < themes.length; index++) {
    context.Math.random = () => (index + 0.5) / themes.length;
    assert.equal(randomGameTheme().id, themes[index].id);
  }
  for (const previous of themes) {
    const selected = new Set();
    for (let index = 0; index < themes.length - 1; index++) {
      context.Math.random = () => (index + 0.5) / (themes.length - 1);
      const next = randomGameTheme(previous.id);
      assert.notEqual(next.id, previous.id);
      selected.add(next.id);
    }
    assert.equal(selected.size, themes.length - 1);
  }
});

function luminance(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(a, b) {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

test("each palette keeps small text and button labels readable", () => {
  for (const theme of themes) {
    const style = gameThemeStyle(theme);
    for (const foreground of ["--ink", "--ink-soft", "--muted"]) {
      for (const background of ["#ffffff", style["--surface"], style["--suggestion-surface"], style["--surface-hover"]]) {
        assert.ok(contrast(style[foreground], background) >= 4.5, `${theme.id}: ${foreground} on ${background}`);
      }
    }
    for (const button of ["--accent", "--accent-hover", "--accent-disabled"]) {
      assert.ok(contrast("#ffffff", style[button]) >= 4.5, `${theme.id}: ${button} label`);
    }
  }
});
