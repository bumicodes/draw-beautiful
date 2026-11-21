import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { levelsPng, engravingSvg, grainSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { HEIGHT, OPTICS, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const START = 5.45;
const TITLE = "Ahu Tongariki";

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
// Optics can be tried from the command line: --rays=0.6 --bloom=0.5 --streak=3 --soft=0.4 (0 turns one off).
const optics = { ...OPTICS };
for (const key of Object.keys(optics)) {
  const flag = process.argv.find((a) => a.startsWith(`--${key}=`));
  if (flag) optics[key] = Number(flag.split("=")[1]);
}
const OUT = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1];
const bits = inkAt(S, START, { size: 1400, negative, optics });
const t2 = performance.now();

// The live plate: a worker builds the scene once, then for each moment of the sunrise lights it, prints it through
// the grain and hands back a PNG of the cells, which the page swaps into the grain mask. The grain never moves.
const worker = `
${wrap(join(HERE, "../../kit/intaglio.mjs"), "I")}
${wrap(join(HERE, "../../kit/mezzotint.mjs"), "M")}
${wrap(join(HERE, "scene.mjs"), "D")}
const S = D.scene();
const canvas = new OffscreenCanvas(S.W, S.H);
const ctx = canvas.getContext("2d");
postMessage({ ready: true });
onmessage = async ({ data: { v } }) => {
  const bits = D.inkAt(S, v, { size: 640, negative: ${negative}, optics: ${JSON.stringify(optics)} });
  ctx.putImageData(new ImageData(M.rgba(bits), S.W, S.H), 0, 0);
  postMessage({ v, blob: await canvas.convertToBlob({ type: "image/png" }) });
};
`;

const live = `
const svg = document.querySelector(".intaglio-svg");
const image = svg.querySelector('[data-layer="grain"]');
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MIN = 4.95, MAX = 6.6;
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
  if (!still && now - touched > 4000) target = 5.775 - 0.825 * Math.cos(now / 1000 / 6 + ${Math.acos((5.775 - START) / 0.825)});
  shown += (target - shown) * 0.06;
  const behind = Math.abs(shown - drawn) > 0.004;
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
  if (e.key === "ArrowRight") set(target + 0.1);
  else if (e.key === "ArrowLeft") set(target - 0.1);
  else return;
  e.preventDefault();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
wake();
`;

const body = grainSvg({ width: WIDTH, height: HEIGHT, href: levelsPng(bits, S.W, S.H) });
const html = pageHtml({
  title: TITLE,
  theme,
  width: 920,
  body: plateHtml({
    body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: TITLE }, label: "A mezzotint of the fifteen moai of Ahu Tongariki in a row on their stone platform, their backs to the sea as the sun rises behind them; beams fan out between the statues and their long shadows cross the grass, a toppled moai lying in the foreground and one person standing by the platform", body }),
  }),
  script: process.argv.includes("--still") ? "" : live,
});
const name = OUT ?? (negative ? "moai-dark.html" : "moai.html");
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
