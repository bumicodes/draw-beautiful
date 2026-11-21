import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// A whale shark seen from above, gliding a few metres down in dark water, printed as a mezzotint.
// World units are metres: x right, y toward the top of the plate, z up, the sea surface at z = 0. The shark is about
// 10.5 m long, drawn from the reference photo's proportions (52 photo px to the metre). Sunlight comes down through
// the surface in a net of caustics that drifts over its back; the water swallows it with depth, so the head and the
// spots on the shoulders stand clear and the tail goes down into the dark.

export const WIDTH = 500;
export const HEIGHT = 700;
export const RES = 2;

const PX = 1 / 52;
const fromPhoto = ([x, y]) => [(x - 255) * PX, -(y - 380) * PX];

// The plate's water.
const VIEW_K = 0.085; // how fast the water hides what is below, per metre looked through
const LIGHT_K = 0.07;
const SURFACE = 0.94; // what the surface itself lets through to the eye, even just under it // how fast it dims the light coming down
const WATER = 0.9; // the tone of deep water

/** A smooth function through [x, y] knots: monotone cubic Hermite, flat at the ends. */
const curve = (knots) => {
  const n = knots.length;
  const xs = knots.map((k) => k[0]);
  const ys = knots.map((k) => k[1]);
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = ys.map((_, i) => (i === 0 || i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])));
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
};

// The spine, snout to tail tip, from the photo: straight through the body, then the tail swings off to the right.
const SPINE = [
  [252, 120], [252, 170], [250, 240], [249, 300], [247, 370], [251, 425], [260, 470], [274, 505], [298, 545], [335, 582], [362, 606], [379, 626],
].map(fromPhoto);

const catmull = (pts, t) => {
  const n = pts.length - 1;
  const f = Math.min(n - 1e-9, Math.max(0, t * n));
  const i = Math.floor(f);
  const s = f - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  return [0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s * s + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s * s * s));
};

// The spine resampled by arc length, so the body can be laid out in metres from the snout.
const SAMPLES = 1200;
const spinePts = Array.from({ length: SAMPLES + 1 }, (_, i) => catmull(SPINE, i / SAMPLES));
const spineLen = [0];
for (let i = 1; i <= SAMPLES; i++) spineLen.push(spineLen[i - 1] + Math.hypot(spinePts[i][0] - spinePts[i - 1][0], spinePts[i][1] - spinePts[i - 1][1]));
export const LENGTH = spineLen[SAMPLES];

/** Where the spine is `d` metres from the snout, and its rightward normal. */
const spineAt = (d) => {
  const x = Math.min(LENGTH, Math.max(0, d));
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (spineLen[mid] < x) lo = mid;
    else hi = mid;
  }
  const t = (x - spineLen[lo]) / (spineLen[hi] - spineLen[lo] || 1);
  const a = spinePts[lo];
  const b = spinePts[hi];
  const tx = b[0] - a[0];
  const ty = b[1] - a[1];
  const l = Math.hypot(tx, ty);
  return { c: [a[0] + tx * t, a[1] + ty * t], right: [ty / l, -tx / l] };
};

// Half-width and half-height of the body along it (photo px from the snout), the broad flat head of a filter feeder.
// Half-width keyed by the photo y where the spine passes, measured off the reference: the broad flat head, a trunk that
// stays nearly full width to the fins, then a long, slow taper (the tail measured square to the spine).
const halfWidth = curve([[120, 0], [121, 20], [123, 33], [126, 43], [131, 51], [140, 58], [160, 63], [200, 66], [260, 66], [300, 65], [330, 61], [360, 53], [390, 44], [420, 37], [460, 32], [500, 28], [530, 22], [555, 16], [575, 10], [595, 6], [612, 3], [626, 0]].map(([y, w]) => [y, w * PX]));
const halfHeight = curve([[0, 0], [4, 7], [20, 13], [60, 20], [130, 27], [210, 31], [290, 27], [380, 17], [470, 9], [560, 0]].map(([d, h]) => [d * PX, h * PX]));
// The back runs level, then the tail goes down into the dark.
// The shark cruises at the surface: its spine rides just under z = 0 from the snout past the fins, so the broad back
// breaks the water while the flanks and fins stay under, then the tail goes down into the dark.
const depthAt = (d) => -H(d) * (0.06 + 1.0 * I.smoothstep(0.3, 6.3, d)) - 0.04 - 2.6 * I.smoothstep(5.6, LENGTH, d) ** 1.2;
const scale = LENGTH / (560 * PX);
/** The photo y of the spine point d metres from the snout. */
const photoY = (d) => 380 - spineAt(d).c[1] / PX;
/** The distance from the snout at which the spine crosses photo y (the spine runs steadily down the photo). */
const dAtY = (y) => {
  let lo = 0;
  let hi = LENGTH;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (photoY(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
const W = (d) => halfWidth(photoY(d));
const H = (d) => halfHeight(d / scale);

// The three ridges each side of a whale shark's back, strongest over the trunk.
const RIDGES = [0, 0.42, -0.42, 0.78, -0.78];
const ridge = (d, theta) => {
  const along = I.smoothstep(1.2, 3, d) * (1 - I.smoothstep(6.5, 9, d));
  return along * RIDGES.reduce((s, at, k) => s + (k ? 0.045 : 0.07) * Math.exp(-(((theta - Math.PI / 2 - at) / 0.07) ** 2)), 0);
};

const TH0 = -0.35;
const TH1 = Math.PI + 0.35;
/** A point on the body: d metres from the snout, theta round the section from the right flank (0) over the back. */
const bodyAt = (d, theta) => {
  const dd = Math.min(LENGTH - 0.004, Math.max(0.004, d));
  const { c, right } = spineAt(dd);
  const w = W(dd);
  const h = H(dd);
  const lat = w * Math.cos(theta);
  const up = Math.sin(theta) >= 0 ? h * Math.sin(theta) ** 0.85 : h * 0.6 * Math.sin(theta);
  return [c[0] + right[0] * lat, c[1] + right[1] * lat, depthAt(dd) + up + ridge(dd, theta) * h];
};

/** Turn a patch so its normals face up, out of the water, whichever way its u and v run. */
const facingUp = (opts) => {
  const s = I.patch(opts);
  return s.point(0.5, 0.5)[1][2] >= 0 ? s : I.patch({ ...opts, side: -1 });
};

/** A pectoral fin: u from root to tip, v from the leading edge to the trailing edge; `side` 1 right, -1 left. */
const finAt = (side) => {
  // In photo px (out from the spine, and down the photo), measured on the right fin; the left one is its mirror.
  // A broad sickle: the leading edge leaves the body high and nearly level, rounds over and sweeps down to the tip;
  // the trailing edge runs from the tip back up in a shallow hollow to meet the body well behind the leading root.
  const bez = (a, b, c, d, t) => [0, 1].map((k) => (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t * t * c[k] + t ** 3 * d[k]);
  const tip = [121, 348];
  return (u, v) => {
    const lead = bez([48, 278], [84, 283], [114, 308], tip, u);
    const trail = bez([48, 337], [76, 322], [106, 324], tip, u);
    const lat = lead[0] + (trail[0] - lead[0]) * v;
    const dpx = lead[1] + (trail[1] - lead[1]) * v;
    const d = dAtY(dpx);
    const { c, right } = spineAt(d);
    const off = lat * PX;
    const thick = 0.07 * (1 - u) * Math.sin(Math.PI * Math.min(1, v * 1.15)) ** 0.7;
    // Held out nearly level just under the surface, so the fins read almost as clearly as the back.
    return [c[0] + right[0] * off * side, c[1] + right[1] * off * side, depthAt(d) - 0.03 - 0.18 * u ** 1.4 + thick];
  };
};


// Spots: a jittered, staggered grid laid out on the skin, about 18 cm apart, smaller and closer on the head.
const SPOT = 0.175;
const spotAt = (a, b, seed, size = 1) => {
  const j = Math.floor(a / SPOT);
  let best = 0;
  for (let dj = -1; dj <= 1; dj++) {
    const row = j + dj;
    const shift = (row & 1) * 0.5;
    const i = Math.floor(b / SPOT - shift);
    for (let di = -1; di <= 1; di++) {
      const col = i + di;
      const h1 = M.hash(row, col, seed);
      if (h1 < 0.08) continue; // a few gaps, as in a real pattern
      const ca = (row + 0.5 + 0.55 * (M.hash(row, col, seed + 1) - 0.5)) * SPOT;
      const cb = (col + shift + 0.5 + 0.55 * (M.hash(row, col, seed + 2) - 0.5)) * SPOT;
      const r = SPOT * size * (0.2 + 0.13 * M.hash(row, col, seed + 3));
      const dist = Math.hypot(a - ca, b - cb);
      best = Math.max(best, I.smoothstep(r, r * 0.55, dist));
    }
  }
  return best;
};

/** A body point back to the spine: metres from the snout, and the signed sideways offset (right positive). */
const bodyCoords = (p) => {
  // The spine runs down the plate, so start from the sample at the same height and walk to the nearest.
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (spinePts[mid][1] > p[1]) lo = mid;
    else hi = mid;
  }
  let best = lo;
  let bd = Infinity;
  for (let i = Math.max(0, lo - 220); i <= Math.min(SAMPLES, lo + 40); i++) {
    const dd = (spinePts[i][0] - p[0]) ** 2 + (spinePts[i][1] - p[1]) ** 2;
    if (dd < bd) {
      bd = dd;
      best = i;
    }
  }
  const { c, right } = spineAt(spineLen[best]);
  return { d: spineLen[best], lat: (p[0] - c[0]) * right[0] + (p[1] - c[1]) * right[1] };
};

export const scene = ({ res = RES } = {}) => {
  const cam = I.perspective({ eye: [0, -0.01, 24], target: [0, 0, -0.6], scale: 52 * (WIDTH / 511), offset: [WIDTH * (255 / 511), HEIGHT * (380 / 720)], width: WIDTH, height: HEIGHT });

  const body = facingUp({ at: (u, v) => bodyAt(u * LENGTH, TH0 + v * (TH1 - TH0)), nu: 160, nv: 40 });
  const fins = [1, -1].map((side) => facingUp({ at: finAt(side), nu: 24, nv: 16 }));
  const solids = [body, ...fins];
  const G = M.gbuffer(solids, cam, { res, mesh: (s) => (s === body ? [360, 72] : [48, 32]) });

  // Everything the light doesn't change, once: the water's tone and texture, and per cell of shark its point, normal,
  // how dark its skin is there (spots scraped out of it), and how much of it the water lets through.
  const N = G.w * G.h;
  const fixed = new Float32Array(N);
  // How much the water blurs each cell: everything under it is a little soft, the deeper the softer.
  const haze = new Float32Array(N);
  const cells = [];
  for (let i = 0; i < N; i++) {
    const x = (i % G.w) / res;
    const y = Math.floor(i / G.w) / res;
    const k = G.id[i];
    // Deep water: dark, mottled where the light comes down in loose patches, with faint streaks of drift.
    const patches = M.fbm(x / 140, y / 110, { octaves: 3, seed: 2 });
    const streak = M.fbm(x / 9, y / 70, { octaves: 2, seed: 8 });
    const glow = Math.exp(-(((x - WIDTH * 0.5) / 210) ** 2) - (((y - HEIGHT * 0.38) / 300) ** 2));
    const water = WATER - 0.14 * (patches - 0.45) - 0.05 * (streak - 0.5) - 0.06 * glow;
    if (k < 0) {
      fixed[i] = I.clamp01(water);
      continue;
    }
    const p = [G.p[i * 3], G.p[i * 3 + 1], G.p[i * 3 + 2]];
    const n = [G.n[i * 3], G.n[i * 3 + 1], G.n[i * 3 + 2]];
    // Above the surface the skin is dry and seen plain; below it the surface itself veils it a little, then depth more.
    const depth = Math.max(0, -p[2]);
    const dry = p[2] >= 0;
    const t = dry ? 1 : SURFACE * Math.exp(-VIEW_K * depth);
    // The waterline: a thin pale film where the water climbs the skin.
    const line = I.smoothstep(0.025, 0, Math.abs(p[2]));
    let spot;
    if (k === 0) {
      const { d, lat } = bodyCoords(p);
      const w = W(d);
      // Across the back as an arc from the spine, so the spots keep their spacing over the curve of the flank.
      const across = w * Math.asin(Math.max(-1, Math.min(1, lat / Math.max(w, 1e-3))));
      const head = 0.62 + 0.38 * I.smoothstep(0.4, 2.2, d);
      spot = spotAt(d / head, across / head, 5, 1);
      // The spots fade a little toward the tail.
      spot *= 1 - 0.35 * I.smoothstep(6, LENGTH, d);
    } else {
      spot = spotAt(p[1], p[0], 40 + k, 1);
    }
    const grit = 0.05 * (M.fbm(p[0] * 9, p[1] * 9, { octaves: 2, seed: 13 }) - 0.5);
    cells.push({ i, p, n, depth, t, dry, line, water: I.clamp01(water), spot, grit });
    haze[i] = dry ? 0 : Math.min(1, 0.7 * (1 - t));
    fixed[i] = I.clamp01(water) * (1 - t);
  }
  return { cam, G, cells, fixed, haze, threshold: M.grain(G.w, G.h, { seed: 4, clump: 0.3, size: 2 }) };
};

/** Sunlight under the surface for v in 0..1: a little from the upper left, swinging to the upper right. */
export const lightAt = (v) => I.unit([-0.42 + 0.7 * v, 0.28, 1]);

/** The caustic net the surface ripples throw down, drifting with v; 0 in the gaps, about 1 on the bright threads. */
const caustic = (x, y, v) => {
  const s = 6 * v;
  const a = 1 - Math.abs(2 * M.noise(x * 3.4 + s, y * 3.4 - 0.5 * s, 3) - 1);
  const b = 1 - Math.abs(2 * M.noise(x * 4.3 - 0.6 * s, y * 4.3 + 0.8 * s, 9) - 1);
  return Math.max(a, b) ** 5;
};

/** The tone of every cell for v, printed through the grain. A negative plate inks the light. */
export const inkAt = (S, v, { negative = false, grain = "film" } = {}) => {
  const L = lightAt(v);
  const tone = S.fixed.slice();
  for (const c of S.cells) {
    const { p, n } = c;
    const l = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    // The light that reaches this depth, caught in the caustics, then the skin's own darkness, spots scraped out.
    // Out of the water the sun falls plain on wet skin with a little sheen; under it, it comes in caustics.
    const sun = c.dry ? 0.92 : Math.exp(-LIGHT_K * c.depth) * (0.72 + 0.7 * caustic(p[0] - (p[2] * L[0]) / L[2], p[1] - (p[2] * L[1]) / L[2], v));
    const level = 0.14 + 0.9 * Math.max(0, l) ** 1.3 * sun + 0.1 * Math.max(0, -l);
    const base = 0.56 * (1 - c.spot) + 0.02 * c.spot;
    const skin = I.clamp01(1 - level * (1 - base) + c.grit - 0.22 * c.line);
    tone[c.i] += skin * c.t;
  }
  // The water softens the tone (never the grain): the edge of the body and the spots melt a little into the dark.
  const soft = M.soften(tone, S.G.w, S.G.h, S.haze, 1);
  if (negative) for (let i = 0; i < soft.length; i++) soft[i] = 1 - soft[i];
  return grain === "film" ? M.film(soft, S.threshold, { amount: 0.8 }) : M.print(soft, S.threshold);
};
