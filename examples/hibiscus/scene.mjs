import * as I from "../../kit/intaglio.mjs";

// A hibiscus (Hibiscus rosa-sinensis), engraved in two inks.
// Five ruffled petals with a dark eye, the staminal column with its anthers and five stigma pads,
// the calyx, a stem and two serrated leaves. The light swings round the flower; every petal casts on the next.

export const WIDTH = 640;
export const HEIGHT = 540;
export const PETALS = 5;
export const ANTHERS = 24;
export const STIGMAS = 5;

const C = [0, 0, 0];
const AXIS = I.unit([0.62, -0.5, 0.6]);
const PETAL_L = 80;
const COLUMN_L = 92;

const frac = (x) => x - Math.floor(x);
const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });

const petalAt = (i) => {
  const { b, c } = I.frameOf(AXIS);
  const th = (i * 72 + 14) * I.deg;
  const d = I.add(I.mul(b, Math.cos(th)), I.mul(c, Math.sin(th)));
  const s = I.cross(AXIS, d);
  return (u, v) => {
    const x = 2 * u - 1;
    const r = 5 + v * PETAL_L * (1 - 0.16 * x * x);
    const open = Math.sin((Math.PI / 2) * Math.min(1, v / 0.72)) ** 0.8;
    const w = 2 + 42 * open * (v < 0.72 ? 1 : 1 - 0.3 * ((v - 0.72) / 0.28) ** 2);
    const ruffle = 6 * Math.sin(9 * x + i * 1.9) * I.smoothstep(0.45, 1, v) * (0.3 + 0.7 * Math.abs(x));
    const h = 34 * Math.sin(v * Math.PI * 0.5) - 26 * v ** 2.2 + 8 * x * x * v + x * w * 0.24 + ruffle;
    return I.add(C, I.add(I.add(I.mul(d, r), I.mul(s, x * w)), I.mul(AXIS, h)));
  };
};

const leafAt = (base, dir, half) => {
  const dl = I.unit(dir);
  const sl = I.unit(I.cross(I.unit([0, -0.6, 1]), dl));
  const nl = I.cross(dl, sl);
  return (u, v) => {
    const x = half < 0 ? -1 + u : u;
    const serrate = 1 - 0.07 * frac(13 * v) ** 2;
    const w = 0.3 + 27 * Math.sin(Math.PI * Math.min(1, v) ** 0.8) ** 0.9 * serrate;
    const h = 6 * Math.abs(x) ** 1.3 * Math.sin(Math.PI * v) - 14 * v * v;
    return I.add(base, I.add(I.add(I.mul(dl, 4 + v * 84), I.mul(sl, x * w)), I.mul(nl, h)));
  };
};

/** Where the light comes from: `angle` degrees left (negative) or right of the viewer, always from above. */
export const lightAt = (cam, angle) => {
  const a = angle * I.deg;
  return I.unit(I.add(I.add(I.mul(cam.right, Math.sin(a) * 0.8), I.mul(cam.up, 0.7)), I.mul(cam.view, Math.cos(a) * 0.5)));
};

export const scene = ({ ss = 3 } = {}) => {
  const petals = Array.from({ length: PETALS }, (_, i) => petalAt(i));
  const petalSheets = petals.map((at) => I.sheet({ at, nu: 28, nv: 36 }));

  const tilt = I.unit(I.add(AXIS, [0.25, 0, -0.45]));
  const colBase = I.add(C, I.mul(AXIS, 3));
  const column = I.lathe({ base: colBase, axis: tilt, profile: [[0, 2.8], [20, 2.1], [55, 1.6], [COLUMN_L, 1.3, 1], [COLUMN_L, 0, 1]] });
  const { b: cb, c: cc } = I.frameOf(tilt);
  const ring = (th) => I.add(I.mul(cb, Math.cos(th)), I.mul(cc, Math.sin(th)));
  const anthers = Array.from({ length: ANTHERS }, (_, k) => {
    const s = 44 + (k * 40) / (ANTHERS - 1);
    const out = ring(k * 137.5 * I.deg);
    const root = I.add(colBase, I.mul(tilt, s));
    const center = I.add(root, I.add(I.mul(out, 4.6), I.mul(tilt, 1.2)));
    return { root: I.add(root, I.mul(out, 1.6)), center, ball: I.sphere({ center, radius: 1.7, axis: out }) };
  });
  const tip = I.add(colBase, I.mul(tilt, COLUMN_L));
  const stigmas = Array.from({ length: STIGMAS }, (_, j) => {
    const dir = I.unit(I.add(I.mul(tilt, 0.75), I.mul(ring((j * 72 + 20) * I.deg), 0.66)));
    const center = I.add(tip, I.mul(dir, 7.5));
    return { center, ball: I.sphere({ center, radius: 2.2, axis: dir }) };
  });

  const throat = I.rings({ center: I.add(C, I.mul(AXIS, 1.5)), normal: AXIS, radius: 11, inner: 0.5 });
  const calyx = I.lathe({ base: I.add(C, I.mul(AXIS, -1)), axis: I.mul(AXIS, -1), profile: [[0, 9.5, 1], [5, 10.5], [10, 9], [15, 4.6], [18, 2.8, 1], [18, 0, 1]] });
  const stemDir = I.unit([-0.3, 0.3, -1]);
  const stemBase = I.add(C, I.mul(AXIS, -18));
  const stem = I.lathe({ base: stemBase, axis: stemDir, profile: [[0, 2.8], [150, 3.4, 1]] });
  const leafBases = [I.add(stemBase, I.mul(stemDir, 58)), I.add(stemBase, I.mul(stemDir, 104))];
  const leaves = [
    [leafBases[0], [-1, -0.45, -0.15]],
    [leafBases[1], [1, -0.3, -0.3]],
  ].map(([base, dir]) => [-1, 1].map((half) => ({ half, at: leafAt(base, dir, half) })));
  const leafSheets = leaves.flat().map((l) => ({ ...l, sheets: I.sheet({ at: l.at, nu: 16, nv: 40 }) }));

  const subject = [
    ...petalSheets.map((s) => s[0]),
    throat,
    column,
    ...anthers.map((a) => a.ball),
    ...stigmas.map((s) => s.ball),
    calyx,
    stem,
    ...leafSheets.map((l) => l.sheets[0]),
  ];

  const extremes = [];
  for (const at of [...petals, ...leaves.flat().map((l) => l.at)]) for (const u of [0, 0.5, 1]) for (const v of [0, 0.5, 1]) extremes.push(at(u, v));
  extremes.push(I.add(stemBase, I.mul(stemDir, 150)), tip);
  const cam = I.fitCamera(extremes, { width: WIDTH, height: HEIGHT, pad: 58, azimuth: -90, elevation: 16 });
  const occ = I.occlusion(subject, cam, { ss });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const both = (pair, opts) => merge(pair.map((s) => H(s, opts)));

  const petal = { base: 0.16, ambient: 0.2, bounce: 0.32, gloss: 0.18, shine: 14 };
  const pollen = { base: 0.08, ambient: 0.25, bounce: 0.2 };
  const leaf = { base: 0.26, ambient: 0.18, bounce: 0.14, gloss: 0.25, shine: 20 };
  const stalk = { base: 0.2, ambient: 0.18, bounce: 0.14 };
  const eye = (p) => {
    const q = I.sub(p, C);
    const r = Math.hypot(...I.sub(q, I.mul(AXIS, I.dot(q, AXIS))));
    return 1 - I.smoothstep(9, 27, r);
  };

  const layers = [];
  const layer = (id, set, material, ink, extra = {}) => layers.push({ id, set, material, ink, ...extra });
  const red = { cls: "intaglio-ink-2" };
  const deepen = { ...red, shape: (s, t) => t + (1 - t) * 0.8 * eye(s.p) };

  petalSheets.forEach((pair, i) => {
    layer(`petal-${i}`, both(pair, { along: "v", spacing: 2.3, step: 1.4 }), petal, { from: 0.2, to: 0.74, width: 1.05 }, deepen);
    layer(`petal-${i}-x`, both(pair, { spacing: 3, slant: 0.35 }), petal, { from: 0.62, to: 0.96, width: 0.8 }, deepen);
  });
  layer("throat", H(throat, { spacing: 1.6, step: 1 }), { ...petal, base: 0.75 }, { from: 0.2, to: 0.9, width: 1 }, red);
  layer("column", H(column, { spacing: 1.5, step: 1 }), petal, { from: 0.12, to: 0.7, width: 0.8 }, red);
  layer("stigmas", merge(stigmas.map((s) => H(s.ball, { spacing: 1.3, step: 0.8 }))), petal, { from: 0.05, to: 0.6, width: 0.8 }, red);
  layer("anthers", merge(anthers.map((a) => H(a.ball, { spacing: 1.05, step: 0.7 }))), pollen, { from: 0.25, to: 0.85, width: 0.55 });
  layer("calyx", H(calyx, { along: "v", spacing: 2, step: 1.2 }), stalk, { from: 0.15, to: 0.7, width: 1 });
  layer("stem", H(stem, { spacing: 2.2, step: 1.2 }), stalk, { from: 0.15, to: 0.7, width: 1 });
  layer("stem-x", H(stem, { spacing: 2.8, slant: 0.3 }), stalk, { from: 0.58, to: 0.95, width: 0.8 });
  leafSheets.forEach((l, i) => {
    layer(`leaf-${i}`, both(l.sheets, { spacing: 2.4, slant: l.half < 0 ? -0.3 : 0.3, step: 1.4 }), leaf, { from: 0.18, to: 0.72, width: 1.05 });
    layer(`leaf-${i}-x`, both(l.sheets, { spacing: 3.1, slant: l.half < 0 ? 0.45 : -0.45, step: 1.4 }), leaf, { from: 0.58, to: 0.95, width: 0.8 });
  });

  const [cx, cy] = cam.project(C);
  const oval = (x, y) => Math.hypot((x - WIDTH / 2) / (WIDTH * 0.47), (y - HEIGHT / 2) / (HEIGHT * 0.46));
  const sky = I.ruling(cam, occ, { spacing: 2.5, halo: 7, region: (x, y) => oval(x, y) < 1 });
  const skyTone = (s) => (0.22 + 0.42 * I.smoothstep(HEIGHT * 0.75, 0, s.y)) * (1 - I.smoothstep(0.72, 1, oval(s.x, s.y)));

  const red2 = [];
  const green = [];
  const S = (into, pts, opts) => into.push(I.stroke(pts, cam, occ.sees, opts));
  const steps = (n) => Array.from({ length: n + 1 }, (_, k) => k / n);
  for (const at of petals) {
    S(red2, [...steps(40).map((v) => at(0, v)), ...steps(60).map((u) => at(u, 1)), ...steps(40).reverse().map((v) => at(1, v))], { width: 0.45 });
  }
  for (const a of anthers) S(green, [a.root, a.center], { width: 0.45 });
  for (const s of stigmas) S(red2, [tip, s.center], { width: 0.6 });
  for (const l of leafSheets) {
    const edge = l.half < 0 ? 0 : 1;
    S(green, steps(80).map((v) => l.at(edge, v)), { width: 0.45 });
    if (l.half > 0) S(green, steps(60).map((v) => l.at(0, v * 0.97)), { width: 0.8, taper: 20 });
  }

  return { cam, solids: subject, tris: I.trianglesOf(subject), layers, sky, skyTone, center: [cx, cy], marks: { red: red2.join(""), green: green.join("") } };
};

/** Ink every layer for a light angle. A negative plate (pale ink on dark paper) inks the light instead of the shade. */
export const inkAt = (S, angle, { size = 768, negative = false } = {}) => {
  const light = lightAt(S.cam, angle);
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris, soft: 1.6 });
  const out = {};
  for (const l of S.layers) {
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    const shaded = l.shape ? (s) => l.shape(s, lit(s)) : lit;
    out[l.id] = I.ink(l.set, negative ? (s) => 1 - shaded(s) : shaded, l.ink);
  }
  return out;
};
