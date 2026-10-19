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
const START = -38;


const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1024, negative });
const t2 = performance.now();

const body = [
  `<path class="intaglio-ink" d="${I.ink(S.sky, S.skyTone, { from: 0.05, to: 0.9, width: 0.85 })}"/>`,
  ...S.layers.map((l) => `<path class="${l.cls ?? "intaglio-ink"}" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks.green}"/>`,
  `<path class="intaglio-ink-2" d="${S.marks.red}"/>`,
].join("");

const live = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "scene.mjs"), "D")}
const svg = document.querySelector(".intaglio-svg");
const paths = Object.fromEntries([...svg.querySelectorAll("[data-layer]")].map((p) => [p.dataset.layer, p]));
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let S = null;
let shown = ${START};
let target = ${START};
let drawn = ${START};
let touched = 0;
let visible = true;
let frame = 0;
const draw = (a) => {
  const ink = D.inkAt(S, a, { size: 448, negative: ${negative} });
  for (const id in ink) paths[id].setAttribute("d", ink[id]);
  drawn = a;
};
const tick = (now) => {
  frame = 0;
  if (!visible) return;
  if (!still && now - touched > 4000) target = ${START} + 50 * Math.sin(now / 1000 / 5);
  shown += (target - shown) * 0.1;
  if (Math.abs(shown - drawn) > 0.25) draw(shown);
  if (!still || Math.abs(target - shown) > 0.25) frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const set = (a) => { target = Math.min(70, Math.max(-70, a)); touched = performance.now(); if (S) wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  set(-70 + ((e.clientX - r.left) / r.width) * 140);
});
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") set(target + 5);
  else if (e.key === "ArrowLeft") set(target - 5);
  else return;
  e.preventDefault();
});
requestIdleCallback(() => {
  S = D.scene({ ss: 2 });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
  wake();
});
`;

const html = pageHtml({
  title: "Hibiscus",
  theme,
  body: plateHtml({
    body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: "Hibiscus rosa-sinensis" }, label: "An engraved hibiscus flower with its staminal column, stem and two leaves", body }),
  }),
  script: live,
});
const name = negative ? "hibiscus-dark.html" : "hibiscus.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
