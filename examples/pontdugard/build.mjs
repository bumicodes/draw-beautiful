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
// The light plate opens just after noon, the faces turned to shade over bright arches in the water; the negative
// opens in the morning, when the lit faces carry its pale lines.
const START = AT > 0 ? Number(process.argv[AT + 1]) : negative ? 9.5 : 13;
const MIN = 6.5;
const MAX = 18.5;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1800, negative });
const t2 = performance.now();

const body = [
  `<path class="intaglio-ink" d="${I.ink(S.sky, S.skyTone, { from: 0.05, to: 0.9, width: 0.9 })}"/>`,
  ...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

// The tour swings the sun from the morning light on the faces to the afternoon, when the shadow lies on the water.
const mid = (MIN + MAX) / 2;
const amp = (MAX - MIN) / 2 - 0.5;
const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: MIN,
  max: MAX,
  idle: `${mid} - ${amp} * Math.cos(t / 9 + ${Math.acos((mid - START) / amp).toFixed(3)})`,
  step: 0.25,
  ink: `{ size: 640, negative: ${negative} }`,
  quantize: 48,
});

const html = pageHtml({
  title: "Pont du Gard",
  theme,
  width: 1080,
  body: plateHtml({
    body: engravingSvg({
      width: WIDTH,
      height: HEIGHT,
      frame: { title: "Le Pont du Gard" },
      label: "An engraved Pont du Gard seen from downstream: the Roman aqueduct's three tiers of arches receding over the Gardon, its rocky banks and holm oaks, the arches mirrored in the water, with shadows moving through a summer day",
      body,
    }),
  }),
  script: live,
});
const name = AT > 0 ? `pontdugard-at-${START}${negative ? "-dark" : ""}.html` : negative ? "pontdugard-dark.html" : "pontdugard.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
