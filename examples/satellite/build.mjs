import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { liveScript } from "../../scripts/live.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const still = process.argv.includes("--still");
const hourArg = process.argv.find((a) => a.startsWith("--hour="));
const negative = theme === "dark";
const START = hourArg ? Number(hourArg.slice(7)) : 9.5;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const f = inkAt(S, START, { size: 1024, negative });
const t2 = performance.now();

// A four-pointed star as a filled path, for the dark plate where stars are ink on dark paper.
const starPath = ({ x, y, size }) => {
  if (size < 3) return `M${(x - size * 0.45).toFixed(1)} ${y.toFixed(1)}a${(size * 0.45).toFixed(2)} ${(size * 0.45).toFixed(2)} 0 1 0 ${(size * 0.9).toFixed(2)} 0a${(size * 0.45).toFixed(2)} ${(size * 0.45).toFixed(2)} 0 1 0 ${(-size * 0.9).toFixed(2)} 0Z`;
  const pts = Array.from({ length: 64 }, (_, k) => {
    const a = (k / 64) * I.TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [x + size * Math.sign(c) * c * c * c * c, y + size * Math.sign(s) * s * s * s * s];
  });
  return `M${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("L")}Z`;
};

const space = negative
  ? `<path class="intaglio-ink" d="${S.stars.map(starPath).join("")}"/>`
  : [
      `<mask id="sat-sky" maskUnits="userSpaceOnUse" x="0" y="0" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#fff"/><path data-layer="knock" d="${f.knock}" fill="#000" stroke="#000" stroke-width="12" stroke-linejoin="round"/></mask>`,
      `<path class="intaglio-ink" mask="url(#sat-sky)" d="${I.ink(S.sky, S.skyTone, { from: 0.05, to: 0.9, width: 1.3 })}"/>`,
    ].join("");

const body = [
  space,
  ...S.earthLayers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${f[l.id]}"/>`),
  `<path class="intaglio-ground" data-layer="knock" style="stroke:var(--intaglio-plate);stroke-width:5;stroke-linejoin:round" d="${f.knock}"/>`,
  `<path class="intaglio-ink" data-layer="sat" d="${f.sat}"/>`,
].join("");

const html = pageHtml({
  title: "Geostationary Satellite",
  theme,
  width: 1100,
  body: plateHtml({
    body: engravingSvg({
      width: WIDTH,
      height: HEIGHT,
      frame: { title: "The geostationary satellite" },
      label: "An engraved communications satellite above the Earth's limb: a foil-wrapped bus with two reflectors and their feeds, and two solar wings that turn through the day to face the sun",
      body,
    }),
  }),
  script: still
    ? ""
    : liveScript({
        kit: join(HERE, "../../kit/intaglio.mjs"),
        scene: join(HERE, "scene.mjs"),
        start: START,
        min: 0,
        max: 24,
        wrapAround: true,
        idle: `(${START} + t / 2.5) % 24`,
        sceneArgs: "{ ss: 2 }",
        ink: `{ size: 560, negative: ${negative} }`,
        quantize: 96,
      }),
});
const name = negative ? "satellite-dark.html" : "satellite.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, frame ${(t2 - t1).toFixed(0)} ms`);
