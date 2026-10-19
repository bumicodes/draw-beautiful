import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Fit a level pinhole camera, and any dimensions of the model, to landmarks measured on a reference photograph.
 *
 *   node fit-camera.mjs landmarks.mjs
 *
 * The landmarks module exports:
 *   params   { name: [start, step] }: the camera's ex, ey, h (eye), yaw (degrees from +x toward +y), f (px), cx, cy
 *            (principal point = horizon, px) and any model dimensions the points use.
 *   points   [[(k) => [x, y, z], [px, py]], ...]: a model point and where it is on the photo.
 *   lines    [[(k) => [[x, y, z], [x, y, z]], [[px, py], ...]], ...]: a model line (an eave, a string course) and points
 *            seen anywhere along it, for edges whose ends are hidden. These carry the vanishing points.
 *   prior    (k) => penalty: what is known without the photo (eye height, one true dimension to fix the scale).
 *
 * The camera is level, as architectural photographs are (a view camera with a shifted lens keeps verticals upright),
 * so the horizon is the line y = cy. It prints each residual in px, the rms, and the fitted values to copy into the
 * scene module. Fit the few dimensions that set the big masses; read the small ones off the photo afterwards.
 */
const file = process.argv[2];
if (!file) {
  console.log("node fit-camera.mjs landmarks.mjs");
  process.exit(1);
}
const { params, points = [], lines = [], prior = () => 0 } = await import(pathToFileURL(resolve(file)));
const names = Object.keys(params);
const named = (v) => Object.fromEntries(names.map((n, i) => [n, v[i]]));

export const project = (k, [X, Y, Z]) => {
  const a = (k.yaw * Math.PI) / 180;
  const d = [Math.cos(a), Math.sin(a)];
  const q = [X - k.ex, Y - k.ey, Z - k.h];
  const z = Math.max(1e-3, q[0] * d[0] + q[1] * d[1]);
  return [k.cx + (k.f * (q[0] * d[1] - q[1] * d[0])) / z, k.cy - (k.f * q[2]) / z];
};

const residuals = (k) => {
  const out = [];
  for (const [at, m] of points) {
    const s = project(k, at(k));
    out.push({ kind: "point", m, s, d: Math.hypot(s[0] - m[0], s[1] - m[1]) });
  }
  for (const [at, ms] of lines) {
    const [a, b] = at(k).map((p) => project(k, p));
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    for (const m of ms) out.push({ kind: "line", m, d: ((b[0] - a[0]) * (a[1] - m[1]) - (a[0] - m[0]) * (b[1] - a[1])) / L });
  }
  return out;
};
const cost = (v) => {
  const k = named(v);
  return residuals(k).reduce((e, r) => e + r.d * r.d, 0) + prior(k);
};

// Nelder-Mead, restarted with shrinking steps.
const minimise = (f, x, step, iters = 20000) => {
  const n = x.length;
  let S = [x, ...x.map((_, i) => x.map((t, j) => (i === j ? t + step[j] : t)))].map((p) => [p, f(p)]);
  for (let it = 0; it < iters; it++) {
    S.sort((a, b) => a[1] - b[1]);
    const c = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][0][j] / n;
    const w = S[n][0];
    const at = (t) => c.map((cj, j) => cj + t * (w[j] - cj));
    const r = at(-1);
    const fr = f(r);
    if (fr < S[0][1]) {
      const e = at(-2);
      const fe = f(e);
      S[n] = fe < fr ? [e, fe] : [r, fr];
    } else if (fr < S[n - 1][1]) S[n] = [r, fr];
    else {
      const k = at(0.5);
      const fk = f(k);
      if (fk < S[n][1]) S[n] = [k, fk];
      else S = S.map((s, i) => (i ? S[0][0].map((b, j) => b + 0.5 * (s[0][j] - b)) : s[0])).map((p) => [p, f(p)]);
    }
  }
  S.sort((a, b) => a[1] - b[1]);
  return S[0];
};

const step = names.map((n) => params[n][1]);
let best = minimise(cost, names.map((n) => params[n][0]), step);
for (let r = 1; r <= 6; r++) best = minimise(cost, best[0], step.map((s) => s / 2 ** r));

const k = named(best[0]);
const rs = residuals(k);
for (const r of rs) console.log(`${r.kind.padEnd(5)} ${String(r.m).padEnd(9)} ${r.s ? `-> ${r.s.map((t) => t.toFixed(1)).join(",").padEnd(12)}` : "".padEnd(15)} ${r.d.toFixed(1)} px`);
console.log(`rms ${Math.sqrt(rs.reduce((e, r) => e + r.d * r.d, 0) / rs.length).toFixed(2)} px over ${rs.length} measurements`);
console.log(JSON.stringify(Object.fromEntries(names.map((n) => [n, +k[n].toFixed(3)]))));
