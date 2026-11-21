import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { levelsPng, engravingSvg, grainSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { HEIGHT, OPTICS, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const START = 17.6;
const TITLE = "The Golden Gate in Fog";

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
// Film grain (continuous tone with grain on top) by default; --dither prints every cell as ink or paper.
const GRAIN = process.argv.includes("--dither") ? "dither" : "film";
// Optics can be tried from the command line: --haze=4 --bloom=0.5 --soft=0 (0 turns one off).
const optics = { ...OPTICS };
for (const key of Object.keys(optics)) {
  const flag = process.argv.find((a) => a.startsWith(`--${key}=`));
  if (flag) optics[key] = Number(flag.split("=")[1]);
}
const plates = inkAt(S, START, { size: 1400, negative, grain: GRAIN, optics });
const t2 = performance.now();

// The live plate: a worker builds the scene once, then for each hour lights it, prints both plates through their
// grains and hands back a PNG of each, which the page swaps into the masks. The grain never moves, only the tone.
const worker = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "../../kit/mezzotint.mjs"), "M")}
${wrap(join(HERE, "scene.mjs"), "D")}
const S = D.scene();
const canvas = new OffscreenCanvas(S.G.w, S.G.h);
const ctx = canvas.getContext("2d");
postMessage({ ready: true });
const png = async (levels) => {
  ctx.putImageData(new ImageData(M.rgba(levels), S.G.w, S.G.h), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
};
onmessage = async ({ data: { v } }) => {
  const { key, paint } = D.inkAt(S, v, { size: 640, negative: ${negative}, grain: "${GRAIN}", optics: ${JSON.stringify(optics)} });
  postMessage({ v, key: await png(key), paint: await png(paint) });
};
`;

const live = `
const svg = document.querySelector(".intaglio-svg");
const images = { key: svg.querySelector('[data-layer="grain"]'), paint: svg.querySelector('[data-layer="paint"]') };
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MIN = 5.2, MAX = 18.9;
const printer = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: "text/javascript" })));
let ready = false, busy = false, visible = true, frame = 0, touched = -Infinity;
const urls = {};
let shown = ${START}, target = ${START}, drawn = ${START};
printer.onmessage = ({ data }) => {
  if (data.ready) ready = true;
  else {
    for (const layer of ["key", "paint"]) {
      const next = URL.createObjectURL(data[layer]);
      images[layer].setAttribute("href", next);
      if (urls[layer]) URL.revokeObjectURL(urls[layer]);
      urls[layer] = next;
    }
    drawn = data.v;
    busy = false;
  }
  wake();
};
const tick = (now) => {
  frame = 0;
  if (!visible) return;
  if (!still && now - touched > 4000) target = 12.05 + 6.85 * Math.sin(now / 1000 / 9 + ${Math.asin((START - 12.05) / 6.85)});
  shown += (target - shown) * 0.06;
  const behind = Math.abs(shown - drawn) > 0.01;
  if (ready && !busy && behind) { busy = true; printer.postMessage({ v: shown }); }
  if (!still || Math.abs(target - shown) > 0.01 || behind) frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const set = (v) => { target = Math.min(MAX, Math.max(MIN, v)); touched = performance.now(); wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  set(MIN + ((e.clientX - r.left) / r.width) * (MAX - MIN));
});
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") set(target + 0.25);
  else if (e.key === "ArrowLeft") set(target - 0.25);
  else return;
  e.preventDefault();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
wake();
`;

// Two plates: the key in the theme's ink and the bridge in International Orange. On paper the orange goes down first
// and the key prints its shading over it; the dark plate inks the light, so there the orange goes on top.
const key = grainSvg({ width: WIDTH, height: HEIGHT, href: levelsPng(plates.key, S.G.w, S.G.h) });
const paint = grainSvg({ width: WIDTH, height: HEIGHT, href: levelsPng(plates.paint, S.G.w, S.G.h), id: "bridge-paint", ink: "bridge-paint", layer: "paint" });
const ORANGE = negative ? "#e0704c" : "#c0402c";
const body = `<style>.bridge-paint{fill:${ORANGE}}</style>${negative ? key + paint : paint + key}`;
const html = pageHtml({
  title: TITLE,
  theme,
  width: 920,
  body: plateHtml({
    body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: TITLE }, label: "A two-colour mezzotint of the Golden Gate Bridge seen from the Marin headlands, its deck running into a bank of sea fog while the orange towers stand clear above it; the light moves with the sun from morning to evening", body }),
  }),
  script: process.argv.includes("--still") ? "" : live,
});
const name = negative ? "bridge-dark.html" : "bridge.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
