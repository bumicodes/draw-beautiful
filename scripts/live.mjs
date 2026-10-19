import { join } from "node:path";
import { wrap } from "./inline.mjs";

/**
 * The live part of a plate driven by one value: a worker builds the scene and answers `D.inkAt(S, value, ink)` with
 * { [layer id]: d }; the page eases toward a target, runs an idle tour, follows the pointer across the figure and the
 * arrow keys, stops offscreen, and swaps path data on `[data-layer]` elements. Under reduced motion it draws once and
 * moves only when asked. `quantize: n` snaps the value to n steps and caches each frame in the worker, for scenes
 * whose geometry is rebuilt per frame. `idle` is a JS expression in `t` (seconds) giving the tour's value.
 */
export const liveScript = ({ kit, scene, start, min, max, idle, step = (max - min) / 40, eps = (max - min) / 400, ease = 0.08, sceneArgs = "{ ss: 2 }", ink = "{}", wrapAround = false, quantize = 0 }) => {
  const worker = `
${wrap(kit, "I")}
${wrap(scene, "D")}
const S = D.scene(${sceneArgs});
postMessage({ ready: true });
const Q = ${quantize}, cache = new Map();
let near = Math.round(((${start} - ${min}) / (${max} - ${min})) * Q);
const at = (k) => ${min} + (k / Q) * (${max} - ${min});
const frame = (k) => { if (!cache.has(k)) cache.set(k, D.inkAt(S, at(k), ${ink})); return cache.get(k); };
// With quantize the value snaps to Q steps and every frame is kept; between requests the worker engraves the
// missing frames nearest the last one asked for, so the loop soon replays from memory.
const prefetch = () => {
  for (let d = 0; d <= Q; d++) for (const k of [near + d, near - d]) if (k >= 0 && k <= Q && !cache.has(k)) { frame(k); setTimeout(prefetch, 0); return; }
};
onmessage = ({ data: { v } }) => {
  if (!Q) return postMessage({ v, ink: D.inkAt(S, v, ${ink}) });
  near = Math.round(((v - ${min}) / (${max} - ${min})) * Q);
  postMessage({ v: at(near), ink: frame(near) });
};
if (Q) setTimeout(prefetch, 0);
`;
  return `
const svg = document.querySelector(".intaglio-svg");
const paths = {};
for (const p of svg.querySelectorAll("[data-layer]")) (paths[p.dataset.layer] ??= []).push(p);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const engraver = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: "text/javascript" })));
const MIN = ${min}, MAX = ${max}, WRAP = ${wrapAround};
const gap = (a, b) => { const d = a - b; if (!WRAP) return d; const span = MAX - MIN; return d - span * Math.round(d / span); };
let ready = false, busy = false, visible = true, frame = 0, touched = -Infinity;
let shown = ${start}, target = ${start}, drawn = ${start};
engraver.onmessage = ({ data }) => {
  if (data.ready) ready = true;
  else {
    for (const id in data.ink) for (const p of paths[id] ?? []) p.setAttribute("d", data.ink[id]);
    drawn = data.v;
    busy = false;
  }
  wake();
};
const tick = (now) => {
  frame = 0;
  if (!visible) return;
  if (!still && now - touched > 4000) { const t = now / 1000; target = ${idle}; }
  shown += gap(target, shown) * ${ease};
  if (WRAP) shown = MIN + ((((shown - MIN) % (MAX - MIN)) + (MAX - MIN)) % (MAX - MIN));
  const behind = Math.abs(gap(shown, drawn)) > ${quantize ? `Math.max(${eps}, ${(max - min) / quantize / 2})` : eps};
  if (ready && !busy && behind) { busy = true; engraver.postMessage({ v: shown }); }
  if (!still || Math.abs(gap(target, shown)) > ${eps} || behind) frame = requestAnimationFrame(tick);
};
const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
const set = (v) => { target = WRAP ? v : Math.min(MAX, Math.max(MIN, v)); touched = performance.now(); wake(); };
svg.addEventListener("pointermove", (e) => {
  const r = svg.getBoundingClientRect();
  set(MIN + ((e.clientX - r.left) / r.width) * (MAX - MIN));
});
svg.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") set(target + ${step});
  else if (e.key === "ArrowLeft") set(target - ${step});
  else return;
  e.preventDefault();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(svg);
`;
};

export const kitPath = (here) => join(here, "../../kit/intaglio.mjs");
