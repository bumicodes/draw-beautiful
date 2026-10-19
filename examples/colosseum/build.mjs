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
const START = AT > 0 ? Number(process.argv[AT + 1]) : 16.8;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1600, negative });
const t2 = performance.now();

const body = [
  `<path class="intaglio-ink" d="${I.ink(S.sky, S.skyTone, { from: 0.05, to: 0.9, width: 0.9 })}"/>`,
  ...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: 7.5,
  max: 17.5,
  idle: `12.5 - 5 * Math.cos(t / 8 + ${Math.acos((12.5 - START) / 5).toFixed(3)})`,
  step: 0.25,
  ink: `{ size: 720, negative: ${negative} }`,
  quantize: 80,
});

const title = "Amphitheatrum Flavium";
const html = pageHtml({
  title: "The Colosseum",
  theme,
  width: 1000,
  body: plateHtml({ body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title }, label: "An engraved Colosseum seen from the west and above: the four storeys of the north wall, the broken rings to the south, the cavea and the walls of the hypogeum, with shadows moving through a day in April", body }) }),
  script: live,
});
const name = AT > 0 ? `colosseum-at-${START}.html` : negative ? "colosseum-dark.html" : "colosseum.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
