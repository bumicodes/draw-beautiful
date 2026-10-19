import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { kitPath, liveScript } from "../../scripts/live.mjs";
import { HEIGHT, PHOTO, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
// --overlay lays the photograph under the engraving at half strength, to check the model against it.
const overlay = process.argv.includes("--overlay");
const START = Number(process.argv.find((a) => a.startsWith("--at="))?.slice(5) ?? 16);

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1400, negative });
const t2 = performance.now();

const photo = overlay
  ? `<image href="data:image/png;base64,${readFileSync(join(HERE, "reference.png")).toString("base64")}" x="${PHOTO.x}" y="${PHOTO.y}" width="${PHOTO.width * PHOTO.scale}" height="${PHOTO.height * PHOTO.scale}" opacity="0.5"/>`
  : "";
const body = [
  photo,
  `<path class="intaglio-ink" d="${I.ink(S.sky, S.skyTone, { from: 0.05, to: 0.9, width: 0.9 })}"/>`,
  `<path class="intaglio-ink" d="${I.ink(S.road, S.roadTone, { from: 0.12, to: 0.9, width: 0.9 })}"/>`,
  ...Object.keys(lit).map((id) => `<path class="intaglio-ink" data-layer="${id}" d="${lit[id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

// A worker engraves the day in 12½-minute steps and keeps every frame, so after the first pass the tour replays from memory.
const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: 7.5,
  max: 17.5,
  idle: `12.5 - 5 * Math.cos(t / 8 + ${Math.acos((12.5 - START) / 5).toFixed(3)})`,
  step: 0.25,
  ink: `{ size: 640, negative: ${negative} }`,
  quantize: 48,
});

const title = "Madras Central";
const html = pageHtml({
  title,
  theme,
  body: plateHtml({
    body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title }, label: "An engraved Madras Central station: the arcaded wings, the clock tower and three pavilions, the shadows moving with the sun and the clocks keeping the hour", body }),
  }),
  script: overlay ? "" : live,
});
const name = `madras${negative ? "-dark" : ""}${overlay ? "-overlay" : ""}.html`;
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
