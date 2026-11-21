import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// Ranges of the Alps going back into the distance, as a mezzotint: the whole plate rocked dark, the light scraped back.
// The country is one heightfield, ridged multifractal noise whose ridges run mostly across the view, so it stands up
// in ranges one behind another: wooded foothills in front, the high Alps behind, jagged summits and arêtes, rock
// faces, snowfields wherever the ground is high enough and gentle enough to hold snow. Height fog lies in the
// valleys between the ranges. Every cell of the plate takes its tone from that lit country, the air softens what is
// far, and a fixed film grain prints over it. The evening sun is low on the left, a little behind the eye: as it
// sinks the shadows climb the faces until only the summits keep the light.
// World units are metres: x right, y away from the eye, z up. The eye is level and looks along +y.

export const WIDTH = 760;
export const HEIGHT = 500;

const EYE = [0, 0, 1300];
const FOCAL = 715;
const HORIZON = 0.5 * HEIGHT;

const SNOWLINE = 2300;
const TREELINE = 1750;

/** Ridged multifractal noise (Musgrave): each octave's ridges are weighted by the last, so detail gathers on crests. */
const ridgedMF = (x, y) => {
  let sum = 0;
  let amp = 1;
  let weight = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < 7; o++) {
    let n = 1 - Math.abs(2 * M.noise(x * f, y * f, 11 + o) - 1);
    n *= n * weight;
    weight = I.clamp01(n * 1.8);
    sum += n * amp;
    norm += amp;
    amp *= 0.52;
    f *= 2.07;
  }
  return sum / norm;
};

/**
 * The ranges, nearest first: `y` the distance of the crest, `h` its height above the valley floor at the highest, `w`
 * how deep the range is front to back, `lx` the length of its peaks (m) along the crest.
 */
const RANGES = [
  { y: 2300, h: 1100, w: 650, lx: 1500 },
  { y: 4300, h: 1450, w: 1100, lx: 2500 },
  { y: 7600, h: 2000, w: 1900, lx: 3800 },
  { y: 13000, h: 3100, w: 3000, lx: 5800 },
  { y: 21000, h: 3700, w: 4400, lx: 8000 },
  { y: 33000, h: 3500, w: 6500, lx: 10500 },
];

/**
 * The height of the country: a valley floor rising gently with distance, and on it the ranges, each a ridge across the
 * view at its own distance, cut into peaks, arêtes and cols by ridged multifractal noise. Between the ranges the
 * ground falls back to the floor, and the fog lies there. The domain is warped a little so no range runs dead straight.
 */
// The warp and each range's wander and swell are slow noise, sampled millions of times while the plate is built, so
// they are tabulated once on a coarse grid and read back bilinearly.
const X0 = -30000;
const X1 = 30000;
const Y1 = 46000;
const STEP = 100;
const NX = (X1 - X0) / STEP + 1;
const NY = Y1 / STEP + 1;
const lerp2 = (tab, k, fx, fy, nx) => {
  const i = Math.min(nx - 2, Math.max(0, Math.floor(fx)));
  const j = Math.floor(fy);
  const a = fx - i;
  const b = fy - j;
  const o = (j * nx + i) * k;
  return (c) => (tab[o + c] * (1 - a) + tab[o + k + c] * a) * (1 - b) + (tab[o + nx * k + c] * (1 - a) + tab[o + nx * k + k + c] * a) * b;
};
const WARP = (() => {
  const t = new Float32Array(NX * NY * 2);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const x = X0 + i * STEP;
      const y = j * STEP;
      t[(j * NX + i) * 2] = 900 * (M.fbm(x / 5000, y / 5000, { octaves: 2, seed: 2 }) - 0.5);
      t[(j * NX + i) * 2 + 1] = 500 * (M.fbm(x / 4000, y / 4000, { octaves: 2, seed: 5 }) - 0.5);
    }
  }
  return t;
})();
const RIDGE = RANGES.map((r, k) =>
  Float32Array.from({ length: NX * 2 }, (_, q) => {
    const x = X0 + (q >> 1) * STEP;
    return q & 1 ? 0.6 + 0.6 * M.fbm(x / (4 * r.lx), k * 3, { octaves: 2, seed: 40 + k }) : 0.25 * r.w * (M.fbm(x / (2 * r.lx), k, { octaves: 2, seed: 30 + k }) - 0.5);
  }),
);

/**
 * The height of the country: a valley floor rising gently with distance, and on it the ranges, each a ridge across the
 * view at its own distance, cut into peaks, arêtes and cols by ridged multifractal noise. Between the ranges the
 * ground falls back to the floor, and the fog lies there. The domain is warped a little so no range runs dead straight.
 */
export const heightAt = (x, y) => {
  const fx = Math.min(NX - 1.001, Math.max(0, (x - X0) / STEP));
  const fy = Math.min(NY - 1.001, Math.max(0, y / STEP));
  const warp = lerp2(WARP, 2, fx, fy, NX);
  const wx = x + warp(0);
  const wy = y + warp(1);
  const i = Math.min(NX - 2, Math.floor(fx));
  const a = fx - i;
  let z = 300 + 400 * I.smoothstep(2000, 30000, y);
  for (let k = 0; k < RANGES.length; k++) {
    const r = RANGES[k];
    const t = RIDGE[k];
    const wander = t[i * 2] * (1 - a) + t[i * 2 + 2] * a;
    const dy = (wy - r.y + wander) / r.w;
    if (Math.abs(dy) > 2.5) continue;
    const massif = t[i * 2 + 1] * (1 - a) + t[i * 2 + 3] * a;
    const ridge = Math.exp(-dy * dy * 2.2);
    const peaks = 0.25 + 0.85 * ridgedMF(wx / r.lx + 17 * k, wy / (0.6 * r.lx) + 5 * k);
    z += r.h * ridge * peaks * massif;
  }
  return z;
};

// The country in bands of distance, each a fan of the view so its cells stay about the same size on the plate.
const BANDS = [1200, 2200, 3600, 5800, 9500, 15500, 25000, 45000];
const SPREAD = 0.62;
const bandAt = (k) => (u, v) => {
  const y = BANDS[k] + (BANDS[k + 1] - BANDS[k]) * v;
  const x = (2 * u - 1) * SPREAD * y;
  return [x, y, heightAt(x, y)];
};
const MESH = [760, 56];
const surfaces = (fine) => BANDS.slice(0, -1).map((_, k) => I.patch({ at: bandAt(k), nu: fine ? MESH[0] : 320, nv: fine ? MESH[1] : 40 }));

/** The sun for v from 0 (late afternoon) to 1 (the last light on the summits): low on the left, a little behind the eye. */
export const sunAt = (v) => {
  const bearing = -104 + 8 * v;
  const altitude = 20 - 19.2 * v;
  const b = bearing * I.deg;
  const a = altitude * I.deg;
  return { bearing, altitude, light: [Math.sin(b) * Math.cos(a), Math.cos(b) * Math.cos(a), Math.sin(a)] };
};

const DEPTH = 1000;
const camera = () =>
  I.perspective({ eye: EYE, target: [EYE[0], DEPTH, EYE[2]], scale: FOCAL / DEPTH, offset: [WIDTH / 2, HORIZON], width: WIDTH, height: HEIGHT });

export const OPTICS = { soft: 2.5, bloom: 0.3, grain: 0.55 };

export const scene = ({ res = 2 } = {}) => {
  const cam = camera();
  const fine = surfaces(true);
  const G = M.gbuffer(fine, cam, { res, mesh: () => MESH });
  const W = G.w;
  const H = G.h;
  // The fog lies in the valleys: thick on the floor, thinning over a few hundred metres, with a faint haze above.
  const fog = M.heightFog({ eye: EYE, density: 0.0008, height: 300, floor: 350, haze: 0.000012, start: 1500 });
  // Everything but the light, once per cell, in flat arrays (a plate has a million and a half cells): the view ray's
  // direction, how much of the cell the fog lets through, and what covers it: snow, forest or bare rock, with grit.
  const n = W * H;
  const AZ = new Float32Array(n);
  const EL = new Float32Array(n);
  const FOG = new Float32Array(n);
  const SNOW = new Float32Array(n);
  const WOOD = new Float32Array(n);
  const GRIT = new Float32Array(n);
  const AIR = new Float32Array(n);
  const far = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % W;
    const y = (i - x) / W;
    let d;
    if (G.id[i] < 0) {
      d = M.ray(cam, res, x + 0.5, y + 0.5);
      far[i] = 1;
    } else {
      const p = [G.p[i * 3], G.p[i * 3 + 1], G.p[i * 3 + 2]];
      const nz = G.n[i * 3 + 2];
      // Ragged edges to the snow and the trees, and snow only where the slope can hold it.
      const ragged = M.fbm(p[0] / 260, p[1] / 260, { octaves: 3, seed: 3 }) - 0.5;
      SNOW[i] = I.smoothstep(SNOWLINE - 120, SNOWLINE + 120, p[2] + 500 * ragged) * I.smoothstep(0.38, 0.58, nz);
      WOOD[i] = (1 - I.smoothstep(TREELINE - 100, TREELINE + 100, p[2] + 300 * ragged)) * I.smoothstep(0.55, 0.75, nz);
      GRIT[i] = M.noise(p[0] / 35, p[1] / 35 + p[2] / 35, 7) - 0.5;
      FOG[i] = fog.through(p, 0.6 + 0.8 * M.fbm(p[0] / 3000, p[1] / 2000, { octaves: 2, seed: 21 }));
      d = I.unit(I.sub(p, EYE));
      // Aerial perspective: each range farther back is paler, whatever the fog does.
      AIR[i] = 1 - Math.exp(-Math.max(0, p[1] - 2500) / 30000);
      far[i] = 1 - Math.exp(-p[1] / 14000);
    }
    AZ[i] = Math.atan2(d[0], d[1]);
    EL[i] = Math.asin(d[2]);
  }
  // Two shadow maps: the near bands need a finer one than the whole country can have.
  const coarse = surfaces(false);
  return {
    cam, G, W, H, res, AZ, EL, FOG, SNOW, WOOD, GRIT, AIR, far,
    near: I.trianglesOf(coarse.slice(0, 4)),
    all: I.trianglesOf(coarse),
    grain: M.grain(W, H, { seed: 9, clump: 0.25, size: 2, soft: 0.4 }),
  };
};

/** The sky's tone toward a direction: dark overhead, pale toward the horizon, a little paler toward the sun. */
const skyTone = (d, L) => {
  const up = I.smoothstep(-0.01, 0.38, d[2]);
  const near = Math.max(0, I.dot(d, L));
  return Math.max(0, (0.1 + 0.8 * up ** 0.85) * (1 - 0.3 * near ** 4));
};

/** The tone of every cell for the sun at v, softened by the air, printed through the grain. A negative plate inks the light. */
export const inkAt = (S, v, { negative = false, size = 1024, optics = OPTICS } = {}) => {
  const { light } = sunAt(v);
  const L = I.unit(light);
  const nearMap = I.shadowMap(null, L, { size, tris: S.near, soft: 1.4 });
  const allMap = I.shadowMap(null, L, { size, tris: S.all, soft: 1.4 });
  const { W, H, G, AZ, EL, FOG, SNOW, WOOD, GRIT, AIR, res } = S;
  // The fog takes the sky's tone just above the horizon: one per column.
  const mists = Float32Array.from({ length: W }, (_, x) => 0.85 * skyTone(I.unit([((x + 0.5) / res - WIDTH / 2) / FOCAL, 1, 0.01]), L));
  const tone = new Float32Array(W * H);
  const d = [0, 0, 0];
  const p = [0, 0, 0];
  const nn = [0, 0, 0];
  for (let i = 0; i < tone.length; i++) {
    const k = G.id[i];
    if (k < 0) {
      const ce = Math.cos(EL[i]);
      d[0] = ce * Math.sin(AZ[i]);
      d[1] = ce * Math.cos(AZ[i]);
      d[2] = Math.sin(EL[i]);
      tone[i] = skyTone(d, L);
      continue;
    }
    for (let c = 0; c < 3; c++) {
      p[c] = G.p[i * 3 + c];
      nn[c] = G.n[i * 3 + c];
    }
    const l = I.dot(nn, L);
    const lit = l > 0 ? (k < 4 ? nearMap : allMap).lit(p, nn) : 0;
    // Grazing evening light: the faces turned to the sun catch it, the rest is in shade. Snow takes the light
    // brightest and keeps some sky in its shadows; forest swallows most of it; rock is in between, with grit.
    const sun = Math.max(0, l) * lit;
    const sky = Math.max(0, nn[2]);
    const rock = 0.04 + Math.min(0.8, 1.1 * sun) + 0.06 * sky + 0.08 * GRIT[i];
    const snow = 0.2 + 0.8 * Math.min(1, 1.6 * sun) + 0.12 * sky;
    const wood = 0.02 + Math.min(0.4, 0.5 * sun) + 0.06 * GRIT[i];
    const level = rock + (snow - rock) * SNOW[i] + (wood - rock) * WOOD[i];
    const mist = mists[i % W];
    const t = 1 - level + (mist - (1 - level)) * AIR[i] * 0.7;
    tone[i] = t * FOG[i] + mist * (1 - FOG[i]);
  }
  let out = tone;
  // The air softens what is far: the last ranges lose their edges, the nearest keeps them.
  if (optics.soft) out = M.soften(out, W, H, S.far, optics.soft * res);
  if (optics.bloom) out = M.bloom(out, W, H, { threshold: 0.82, r: 8 * res, strength: optics.bloom });
  if (negative) for (let i = 0; i < out.length; i++) out[i] = 1 - out[i];
  return M.film(out, S.grain, { amount: optics.grain });
};
