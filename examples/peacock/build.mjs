import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { kitPath, liveScript } from "../../scripts/live.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const START = -38;

// A bank-note palette on warm ivory: navy for the key lines, royal blue, teal, green, olive and orange. The dark plate
// prints pale tints of the same inks on navy paper.
const INKS = `<style>
.intaglio{--intaglio-ink:#15264d;--intaglio-paper:#f7f1e1;--intaglio-plate:#f3ead4;--intaglio-mark:#d9cdb0;--ink-blue:#2452a6;--ink-teal:#0f8193;--ink-green:#1e8a5e;--ink-olive:#7a8526;--ink-orange:#d1672a}
.intaglio[data-theme="dark"]{--intaglio-ink:#efe3c4;--intaglio-page:#070b16;--intaglio-paper:#0f1830;--intaglio-plate:#121c36;--intaglio-mark:#1f2b4b;--ink-blue:#93b5ff;--ink-teal:#7fd5e0;--ink-green:#86dcae;--ink-olive:#cfd681;--ink-orange:#f4a873}
.ink-blue{fill:var(--ink-blue)}.ink-teal{fill:var(--ink-teal)}.ink-green{fill:var(--ink-green)}.ink-olive{fill:var(--ink-olive)}.ink-orange{fill:var(--ink-orange)}
</style>`;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1600, negative });
const t2 = performance.now();

const body = [
  ...S.layers.map((l) => `<path class="${l.cls}" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  ...Object.entries(S.marks).map(([cls, d]) => `<path class="${cls}" d="${d}"/>`),
].join("");

const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: -70,
  max: 70,
  idle: `${START} + 45 * Math.sin(t / 5)`,
  ink: `{ size: 512, negative: ${negative} }`,
});

const html = pageHtml({
  title: "Peacock",
  theme,
  width: 980,
  body: INKS + plateHtml({ body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: {}, label: "An engraved Indian peacock in display facing the viewer, its eyed train fanned behind it, engraved in several inks", body }) }),
  script: process.argv.includes("--still") ? "" : live,
});
const name = negative ? "peacock-dark.html" : "peacock.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
