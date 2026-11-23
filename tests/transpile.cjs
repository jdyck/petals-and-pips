const { transformSync } = require("esbuild");

// The tests execute modules in isolated VM contexts with mocked imports.
function transpile(source) {
  const { code } = transformSync(source, { loader: "tsx", format: "cjs", jsx: "automatic" });
  return `const module = { exports };\n${code}\nObject.assign(exports, module.exports);`;
}

module.exports = { transpile };
