import * as I from "../../kit/intaglio.mjs";

// The Great Wave, after Hokusai, engraved. One breaker towers over the trough, its crest running round a horseshoe in
// plan so the curl is seen in profile at the front and its back slope turns toward us as it recedes. Every profile is
// a curve whose heading is integrated along its length: it climbs the back, tops the crest and curls ever tighter at
// the lip, which breaks into claws of foam. A small Mount Fuji stands on the far sea in the hollow of the curl.
// The curl drives the motion: only the lip changes, so only the lip is rebuilt and re-hatched each frame.
// World units: x right, y away from the viewer, z up; the sea is z = 0.

export const WIDTH = 800;
export const HEIGHT = 540;

const TR = 0.5;
const N = 150;
const NV = 520;
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

/** The heading of the breaker's surface t of the way along it: up the back, over the crest, curling at the lip. */
const heading = (t, c) => {
  const g = Math.max(0, (t - 0.3) / 0.7);
  const late = Math.min(1.25, Math.max(0, (t - 0.6) / 0.4));
  return (66 * S(0, 0.28, t) - 70 * g ** 1.2 - (120 + 85 * c) * late ** 2.2) * I.deg;
};

/** The surface profile from the back trough to the tip t = end, as [a, z] in units where the crest stands 0.38 high. */
const outer = (c, end, from = 0, n = N) => {
  const pts = [];
  let x = 0;
  let z = 0;
  // Integrate from the trough to `from` in the back's own steps, so the lip meets the back without a seam.
  const pre = from ? 90 : 0;
  for (let i = 0; i < pre; i++) {
    const t = ((i + 0.5) / pre) * from;
    const h = heading(t, c);
    x += (Math.cos(h) * from) / pre;
    z += (Math.sin(h) * from) / pre;
  }
  pts.push([x, z, from, heading(from, c)]);
  const span = end - from;
  for (let i = 1; i <= n; i++) {
    const t = from + ((i - 0.5) / n) * span;
    const h = heading(t, c);
    x += (Math.cos(h) * span) / n;
    z += (Math.sin(h) * span) / n;
    pts.push([x, z, from + (i / n) * span, h]);
  }
  return pts;
};
const LIP = 0.042;
const thick = (t, end) => LIP * ((end - t) / (end - TR)) ** 0.75;
const inward = (h) => [Math.sin(h), -Math.cos(h)];

/** The lip from the root (t = TR) out to the tip and back along its underside, n + 1 + n points. */
const lipProfile = (c, end) => {
  const out = outer(c, end, TR, N);
  const back = [...out].reverse().map(([x, z, t, h]) => {
    const k = thick(t, end);
    const [nx, nz] = inward(h);
    return [x + nx * k, z + nz * k];
  });
  return [...out.map(([x, z]) => [x, z]), ...back.slice(1)];
};

const catmull = (rows, u) => {
  const n = rows.length - 1;
  const f = Math.min(n - 1e-9, Math.max(0, u * n));
  const i = Math.floor(f);
  const s = f - i;
  const p0 = rows[Math.max(0, i - 1)];
  const p1 = rows[i];
  const p2 = rows[i + 1];
  const p3 = rows[Math.min(n, i + 2)];
  const s2 = s * s;
  const s3 = s2 * s;
  return [0, 1].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * s3));
};

/**
 * A breaker with a straight crest through O along `d` (in plan), travelling along `n`. `w` runs along the crest from
 * w0 (near) to w1 (far); `height(w)` is the crest height there and `claws(w)` how far each finger of foam runs past the lip.
 * Where the crest drops the wave keeps its breadth on the sea: profiles shrink in height far more than in reach.
 */
const breaker = ({ O, d, n, w0, w1, top, height, claws }) => {
  const bs = range(NV + 1).map((i) => w0 + ((w1 - w0) * i) / NV);
  const K0 = top / 0.445;
  const place = (w, [a, z], k) => {
    const r = (a - 0.5) * K0 * (k / K0) ** 0.35;
    return [O[0] + w * d[0] + r * n[0], O[1] + w * d[1] + r * n[1], z * k];
  };
  const k = (w) => height(w) / 0.445;
  const field = (rowsAt, nu, nv) => {
    const tables = bs.map((w) => rowsAt(w));
    const at = (u, v) => {
      const f = Math.min(NV - 1e-9, Math.max(0, v * NV));
      const j = Math.floor(f);
      const s = f - j;
      const a = catmull(tables[j], u);
      const c = catmull(tables[j + 1], u);
      const w = bs[j] + (bs[j + 1] - bs[j]) * s;
      return place(w, [a[0] + (c[0] - a[0]) * s, a[1] + (c[1] - a[1]) * s], k(w));
    };
    return I.patch({ at, nu, nv });
  };
  // The back, from the trough to the root of the lip: the same for every curl.
  const back = field(() => outer(0, TR, 0, 90).map(([x, z]) => [x, z]), 60, 160);
  // The hollow: from under the root of the lip down to the trough in front, concave toward the sea.
  const hollow = field(() => {
    const [x, z, t, h] = outer(0, TR, 0, 90).at(-1);
    const [nx, nz] = inward(h);
    const root = [x + nx * LIP, z + nz * LIP];
    const tip = outer(0.5, 1, 0, 120).at(-1);
    const foot = [tip[0] + 0.03, 0];
    return range(41).map((i) => {
      const s = i / 40;
      const p1 = [root[0] - 0.02, root[1] - 0.2];
      const p2 = [foot[0] - 0.2, foot[1] + 0.01];
      const m = 1 - s;
      return [0, 1].map((q) => m * m * m * root[q] + 3 * m * m * s * p1[q] + 3 * m * s * s * p2[q] + s * s * s * foot[q]);
    });
  }, 30, 160);
  const lip = (c) => field((b) => lipProfile(c, 1 + claws(b)), 48, 260);
  // Each claw as engraved talons: the finger's spine and its two edges, following the curl out to the point.
  const talons = (c) => claws.fingers.flatMap(([w, a, width]) => [-0.45, 0, 0.45].map((side) => {
    const ww = w + side * width;
    const end = 1 + claws(ww);
    return outer(c, end, 0.9, 24).map(([x, z]) => place(ww, [x, z], k(ww)));
  }));
  return { back, hollow, lip, talons, place, k, bs };
};

/** Claws: fingers of foam along the lip, each with a smaller finger beside it. */
const clawsOf = (b0, b1, every, seed, reach = 1) => {
  const fingers = [];
  for (let b = b0 + every * 0.5; b < b1; b += every * (0.7 + 0.6 * hash(b, seed))) {
    const main = 0.1 + 0.12 * hash(b, seed + 1);
    fingers.push([b, main, every * (0.16 + 0.08 * hash(b, seed + 2))]);
    fingers.push([b + every * (0.32 + 0.1 * hash(b, seed + 3)), main * 0.45, every * 0.1]);
  }
  const f = (b) => {
    let e = 0;
    for (const [c, a, w] of fingers) e = Math.max(e, a * Math.exp(-(((b - c) / w) ** 2)));
    return e * reach;
  };
  f.fingers = fingers.map(([c, a, w]) => [c, a * reach, w]);
  return f;
};

// The crest runs away to the right at 30 degrees, so the wave travels right and toward us and shows its face.
const SKEW = 30 * I.deg;
const D = [Math.sin(SKEW), Math.cos(SKEW)];
const NRM = [Math.cos(SKEW), -Math.sin(SKEW)];
const BIG = { O: [0, 0], d: D, n: NRM, w0: -560, w1: 420 };
const bigHeight = (w) => 4 + 250 * (w < 0 ? 0.3 + 0.7 * Math.exp(-((w / 300) ** 2)) : Math.exp(-((w / 210) ** 2)));
const SMALL = { O: [-60, -420], d: D, n: NRM, w0: -170, w1: 150 };
const smallHeight = (w) => 2 + 56 * Math.exp(-((w / 70) ** 2));
const FUJI = [235, 1120];
const FAR = 1200;
const EL = 4;
const SCALE = 1.36;

export const scene = ({ ss = 3, coarse = 1, curl = 0.5 } = {}) => {
  const big = breaker({ ...BIG, top: 254, height: bigHeight, claws: clawsOf(BIG.w0, BIG.w1, 11, 7) });
  const small = breaker({ ...SMALL, top: 58, height: smallHeight, claws: clawsOf(SMALL.w0, SMALL.w1, 9, 3, 0.8) });
  const sea = I.face({ points: [[-320, -1100, 0], [420, -1100, 0], [420, FAR, 0], [-320, FAR, 0]], along: [1, 0, 0], outward: [0, 0, 1] });
  const fuji = I.lathe({
    base: [FUJI[0], FUJI[1], 0],
    profile: [[0, 74, 1], [5, 50], [12, 32], [20, 18], [27, 9], [31, 5, 1], [31.3, 0, 1]],
  });
  const statics = [big.back, big.hollow, small.back, small.hollow, small.lip(0.35), fuji];
  // A low eye in the trough: the crest of the front curl a little left of centre, the sea's edge low in the plate.
  const cam = I.camera({ azimuth: -90, elevation: EL, scale: SCALE, offset: [WIDTH * 0.42, HEIGHT * 0.88], width: WIDTH, height: HEIGHT });
  const solids = [sea, ...statics];
  const occ = I.occlusion(solids, cam, { ss, halo: statics.slice(0, 5) });
  const H = (surface, opts, sees = occ.sees) => I.hatch(surface, cam, sees, { ...opts, step: (opts.step ?? 1.6) * coarse });
  const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });

  const water = { base: 0.6, ambient: 0.12, bounce: 0.1, gloss: 0.3, shine: 16 };
  const deep = { base: 0.42, ambient: 0.14, bounce: 0.1 };
  const snow = { base: 0.02, ambient: 0.35, bounce: 0.1 };
  const LINES = 230;

  // White streaks running with the flow up the face and over the back, as Hokusai cut them.
  const streaks = (s) => {
    const b = (s.p[0] * D[0] + s.p[1] * D[1]) / 26;
    const w = b + 0.35 * Math.sin(s.a * 5 + b);
    const f = w - Math.floor(w);
    const on = S(0.0, 0.1, f) * (1 - S(0.18, 0.34, f)) * S(0.1, 0.45, s.a) * S(0.25, 0.6, noise(b * 0.7, 1));
    return 1 - 0.95 * on;
  };
  // Foam: the last part of every flow line, out to the claw and back under it, is left as paper.
  const foamy = (s) => 1 - S(0.38, 0.47, s.a) * (1 - S(0.53, 0.64, s.a));
  const crest = (s) => 1 - 0.85 * S(0.93, 1, s.a);
  // Fuji: a white cone above the ragged snowline, dark forest below.
  const fujiShape = (s) => {
    const h = s.p[2] / 31;
    const th = Math.atan2(s.p[1] - FUJI[1], s.p[0] - FUJI[0]);
    const line = 0.42 + 0.1 * noise(th * 7) + 0.06 * Math.sin(th * 23);
    return 1 - 0.85 * S(line - 0.03, line + 0.03, h);
  };
  // The sea: level lines broken by chop, darkest in the trough under the curl, fading to a horizon far off.
  const [, yFar] = cam.project([0, FAR, 0]);
  const chop = (s) => {
    const n1 = noise(s.p[0] / 60, s.p[1] / 22);
    const n2 = noise(s.p[0] / 17 + 3, s.p[1] / 7);
    const far = S(500, FAR, s.p[1]);
    return (0.55 + 0.6 * S(0.35, 0.8, n1 * 0.7 + n2 * 0.3)) * (1 - 0.75 * far);
  };

  const layers = [];
  const layer = (id, set, material, ink, shape) => layers.push({ id, set, material, ink, shape });
  layer("sea", H(sea, { spacing: 1.7, step: 1.4 }), water, { from: 0.08, to: 0.85, width: 0.95 }, chop);
  layer("sea-x", H(sea, { spacing: 2.3, slant: 0.4, step: 1.6 }), water, { from: 0.6, to: 0.95, width: 0.7 }, chop);
  layer("fuji", H(fuji, { along: "v", spacing: 1.1, step: 0.8 }), water, { from: 0.08, to: 0.85, width: 0.55 }, fujiShape);
  layer("fuji-x", H(fuji, { spacing: 1.4, step: 0.9 }), snow, { from: 0.25, to: 0.95, width: 0.45 }, fujiShape);
  const both = (w) => [w.back, w.hollow];
  layer("back", merge([H(big.back, { lines: LINES, step: 1.1 }), H(small.back, { lines: 90, step: 1 })]), water, { from: 0.06, to: 0.75, width: 1.05 }, (q) => crest(q) * streaks(q));
  layer("back-c", H(big.back, { along: "v", spacing: 1.9, step: 1.3 }), water, { from: 0.12, to: 0.8, width: 0.7 }, crest);
  layer("back-x", merge([H(big.back, { spacing: 2.4, along: "v", slant: 0.5, step: 1.2 }), H(small.back, { spacing: 2.2, along: "v", slant: 0.5, step: 1 })]), water, { from: 0.55, to: 0.95, width: 0.75 });
  layer("hollow", merge([H(big.hollow, { lines: LINES, step: 1.1 }), H(small.hollow, { lines: 90, step: 1 })]), deep, { from: 0.05, to: 0.7, width: 1.1 }, streaks);
  layer("hollow-x", merge(both(big).slice(1).concat(both(small).slice(1)).map((w) => H(w, { spacing: 2.2, along: "v", slant: -0.6, step: 1.5 }))), deep, { from: 0.45, to: 0.92, width: 0.85 }, streaks);
  layer("hollow-xx", merge([H(big.hollow, { spacing: 2.9, slant: 0.9, step: 1.6 })]), deep, { from: 0.75, to: 1, width: 0.6 }, streaks);
  const smallLip = small.lip(0.35);
  layer("small-lip", H(smallLip, { lines: 90, step: 0.9 }), water, { from: 0.05, to: 0.75, width: 0.9 }, foamy);

  const sky = I.ruling(cam, occ, { spacing: 1.8, halo: 7, step: 1.6, region: (x, y) => y < yFar - 2 });
  const skyTone = (s) => {
    const top = 1 - S(0, yFar * 0.85, s.y);
    const cloud = noise(s.x / 90, s.y / 18) * 0.7 + noise(s.x / 30, s.y / 7) * 0.3;
    return 0.3 + 0.5 * top + 0.25 * S(0.55, 0.8, cloud);
  };

  return { cam, occ, big, small, sea, solids, statics, staticTris: I.trianglesOf(statics), layers, sky, skyTone, LINES };
};

/** The light: from the upper left, a little in front, so the back of the wave is lit and its hollow in shade. */
export const LIGHT = I.unit([-0.25, -0.3, 1]);

/** Ink the static plate once. */
export const inkStatic = (S, curl, { size = 1024, negative = false } = {}) => {
  const shadow = I.shadowMap([...S.solids, S.big.lip(curl)], LIGHT, { size });
  const out = {};
  for (const l of S.layers) {
    const lit = I.lighting({ ...l.material, light: LIGHT, view: S.cam.view, shadow });
    const tone = negative ? (q) => 1 - lit(q) : lit;
    out[l.id] = I.ink(l.set, l.shape ? (q) => tone(q) * l.shape(q) : tone, l.ink);
  }
  return out;
};

/** The lip for a curl c in [0, 1]: rebuilt, hatched against the static plate, inked, with its outline and a paper knock-out. */
export const inkAt = (S, c, { size = 640, negative = false, coarse = 1 } = {}) => {
  const lip = S.big.lip(c);
  const tris = lip.triangles();
  const sees = S.occ.plus([{ triangles: () => tris }]);
  const shadow = I.shadowMap(null, LIGHT, { size, tris: [...S.staticTris, ...tris] });
  const water = I.lighting({ base: 0.6, ambient: 0.16, bounce: 0.12, gloss: 0.25, shine: 16, light: LIGHT, view: S.cam.view, shadow });
  const tone = negative ? (q) => 1 - water(q) : water;
  const foamy = (q) => 1 - I.smoothstep(0.38, 0.47, q.a) * (1 - I.smoothstep(0.53, 0.64, q.a));
  const lines = I.hatch(lip, S.cam, sees, { lines: S.LINES, step: 1.1 * coarse });
  const contour = I.hatch(lip, S.cam, sees, { along: "v", spacing: 1.9, step: 2.4 * coarse, range: [0, 0.44] });
  const cross = I.hatch(lip, S.cam, sees, { along: "v", spacing: 2.3, slant: 0.5, step: 2.4 * coarse });
  const outline = S.big.talons(c).map((pts) => I.stroke(pts, S.cam, sees, { width: 0.75, taper: 9, lift: 1.5, step: 0.8 })).join("");
  const knock = tris.map((t) => `M${t.map((p) => S.cam.project(p).slice(0, 2).map((v) => Math.round(v * 10) / 10).join(" ")).join("L")}Z`).join("");
  return {
    lip: I.ink(lines, (q) => tone(q) * foamy(q), { from: 0.06, to: 0.75, width: 1.05 }),
    "lip-c": I.ink(contour, (q) => tone(q) * foamy(q), { from: 0.12, to: 0.8, width: 0.7 }),
    "lip-x": I.ink(cross, (q) => tone(q) * foamy(q), { from: 0.55, to: 0.95, width: 0.75 }),
    claws: outline,
    knock,
  };
};
