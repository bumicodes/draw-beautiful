import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// A torii standing in a still bay at dawn, printed as a mezzotint.
// World units are metres: x east, y north, z up, the water at z = 0. The gate is a ryōbu torii at about the
// proportions of Itsukushima's: two main pillars 10.9 m apart, each braced fore and aft by a pair of lower legs, the
// tie beam (nuki) through them, and the two-part lintel (shimaki under kasagi) 24 m long with its ends swept up,
// 16.6 m above the water. It stands 75 m out from the eye, which looks north-east over the water toward ridges lost in
// haze. The sun follows Miyajima's sky (34.3° N) in late May, rising a little north of east. Mist lies on the water,
// so the gate's feet and its reflection go under while the lintel stands clear. The water is a mirror: a second
// G-buffer renders the scene reflected in z = 0, and each water cell looks up what it reflects through the ripples,
// through the mist twice (up to the gate and back to the eye).

export const WIDTH = 720;
export const HEIGHT = 480;
export const RES = 2;

export const LATITUDE = 34.3;
export const DECLINATION = 21;

const EYE = [-53, -53, 2.0];
const YAW = -25 * I.deg;
const SPAN = 10.9 / 2;
const LEG = 3.1;

const range = (n) => Array.from({ length: n }, (_, i) => i);

/** The sun at a solar time in hours: altitude and bearing in degrees, and its direction. */
export const sunAt = (hours) => {
  const phi = LATITUDE * I.deg;
  const dec = DECLINATION * I.deg;
  const ha = (hours - 12) * 15 * I.deg;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const cosA = (Math.sin(dec) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
  const az = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const bearing = (ha > 0 ? I.TAU - az : az) / I.deg;
  return { altitude: alt / I.deg, bearing, light: I.sunDirection(bearing, alt / I.deg) };
};

// The gate is built in its own frame (x along the lintel, y through it, z up) and turned to face the eye.
const G = ([x, y, z]) => [x * Math.cos(YAW) - y * Math.sin(YAW), x * Math.sin(YAW) + y * Math.cos(YAW), z];

/** A patch whose normals point away from `inside`. */
const outward = (at, inside, opts = {}) => {
  const probe = I.patch({ at, nu: 2, nv: 2 });
  const [p, n] = probe.point(0.5, 0.5);
  return I.patch({ at, side: I.dot(n, I.sub(p, inside)) < 0 ? -1 : 1, ...opts });
};

/**
 * A squared timber from x0 to x1, y0 to y1, z0 to z1 in the gate's frame, its whole length swept up by
 * lift(x) = rise·(x / half)^4: the sori of a torii's lintel, flat in the middle and turning up at the ends.
 */
const beam = ({ x0, x1, y0, y1, z0, z1, rise = 0 }) => {
  const half = Math.max(Math.abs(x0), Math.abs(x1));
  const lift = (x) => rise * Math.pow(x / half, 4);
  const X = (u) => x0 + (x1 - x0) * u;
  const mid = G([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2 + rise * 0.1]);
  // Coarse triangles are enough for shadows; the G-buffer meshes each surface finely on its own.
  const side = (fn) => outward((u, v) => G(fn(X(u), v)), mid, { nu: 24, nv: 1 });
  const end = (x) =>
    I.face({ points: [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map(([a, b, c]) => G([a, b, c + lift(x)])), along: [0, 0, 1], outward: I.sub(G([x, 0, 0]), G([0, 0, 0])) });
  return [
    side((x, v) => [x, y0 + (y1 - y0) * v, z1 + lift(x)]),
    side((x, v) => [x, y0 + (y1 - y0) * v, z0 + lift(x)]),
    side((x, v) => [x, y0, z0 + (z1 - z0) * v + lift(x)]),
    side((x, v) => [x, y1, z0 + (z1 - z0) * v + lift(x)]),
    end(x0),
    end(x1),
  ];
};

const block = (min, max) => beam({ x0: min[0], x1: max[0], y0: min[1], y1: max[1], z0: min[2], z1: max[2] });

/** A round post from below the water to `top`, slightly tapered, with a capping ring. */
const post = (x, y, r, top) =>
  I.lathe({ base: G([x, y, -1.5]), profile: [[0, r, 1], [top + 1.5 - 0.5, r * 0.94], [top + 1.5 - 0.5, r * 1.08, 1], [top + 1.5, r * 1.08, 1], [top + 1.5, 0, 1]] });

export const scene = ({ res = RES } = {}) => {
  const target = [0, 0, EYE[2]];
  const cam = I.perspective({ eye: EYE, target, scale: 9.5, offset: [WIDTH * 0.46, HEIGHT * 0.47], width: WIDTH, height: HEIGHT });
  const fog = M.heightFog({ eye: EYE, density: 0.032, height: 1.4, haze: 0.0013, start: 22 });

  // The gate. Lacquer is vermilion, the lintel's top and the pillars' feet are black.
  const pillars = [-SPAN, SPAN].map((x) => post(x, 0, 0.62, 14.4));
  const legs = [-SPAN, SPAN].flatMap((x) => [-LEG, LEG].map((y) => post(x, y, 0.36, 9.2)));
  const braces = [-SPAN, SPAN].flatMap((x) => [
    ...block([x - 0.22, -LEG, 7.3], [x + 0.22, LEG, 7.8]),
    ...block([x - 0.22, -LEG, 3.2], [x + 0.22, LEG, 3.6]),
    ...beam({ x0: x - 0.6, x1: x + 0.6, y0: -LEG - 0.75, y1: LEG + 0.75, z0: 9.2, z1: 9.75 }),
  ]);
  const nuki = block([-8.4, -0.36, 10.5], [8.4, 0.36, 11.3]);
  const gakuzuka = block([-0.45, -0.28, 11.3], [0.45, 0.28, 14.4]);
  const gaku = block([-1.05, -0.62, 11.75], [1.05, -0.28, 13.95]);
  const shimaki = beam({ x0: -11.2, x1: 11.2, y0: -0.6, y1: 0.6, z0: 14.4, z1: 15.25, rise: 0.45 });
  const kasagi = beam({ x0: -12.1, x1: 12.1, y0: -0.9, y1: 0.9, z0: 15.25, z1: 16.6, rise: 1.0 });
  const lacquer = [...pillars, ...legs, ...braces, ...nuki, ...gakuzuka, ...shimaki];
  const black = [...gaku, ...kasagi];
  const gate = [...lacquer, ...black];

  // Ridges across the bay, one behind the other, for the haze to grade.
  const fwd = I.unit([-cam.view[0], -cam.view[1], 0]);
  const side = I.unit([cam.right[0], cam.right[1], 0]);
  const ridge = (d, h, seed) =>
    I.patch({
      at: (u, v) => {
        const s = (u - 0.5) * 2600;
        const top = h * (0.25 + 0.75 * M.fbm(s / 260 + seed, seed, { octaves: 4, seed }));
        const back = d + v * top * 1.6;
        return [EYE[0] + fwd[0] * back + side[0] * s, EYE[1] + fwd[1] * back + side[1] * s, v * top];
      },
      side: -1,
      nu: 128,
      nv: 6,
    });
  const ridges = [ridge(520, 34, 3), ridge(980, 62, 7), ridge(1700, 95, 11)];

  // The bay: laid out in front of the eye, rows spaced in distance so they fall evenly on screen.
  const near = 4;
  const far = 4000;
  const water = I.patch({
    at: (u, v) => {
      const d = near * Math.pow(far / near, v);
      const s = (u - 0.5) * 2.2 * d;
      return [EYE[0] + fwd[0] * d + side[0] * s, EYE[1] + fwd[1] * d + side[1] * s, 0];
    },
    nu: 4,
    nv: 4,
  });

  const solids = [water, ...gate, ...ridges];
  const mats = { lacquer: { base: 0.5 }, black: { base: 0.86 }, hill: { base: 0.5 } };
  const matOf = (s) => (lacquer.includes(s) ? mats.lacquer : black.includes(s) ? mats.black : mats.hill);
  const mesh = (s) => (s === water ? [4, 8] : s.normal ? [1, 1] : ridges.includes(s) ? [256, 6] : [48, 24]);
  const D = M.gbuffer(solids, cam, { res, mesh });
  const reflectable = solids.slice(1);
  const images = reflectable.map((s) => M.mirrored(s));
  const R = M.gbuffer(images, cam, { res, mesh: (m) => mesh(reflectable[images.indexOf(m)]) });

  // Everything the sun doesn't change, once, per cell: what it sees, the ray, how much the mist lets through, and
  // for water what it reflects (the mirror cell, nudged by the ripples), the Fresnel weight and the mist on the way.
  const W = D.w;
  const H = D.h;
  const horizon = cam.project(I.add(EYE, I.mul(fwd, 1e5)))[1] * res;
  const bank = (p) => 0.25 + 1.5 * M.fbm(p[0] / 90 + 4, p[1] / 40, { octaves: 3, seed: 31 });
  const pt = (buf, i) => [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]];
  const cells = new Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = M.ray(cam, res, x + 0.5, y + 0.5);
      const h = I.unit([d[0], d[1], 0]);
      const low = 1 - I.smoothstep(0, 0.45, Math.abs(d[2]));
      const k = D.id[i];
      if (k < 0) {
        cells[i] = { kind: 0, d, h, low, t: I.smoothstep(-0.004, 0.06, d[2]) };
        continue;
      }
      const p = pt(D.p, i);
      const t = fog.through(p, bank(p));
      if (solids[k] !== water) {
        cells[i] = { kind: 1, h, t, p, n: pt(D.n, i), mat: matOf(solids[k]) };
        continue;
      }
      // Ripples: long, low swells that shift the reflection up and down by a few cells, more near the eye.
      const near01 = Math.max(0, (y - horizon) / (H - horizon));
      const amp = res * (0.6 + 6 * near01 * near01);
      const dy = Math.round(amp * 2 * (M.fbm(x / (40 * res), y / (1.3 * res), { octaves: 2, seed: 5 }) - 0.5));
      const dx = Math.round(amp * 0.6 * (M.noise(x / (9 * res), y / (2 * res), 9) - 0.5));
      const j = Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx));
      const cos = Math.max(0, -d[2]);
      const F = 0.02 + 0.98 * Math.pow(1 - cos, 5);
      const rd = [d[0], d[1], -d[2]];
      // Each cell is also a tiny facet of the swell, tipped at random, that flashes when it mirrors the sun: the
      // glitter path. Tips run mostly up and down, as on long low waves.
      // A facet is a short horizontal dash of cells, so a flash reads as a glint and not as one more speck of grain.
      const fx = Math.floor(x / (4 * res) + 0.5 * (Math.floor(y / res) % 2));
      const fy = Math.floor(y / res);
      const tip = [0.03 * (M.hash(fx, fy, 41) - 0.5), 0, 0.32 * (M.hash(fx, fy, 43) - 0.5) * (0.35 + near01)];
      const cell = { kind: 2, h, low, t, F, rd, glint: I.unit(I.add(rd, tip)) };
      if (R.id[j] >= 0) {
        const m = pt(R.p, j);
        const q = [m[0], m[1], -m[2]];
        const nm = pt(R.n, j);
        cell.q = { p: q, n: [nm[0], nm[1], -nm[2]], mat: matOf(reflectable[R.id[j]]), t: fog.between(p, q, bank(p)) };
      } else cell.ts = I.smoothstep(-0.004, 0.06, rd[2]);
      cells[i] = cell;
    }
  }
  // How soft each cell goes: with the mist it looks through (the sky is smooth already), and the water's reflection
  // smeared down the swell.
  const haze = new Float32Array(W * H);
  const wet = new Float32Array(W * H);
  cells.forEach((c, i) => {
    haze[i] = c.kind === 0 ? 0.5 : Math.pow(1 - c.t, 2);
    wet[i] = c.kind === 2 ? 1 : 0;
  });
  return { cam, W, H, res, cells, haze, wet, tris: I.trianglesOf(gate), grains: new Map() };
};

/**
 * Light, sky and mist at a solar time. Before sunrise there is only the glow; the disc and direct light come up with
 * the sun. The glow and the mist depend only on a ray's angle to the sun, so each frame tabulates them once and every
 * cell looks its value up: no acos or exp per cell.
 */
const GLOW = 4096;
const MIST = 1024;
const dawnAt = (hours) => {
  const sun = sunAt(hours);
  const L = sun.light;
  const dawn = I.smoothstep(-7, 3, sun.altitude);
  const direct = I.smoothstep(-0.4, 2.5, sun.altitude);
  // Indexed by sin(a / 2) = sqrt((1 - cos a) / 2), which is nearly the angle itself near the sun, where the disc is.
  const glow = new Float32Array(GLOW + 1);
  for (let k = 0; k <= GLOW; k++) {
    const a = 2 * Math.asin(k / GLOW);
    const g = (0.2 + 0.8 * dawn) * (0.5 * Math.exp(-((a / 0.55) ** 2)) + 0.35 * Math.exp(-((a / 0.13) ** 2)));
    glow[k] = 0.3 * g + direct * I.smoothstep(0.012, 0.008, a);
  }
  const level = 0.38 + 0.18 * dawn;
  const sky = (d, low) => {
    const c = d[0] * L[0] + d[1] * L[1] + d[2] * L[2];
    return Math.max(0, 0.9 - level * low - glow[Math.round(Math.sqrt(Math.max(0, (1 - c) / 2)) * GLOW)]);
  };
  const flat = I.unit([L[0], L[1], 0]);
  const haze = new Float32Array(MIST + 1);
  for (let k = 0; k <= MIST; k++) haze[k] = Math.max(0.03, 0.5 - 0.32 * dawn - 0.22 * dawn * Math.exp(-(1 - (2 * k) / MIST + 1) / 0.08));
  const mist = (h) => haze[Math.round(((h[0] * flat[0] + h[1] * flat[1] + 1) / 2) * MIST)];
  return { L, dawn, direct, sky, mist };
};

/**
 * The optics the plate is printed with (0 turns one off): `haze` blurs what the mist thickens and `streak` the
 * reflection down the swell, in viewBox px; `bloom` is how much the bright light glows into the dark; `soft` rounds
 * the grain (0..1).
 */
export const OPTICS = { haze: 0, streak: 5, bloom: 0.6, soft: 0 };

/**
 * The tone of every cell at a solar time, through the optics, printed through the grain as film grain. A negative
 * plate inks the light.
 */
export const inkAt = (S, hours, { size = 1024, negative = false, optics = OPTICS } = {}) => {
  const { L, dawn, direct, sky, mist } = dawnAt(hours);
  const shadow = direct > 0 ? I.shadowMap(null, L, { size, tris: S.tris, soft: 1.5 }) : null;
  const amb = 0.08 + 0.3 * dawn;
  const shade = (p, n, mat) => {
    const l = I.dot(n, L);
    const lit = l > 0 && direct > 0 ? l * direct * shadow.lit(p, n) : 0;
    const level = amb + 0.12 * dawn * Math.max(0, n[2]) + (1 - amb) * 0.95 * lit;
    return 1 - Math.min(1, level) * (1 - mat.base);
  };
  const tone = new Float32Array(S.W * S.H);
  const glints = new Float32Array(S.W * S.H);
  for (let i = 0; i < tone.length; i++) {
    const c = S.cells[i];
    // A ray and its reflection share their bearing, so they see the same mist.
    const fogInk = mist(c.h);
    let v;
    if (c.kind === 0) v = sky(c.d, c.low) * c.t + fogInk * (1 - c.t);
    else if (c.kind === 1) v = shade(c.p, c.n, c.mat) * c.t + fogInk * (1 - c.t);
    else {
      const r = c.q ? shade(c.q.p, c.q.n, c.q.mat) * c.q.t + fogInk * (1 - c.q.t) : sky(c.rd, c.low) * c.ts + fogInk * (1 - c.ts);
      const off = 1 - (c.glint[0] * L[0] + c.glint[1] * L[1] + c.glint[2] * L[2]);
      const glint = direct && off < 0.001 ? 1.3 * direct * Math.exp(-off / 0.00008) : 0;
      v = (c.F * r + (1 - c.F) * 0.7) * c.t + fogInk * (1 - c.t);
      glints[i] = glint * c.t;
    }
    tone[i] = v;
  }
  const { W, H, res } = S;
  let out = tone;
  if (optics.haze) out = M.soften(out, W, H, S.haze, optics.haze * res);
  if (optics.streak) out = M.soften(out, W, H, S.wet, 0, optics.streak * res);
  // The glints go on after the streak, so they stay sharp flashes, and before the bloom, so they glow.
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, out[i] - glints[i]);
  if (optics.bloom) out = M.bloom(out, W, H, { threshold: 0.82, r: 9 * res, strength: optics.bloom });
  if (negative) for (let i = 0; i < out.length; i++) out[i] = 1 - out[i];
  // A soft grain is the same noise blurred a little and spread evenly again: finer specks merge into film-like clumps.
  const key = optics.soft ?? 0;
  if (!S.grains.has(key)) S.grains.set(key, M.grain(W, H, { seed: 8, clump: 0.25, size: 2, soft: key }));
  return M.film(out, S.grains.get(key), { amount: 0.75 });
};
