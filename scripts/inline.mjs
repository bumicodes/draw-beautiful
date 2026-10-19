import { readFileSync } from "node:fs";

/**
 * Wrap an ES module as `const <name> = (() => { ... })()` so a standalone page can inline it.
 * Import lines are dropped, so every module that imports it must use the same alias (`import * as I from ".../intaglio.mjs"`).
 */
export const wrap = (path, name) => {
  const source = readFileSync(path, "utf8").replace(/^import .*$/gm, "");
  const names = [...source.matchAll(/^export (?:const|function|let) (\w+)/gm)].map((m) => m[1]);
  return `const ${name} = (() => {\n${source.replace(/^export /gm, "")}\nreturn { ${names.join(", ")} };\n})();\n`;
};
