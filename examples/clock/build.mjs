import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { kitPath, liveScript } from "../../scripts/live.mjs";
import { HEIGHT, WIDTH, inkAt, inkStatic, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const AT = process.argv.indexOf("--at");
const START = AT > 0 ? Number(process.argv[AT + 1]) : 0.18;

// The dial in a deep blue-black, the brass in a gilt brown.
const INKS = `<style>
.intaglio{--intaglio-ink:#16233b;--intaglio-ink-2:#8a5a1c;--intaglio-paper:#f1ebd9;--intaglio-plate:#ece4cf}
.intaglio[data-theme="dark"]{--intaglio-ink:#e7dfc8;--intaglio-ink-2:#d9a95a}
</style>`;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const still = inkStatic(S, { negative });
const f = inkAt(S, START, { negative });
const t2 = performance.now();

const P = (cls, d, layer) => `<path class="intaglio-${cls}"${layer ? ` data-layer="${layer}"` : ""} d="${d}"/>`;
const knock = (id) => `<path class="intaglio-ground" fill-rule="evenodd" stroke="var(--intaglio-plate)" stroke-width="1.2" stroke-linejoin="round" data-layer="${id}" d="${f[id]}"/>`;
const body = [
  P("ink-2", still.ground),
  P("ink-2", still.rose),
  P("ink", still.dial),
  P("ink", still["dial-x"]),
  P("ink", S.marks),
  ...S.layers.map((l) => P(l.cls, still[l.id])),
  knock("rete-knock"),
  P("ink-2", f.rete, "rete"),
  P("ink-2", f["rete-x"], "rete-x"),
  P("ink-2", f["rete-marks"], "rete-marks"),
  knock("moon-knock"),
  P("ink", f.moon, "moon"),
  knock("moon-knock2"),
  P("ink", f["moon-ball"], "moon-ball"),
  P("ink", f["moon-ball-x"], "moon-ball-x"),
  knock("sun-knock"),
  P("ink-2", f.sun, "sun"),
  knock("sun-knock2"),
  P("ink-2", f["sun-disc"], "sun-disc"),
  P("ink-2", f["sun-rays"], "sun-rays"),
  `<circle class="intaglio-ground" cx="${WIDTH / 2}" cy="${HEIGHT / 2}" r="10.5"/>`,
  P("ink-2", still.boss),
].join("");

// One day of the sky in a minute; the pointer scrubs a day either side.
const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: START - 1,
  max: START + 1,
  idle: `${START} + ((t / 60) % 2) - 0`,
  step: 1 / 48,
  eps: 0.0004,
  ease: 0.1,
  sceneArgs: "{ ss: 2 }",
  ink: `{ negative: ${negative} }`,
});

const html = pageHtml({
  title: "The Astronomical Clock",
  theme,
  width: 780,
  body: INKS + plateHtml({ body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: "Horologium astronomicum" }, label: "An engraved astronomical clock face: a turned bezel, a ring of Roman hours, the dial light above the horizon and dark below, the turning zodiac ring and star map, and gilt sun and moon hands", body }) }),
  script: live,
});
const name = AT > 0 ? `clock-at-${START}.html` : negative ? "clock-dark.html" : "clock.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
