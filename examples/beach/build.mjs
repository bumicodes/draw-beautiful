import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { HEIGHT, WIDTH, inkStatic, inkTide, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const START = 0.5;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const still = inkStatic(S, { negative });
const wet = inkTide(S, START, { negative });
const t2 = performance.now();

const cls = Object.fromEntries(S.layers.map((l) => [l.id, l.cls]));
const order = ["sky", "disc", "birds", "sun", "sea", "wave", "wave-fine", "wet", "swash", "foam", "sand", "sand-x", ...S.layers.map((l) => l.id).filter((id) => !/^(wet|swash|sand|sand-x)$/.test(id)), "marks"];
still.sun = I.ink({ lines: [[Array.from({ length: 121 }, (_, i) => ({ x: S.sun[0] + 10 * Math.cos((i / 120) * 2 * Math.PI), y: S.sun[1] + 10 * Math.sin((i / 120) * 2 * Math.PI), sp: 3 }))]] }, () => (negative ? 0.5 : 0.7), { from: 0, to: 1, width: 0.7 });
const body = order
  .map((id) => {
    const d = still[id] ?? wet[id];
    const c = /^(sky|disc|sun|sea|wave|wave-fine|foam)$/.test(id) ? "intaglio-ink-2" : cls[id] ?? "intaglio-ink";
    return `<path class="${c}"${id in wet ? ` data-layer="${id}"` : ""} d="${d}"/>`;
  })
  .join("");

// Sepia for the sand and shells, teal for the water.
const inks = `<style>.intaglio{--intaglio-ink:#3b2b1d;--intaglio-ink-2:#13716d}.intaglio[data-theme="dark"]{--intaglio-ink:#e9d8b6;--intaglio-ink-2:#6fcabf}</style>`;

const live = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "scene.mjs"), "D")}
const svg = document.querySelector(".intaglio-svg");
const paths = Object.fromEntries([...svg.querySelectorAll("[data-layer]")].map((p) => [p.dataset.layer, p]));
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PERIOD = 10000;
let S = null;
let phase = ${START};
let visible = true;
let frame = 0;
let last = 0;
const tick = (now) => {
  frame = 0;
  if (!visible || !S) return;
  phase = (phase + (last ? Math.min(64, now - last) : 16) / PERIOD) % 1;
  last = now;
  const ink = D.inkTide(S, phase, { negative: ${negative} });
  for (const id in ink) paths[id].setAttribute("d", ink[id]);
  frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame && !still) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
if (!still) setTimeout(() => { S = D.scene({ ss: 2, live: true }); wake(); }, 50);
`;

const html = pageHtml({
  title: "The Tideline",
  theme,
  width: 880,
  body:
    inks +
    plateHtml({
      body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: "The tideline" }, label: "An engraved beach: shells on rippled sand, and wave after wave rolling in from a teal sea, breaking and running up the wet sand under a low sun", body }),
    }),
  script: live,
});
const name = negative ? "beach-dark.html" : "beach.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
