import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { kitPath, liveScript } from "../../scripts/live.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const AT = process.argv.indexOf("--at");
const START = AT > 0 ? Number(process.argv[AT + 1]) : 2.6;

// A night plate in a blue-black ink.
const INKS = `<style>
.intaglio{--intaglio-ink:#141c2b;--intaglio-paper:#f0ead9;--intaglio-plate:#ebe4d1}
.intaglio[data-theme="dark"]{--intaglio-ink:#efe6c9}
</style>`;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1280, negative });
const t2 = performance.now();

const moon = negative
  ? I.ink(S.moon.lit, () => 0.8, { from: 0, to: 1, width: 0.8 })
  : I.ink(S.moon.dark, () => 0.35, { from: 0, to: 1, width: 0.8 });
const body = [
  `<path class="intaglio-ink" data-layer="sky" d="${lit.sky}"/>`,
  `<path class="intaglio-ink" d="${moon}"/>`,
  ...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: 0,
  max: 2 * Math.PI,
  wrapAround: true,
  idle: `(${START} + t * 0.45) % (2 * Math.PI)`,
  ease: 0.12,
  sceneArgs: "{ ss: 2, coarse: 1.4 }",
  ink: `{ size: 512, negative: ${negative} }`,
});

const html = pageHtml({
  title: "The Lighthouse",
  theme,
  width: 900,
  body:
    INKS +
    plateHtml({
      body: engravingSvg({
        width: WIDTH,
        height: HEIGHT,
        frame: { title: "The light on the rock" },
        label: "An engraved night scene: a lighthouse on a crag under a crescent moon, its turning beam cutting a bright wedge through the ruled sky and the cross-hatched sea",
        body,
      }),
    }),
  script: live,
});
const name = AT > 0 ? `lighthouse-at-${START}.html` : negative ? "lighthouse-dark.html" : "lighthouse.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
