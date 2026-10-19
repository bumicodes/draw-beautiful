import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { HEIGHT, NOW, WIDTH, frameAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const f = frameAt(S, NOW, { size: 1024, negative });
const t2 = performance.now();

const statics = S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${f[l.id]}"/>`).join("");
const body = [
  `<mask id="orrery-sky" maskUnits="userSpaceOnUse" x="0" y="0" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#fff"/><path data-layer="knock" d="${f.knock}" fill="#000" stroke="#000" stroke-width="16" stroke-linejoin="round"/></mask>`,
  `<path class="intaglio-ink" mask="url(#orrery-sky)" d="${I.ink(S.sky, S.skyTone, { from: 0.05, to: 0.9, width: 0.9 })}"/>`,
  statics,
  `<path class="intaglio-ink" d="${S.marks}"/>`,
  `<path class="intaglio-ground" data-layer="knock" d="${f.knock}"/>`,
  `<path class="intaglio-ink" data-layer="moving" d="${f.moving}"/>`,
].join("");

const live = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "scene.mjs"), "D")}
const svg = document.querySelector(".intaglio-svg");
const paths = [...svg.querySelectorAll("[data-layer]")];
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const S = D.scene({ ss: 2 });
const YEAR = 30000;
let shown = D.NOW;
let target = D.NOW;
let touched = -Infinity;
let visible = true;
let frame = 0;
let drawn = shown;
let last = 0;
const draw = (t) => {
  const f = D.frameAt(S, t, { size: 560, negative: ${negative} });
  for (const p of paths) p.setAttribute("d", f[p.dataset.layer]);
  drawn = t;
};
const tick = (now) => {
  frame = 0;
  const dt = last ? Math.min(100, now - last) : 0;
  last = now;
  if (!visible) return;
  if (!still && now - touched > 4000) target += dt / YEAR;
  shown += (target - shown) * 0.1;
  if (Math.abs(shown - drawn) > 0.0004) draw(shown);
  if (!still || Math.abs(target - shown) > 0.0004) frame = requestAnimationFrame(tick);
  else last = 0;
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const set = (t) => { target = t; touched = performance.now(); wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  set(D.NOW + ((e.clientX - r.left) / r.width) * 2);
});
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") set(target + 7 / 365.25);
  else if (e.key === "ArrowLeft") set(target - 7 / 365.25);
  else return;
  e.preventDefault();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; if (visible) wake(); }).observe(svg);
wake();
`;

const html = pageHtml({
  title: "The Orrery",
  theme,
  body: plateHtml({
    body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: "The orrery" }, label: "An engraved brass orrery: Mercury, Venus, Earth with its Moon, and Mars on arms round a central sun, each lit on the side that faces it", body }),
  }),
  script: live,
});
const name = negative ? "orrery-dark.html" : "orrery.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, frame ${(t2 - t1).toFixed(0)} ms`);
