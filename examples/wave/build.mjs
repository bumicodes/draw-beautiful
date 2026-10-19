import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { kitPath, liveScript } from "../../scripts/live.mjs";
import { HEIGHT, WIDTH, inkAt, inkStatic, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const AT = process.argv.indexOf("--at");
const START = AT > 0 ? Number(process.argv[AT + 1]) : 0.45;

// Prussian blue, the pigment Hokusai's printers used for the wave.
const INKS = `<style>
.intaglio{--intaglio-ink:#1b3150;--intaglio-paper:#f0e9d6;--intaglio-plate:#ece3cc}
.intaglio[data-theme="dark"]{--intaglio-ink:#dfe3dc}
</style>`;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const still = inkStatic(S, START, { size: 1280, negative });
const lip = inkAt(S, START, { size: 1024, negative });
const t2 = performance.now();

// The sky stops short of the lip wherever it is: the lip's silhouette, widened, masks the ruling.
const body = [
  `<mask id="wave-sky" maskUnits="userSpaceOnUse" x="0" y="0" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#fff"/><path data-layer="knock" d="${lip.knock}" fill="#000" stroke="#000" stroke-width="14" stroke-linejoin="round"/></mask>`,
  `<path class="intaglio-ink" mask="url(#wave-sky)" d="${I.ink(S.sky, negative ? (s) => 1 - S.skyTone(s) : S.skyTone, { from: 0.05, to: 0.95, width: 0.85 })}"/>`,
  ...S.layers.map((l) => `<path class="intaglio-ink" d="${still[l.id]}"/>`),
  `<path class="intaglio-ground" data-layer="knock" stroke="var(--intaglio-plate)" stroke-width=".8" stroke-linejoin="round" d="${lip.knock}"/>`,
  ...["lip", "lip-c", "lip-x", "claws"].map((id) => `<path class="intaglio-ink" data-layer="${id}" d="${lip[id]}"/>`),
].join("");

const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: 0,
  max: 1,
  idle: "0.5 - 0.5 * Math.cos(t / 2.6)",
  sceneArgs: "{ ss: 2, coarse: 1.5 }",
  ink: `{ size: 512, negative: ${negative}, coarse: 1.5 }`,
  quantize: 40,
});

const html = pageHtml({
  title: "The Great Wave",
  theme,
  width: 920,
  body:
    INKS +
    plateHtml({
      body: engravingSvg({
        width: WIDTH,
        height: HEIGHT,
        frame: { title: "The great wave" },
        label: "An engraving after Hokusai: a towering breaker curls over a deep trough, its lip breaking into claws of foam, with a small snow-capped Mount Fuji on the far sea",
        body,
      }),
    }),
  script: live,
});
const name = AT > 0 ? `wave-at-${START}.html` : negative ? "wave-dark.html" : "wave.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
