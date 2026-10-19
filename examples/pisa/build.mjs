import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const START = 13;


const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1400, negative });
const t2 = performance.now();

const body = [
  `<path class="intaglio-ink" d="${I.ink(S.sky, S.skyTone, { from: 0.05, to: 0.9, width: 0.9 })}"/>`,
  ...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

const live = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "scene.mjs"), "D")}
const svg = document.querySelector(".intaglio-svg");
const paths = Object.fromEntries([...svg.querySelectorAll("[data-layer]")].map((p) => [p.dataset.layer, p]));
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const S = D.scene({ ss: 2 });
let shown = ${START};
let target = ${START};
let touched = 0;
let visible = true;
let frame = 0;
let drawn = 0;
const draw = (h) => {
  const ink = D.inkAt(S, h, { size: 640, negative: ${negative} });
  for (const id in ink) paths[id].setAttribute("d", ink[id]);
  drawn = h;
};
const tick = (now) => {
  frame = 0;
  if (!visible) return;
  if (!still && now - touched > 4000) target = 8 + ((now / 1000 / 2.6 + ${START - 8}) % 9.5);
  shown += (target - shown) * 0.12;
  if (Math.abs(shown - drawn) > 0.004) draw(shown);
  if (!still || Math.abs(target - shown) > 0.004) frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const set = (h) => { target = Math.min(17.5, Math.max(7.5, h)); touched = performance.now(); wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  set(17.5 - ((e.clientX - r.left) / r.width) * 10);
});
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") set(target - 0.25);
  else if (e.key === "ArrowLeft") set(target + 0.25);
  else return;
  e.preventDefault();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
wake();
`;

const html = pageHtml({
  title: "Torre di Pisa",
  theme,
  body: plateHtml({
    body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: "Torre di Pisa" }, label: "An engraved Leaning Tower of Pisa on the lawn of the Piazza dei Miracoli, its shadow moving with the sun", body }),
  }),
  script: live,
});
const name = negative ? "pisa-dark.html" : "pisa.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
