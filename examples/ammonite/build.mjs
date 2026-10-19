import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { kitPath, liveScript } from "../../scripts/live.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const AT = process.argv.indexOf("--at");
const START = AT > 0 ? Number(process.argv[AT + 1]) : 0.15;

// A warm sepia, the colour of a geological plate.
const INKS = `<style>
.intaglio{--intaglio-ink:#2b2118;--intaglio-paper:#f2ead6;--intaglio-plate:#ede3cc}
.intaglio[data-theme="dark"]{--intaglio-ink:#eadcc0}
</style>`;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1600, negative });
const t2 = performance.now();

const body = [
  ...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: 0,
  max: 1,
  idle: "0.5 - 0.5 * Math.cos(t / 3.6 + 1.1)",
  sceneArgs: "{ ss: 2, coarse: 2 }",
  ink: `{ size: 700, negative: ${negative} }`,
});

const html = pageHtml({
  title: "The Ammonite",
  theme,
  width: 900,
  body: INKS + plateHtml({ body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: "Dactylioceras commune" }, label: "An engraved ammonite fossil standing proud of a block of limestone, its ribbed whorls throwing shadows under a low raking light", body }) }),
  script: live,
});
const name = AT > 0 ? `ammonite-at-${START}.html` : negative ? "ammonite-dark.html" : "ammonite.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
