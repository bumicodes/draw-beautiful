import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { liveScript } from "../../scripts/live.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const still = process.argv.includes("--still");
const negative = theme === "dark";
const START = 16;

// Deep indigo on warm ivory; the dark plate prints pale blue-white on midnight paper.
const INKS = `<style>
.intaglio{--intaglio-ink:#1f2b63;--intaglio-paper:#f5eedb;--intaglio-plate:#f1e8d0;--intaglio-mark:#d9cdae}
.intaglio[data-theme="dark"]{--intaglio-ink:#d3dcf5;--intaglio-paper:#121524;--intaglio-plate:#151929;--intaglio-mark:#262b40}
</style>`;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const short = (d) => d.replace(/(\.\d)\d+/g, "$1");
const lit = Object.fromEntries(Object.entries(inkAt(S, START, { size: 1400, negative })).map(([k, d]) => [k, short(d)]));
const t2 = performance.now();

const body = [...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`), `<path class="intaglio-ink" d="${S.marks}"/>`].join("");

const html = pageHtml({
  title: "Mountain Lake",
  theme,
  width: 1180,
  body:
    INKS +
    plateHtml({
      body: engravingSvg({
        width: WIDTH,
        height: HEIGHT,
        label: "A panoramic engraving of a still mountain lake: a granite outcrop with two pines in the foreground, forested shores, snowy peaks and a far range fading into the sky, all mirrored in the water",
        body,
        frame: {},
      }),
    }),
  script: still
    ? ""
    : liveScript({
        kit: join(HERE, "../../kit/intaglio.mjs"),
        scene: join(HERE, "scene.mjs"),
        start: START,
        min: 13,
        max: 18.5,
        idle: `16 - 2.5 * Math.cos(t / 9)`,
        sceneArgs: "{ ss: 2 }",
        ink: `{ size: 640, negative: ${negative} }`,
        quantize: 22,
      }),
});
const name = negative ? "lake-dark.html" : "lake.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms, ${S.stats.cards} pines`);
for (const l of S.layers) console.log(l.id.padEnd(12), (lit[l.id].length / 1024).toFixed(0), "KB");
