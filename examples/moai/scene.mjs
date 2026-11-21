import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// Ahu Tongariki on Rapa Nui at sunrise on the summer solstice, printed as a mezzotint.
// World units are metres: x east, y north, z up, the grass at z = 0 and the sea at z = -6. Fifteen moai, 5.6 to
// 8.7 m tall, stand in a row on a 100 m stone platform (ahu) with their backs to the sea, facing inland to the
// north-west; one wears its red topknot (pukao). The eye stands on the grass in front of them, a little to one side,
// so the row runs away into the light. On 21 December at 27.1° S the sun rises at a bearing of about 116°, out of the
// sea behind the statues: their faces stay in shadow, the low light rims their heads and shoulders, their shadows run
// across the grass toward the eye, the beams fan out through the gaps, and a glitter path lies on the sea. One moai
// lies toppled face-down in the grass, and one person stands by the platform for scale.

export const WIDTH = 760;
export const HEIGHT = 430;
export const RES = 2;

export const LATITUDE = -27.1;
export const DECLINATION = -23.44;

const deg = I.deg;
const BACK = [Math.sin(125 * deg), Math.cos(125 * deg), 0];
const ROW = [Math.sin(35 * deg), Math.cos(35 * deg), 0];
const FACE = I.mul(BACK, -1);
const SEA = -6;
const AHU = { length: 100, depth: 7, height: 2.2 };
const HEIGHTS = [5.6, 6.2, 7.0, 6.5, 7.8, 6.8, 8.2, 8.7, 7.3, 6.9, 7.6, 6.4, 7.1, 5.9, 6.6];
const PUKAO = 4;
const EYE = I.add(I.add(I.mul(BACK, -30), I.mul(ROW, -34)), [0, 0, 1.2]);

const at2 = (o, r, f, X, Y, Z) => [o[0] + r[0] * X + f[0] * Y, o[1] + r[1] * X + f[1] * Y, o[2] + Z];
const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));

/** The sun at a solar time in hours: altitude and bearing in degrees, and its direction. */
export const sunAt = (hours) => {
  const phi = LATITUDE * deg;
  const dec = DECLINATION * deg;
  const ha = (hours - 12) * 15 * deg;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const cosA = (Math.sin(dec) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
  const az = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const bearing = (ha > 0 ? I.TAU - az : az) / deg;
  return { altitude: alt / deg, bearing, light: I.sunDirection(bearing, alt / deg) };
};

/** A patch whose normals point away from `inside`. */
const outward = (at, inside, opts) => {
  const [p, n] = I.patch({ at, nu: 2, nv: 2 }).point(0.5, 0.5);
  return I.patch({ at, side: I.dot(n, I.sub(p, inside)) < 0 ? -1 : 1, ...opts });
};

/**
 * A moai in its own frame, in units of its height: X across, Y forward (the face), Z up. Each level is a rounded box
 * (a superellipse), the torso broad and shallow, the head narrower and deep; the face is carved onto the front of the
 * head as bumps in height t from the chin: the jutting chin, pursed lips, the long nose with its sharp tip, deep eye
 * sockets under the heavy brow, and the forehead sloping back. Long ears stand out at the sides.
 */
const moaiShape = (u, v, seed) => {
  const th = u * I.TAU;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const n = 3.2;
  const sx = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
  const sy = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
  const head = I.smoothstep(0.42, 0.48, v);
  const t = Math.max(0, (v - 0.45) / 0.55);
  const jitter = 1 + 0.06 * (M.hash(seed, 1) - 0.5);
  // Torso widest at the shoulders and cut off at the hips; the head narrower than the shoulders but deeper.
  // Squat and massive, as at Tongariki: shoulders about 0.42 of the height across, the head nearly as wide (0.34)
  // and deeper than the body, the body cut off at the hips.
  let a = (1 - head) * (0.19 + 0.02 * (v / 0.45)) + head * (0.16 - 0.01 * t);
  let b = (1 - head) * (0.11 + 0.01 * (v / 0.45)) + head * (0.14 - 0.02 * t);
  a *= jitter;
  if (v > 0.965) {
    const k = Math.sqrt(Math.max(0, 1 - ((v - 0.965) / 0.035) ** 2));
    a *= k;
    b *= k;
  }
  let X = a * sx;
  // The face leans back as it rises, so the moai looks a little up.
  let Y = b * sy - head * 0.03 * t;
  // The face, on the front of the head only.
  const front = I.smoothstep(0.25, 0.85, s) * head;
  if (front > 0) {
    const xn = Math.min(1, Math.abs(X) / (a || 1));
    const nose = I.smoothstep(0.215, 0.27, t) * (1 - I.smoothstep(0.6, 0.66, t)) * (0.1 - 0.07 * Math.max(0, (t - 0.27) / 0.35));
    const noseW = 0.034 + 0.022 * (1 - Math.min(1, Math.max(0, (t - 0.27) / 0.35)));
    const F =
      0.075 * bump(t, 0.05, 0.06) * (1 - xn ** 4) +
      0.024 * bump(t, 0.155, 0.03) * Math.exp(-((X / 0.05) ** 2)) +
      nose * Math.exp(-((X / noseW) ** 2)) +
      0.075 * bump(t, 0.665, 0.045) * (1 - xn ** 6) -
      0.045 * bump(t, 0.585, 0.045) * Math.exp(-(((Math.abs(X) - 0.062) / 0.03) ** 2)) +
      0.014 * bump(v, 0.2, 0.12) * (1 - head);
    Y += front * F;
  }
  // Long ears down the sides of the head.
  const side = I.smoothstep(0.82, 0.98, Math.abs(c)) * head * I.smoothstep(0.26, 0.32, t) * (1 - I.smoothstep(0.62, 0.7, t));
  X += Math.sign(c) * 0.018 * side;
  return [X, Y, v];
};

/** A moai standing at `foot` facing `face`, `H` metres tall, leaning a little. */
const moai = (foot, H, face, seed, lean = 0) => {
  const right = [face[1], -face[0], 0];
  const centre = [foot[0], foot[1], foot[2] + H * 0.5];
  const at = (u, v) => {
    const [X, Y, Z] = moaiShape(u, v, seed);
    const z = Z * H;
    const y = Y * H + lean * z;
    return at2(foot, right, face, X * H, y, z);
  };
  return outward(at, centre, { nu: 20, nv: 30 });
};

/** A moai toppled face-down in the grass, its head toward `toward`. */
const fallen = (centre, H, toward, seed) => {
  const right = [toward[1], -toward[0], 0];
  const at = (u, v) => {
    const [X, Y, Z] = moaiShape(u, v, seed);
    const along = (Z - 0.5) * H;
    return [centre[0] + toward[0] * along + right[0] * X * H, centre[1] + toward[1] * along + right[1] * X * H, 0.06 * H + Y * H * 0.95];
  };
  return outward(at, [centre[0], centre[1], 0.6], { nu: 20, nv: 30 });
};

const rock = ([x, y], r, seed) =>
  I.patch({
    at: (u, v) => {
      const lon = u * I.TAU;
      const lat = (v - 0.5) * Math.PI;
      const k = r * (0.8 + 0.45 * M.noise(Math.cos(lon) * 1.6 + 3, Math.sin(lon) * 1.6 + lat * 1.2, seed));
      return [x + k * Math.cos(lat) * Math.cos(lon) * 1.3, y + k * Math.cos(lat) * Math.sin(lon), -0.25 * r + 0.6 * k * Math.sin(lat)];
    },
    nu: 16,
    nv: 8,
  });

const person = (foot) =>
  I.lathe({ base: foot, profile: [[0, 0.16, 1], [0.8, 0.15], [0.95, 0.2], [1.35, 0.23], [1.45, 0.21], [1.5, 0.08, 1], [1.56, 0.1], [1.68, 0.11], [1.78, 0, 1]] });

export const scene = ({ res = RES } = {}) => {
  // The eye looks toward bearing 106°, just left of where the sun comes up among the nearest statues.
  const target = I.add(EYE, [Math.sin(106 * deg) * 50, Math.cos(106 * deg) * 50, 1.2]);
  const cam = I.perspective({ eye: EYE, target, scale: 7.6, offset: [WIDTH * 0.47, HEIGHT * 0.7], width: WIDTH, height: HEIGHT });
  const fog = M.heightFog({ eye: EYE, density: 0.012, height: 4, floor: SEA, haze: 0.0011, start: 40 });

  // The platform and its statues.
  const corner = (r, b) => I.add(I.mul(ROW, (r * AHU.length) / 2), I.mul(BACK, (b * AHU.depth) / 2));
  const ahu = I.prism({ outline: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], extrude: [0, 0, AHU.height] });
  const ramp = I.prism({ outline: [corner(-1.02, -1.9), corner(1.02, -1.9), corner(1.02, -1), corner(-1.02, -1)], extrude: [0, 0, 0.35] });
  const statues = HEIGHTS.map((H, i) => {
    const foot = I.add(I.mul(ROW, (i - 7) * 6.3), I.add(I.mul(BACK, 0.4), [0, 0, AHU.height]));
    return moai(foot, H, FACE, i + 1, 0.015 * (M.hash(i, 3) - 0.5));
  });
  const topH = HEIGHTS[PUKAO];
  const pukaoFoot = I.add(I.add(I.mul(ROW, (PUKAO - 7) * 6.3), I.mul(BACK, 0.4 + 0.03 * topH)), [0, 0, AHU.height + topH * 0.985]);
  const pukao = I.lathe({ base: pukaoFoot, profile: [[0, 0.95, 1], [0.1, 1.05], [1.15, 1.0], [1.3, 0.85], [1.38, 0, 1]] });
  const toppled = fallen(I.add(I.mul(FACE, 13), I.mul(ROW, -27)), 7.2, I.unit(I.add(ROW, I.mul(FACE, -0.5))), 31);
  const visitor = person(I.add(I.mul(FACE, 7), I.mul(ROW, -6)));
  const stones = [
    [I.add(I.mul(FACE, 25), I.mul(ROW, -8)), 0.9, 1], [I.add(I.mul(FACE, 33), I.mul(ROW, 4)), 0.6, 2], [I.add(I.mul(FACE, 14), I.mul(ROW, -30)), 1.1, 3],
    [I.add(I.mul(FACE, 38), I.mul(ROW, -24)), 0.7, 4], [I.add(I.mul(FACE, 20), I.mul(ROW, 40)), 1.2, 5], [I.add(I.mul(FACE, 30), I.mul(ROW, 26)), 0.5, 6],
  ].map(([p, r, s]) => rock(p, r, s));

  // The grass, laid out in front of the eye, falling away to the sea behind the platform; and the sea.
  const fwd = I.unit([-cam.view[0], -cam.view[1], 0]);
  const side = I.unit([cam.right[0], cam.right[1], 0]);
  const laid = (near, far, z) =>
    I.patch({
      at: (u, v) => {
        const d = near * Math.pow(far / near, v);
        const s = (u - 0.5) * 5 * d;
        const x = EYE[0] + fwd[0] * d + side[0] * s;
        const y = EYE[1] + fwd[1] * d + side[1] * s;
        return [x, y, z(x, y)];
      },
      nu: 4,
      nv: 4,
    });
  const grass = laid(3, 4000, (x, y) => {
    const back = x * BACK[0] + y * BACK[1];
    const along = Math.abs(x * ROW[0] + y * ROW[1]);
    const flat = I.smoothstep(4, 14, Math.max(Math.abs(back) - AHU.depth / 2, along - AHU.length / 2));
    return 0.5 * flat * (M.fbm(x / 30, y / 30, { octaves: 3, seed: 2 }) - 0.4) - 14 * I.smoothstep(12, 45, back);
  });
  const sea = laid(3, 6000, () => SEA);

  const solids = [grass, sea, ahu[0], ...ahu.slice(1), ...ramp, ...statues, pukao, toppled, visitor, ...stones];
  const kinds = {
    grass: { base: 0.62, grit: 0.32 },
    tuff: { base: 0.55, grit: 0.16 },
    wall: { base: 0.62, grit: 0.22 },
    scoria: { base: 0.72, grit: 0.1 },
    cloth: { base: 0.82, grit: 0 },
  };
  const kindOf = (s) =>
    s === grass ? kinds.grass : statues.includes(s) || s === toppled ? kinds.tuff : s === pukao ? kinds.scoria : s === visitor ? kinds.cloth : kinds.wall;
  const mesh = (s) => (s === grass || s === sea ? [4, 8] : s.normal ? [1, 1] : statues.includes(s) || s === toppled ? [64, 120] : [32, 16]);
  const D = M.gbuffer(solids, cam, { res, mesh });

  const W = D.w;
  const H = D.h;
  const horizon = cam.project(I.add(EYE, I.mul(fwd, 1e6)))[1] * res;
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
        cells[i] = { kind: 0, d, h, low, t: I.smoothstep(-0.003, 0.05, d[2]) };
        continue;
      }
      const p = pt(D.p, i);
      const t = fog.through(p);
      if (solids[k] !== sea) {
        const m = kindOf(solids[k]);
        const grit = m.grit * (M.fbm(p[0] * 1.3, p[1] * 1.3 + p[2] * 1.3, { octaves: 3, seed: 11 }) - 0.5);
        cells[i] = { kind: 1, d, h, t, p, n: pt(D.n, i), m, grit };
        continue;
      }
      // The sea: the sky in it, and facets of the swell that flash with the sun (short dashes, so a flash reads as
      // a glint, not as one more speck of grain).
      const near01 = Math.max(0, (y - horizon) / (H - horizon));
      const cos = Math.max(0, -d[2]);
      const F = 0.02 + 0.98 * Math.pow(1 - cos, 5);
      const rd = [d[0], d[1], -d[2]];
      const fx = Math.floor(x / (4 * res) + 0.5 * (Math.floor(y / res) % 2));
      const fy = Math.floor(y / res);
      const tip = [0.04 * (M.hash(fx, fy, 41) - 0.5), 0, 0.3 * (M.hash(fx, fy, 43) - 0.5) * (0.4 + near01)];
      cells[i] = { kind: 2, d, h, low, t, F, rd, glint: I.unit(I.add(rd, tip)), ts: I.smoothstep(-0.003, 0.05, rd[2]) };
    }
  }
  const wet = new Float32Array(W * H);
  cells.forEach((c, i) => (wet[i] = c.kind === 2 ? 1 : 0));
  const casters = [...ahu, ...statues, pukao, toppled, visitor, ...stones];
  return { cam, W, H, res, cells, wet, tris: I.trianglesOf(casters), grains: new Map() };
};

/**
 * Light, sky and mist at a solar time. The glow and the mist depend only on a ray's angle to the sun, so each frame
 * tabulates them once and every cell looks its value up.
 */
const GLOW = 4096;
const MIST = 1024;
const dawnAt = (hours) => {
  const sun = sunAt(hours);
  const L = sun.light;
  const dawn = I.smoothstep(-7, 4, sun.altitude);
  const direct = I.smoothstep(-0.4, 2.5, sun.altitude);
  const glow = new Float32Array(GLOW + 1);
  for (let k = 0; k <= GLOW; k++) {
    const a = 2 * Math.asin(k / GLOW);
    const g = (0.2 + 0.8 * dawn) * (0.5 * Math.exp(-((a / 0.6) ** 2)) + 0.4 * Math.exp(-((a / 0.14) ** 2)));
    glow[k] = 0.34 * g + direct * I.smoothstep(0.0125, 0.0085, a);
  }
  const level = 0.4 + 0.18 * dawn;
  const sky = (d, low) => {
    const c = d[0] * L[0] + d[1] * L[1] + d[2] * L[2];
    return Math.max(0, 0.92 - level * low - glow[Math.round(Math.sqrt(Math.max(0, (1 - c) / 2)) * GLOW)]);
  };
  const flat = I.unit([L[0], L[1], 0]);
  const haze = new Float32Array(MIST + 1);
  for (let k = 0; k <= MIST; k++) haze[k] = Math.max(0.04, 0.5 - 0.3 * dawn - 0.24 * dawn * Math.exp(-(2 - (2 * k) / MIST) / 0.1));
  const mist = (h) => haze[Math.round(((h[0] * flat[0] + h[1] * flat[1] + 1) / 2) * MIST)];
  return { sun, L, dawn, direct, sky, mist };
};

/**
 * The optics the plate is printed with (0 turns one off): `rays` is how strongly the beams fan out through the gaps,
 * `bloom` how much bright light glows into the dark, `streak` blurs the sea's light down the swell (viewBox px), and
 * `soft` rounds the grain (0..1).
 */
export const OPTICS = { rays: 1.5, bloom: 0.55, streak: 3, soft: 0.4 };

/** The tone of every cell at a solar time, through the optics, printed as film grain. A negative plate inks the light. */
export const inkAt = (S, hours, { size = 1024, negative = false, optics = OPTICS } = {}) => {
  const { L, dawn, direct, sky, mist } = dawnAt(hours);
  const shadow = direct > 0 ? I.shadowMap(null, L, { size, tris: S.tris, soft: 1.4 }) : null;
  const amb = 0.07 + 0.26 * dawn;
  const flat = I.unit([L[0], L[1], 0]);
  // Lit faces, and the rim: where a surface turns edge-on to the eye with the sun behind it, the low light catches it.
  const shade = (c) => {
    const n = c.n;
    const l = I.dot(n, L);
    const lit = l > 0 && direct > 0 ? l * direct * shadow.lit(c.p, n) : 0;
    const edge = 1 - Math.abs(I.dot(n, c.d));
    const rim = direct * edge * edge * edge * Math.max(0, n[0] * flat[0] + n[1] * flat[1]) * (l > -0.05 && shadow ? shadow.lit(c.p, n) : 0);
    const level = amb + 0.1 * dawn * Math.max(0, n[2]) + (1 - amb) * (0.9 * lit + 0.9 * rim);
    return Math.min(1, Math.max(0, 1 - Math.min(1, level) * (1 - c.m.base) + c.grit));
  };
  const W = S.W;
  const H = S.H;
  const tone = new Float32Array(W * H);
  const glints = new Float32Array(W * H);
  for (let i = 0; i < tone.length; i++) {
    const c = S.cells[i];
    const fogInk = mist(c.h);
    if (c.kind === 0) tone[i] = sky(c.d, c.low) * c.t + fogInk * (1 - c.t);
    else if (c.kind === 1) tone[i] = shade(c) * c.t + fogInk * (1 - c.t);
    else {
      const r = sky(c.rd, c.low) * c.ts + fogInk * (1 - c.ts);
      const off = 1 - (c.glint[0] * L[0] + c.glint[1] * L[1] + c.glint[2] * L[2]);
      glints[i] = direct && off < 0.001 ? 1.3 * direct * Math.exp(-off / 0.00009) * c.t : 0;
      tone[i] = (c.F * r + (1 - c.F) * 0.75) * c.t + fogInk * (1 - c.t);
    }
  }
  const res = S.res;
  let out = tone;
  if (optics.streak) out = M.soften(out, W, H, S.wet, 0, optics.streak * res);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, out[i] - glints[i]);
  if (optics.bloom) out = M.bloom(out, W, H, { threshold: 0.8, r: 8 * res, strength: optics.bloom });
  if (optics.rays) {
    const toward = I.add(S.cam.eye, I.mul(L, 1e6));
    if (I.dot(L, S.cam.view) < 0) {
      const [x, y] = S.cam.project(toward);
      out = M.shafts(out, W, H, { x: x * res, y: y * res, strength: optics.rays * (0.3 + 0.7 * dawn), threshold: 0.8, samples: 72, reach: 1, decay: 0.985 });
    }
  }
  if (negative) for (let i = 0; i < out.length; i++) out[i] = 1 - out[i];
  const key = optics.soft ?? 0;
  if (!S.grains.has(key)) S.grains.set(key, M.grain(W, H, { seed: 12, clump: 0.25, size: 2, soft: key }));
  return M.film(out, S.grains.get(key), { amount: 0.75 });
};
