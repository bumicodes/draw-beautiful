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
const START = AT > 0 ? Number(process.argv[AT + 1]) : 9.5;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1600, negative });
const t2 = performance.now();

const body = [
  ...S.layers.map((l) => `<path class="${l.cls ?? "intaglio-ink"}" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

// The water is printed in a second, green ink.
const inks = `<style>.intaglio{--intaglio-ink-2:#2f5a3f}.intaglio[data-theme="dark"]{--intaglio-ink-2:#8fc29a}</style>`;

const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: 7.5,
  max: 16.5,
  idle: `12 - 4.5 * Math.cos(t / 9 + ${Math.acos((12 - START) / 4.5).toFixed(3)})`,
  step: 0.25,
  ink: `{ size: 640, negative: ${negative} }`,
  quantize: 60,
});

const html = pageHtml({
  title: "Chand Baori",
  theme,
  width: 1000,
  body:
    inks +
    plateHtml({
      body: engravingSvg({
        width: WIDTH,
        height: HEIGHT,
        frame: { title: "Chand Baori · Abhaneri" },
        label: "An engraving of the Chand Baori stepwell seen from its south rim: thirteen storeys of zigzag steps descending on the east and west sides to green water, the pavilion of galleries and balconies on the north, the rim's shadow moving down the terraces through a day",
        body,
      }),
    }),
  script: live,
});
const name = AT > 0 ? `chandbaori-at-${START}.html` : negative ? "chandbaori-dark.html" : "chandbaori.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
