import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { levelsPng, engravingSvg, grainSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { wrap } from "../../scripts/inline.mjs";
import { HEIGHT, OPTICS, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const AT = process.argv.find((a) => a.startsWith("--at="))?.split("=")[1];
const START = AT ? Number(AT) : 0.3;
const TITLE = "Ranges into Distance";

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
// Optics can be tried from the command line: --soft=2.5 --bloom=0.3 --grain=0.55 (0 turns one off).
const optics = { ...OPTICS };
for (const key of Object.keys(optics)) {
  const flag = process.argv.find((a) => a.startsWith(`--${key}=`));
  if (flag) optics[key] = Number(flag.split("=")[1]);
}
const bits = inkAt(S, START, { size: 1400, negative, optics });
const t2 = performance.now();

// The live plate: a worker builds the scene once, then for each moment of the evening lights it, prints it through
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
  try {
    const bits = D.inkAt(S, v, { size: 640, negative: ${negative}, optics: ${JSON.stringify(optics)} });
    ctx.putImageData(new ImageData(M.rgba(bits), S.W, S.H), 0, 0);
    postMessage({ v, blob: await canvas.convertToBlob({ type: "image/png" }) });
  } catch (e) {
    postMessage({ error: String(e && e.stack || e) });
  }
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
// A worker that fails would leave the plate still and silent, so say so.
printer.onerror = (e) => console.error("ranges: the live plate's worker failed:", e.message);
printer.onmessage = ({ data }) => {
  if (data.error) return console.error("ranges: a frame failed:", data.error);
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
  if (!still && now - touched > 4000) target = 0.5 - 0.5 * Math.cos(now / 1000 / 9 + ${Math.acos(1 - 2 * START)});
  shown += (target - shown) * 0.06;
  const behind = Math.abs(shown - drawn) > 0.002;
  if (ready && !busy && behind) { busy = true; printer.postMessage({ v: shown }); }
  if (!still || Math.abs(target - shown) > 0.002 || behind) frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const set = (v) => { target = Math.min(MAX, Math.max(MIN, v)); touched = performance.now(); wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  set(MIN + ((e.clientX - r.left) / r.width) * (MAX - MIN));
});
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") set(target + 0.03);
  else if (e.key === "ArrowLeft") set(target - 0.03);
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
  body: plateHtml({
    body: engravingSvg({ width: WIDTH, height: HEIGHT, frame: { title: TITLE }, label: "A mezzotint of the Alps, range behind range with fog in the valleys between them, the snowy summits catching the last of the evening sun", body }),
  }),
  script: AT || process.argv.includes("--still") ? "" : live,
});
const name = AT ? `ranges-at-${AT}.html` : negative ? "ranges-dark.html" : "ranges.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
