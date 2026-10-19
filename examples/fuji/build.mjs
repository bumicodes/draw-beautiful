import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { ARCH, HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const START = 8.5;

// One ink, the grey-green of a bank-note back, on a faintly green paper.
const INKS = `<style>
.intaglio{--intaglio-ink:#2f4438;--intaglio-paper:#ebe8d3;--intaglio-plate:#e6e3cc}
.intaglio[data-theme="dark"]{--intaglio-ink:#cfdccb}
</style>`;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1280, negative });
const t2 = performance.now();

// The arch: a fine rule round the sky, which springs from the far shore; the land below runs the full width.
const { cx, cy, rx, ry } = ARCH;
const archD = `M${cx - rx} ${cy}A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;
const body = [
  `<clipPath id="fuji-arch"><path d="${archD}V${HEIGHT}H${cx - rx}Z"/></clipPath>`,
  `<g clip-path="url(#fuji-arch)">`,
  `<path class="intaglio-ink" d="${I.ink(S.sky, S.skyTone, { from: 0.08, to: 0.95, width: 0.7 })}"/>`,
  ...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
  `</g>`,
  `<path class="intaglio-rule" stroke-width=".7" d="${archD}"/>`,
].join("");

// The engraving is hatched and re-inked in a worker, so the page never stalls: it only swaps path data.
// The far plate (cone, hills, lake) and the near one (village, tree, bank) re-ink on alternate frames.
const worker = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "scene.mjs"), "D")}
const S = D.scene({ ss: 2 });
postMessage({ ready: true });
onmessage = ({ data: { h, only } }) => postMessage({ h, only, ink: D.inkAt(S, h, { size: 512, negative: ${negative}, only }) });
`;

const live = `
const svg = document.querySelector(".intaglio-svg");
const paths = Object.fromEntries([...svg.querySelectorAll("[data-layer]")].map((p) => [p.dataset.layer, p]));
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const engraver = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: "text/javascript" })));
let ready = false;
let busy = false;
let shown = ${START};
let target = ${START};
let drawn = { far: ${START}, near: ${START} };
let group = "far";
let touched = 0;
let visible = true;
let frame = 0;
const behind = () => Math.max(Math.abs(shown - drawn.far), Math.abs(shown - drawn.near));
engraver.onmessage = ({ data }) => {
  if (data.ready) ready = true;
  else {
    for (const id in data.ink) paths[id].setAttribute("d", data.ink[id]);
    drawn[data.only] = data.h;
    busy = false;
  }
  wake();
};
const tick = (now) => {
  frame = 0;
  if (!visible) return;
  if (!still && now - touched > 4000) target = 12 - 3.5 * Math.cos(now / 1000 / 6);
  shown += (target - shown) * 0.08;
  if (ready && !busy && behind() > 0.03) {
    busy = true;
    engraver.postMessage({ h: shown, only: group });
    group = group === "far" ? "near" : "far";
  }
  if (!still || Math.abs(target - shown) > 0.03 || behind() > 0.03) frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const set = (h) => { target = Math.min(17, Math.max(7, h)); touched = performance.now(); wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  set(7 + ((e.clientX - r.left) / r.width) * 10);
});
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") set(target + 0.25);
  else if (e.key === "ArrowLeft") set(target - 0.25);
  else return;
  e.preventDefault();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
`;

const html = pageHtml({
  title: "Mount Fuji in Spring",
  theme,
  width: 900,
  body:
    INKS +
    plateHtml({
      body: engravingSvg({
        width: WIDTH,
        height: HEIGHT,
        label: "An engraving of snow-capped Mount Fuji above a lakeside village with a pagoda, reflected in the lake and framed by cherry blossoms",
        body,
      }),
    }),
  script: live,
});
const name = negative ? "fuji-dark.html" : "fuji.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
