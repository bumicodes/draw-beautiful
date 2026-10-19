import * as I from "../../kit/intaglio.mjs";

// Mount Fuji from the north shore of Lake Kawaguchi in mid-April, engraved as a bank-note vignette in one ink
// under an arched sky of engine-ruled lines.
// The cone (snow down its gullies), the forested foothills, the lake that mirrors them, a village with a
// five-storey pagoda on the near shore, and a cherry tree in bloom framing the view.
// World units are a stage set seen in orthographic: x west (screen right), y south (away), z up, the lake at z = 0.
// The sun follows Kawaguchi's sky through the day; the mountain turns its lit flank and the reflection follows.

export const WIDTH = 760;
export const HEIGHT = 500;

export const LATITUDE = 35.5;
export const DECLINATION = 10;

// A low eye over a deep lake, so the whole cone and its mirror image both fit between the sky and the near shore.
const EL = 3;
const SHORE = 420;
const SCALE = 0.6;

const MT = { x: 40, y: 6060, R: 660, H: 290 };
const HILLS = { y0: 5380, y1: 5800 };
const LAKE = { y1: 5500 };

/** The vignette: a half-ellipse of sky springing from the far shore, the land below it the full width. */
export const ARCH = { cx: WIDTH / 2, cy: 300, rx: 372, ry: 292 };
const inArch = (x, y, inset = 0) => y >= ARCH.cy || ((x - ARCH.cx) / (ARCH.rx - inset)) ** 2 + ((y - ARCH.cy) / (ARCH.ry - inset)) ** 2 < 1;

const range = (n) => Array.from({ length: n }, (_, i) => i);
const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });

// Deterministic noise.
const hash = (i, j = 0) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const fade = (t) => t * t * (3 - 2 * t);
const noise = (x, y = 0) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = fade(x - i);
  const fy = fade(y - j);
  const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * fx;
  const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * fx;
  return a + (b - a) * fy;
};
const rand = (seed) => {
  let k = seed;
  return () => hash(k++, seed * 0.37);
};

/** The sun at a solar time in hours, as a light direction in this scene's frame (x west, y south). */
export const sunAt = (hours) => {
  const phi = LATITUDE * I.deg;
  const dec = DECLINATION * I.deg;
  const ha = (hours - 12) * 15 * I.deg;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const cosA = (Math.sin(dec) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
  const az = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const bearing = (ha > 0 ? I.TAU - az : az) / I.deg;
  const [e, n, z] = I.sunDirection(bearing, Math.max(4, alt / I.deg));
  return { altitude: alt / I.deg, bearing, light: [-e, -n, z] };
};

// The mountain: a concave cone with a flat crater top, radial ravines and a ragged snowline.

/** A periodic function of the angle round the cone, tabulated once: the ravines and snow fingers are sampled millions of times. */
const table = (f, n = 4096) => {
  const t = Float64Array.from({ length: n + 1 }, (_, i) => f((i / n) * I.TAU));
  return (th) => {
    const x = ((((th / I.TAU) % 1) + 1) % 1) * n;
    const i = Math.floor(x);
    return t[i] + (t[i + 1] - t[i]) * (x - i);
  };
};
const ravines = range(14).map((k) => ({ phase: hash(k, 3) * I.TAU, width: 40 + 50 * hash(k, 4), depth: 0.5 + 0.5 * hash(k, 5) }));
const groove = table((th) => {
  let g = 0;
  for (const r of ravines) g += r.depth * (0.5 + 0.5 * Math.cos(th - r.phase)) ** r.width;
  return Math.min(1, g);
});
const slopeBand = (rho) => I.smoothstep(0.04, 0.16, rho) * (1 - I.smoothstep(0.45, 0.85, rho));

const mountZ = (rho, th) => {
  const k = rho - 0.05;
  const re = 0.5 * (k + Math.sqrt(k * k + 0.0004));
  const cone = Math.max(0, 1 - re) ** 1.5;
  const rim = 0.008 * Math.sin(5 * th + 1) * (1 - I.smoothstep(0.03, 0.07, rho));
  const lumpy = 0.012 * (noise(th * 9, rho * 6) - 0.5) * I.smoothstep(0.3, 0.6, rho);
  return MT.H * Math.max(0, cone * (1 + 0.025 * Math.sin(th + 1)) + rim + lumpy - 0.035 * groove(th) * slopeBand(rho));
};
const mountAt = (x, y) => {
  const dx = x - MT.x;
  const dy = y - MT.y;
  return mountZ(Math.hypot(dx, dy) / MT.R, Math.atan2(dy, dx));
};
// Snow lies longest in the ravines, so the snowline runs down in long fingers.
const streaks = range(34).map((k) => ({ phase: hash(k, 9) * I.TAU, width: 300 + 900 * hash(k, 10), reach: 0.08 + 0.2 * hash(k, 11) }));
const fingers = table((th) => {
  let g = 0;
  for (const f of streaks) g = Math.max(g, f.reach * (0.5 + 0.5 * Math.cos(th - f.phase)) ** f.width);
  return g;
}, 16384);
const snowAt = (z, th, rho) => {
  const line = 0.52 + 0.035 * Math.sin(2 * th + 0.5) + 0.03 * Math.sin(5 * th + 2) - 0.05 * Math.max(0, -Math.sin(th)) + 0.06 * (noise(th * 22) - 0.5);
  const h = z / MT.H + 0.16 * groove(th) * slopeBand(rho) + fingers(th);
  return I.smoothstep(line - 0.012, line + 0.012, h);
};

// The foothills: a forested ridge between the lake and the cone, lowest under the summit.
const hillAt = (x, y) => {
  const v = (y - HILLS.y0) / (HILLS.y1 - HILLS.y0);
  if (v <= 0 || v >= 1) return 0;
  const crowns = 6 * Math.abs(Math.sin(x / 9 + 3 * noise(x / 40))) + 4 * noise(x / 14, 5);
  const rolling = 34 * noise(x / 70 + 4) ** 1.6 + 14 * noise(x / 30, 7);
  const A = 6 + rolling + 28 * I.smoothstep(260, 720, Math.abs(x - MT.x)) + 0.6 * crowns;
  const ridge = Math.sin(Math.PI * v ** 0.75) ** 1.3;
  return A * ridge * (1 + 0.15 * (noise(x / 60, v * 4) - 0.5));
};

const heightAt = (x, y) => Math.max(mountAt(x, y), hillAt(x, y));
const normalAt = (x, y) => {
  const e = 2;
  const dx = (heightAt(x + e, y) - heightAt(x - e, y)) / (2 * e);
  const dy = (heightAt(x, y + e) - heightAt(x, y - e)) / (2 * e);
  return I.unit([-dx, -dy, 1]);
};

// A tube along a smooth 3D curve (trunks and branches). Lines along u are rings round it.
const catmull3 = (pts, t) => {
  const n = pts.length - 1;
  const f = Math.min(n - 1e-9, Math.max(0, t * n));
  const i = Math.floor(f);
  const s = f - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  const s2 = s * s;
  const s3 = s2 * s;
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * s3));
};
const tube = ({ pts, r0, r1, nu = 14, nv = 40 }) => {
  const C = (v) => catmull3(pts, v);
  const at = (u, v) => {
    const t = I.unit(I.sub(C(Math.min(1, v + 0.002)), C(Math.max(0, v - 0.002))));
    const n = I.unit(I.cross(t, [0, 1, 0.3]));
    const b = I.cross(t, n);
    const r = r0 + (r1 - r0) * v ** 0.8;
    const th = u * I.TAU;
    return I.add(C(v), I.add(I.mul(n, r * Math.cos(th)), I.mul(b, r * Math.sin(th))));
  };
  return { surface: I.patch({ at, nu, nv }), at: C };
};

// A clump of blossom: a lumpy ball.
const clump = (center, R, seed) => {
  const r = rand(seed * 13 + 1);
  const bumps = range(14).map(() => {
    const z = 2 * r() - 1;
    const a = r() * I.TAU;
    const s = Math.sqrt(1 - z * z);
    return { d: [s * Math.cos(a), s * Math.sin(a), z], k: 0.1 + 0.14 * r() };
  });
  const at = (u, v) => {
    const lon = u * I.TAU;
    const lat = (v - 0.5) * Math.PI * 0.98;
    const d = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    let k = 0.86 - 0.08 * Math.max(0, -d[2]);
    for (const b of bumps) {
      const c = d[0] * b.d[0] + d[1] * b.d[1] + d[2] * b.d[2];
      if (c > 0) {
        const c3 = c * c * c;
        k += b.k * c3 * c3 * c3;
      }
    }
    return I.add(center, I.mul(d, R * k));
  };
  return { center, R, at, surface: I.patch({ at, nu: 16, nv: 10 }) };
};

/**
 * A convex block from its bottom and top quads (counterclockwise from above). Sides are hatched along their bottom
 * edge, or along `sideAlong` (vertical boards); the top along `capAlong`. `bottom` adds the underside (eaves seen from below).
 */
const centroid = (pts) => I.mul(pts.reduce(I.add), 1 / pts.length);
const block = (bot, top, { capAlong = [1, 0, 0], sideAlong, bottom = false } = {}) => {
  const mid = centroid([...bot, ...top]);
  const faceOf = (points, along) => I.face({ points, along, outward: I.sub(centroid(points), mid) });
  const sides = range(4).map((i) => {
    const j = (i + 1) % 4;
    return faceOf([bot[i], bot[j], top[j], top[i]], sideAlong ?? I.sub(bot[j], bot[i]));
  });
  return [faceOf(top, capAlong), ...sides, ...(bottom ? [faceOf(bot, capAlong)] : [])];
};
const quad = (cx, cy, a, b, z) => [[cx - a, cy - b, z], [cx + a, cy - b, z], [cx + a, cy + b, z], [cx - a, cy + b, z]];

/** A house with plaster walls and a tiled gable roof whose ridge runs along x. */
const house = ({ x, y, w, d, h, rise, eave = 5 }) => {
  const walls = block(quad(x, y, w / 2, d / 2, 0), quad(x, y, w / 2, d / 2, h), { sideAlong: [0, 0, 1] }).slice(1);
  const x0 = x - w / 2 - eave;
  const x1 = x + w / 2 + eave;
  const y0 = y - d / 2 - eave;
  const y1 = y + d / 2 + eave;
  const zr = h + rise;
  const ze = h - eave * (rise / (d / 2));
  const roof = [
    I.face({ points: [[x0, y0, ze], [x1, y0, ze], [x1, y, zr], [x0, y, zr]], along: [1, 0, 0], outward: [0, -1, 1] }),
    I.face({ points: [[x0, y1, ze], [x1, y1, ze], [x1, y, zr], [x0, y, zr]], along: [1, 0, 0], outward: [0, 1, 1] }),
  ];
  const gables = [-1, 1].map((s) => I.face({ points: [[x + (s * w) / 2, y - d / 2, h], [x + (s * w) / 2, y + d / 2, h], [x + (s * w) / 2, y, zr - 2]], along: [0, 1, 0], outward: [s, 0, 0] }));
  const door = I.face({ points: [[x - w * 0.12, y - d / 2 - 0.4, 0], [x + w * 0.12, y - d / 2 - 0.4, 0], [x + w * 0.12, y - d / 2 - 0.4, h * 0.72], [x - w * 0.12, y - d / 2 - 0.4, h * 0.72]], along: [0, 0, 1], outward: [0, -1, 0] });
  const posts = [-0.5, -0.25, 0.25, 0.5].map((f) => [[x + f * w * 0.98, y - d / 2 - 0.3, 0], [x + f * w * 0.98, y - d / 2 - 0.3, h]]);
  return { walls: [...walls, ...gables], roof, dark: [door], posts, ridge: [[x0, y, zr], [x1, y, zr]] };
};

/** A five-storey pagoda: a stone plinth, shrinking storeys under flaring hip roofs, and the sorin spire. */
const pagoda = ({ x, y }) => {
  const body = [];
  const roofs = [];
  const posts = [];
  body.push(...block(quad(x, y, 30, 30, 0), quad(x, y, 30, 30, 8)));
  let z = 8;
  for (let i = 0; i < 5; i++) {
    const b = 19 - 2.4 * i;
    const hb = i === 0 ? 20 : 15;
    body.push(...block(quad(x, y, b, b, z), quad(x, y, b, b, z + hb)).slice(1));
    for (const f of [-0.55, 0.55]) posts.push([[x + f * b, y - b - 0.3, z], [x + f * b, y - b - 0.3, z + hb]]);
    z += hb;
    const e = b + 14 - i;
    roofs.push(...block(quad(x, y, e, e, z - 3), quad(x, y, b * 0.72, b * 0.72, z + 6), { capAlong: [1, 1, 0], bottom: true }));
    z += 6;
  }
  return { body, roofs, posts, spire: [[x, y, z], [x, y, z + 42]], rings: range(9).map((k) => z + 10 + k * 3.2), top: [x, y, z + 42] };
};

/**
 * Sky lines as concentric half-ellipses inside the arch, outermost first, sampled in screen space and cut where `on`
 * fails. Each sample carries `k`, its place from the centre (0) to the arch (1), for an edge-darkened tone.
 */
const arcs = (on, { spacing = 1.5, step = 1.6 } = {}) => {
  const out = [];
  for (let d = spacing / 2; d < ARCH.ry - 4; d += spacing) {
    const a = ARCH.rx - d;
    const b = ARCH.ry - d;
    const n = Math.ceil((Math.PI * (a + b)) / 2 / step);
    const at = (t) => ({ x: ARCH.cx - a * Math.cos(t), y: ARCH.cy - b * Math.sin(t), sp: spacing, k: 1 - d / ARCH.ry });
    const runs = [];
    let run = null;
    let last = null;
    for (let i = 0; i <= n; i++) {
      const t = (Math.PI * i) / n;
      const s = at(t);
      s.on = on(s.x, s.y);
      if (last && s.on !== last.on) {
        let inn = last.on ? last.t : t;
        let off = last.on ? t : last.t;
        for (let j = 0; j < 10; j++) {
          const m = (inn + off) / 2;
          const q = at(m);
          if (on(q.x, q.y)) inn = m;
          else off = m;
        }
        const e = { ...at(inn), on: true };
        if (s.on) run = [e];
        else {
          run.push(e);
          runs.push(run);
          run = null;
        }
      }
      if (s.on) (run ??= []).push(s);
      s.t = t;
      last = s;
    }
    if (run) runs.push(run);
    if (runs.length) out.push(runs);
  }
  return { lines: out };
};

export const scene = ({ ss = 3 } = {}) => {
  const cam = I.camera({ azimuth: -90, elevation: EL, scale: SCALE, offset: [WIDTH / 2, SHORE], width: WIDTH, height: HEIGHT });

  // The mountain as a polar height field: u round the cone (front at 0.5), v from the summit down.
  const mountPoint = (u, v) => {
    const th = (u - 0.5) * I.TAU - Math.PI / 2;
    const rho = 0.002 + v * 0.998;
    return [MT.x + rho * MT.R * Math.cos(th), MT.y + rho * MT.R * Math.sin(th), mountZ(rho, th)];
  };
  const mountain = I.patch({ at: mountPoint, side: -1, nu: 220, nv: 60 });
  const hillsPoint = (u, v) => {
    const x = -760 + 1520 * u;
    const y = HILLS.y0 + (HILLS.y1 - HILLS.y0) * v;
    return [x, y, hillAt(x, y)];
  };
  const hills = I.patch({ at: hillsPoint, nu: 160, nv: 24 });
  const lake = I.face({ points: [[-700, 0, 0], [700, 0, 0], [700, LAKE.y1, 0], [-700, LAKE.y1, 0]], along: [1, 0, 0], outward: [0, 0, 1] });
  const ground = I.face({ points: [[-700, -2800, 0], [700, -2800, 0], [700, 0, 0], [-700, 0, 0]], along: [1, 0, 0], outward: [0, 0, 1] });

  // The village along the near shore and the pagoda among its cherries.
  const homes = [
    { x: 60, y: -260, w: 54, d: 36, h: 20, rise: 15 },
    { x: 135, y: -120, w: 46, d: 32, h: 18, rise: 13 },
    { x: 210, y: -420, w: 60, d: 38, h: 22, rise: 16 },
    { x: 290, y: -160, w: 44, d: 30, h: 17, rise: 12 },
    { x: 360, y: -520, w: 58, d: 36, h: 21, rise: 15 },
    { x: 440, y: -220, w: 50, d: 34, h: 19, rise: 14 },
    { x: 520, y: -640, w: 56, d: 36, h: 20, rise: 15 },
    { x: -20, y: -120, w: 40, d: 28, h: 16, rise: 12 },
    { x: 150, y: -760, w: 52, d: 34, h: 20, rise: 14 },
    { x: 300, y: -900, w: 50, d: 32, h: 19, rise: 13 },
    { x: 590, y: -300, w: 46, d: 32, h: 18, rise: 13 },
  ].map(house);
  const pag = pagoda({ x: -170, y: -420 });

  // Small cherries on the shore between the houses.
  const shoreTrees = [
    { x: -90, y: -200, h: 34, r: 24 },
    { x: -250, y: -120, h: 30, r: 22 },
    { x: 98, y: -40, h: 26, r: 18 },
    { x: 250, y: -60, h: 28, r: 20 },
    { x: 400, y: -80, h: 26, r: 19 },
    { x: 640, y: -500, h: 30, r: 22 },
    { x: -330, y: -600, h: 36, r: 26 },
    { x: 480, y: -1000, h: 32, r: 24 },
  ];
  const smallTrunks = [];
  const smallClumps = [];
  shoreTrees.forEach((t, i) => {
    smallTrunks.push(tube({ pts: [[t.x, t.y, 0], [t.x + 2, t.y, t.h * 0.6], [t.x - 1, t.y, t.h]], r0: 2.6, r1: 1.4, nu: 8, nv: 8 }));
    const r = rand(100 + i);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * I.TAU + r();
      smallClumps.push(clump([t.x + Math.cos(a) * t.r * 0.55, t.y + Math.sin(a) * t.r * 0.4 - 4, t.h + t.r * (0.3 + 0.35 * r())], t.r * (0.55 + 0.2 * r()), 200 + i * 7 + k));
    }
  });

  // Two cherries on the near bank flank the view: a short trunk forking into limbs that vanish into a domed crown.
  const cherry = (x, y, lean, seed) => {
    const r = rand(seed);
    const top = [x + lean * 30, y, 250];
    const limbs = [
      { pts: [[x, y, -20], [x + lean * 6, y, 110], [x + lean * 22, y + 10, 200], top], r0: 26, r1: 17 },
      ...range(5).map((k) => {
        const a = (-0.9 + (1.8 * k) / 4) + lean * 0.25;
        const reach = 90 + 40 * r();
        return { pts: [top, I.add(top, [Math.sin(a) * reach * 0.5, -10, 70]), I.add(top, [Math.sin(a) * reach, -20, 120 + 60 * Math.cos(a)])], r0: 11, r1: 3 };
      }),
    ].map(tube);
    const crown = { c: [x + lean * 30, y - 60, 390], a: 150, b: 105 };
    const blooms = [];
    for (let k = 0; k < 16; k++) {
      const t = (k / 16) * I.TAU + r();
      const h = k === 0 ? 0 : 0.5 + 0.5 * r();
      const ex = Math.cos(t) * h;
      const ez = Math.sin(t) * h;
      const R = 34 + 22 * r();
      blooms.push(clump([crown.c[0] + ex * crown.a, crown.c[1] - 60 * (1 - h) - r() * 20, crown.c[2] + ez * crown.b - 18 * Math.abs(ex)], R, seed * 97 + k));
    }
    return { limbs, blooms };
  };
  const trees2 = [cherry(-470, -2000, 1, 3), cherry(500, -1800, -1, 5)];
  const limbs = trees2.flatMap((t) => t.limbs);
  const blooms = trees2.flatMap((t) => t.blooms);

  const village = [...homes.flatMap((h) => [...h.walls, ...h.roof, ...h.dark]), ...pag.body, ...pag.roofs];
  const trees = [...smallTrunks.map((t) => t.surface), ...limbs.map((l) => l.surface)];
  const flowers = [...smallClumps, ...blooms].map((c) => c.surface);
  const shoreFlowers = smallClumps.map((c) => c.surface);
  const crowns = blooms.map((c) => c.surface);
  const subject = [mountain, hills, ...village, ...trees, ...flowers];
  const solids = [lake, ground, ...subject];
  const occ = I.occlusion(solids, cam, { ss, halo: [...village, ...trees, ...flowers] });
  const skyline = I.occlusion([mountain, hills, lake, ground], cam, { ss });
  // Two shadow maps: the far one for the cone and the hills, the near one fine enough for the village and the tree.
  const far = [mountain, hills];
  const near = [ground, ...village, ...trees, ...flowers];

  const facing = (s) => !s.normal || I.dot(s.normal, cam.view) > 0.01;
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const all = (list, opts) => merge(list.filter(facing).map((s) => H(s, opts)));

  // The crowns in foliage flicks: small cupped strokes over the big masses, each lit by its own point of the surface.
  // Fine and sparse where the light falls, swelling and crowding into the shade; the paper between them is the blossom.
  const foliage = { lines: [] };
  const fr = rand(41);
  for (const c of blooms) {
    const count = Math.round(c.R * c.R * 0.7);
    for (let k = 0; k < count; k++) {
      const [p, n] = c.surface.point(fr(), 0.06 + 0.88 * fr());
      if (I.dot(n, cam.view) < 0.05 || !occ.sees(I.add(p, I.mul(cam.view, 1.5)))) continue;
      const [x, y] = cam.project(p);
      const rad = 1.2 + 1.2 * fr();
      const rot = (fr() - 0.5) * 1.6;
      const run = range(7).map((i) => {
        const a = rot + Math.PI * (0.12 + (0.76 * i) / 6);
        return { x: x + rad * Math.cos(a), y: y + rad * (Math.sin(a) - 0.4), p, n, sp: 2.4, w: Math.sin((Math.PI * i) / 6) };
      });
      foliage.lines.push([run]);
    }
  }

  // Single blossoms on the near side of every big clump: tiny paper florets outlined in ink, cut out of the hatching.
  const marks = { blossom: [], dark: [] };
  const holes = [];
  const r = rand(7);
  const outline = range(37);
  for (const c of smallClumps) {
    const n = Math.round(c.R * 0.3);
    for (let k = 0; k < n; k++) {
      const u = 0.5 + (r() - 0.5) * 0.9;
      const v = 0.3 + r() * 0.65;
      const lon = (u - 0.5) * Math.PI - Math.PI / 2;
      const p = c.at((lon / I.TAU + 1) % 1, v);
      const [x, y] = cam.project(p);
      const size = 1.1 + 0.7 * r();
      const spin = r() * I.TAU;
      const near = I.add(p, I.mul(cam.view, 4));
      if (!occ.sees(near)) continue;
      const ring = outline.map((i) => {
        const a = (i / 36) * I.TAU;
        const petal = Math.abs(Math.cos(2.5 * (a + spin)));
        const notch = 1 - 0.18 * Math.exp(-(((petal - 1) / 0.04) ** 2));
        const rr = size * (0.42 + 0.58 * petal ** 0.6) * notch;
        return I.add(near, I.add(I.mul(cam.right, (rr * Math.cos(a)) / SCALE), I.mul(cam.up, (rr * Math.sin(a)) / SCALE)));
      });
      marks.blossom.push(I.stroke(ring, cam, () => true, { width: 0.3, step: 0.4 }));
      holes.push([x, y, size * 1.05]);
    }
  }
  const CELL = 12;
  const holeGrid = new Map();
  for (const h of holes) {
    const key = `${Math.floor(h[0] / CELL)},${Math.floor(h[1] / CELL)}`;
    if (!holeGrid.has(key)) holeGrid.set(key, []);
    holeGrid.get(key).push(h);
  }
  const inHole = (x, y) => {
    const i = Math.floor(x / CELL);
    const j = Math.floor(y / CELL);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const h of holeGrid.get(`${i + di},${j + dj}`) ?? []) if (Math.hypot(x - h[0], y - h[1]) < h[2]) return true;
      }
    }
    return false;
  };

  // Materials.
  const rock = { base: 0.36, ambient: 0.18, bounce: 0.08 };
  const snow = { base: 0, ambient: 0.3, bounce: 0.2 };
  const forest = { base: 0.46, ambient: 0.2, bounce: 0.05 };
  const plaster = { base: 0.06, ambient: 0.42, bounce: 0.12 };
  const tile = { base: 0.34, ambient: 0.16, bounce: 0.1, gloss: 0.3, shine: 18 };
  const lacquer = { base: 0.3, ambient: 0.16, bounce: 0.1 };
  const deep = { base: 0.8, ambient: 0.05, bounce: 0 };
  const bark = { base: 0.2, ambient: 0.16, bounce: 0.2 };
  const petal = { base: 0.16, ambient: 0.16, bounce: 0.06 };
  const grass = { base: 0.34, ambient: 0.3, bounce: 0 };

  const mountainTone = (ctx) => {
    const r1 = I.lighting({ ...rock, ...ctx });
    const s1 = I.lighting({ ...snow, ...ctx });
    return (s) => {
      if (s.snow === undefined) {
        const dx = s.p[0] - MT.x;
        const dy = s.p[1] - MT.y;
        s.snow = snowAt(s.p[2], Math.atan2(dy, dx), Math.hypot(dx, dy) / MT.R);
      }
      return r1(s) * (1 - s.snow) + 0.8 * s1(s) * s.snow;
    };
  };
  const forestTone = (ctx) => {
    const f = I.lighting({ ...forest, ...ctx });
    return (s) => f(s);
  };
  const leaves = (s) => (0.4 + 0.8 * noise(s.p[0] / 2.2, s.p[2] / 2.2)) * (0.75 + 0.35 * I.smoothstep(0, 18, s.p[2]));

  // The reflection: each sample of the lake looks along the mirrored view ray into the mountain and the hills.
  const mirror = [0, Math.cos(EL * I.deg), Math.sin(EL * I.deg)];
  const reflect = (p) => {
    const start = Math.max(0, (HILLS.y0 - 20 - p[1]) / mirror[1]);
    let prev = start;
    for (let t = start + 10; t < 8000; t += 10) {
      const q = I.add(p, I.mul(mirror, t));
      if (q[1] > MT.y + MT.R) break;
      if (q[2] < heightAt(q[0], q[1])) {
        let lo = prev;
        let hi = t;
        for (let k = 0; k < 8; k++) {
          const m = (lo + hi) / 2;
          const qm = I.add(p, I.mul(mirror, m));
          if (qm[2] < heightAt(qm[0], qm[1])) hi = m;
          else lo = m;
        }
        const hit = I.add(p, I.mul(mirror, hi));
        return { p: hit, n: normalAt(hit[0], hit[1]), hill: hillAt(hit[0], hit[1]) >= mountAt(hit[0], hit[1]) };
      }
      prev = t;
    }
    return null;
  };
  const lakeLines = H(lake, { spacing: 1.5, step: 1.6 });
  for (const runs of lakeLines.lines) for (const run of runs) for (const s of run) s.hit = reflect(s.p);
  const [, yFar] = cam.project([0, LAKE.y1, 0]);
  const waterTone = (ctx) => {
    const m = mountainTone(ctx);
    const f = forestTone(ctx);
    return (s) => {
      const depth = I.smoothstep(yFar, SHORE, s.y);
      if (!s.hit) return 0.2 + 0.22 * depth;
      if (s.hit.hill) s.hit.leaves ??= leaves(s.hit);
      return 0.12 + 0.86 * (s.hit.hill ? f(s.hit) * s.hit.leaves : m(s.hit));
    };
  };
  const ripple = (s) => 0.7 + 0.42 * noise(s.x / (5 + 9 * I.smoothstep(yFar, SHORE, s.y)), s.y * 0.7);

  const layers = [];
  // tone is the light on the surface; fade multiplies the ink after any negative (vignettes, cut-outs, texture).
  const layer = (id, set, tone, ink, fade = null, far = false) => layers.push({ id, set, tone, ink, fade, far });
  const mat = (m) => (ctx) => I.lighting({ ...m, ...ctx });

  const front = { range: [0.2, 0.8] };
  const sparse = (s, negative) => (negative ? I.smoothstep(0.2, 0.6, s.sp) : I.smoothstep(0.7, 1.6, s.sp));
  layer("mountain", H(mountain, { along: "v", spacing: 1.55, step: 1.4, ...front }), mountainTone, { from: 0.1, to: 0.8, width: 0.8 }, sparse, true);
  layer("mountain-x", H(mountain, { along: "v", spacing: 2.1, step: 1.6, slant: 0.22, ...front }), mountainTone, { from: 0.45, to: 0.95, width: 0.6 }, sparse, true);
  // The forest on the far shore in short upright strokes, against the level ruling of the water.
  layer("hills", H(hills, { along: "v", spacing: 1.25, step: 0.6 }), forestTone, { from: 0.2, to: 0.9, width: 0.75 }, leaves, true);
  layer("lake", lakeLines, waterTone, { from: 0.12, to: 0.9, width: 0.8 }, ripple, true);

  // The bank fades into the paper at the sides and along a ragged lower edge, as a vignette does.
  const bank = (s) => (1 - I.smoothstep(0.88, 1, Math.abs(s.x - WIDTH / 2) / (WIDTH / 2))) * (1 - I.smoothstep(HEIGHT - 34, HEIGHT - 6, s.y + 10 * noise(s.x / 18, 3)));
  layer("ground", H(ground, { spacing: 1.6, step: 1.4 }), mat(grass), { from: 0.2, to: 0.9, width: 0.7 }, bank);
  layer("ground-x", H(ground, { spacing: 2.2, slant: 0.5, step: 1.4 }), mat(grass), { from: 0.5, to: 0.95, width: 0.55 }, bank);

  const houseWalls = homes.flatMap((h) => h.walls);
  layer("walls", all(houseWalls, { spacing: 1.3, step: 0.7 }), mat(plaster), { from: 0.22, to: 0.85, width: 0.6 });
  layer("roofs", all(homes.flatMap((h) => h.roof), { spacing: 1.1, step: 0.8 }), mat(tile), { from: 0.15, to: 0.8, width: 0.6 });
  layer("doors", all(homes.flatMap((h) => h.dark), { spacing: 1, step: 0.7 }), mat(deep), { from: 0.2, to: 0.9, width: 0.6 });
  layer("pagoda", all(pag.body, { spacing: 1.1, step: 0.8 }), mat(lacquer), { from: 0.15, to: 0.85, width: 0.6 });
  layer("pagoda-roofs", all(pag.roofs, { spacing: 1.05, step: 0.7 }), mat(tile), { from: 0.12, to: 0.85, width: 0.55 });

  layer("bark", merge(trees.map((t) => H(t, { spacing: 1.35, step: 0.9 }))), mat(bark), { from: 0.2, to: 0.85, width: 0.8 });
  layer("bark-x", merge(trees.map((t) => H(t, { spacing: 2, step: 1, slant: 0.3 }))), mat(bark), { from: 0.6, to: 0.98, width: 0.55 });

  const bloomShape = (s) => (inHole(s.x, s.y) ? 0 : 0.6 + 0.6 * noise(s.x / 2.2, s.y / 1.6));
  layer("blossom", merge(shoreFlowers.map((f) => H(f, { spacing: 1.35, step: 1, slant: 0.15 }))), mat(petal), { from: 0.14, to: 0.85, width: 0.65 }, bloomShape);
  layer("crown", merge(crowns.map((f) => H(f, { spacing: 1.5, step: 1.1, slant: 0.4 }))), mat(petal), { from: 0.55, to: 1, width: 0.55 }, bloomShape);
  layer("foliage", foliage, mat(petal), { from: 0.12, to: 0.85, width: 0.9 }, (s) => s.w);

  // The sky: engine-ruled arcs parallel to the arch, kept clear of the near things and stopping on the skyline.
  const sky = arcs((x, y) => y > 0 && y < ARCH.cy && occ.clear(x, y) > 5 && skyline.clear(x, y) > 0.6, { spacing: 1.45 });
  const skyTone = (s) => {
    const edge = I.smoothstep(0.55, 1, s.k);
    const cloud = noise(s.x / 70, s.y / 22) * 0.7 + noise(s.x / 23, s.y / 9) * 0.3;
    return 0.16 + 0.38 * edge + 0.34 * I.smoothstep(0.35, 0.8, cloud) * (1 - 0.5 * edge);
  };

  // Engraved marks: posts, ridges, the spire and its rings, the shore line.
  const S = (pts, width, taper = 0) => marks.dark.push(I.stroke(pts, cam, occ.sees, { width, taper, lift: 0.8 }));
  for (const h of homes) {
    for (const p of h.posts) S(p, 0.5);
    S(h.ridge, 0.8, 2);
  }
  for (const p of pag.posts) S(p, 0.45);
  S(pag.spire, 1.1, 4);
  for (const z of pag.rings) S(I.circle([pag.top[0], pag.top[1], z], [0, 0, 1], 2.2, 16), 0.5);
  S(range(80).map((i) => [-700 + i * 17.5, 0, 0.5]), 0.6);
  S(range(90).map((i) => [-760 + i * 17.1, HILLS.y0 + 2, 0.3]), 0.45);

  return {
    cam,
    solids,
    far: I.trianglesOf(far),
    near: I.trianglesOf(near),
    layers,
    sky,
    skyTone,
    marks: marks.dark.join("") + marks.blossom.join(""),
  };
};

/**
 * Ink the layers for a solar time. A negative plate (pale ink on dark paper) inks the light instead of the shade.
 * `only: "far" | "near"` inks one group with its own shadow map, so a live page can alternate the two and halve each frame.
 */
export const inkAt = (S, hours, { size = 1024, negative = false, only } = {}) => {
  const { light } = sunAt(hours);
  const map = (tris) => I.shadowMap(null, light, { size, tris, soft: 1 });
  const shadows = { far: only !== "near" && map(S.far), near: only !== "far" && map(S.near) };
  const out = {};
  for (const l of S.layers) {
    if (only && l.far !== (only === "far")) continue;
    const t = l.tone({ light, view: S.cam.view, shadow: l.far ? shadows.far : shadows.near });
    const tone = negative ? (s) => 1 - t(s) : t;
    out[l.id] = I.ink(l.set, l.fade ? (s) => tone(s) * (s.fade ??= l.fade(s, negative)) : tone, l.ink);
  }
  return out;
};
