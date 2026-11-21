import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { levelsPng, engravingSvg, grainSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const START = 0.35;
const TITLE = "The Whale Shark";

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
// Film grain (continuous tone with grain on top) by default; --dither prints every cell as ink or paper.
const GRAIN = process.argv.includes("--dither") ? "dither" : "film";
const bits = inkAt(S, START, { negative, grain: GRAIN });
const t2 = performance.now();

// The live plate: a worker builds the scene once, then for each hour lights it, prints it through the grain and
// hands back a PNG of the cells, which the page swaps into the grain mask. The grain never moves, only the tone.
const worker = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "../../kit/mezzotint.mjs"), "M")}
${wrap(join(HERE, "scene.mjs"), "D")}
const S = D.scene();
const canvas = new OffscreenCanvas(S.G.w, S.G.h);
const ctx = canvas.getContext("2d");
postMessage({ ready: true });
onmessage = async ({ data: { v } }) => {
  const bits = D.inkAt(S, v, { negative: ${negative}, grain: "${GRAIN}" });
  ctx.putImageData(new ImageData(M.rgba(bits), S.G.w, S.G.h), 0, 0);
  postMessage({ v, blob: await canvas.convertToBlob({ type: "image/png" }) });
};
`;

const live = `
const svg = document.querySelector(".intaglio-svg");
const image = svg.querySelector('[data-layer="grain"]');
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MIN = 0, MAX = 1;
const printer = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: "text/javascript" })));
let ready = false, busy = false, visible = true, frame = 0, touched = -Infinity, url = "";
let shown = ${START}, target = ${START}, drawn = ${START};
printer.onmessage = ({ data }) => {
  if (data.ready) ready = true;
  else {
    const next = URL.createObjectURL(data.blob);
    image.setAttribute("href", next);
    if (url) URL.revokeObjectURL(url);
    url = next;
    drawn = data.v;
    busy = false;
  }
  wake();
};
const tick = (now) => {
  frame = 0;
  if (!visible) return;
  if (!still && now - touched > 4000) target = 0.5 + 0.5 * Math.sin(now / 1000 / 9 + ${Math.asin((START - 0.5) / 0.5)});
  shown += (target - shown) * 0.06;
  const behind = Math.abs(shown - drawn) > 0.004;
  if (ready && !busy && behind) { busy = true; printer.postMessage({ v: shown }); }
  if (!still || Math.abs(target - shown) > 0.004 || behind) frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const set = (v) => { target = Math.min(MAX, Math.max(MIN, v)); touched = performance.now(); wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  set(MIN + ((e.clientX - r.left) / r.width) * (MAX - MIN));
});
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") set(target + 0.04);
  else if (e.key === "ArrowLeft") set(target - 0.04);
  else return;
  e.preventDefault();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
wake();
`;

const OVERLAY = process.argv.includes("--overlay");
// --bare drops the engraved frame and title: the picture alone, for sharing.
const BARE = process.argv.includes("--bare");
// --overlay lays the reference photo over the plate at half strength, where the camera puts photo px.
const k = WIDTH / 511;
const photo = OVERLAY
  ? `<image href="data:image/png;base64,${readFileSync(join(HERE, "reference.png")).toString("base64")}" x="0" y="${(HEIGHT * (380 / 720) - 380 * k).toFixed(2)}" width="${WIDTH}" height="${(720 * k).toFixed(2)}" opacity="0.5"/>`
  : "";
const body = grainSvg({ width: WIDTH, height: HEIGHT, href: levelsPng(bits, S.G.w, S.G.h) }) + photo;
const html = pageHtml({
  title: TITLE,
  theme,
  width: 920,
  body: plateHtml({
    body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: BARE ? undefined : { title: TITLE }, label: "A mezzotint of a whale shark seen from above in dark water, its pale spots catching the sunlight that drifts over its back in caustics", body }),
  }),
  script: process.argv.includes("--still") || OVERLAY || BARE ? "" : live,
});
const name = BARE ? "whaleshark-bare.html" : OVERLAY ? "whaleshark-overlay.html" : negative ? "whaleshark-dark.html" : "whaleshark.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
