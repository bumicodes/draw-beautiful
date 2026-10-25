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
const START = AT > 0 ? Number(process.argv[AT + 1]) : 17.05;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 2048, negative });
const t2 = performance.now();

const body = [
  `<path class="intaglio-ink" d="${I.ink(S.sky, S.skyTone, { from: 0.05, to: 0.9, width: 0.9 })}"/>`,
  ...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

// The afternoon from 13:00 to sunset. The tour lingers in the late afternoon, when the serpent comes down the stair.
const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: 13,
  max: 17.95,
  idle: `15.65 + 1.75 * Math.sin(t / 6 + ${Math.asin((START - 15.65) / 1.75).toFixed(3)})`,
  step: 0.1,
  ink: `{ size: 1024, negative: ${negative} }`,
});

const title = "Kukulcán · Chichén Itzá";
const html = pageHtml({
  title: "El Castillo",
  theme,
  width: 1000,
  body: plateHtml({ body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title }, label: "An engraving of El Castillo, the Temple of Kukulcán at Chichén Itzá, seen from the north-west on the spring equinox: the nine terraces, the north stair with its serpent heads, and in the late afternoon the triangles of light that make the body of the serpent on the stair's west balustrade", body }) }),
  script: live,
});
const name = AT > 0 ? `kukulcan-at-${START}.html` : negative ? "kukulcan-dark.html" : "kukulcan.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
