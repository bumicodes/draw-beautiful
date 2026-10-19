import * as I from "../../kit/intaglio.mjs";

// A lighthouse on a rock at night, engraved as a dark plate. The moon is low behind it on the right, so the tower,
// the keeper's cottage and the crags are rimmed with light and black toward us; the sea is ruled and cross-hatched,
// broken by the moon's glitter. The lamp turns two beams; where the night air lies in a beam it scatters the light,
// so every line whose sight passes through the beam is thinned, sky, sea and rock alike, and the beam cuts a bright
// wedge through the plate. Pointed at us, it flares round the lantern.
// World units: x right, y away, z up; the sea is z = 0.

export const WIDTH = 760;
export const HEIGHT = 540;

const range = (n) => Array.from({ length: n }, (_, i) => i);
const S = I.smoothstep;
const hash = (i, j = 0) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (x, y = 0) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const f = (t) => t * t * (3 - 2 * t);
  const fx = f(x - i);
  const fy = f(y - j);
  const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * fx;
  const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * fx;
  return a + (b - a) * fy;
};
const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1 + 7, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3 + 3) * 0.15;

const ROCK = { x: -40, y: 40 };
const BASE = 46;
const LAMP = [ROCK.x, ROCK.y, BASE + 112];
const MOON = I.unit([0.55, 0.75, 0.38]);

/** The crag: a ridge of rock rising from the sea, flattened where the tower stands. */
const rockAt = (x, y) => {
  const dx = (x - ROCK.x) / 150;
  const dy = (y - ROCK.y) / 90;
  const r = Math.hypot(dx * 0.9, dy);
  const body = Math.max(0, 1 - r) ** 1.4;
  const crags = 0.5 + 0.9 * (fbm(x / 26, y / 26) - 0.5) + 0.25 * Math.abs(Math.sin(x / 11 + 2 * noise(y / 30)));
  const z = 62 * body * crags + 14 * Math.max(0, 1 - Math.hypot((x + 150) / 60, (y - 10) / 40)) ** 1.2 * crags;
  const pad = 1 - S(18, 30, Math.hypot(x - ROCK.x, y - ROCK.y));
  const cot = 1 - S(10, 22, Math.hypot((x - ROCK.x - 40) / 1.4, y - ROCK.y + 6));
  return Math.max(z * (1 - pad) * (1 - cot) + BASE * pad + (BASE - 10) * cot * (1 - pad), 0) - 3;
};

/** The beams: the lamp's two lenses at bearing phi and phi + 180, a little dipped. */
const beamsAt = (phi) => [phi, phi + Math.PI].map((a) => I.unit([Math.cos(a), Math.sin(a), -0.035]));
const SPREAD = 0.12;
const fog = (q, dirs) => {
  const d = I.sub(q, LAMP);
  const dist = Math.hypot(d[0], d[1], d[2]);
  let f = 2.4 * Math.exp(-((dist / 16) ** 2));
  for (const b of dirs) {
    const along = I.dot(d, b);
    if (along <= 2) continue;
    const perp = Math.hypot(d[0] - b[0] * along, d[1] - b[1] * along, d[2] - b[2] * along);
    const k = perp / (along * SPREAD + 3);
    if (k < 3) f += (Math.exp(-k * k) * 40 * Math.exp(-along / 2500)) / (along + 25);
  }
  return f;
};

export const scene = ({ ss = 3, coarse = 1 } = {}) => {
  const rock = I.patch({
    at: (u, v) => {
      const x = ROCK.x - 230 + 420 * u;
      const y = ROCK.y - 110 + 220 * v;
      return [x, y, rockAt(x, y)];
    },
    nu: 140,
    nv: 70,
  });
  const tower = I.lathe({
    base: [ROCK.x, ROCK.y, BASE - 2],
    profile: [
      [0, 18, 1], [6, 18, 1], [6, 16, 1], [8, 15.4],
      [30, 14.2], [60, 12.6], [90, 11, 1],
      [90, 11, 1], [92, 12.6], [94.5, 14.2, 1], [96, 14.2, 1], [96, 9.4, 1], [101, 9.4, 1],
    ],
  });
  const glass = I.lathe({ base: [ROCK.x, ROCK.y, BASE + 99], profile: [[0, 8.6, 1], [13, 8.6, 1]] });
  const dome = I.lathe({
    base: [ROCK.x, ROCK.y, BASE + 112],
    profile: [[0, 10.2, 1], [1.2, 10.2, 1], [1.2, 9.4, 1], [3, 8.6], [6, 6.6], [8.4, 3.6], [9.6, 1.4], [10, 0.2, 1]],
  });
  const cx = ROCK.x + 40;
  const cy = ROCK.y - 6;
  const walls = I.box({ min: [cx - 16, cy - 9, BASE - 12], max: [cx + 16, cy + 9, BASE + 13] }).slice(2);
  const roof = [
    I.face({ points: [[cx - 18, cy - 11, BASE + 12], [cx + 18, cy - 11, BASE + 12], [cx + 18, cy, BASE + 24], [cx - 18, cy, BASE + 24]], along: [1, 0, 0], outward: [0, -1, 1] }),
    I.face({ points: [[cx - 18, cy + 11, BASE + 12], [cx + 18, cy + 11, BASE + 12], [cx + 18, cy, BASE + 24], [cx - 18, cy, BASE + 24]], along: [1, 0, 0], outward: [0, 1, 1] }),
    ...[-1, 1].map((s) => I.face({ points: [[cx + s * 16, cy - 9, BASE + 13], [cx + s * 16, cy + 9, BASE + 13], [cx + s * 16, cy, BASE + 23]], along: [0, 1, 0], outward: [s, 0, 0] })),
  ];
  const sea = I.face({ points: [[-240, -700, 0], [270, -700, 0], [270, 950, 0], [-240, 950, 0]], along: [1, 0, 0], outward: [0, 0, 1] });
  const subject = [rock, tower, glass, dome, ...walls, ...roof];
  const cam = I.camera({ azimuth: -90, elevation: 7, scale: 1.72, offset: [WIDTH * 0.43, HEIGHT * 0.8], width: WIDTH, height: HEIGHT });
  const solids = [sea, ...subject];
  const occ = I.occlusion(solids, cam, { ss, halo: subject });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, { ...opts, step: (opts.step ?? 1.6) * coarse });
  const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });

  const stone = { base: 0.62, ambient: 0.08, bounce: 0.05 };
  const plaster = { base: 0.3, ambient: 0.1, bounce: 0.15 };
  const slate = { base: 0.6, ambient: 0.08, bounce: 0.05, gloss: 0.4, shine: 20 };
  const water = { base: 0.72, ambient: 0.06, bounce: 0 };
  const copper = { base: 0.5, ambient: 0.1, bounce: 0.2, gloss: 0.6, shine: 30 };

  const [mx] = cam.project(I.add(LAMP, I.mul(MOON, 2000)));
  const [, yFar] = cam.project([0, 950, 0]);
  const [, ySea] = cam.project([0, -700, 0]);
  // The moon's road on the sea: a column of broken bright dashes under it, widening toward us.
  const glitter = (s) => {
    const spread = 6 + 0.16 * (s.y - yFar);
    const col = Math.exp(-(((s.x - MOON_X) / spread) ** 2));
    const dash = S(0.55, 0.8, noise(s.x / 7, s.y * 0.9) * 0.7 + noise(s.x / 2.5, s.y * 1.7) * 0.3);
    return 1 - 0.92 * col * dash;
  };
  const MOON_X = WIDTH * 0.8;
  const chop = (s) => (0.78 + 0.3 * (noise(s.p[0] / 40, s.p[1] / 14) - 0.5)) * (1 - 0.3 * S(500, 950, s.p[1]));
  // The tower's dark daymark bands.
  const bands = (s) => {
    const h = s.p[2] - BASE;
    return h > 26 && h < 44 ? 1.6 : h > 62 && h < 78 ? 1.6 : 1;
  };
  const roughness = (s) => 0.8 + 0.45 * fbm(s.p[0] / 6, s.p[2] / 4);

  const layers = [];
  const layer = (id, set, material, ink, shape) => layers.push({ id, set, material, ink, shape });
  layer("sea", H(sea, { spacing: 1.6, step: 1.4 }), water, { from: 0.06, to: 0.85, width: 0.95 }, (s) => chop(s) * glitter(s));
  layer("sea-x", H(sea, { spacing: 2.1, slant: 0.35, step: 1.6 }), water, { from: 0.6, to: 0.95, width: 0.7 }, (s) => chop(s) * glitter(s));
  layer("rock", H(rock, { spacing: 1.8, step: 1.2 }), stone, { from: 0.1, to: 0.75, width: 1 }, roughness);
  layer("rock-x", H(rock, { along: "v", spacing: 2.2, slant: 0.6, step: 1.3 }), stone, { from: 0.45, to: 0.92, width: 0.8 }, roughness);
  layer("rock-xx", H(rock, { spacing: 2.8, slant: -0.9, step: 1.4 }), stone, { from: 0.75, to: 1, width: 0.6 });
  layer("tower", H(tower, { spacing: 1.5, step: 1 }), plaster, { from: 0.12, to: 0.8, width: 0.8 }, bands);
  layer("tower-x", H(tower, { spacing: 2, slant: 0.3, step: 1.1 }), plaster, { from: 0.5, to: 0.95, width: 0.65 }, bands);
  layer("glass", H(glass, { spacing: 1.1, step: 0.8 }), plaster, { from: 0.1, to: 0.9, width: 0.6 }, () => 0);
  layer("dome", H(dome, { spacing: 1.2, step: 0.9 }), copper, { from: 0.1, to: 0.85, width: 0.6 });
  const cot = merge(walls.filter((f) => I.dot(f.normal, cam.view) > 0).map((f) => H(f, { spacing: 1.5, step: 1 })));
  layer("cottage", cot, plaster, { from: 0.12, to: 0.85, width: 0.75 });
  layer("roof", merge(roof.filter((f) => I.dot(f.normal, cam.view) > 0).map((f) => H(f, { spacing: 1.3, step: 1 }))), slate, { from: 0.1, to: 0.85, width: 0.7 });

  // Sky: ruled to the top, kept clear of the light, the stars and the moon.
  const stars = range(150).map((i) => [hash(i, 1) * WIDTH, hash(i, 2) ** 1.4 * (yFar - 20), 0.6 + 1.6 * hash(i, 3) ** 3]);
  const MOON_C = [MOON_X, 92];
  const sky = I.ruling(cam, occ, { spacing: 1.7, halo: 3, step: 1.5, region: (x, y) => y < yFar && Math.hypot(x - MOON_C[0], y - MOON_C[1]) > 21 });
  const skyTone = (s) => {
    let t = 0.74 + 0.24 * (1 - S(0, yFar, s.y)) + 0.12 * (fbm(s.x / 80, s.y / 14) - 0.5);
    for (const [x, y, r] of stars) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < r * 2.2) t *= S(r * 0.5, r * 2.2, d);
    }
    const halo = Math.hypot(s.x - MOON_C[0], s.y - MOON_C[1]);
    return t * (0.55 + 0.45 * S(20, 90, halo));
  };
  // The moon: a crescent, its dark part ruled faintly with earthshine.
  const moonLines = range(26).map((i) => (t) => {
    const y = MOON_C[1] - 19 + i * 1.5;
    const h = Math.sqrt(Math.max(0, 19.5 ** 2 - (y - MOON_C[1]) ** 2));
    return [MOON_C[0] - h + 2 * h * t, y];
  });
  const shade = (x, y) => Math.hypot(x - MOON_C[0] - 8, y - MOON_C[1] + 3) < 17;
  const moon = {
    dark: I.trace(moonLines, { on: shade, spacing: 1.5, step: 1 }),
    lit: I.trace(moonLines, { on: (x, y) => !shade(x, y), spacing: 1.5, step: 1 }),
  };

  // Engraved marks: the lantern's astragals and rims, the gallery rail, the cottage's door and lit window.
  const marks = [];
  const M = (pts, width, opts = {}) => marks.push(I.stroke(pts, cam, occ.sees, { width, lift: 0.6, ...opts }));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * I.TAU;
    const p = (z) => [LAMP[0] + 8.7 * Math.cos(a), LAMP[1] + 8.7 * Math.sin(a), z];
    M([p(BASE + 99), p(BASE + 112)], 0.55);
  }
  for (const z of [BASE + 99, BASE + 105.5, BASE + 112]) M(I.circle([LAMP[0], LAMP[1], z], [0, 0, 1], 8.7, 48), 0.5);
  M(I.circle([LAMP[0], LAMP[1], BASE + 100.5], [0, 0, 1], 14.2, 64), 0.6);
  M(I.circle([LAMP[0], LAMP[1], BASE + 97.2], [0, 0, 1], 14.2, 64), 0.4);
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * I.TAU;
    M([[LAMP[0] + 14 * Math.cos(a), LAMP[1] + 14 * Math.sin(a), BASE + 96], [LAMP[0] + 14 * Math.cos(a), LAMP[1] + 14 * Math.sin(a), BASE + 100.5]], 0.35);
  }
  M([[LAMP[0], LAMP[1], BASE + 122], [LAMP[0], LAMP[1], BASE + 130]], 0.7, { taper: 3 });
  const win = (x0, x1, z0, z1, y) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [x0, y, z0]];
  M(win(cx - 10, cx - 3, BASE - 1, BASE + 8, cy - 9.2), 0.6);
  M(win(cx + 3, cx + 9, BASE - 12, BASE + 2, cy - 9.2), 0.6);
  M([[cx - 6.5, cy - 9.2, BASE - 1], [cx - 6.5, cy - 9.2, BASE + 8]], 0.4);
  M([[cx - 10, cy - 9.2, BASE + 3.5], [cx - 3, cy - 9.2, BASE + 3.5]], 0.4);
  // The lit window and the lantern glass are left as paper: their pixels knock out the cottage's lines.
  const [w0] = cam.project([cx - 10, cy - 9.2, 0]);
  const [w1] = cam.project([cx - 3, cy - 9.2, 0]);
  const [, wt] = cam.project([0, cy - 9.2, BASE + 8]);
  const [, wb] = cam.project([0, cy - 9.2, BASE - 1]);
  const lit = (s) => (s.x > w0 && s.x < w1 && s.y > wt && s.y < wb ? 0 : 1);
  layers.find((l) => l.id === "cottage").shape = lit;

  return { cam, occ, solids, tris: I.trianglesOf(solids), layers, sky, skyTone, moon, marks: marks.join(""), sea: [ySea, yFar] };
};

/**
 * How much beam lies along the line of sight. In an orthographic view a cone of light projects to a wedge: its axis is
 * the beam's direction on screen, its spread grows as the beam turns toward or away from us, and the light gathered
 * through it grows as 1 / sin of that angle. The air glows as 1 / distance from the lamp (the light spreads as it goes).
 * On a surface only the part of the beam in front of it counts.
 */
const scatter = (S, s, beams) => {
  let sum = 0;
  const dx = s.x - beams.lx;
  const dy = s.y - beams.ly;
  const r = Math.hypot(dx, dy) / S.cam.scale;
  sum += 1.6 * Math.exp(-((r / 13) ** 2));
  for (const b of beams.list) {
    const along = (dx * b.ex + dy * b.ey) / S.cam.scale;
    if (along <= 0) continue;
    const perp = Math.abs(dx * b.ey - dy * b.ex) / S.cam.scale;
    const a = along / b.fore;
    if (s.p && I.dot(I.add(LAMP, I.mul(b.dir, a)), S.cam.view) < I.dot(s.p, S.cam.view)) continue;
    const k = perp / (a * SPREAD + 3);
    if (k < 3) sum += (Math.exp(-k * k) * 380 * Math.exp(-a / 1400)) / ((a + 25) * Math.max(0.12, b.fore));
  }
  return 1 - Math.exp(-sum);
};
const beamsOf = (S, phi) => {
  const [lx, ly] = S.cam.project(LAMP);
  const list = beamsAt(phi).map((dir) => {
    const sx = I.dot(dir, S.cam.right);
    const sy = -I.dot(dir, S.cam.up);
    const fore = Math.max(1e-3, Math.hypot(sx, sy));
    return { dir, fore, ex: sx / fore, ey: sy / fore };
  });
  return { lx, ly, list };
};

/** Ink every layer for a beam bearing phi (radians). The air in a beam thins the lines behind it. */
export const inkAt = (S, phi, { size = 1024, negative = false } = {}) => {
  const beams = beamsOf(S, phi);
  // The moon never moves, so each sample's moonlit tone is worked out once and kept; only the beam is new each frame.
  if (!S.shadow) S.shadow = I.shadowMap(S.solids, MOON, { size, tris: S.tris });
  const out = {};
  const air = (s) => 1 - 0.93 * scatter(S, s, beams);
  for (const l of S.layers) {
    const lit = (l.lit ??= I.lighting({ ...l.material, light: MOON, view: S.cam.view, shadow: S.shadow }));
    const dark = (s) => (s.t0 ??= lit(s) * (l.shape ? l.shape(s) : 1)) * air(s);
    out[l.id] = I.ink(l.set, negative ? (s) => 1 - dark(s) : dark, l.ink);
  }
  const sky = (s) => (s.t0 ??= S.skyTone(s)) * air(s);
  out.sky = I.ink(S.sky, negative ? (s) => 1 - sky(s) : sky, { from: 0.05, to: 0.95, width: 0.9 });
  return out;
};
