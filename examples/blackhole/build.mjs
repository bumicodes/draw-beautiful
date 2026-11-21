import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { levelsPng, engravingSvg, grainSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const at = process.argv.indexOf("--time");
const START = at > 0 ? Number(process.argv[at + 1]) : 40;
const TITLE = "The Black Hole";

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const bits = inkAt(S, START, { negative });
const t2 = performance.now();

// The live plate: a worker traces the photons once, then for each moment turns the disk's gas, prints it through
// the grain and hands back a PNG, which the page swaps into the grain mask. The grain never moves, only the light.
const worker = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "../../kit/mezzotint.mjs"), "M")}
${wrap(join(HERE, "scene.mjs"), "D")}
const S = D.scene();
const canvas = new OffscreenCanvas(S.w, S.h);
const ctx = canvas.getContext("2d");
postMessage({ ready: true });
onmessage = async ({ data: { v } }) => {
  const bits = D.inkAt(S, v, { negative: ${negative} });
  ctx.putImageData(new ImageData(M.rgba(bits), S.w, S.h), 0, 0);
  postMessage({ v, blob: await canvas.convertToBlob({ type: "image/png" }) });
};
`;

// Time runs on by itself, about 4 M a second (the innermost orbit takes some 23 s); dragging the pointer across the
// plate or the arrow keys turn the disk by hand, forward or back, and then it runs on from there.
const live = `
const svg = document.querySelector(".intaglio-svg");
const image = svg.querySelector('[data-layer="grain"]');
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const RATE = 4;
const printer = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: "text/javascript" })));
let ready = false, busy = false, visible = true, frame = 0, url = "", last = 0, px = null;
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
  if (!visible) { last = 0; return; }
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  if (!still) target += RATE * dt;
  shown += (target - shown) * 0.12;
  const behind = Math.abs(shown - drawn) > 0.05;
  if (ready && !busy && behind) { busy = true; printer.postMessage({ v: shown }); }
  if (!still || Math.abs(target - shown) > 0.05 || behind) frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const turn = (dv) => { target += dv; wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  if (px !== null) turn((x - px) * 120);
  px = x;
});
svg.addEventListener("pointerleave", () => { px = null; });
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") turn(8);
  else if (e.key === "ArrowLeft") turn(-8);
  else return;
  e.preventDefault();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
wake();
`;

const body = grainSvg({ width: WIDTH, height: HEIGHT, href: levelsPng(bits, S.w, S.h) });
const html = pageHtml({
  title: TITLE,
  theme,
  width: 880,
  body: plateHtml({
    body: engravingSvg({
      width: WIDTH,
      height: HEIGHT,
      frame: { title: TITLE },
      label: "A mezzotint of a black hole: a black shadow ringed by thin light, its accretion disk crossing in front and bent by gravity over the top and under, brighter on the side that turns toward us, in a field of lensed stars",
      body,
    }),
  }),
  script: process.argv.includes("--still") ? "" : live,
});
const name = at > 0 ? `blackhole-${START}${negative ? "-dark" : ""}.html` : negative ? "blackhole-dark.html" : "blackhole.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
