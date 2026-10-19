import * as I from "../../kit/intaglio.mjs";

// An Indian peacock (Pavo cristatus) in display, facing the viewer, engraved in several inks like a bank-note vignette.
// The train stands behind it as a cupped fan of 110 eyed feathers in four rows, the shortest nearest, each engraved
// from nature: barbs angled toward the tip in green, and an eye with a navy heart, a teal ring, an orange ring and an
// olive halo. In front stand the royal blue neck and breast, ringed
// round the form, the head turned to its left under a crest of spatulate shafts, the wings drooped at the sides with
// barred coverts, and the legs on a ruled ground among a few grasses. The lamp swings slowly and the fan shimmers.
// World units are centimetres; z is up, the ground is z = 0 and the viewer looks from -y.

export const WIDTH = 820;
export const HEIGHT = 600;
export const ELEVATION = 8;
export const ROWS = [
  { L: 50, n: 17, W: 3.8 },
  { L: 71, n: 24, W: 4.1 },
  { L: 92, n: 31, W: 4.4 },
  { L: 113, n: 38, W: 4.7 },
];
export const FAN = { centre: [0, 0, 54], spread: 104 * I.deg, cup: 0.0019 };

const S = I.smoothstep;
const mix = (a, b, t) => a + (b - a) * t;
const range = (n) => Array.from({ length: n }, (_, i) => i);
const steps = (n) => Array.from({ length: n + 1 }, (_, k) => k / n);
const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });
const tag = (p, u, v) => Object.assign(p, { uv: [u, v] });
const VIEW = I.direction(-90, ELEVATION);

/** A patch whose lines and shading face the viewer: flipped when its own winding faces away. */
const facing = (opts) => {
  const s = I.patch(opts);
  return I.dot(s.point(0.5, 0.5)[1], VIEW) > 0 ? s : I.patch({ ...opts, side: -1 });
};

// The body and neck: one tube round a vertical spine, [x, z, half-width, depth], from the belly to the back of the head.

const SPINE = [
  [0, 21, 0.8, 0.8],
  [0, 25, 9, 8.5],
  [0, 34, 14.5, 12.5],
  [0, 44, 14, 12.5],
  [0.4, 52, 9.5, 9],
  [1, 59, 5.6, 5.4],
  [1.6, 67, 4.3, 4.1],
  [2.2, 75, 3.8, 3.6],
  [2.8, 83, 3.5, 3.3],
  [3.6, 90, 3, 2.9],
];

const spineOf = (pts) => {
  const cr = (a, b, c, d, t) => a.map((_, k) => 0.5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t * t * t));
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 24; k++) dense.push(cr(pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1], k / 24));
  }
  dense.push(pts[pts.length - 1]);
  const at = [0];
  for (let i = 1; i < dense.length; i++) at.push(at[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = at[at.length - 1];
  return (v) => {
    const s = I.clamp01(v) * total;
    let i = 0;
    while (i < dense.length - 2 && at[i + 1] < s) i++;
    const t = (s - at[i]) / (at[i + 1] - at[i] || 1);
    const [x, z, w, d] = dense[i].map((q, k) => mix(q, dense[i + 1][k], t));
    const l = Math.hypot(dense[i + 1][0] - dense[i][0], dense[i + 1][1] - dense[i][1]) || 1;
    return { x, z, w, d, tx: (dense[i + 1][0] - dense[i][0]) / l, tz: (dense[i + 1][1] - dense[i][1]) / l };
  };
};

const spine = spineOf(SPINE);

/** A point of the body and neck; u runs round it, v from the belly up to the head. */
const bodyAt = (u, v) => {
  const q = spine(v);
  const a = u * I.TAU;
  return tag([q.x - q.tz * q.w * Math.cos(a), q.d * Math.sin(a), q.z + q.tx * q.w * Math.cos(a)], u, v);
};

// The head, turned to the bird's left and a little toward the viewer: an ellipsoid along the bill.

const HEAD = { c: [5.6, -0.6, 93.5], f: I.unit([0.82, -0.52, -0.16]), A: 5.2, B: 3.5, C: 3 };
const headSide = I.unit(I.cross([0, 0, 1], HEAD.f));
const headUp = I.cross(HEAD.f, headSide);
const headLocal = (along, up, side) => I.add(HEAD.c, I.add(I.mul(HEAD.f, along * HEAD.A), I.add(I.mul(headUp, up * HEAD.B), I.mul(headSide, side * HEAD.C))));
const headAt = (u, v) => {
  const lat = v * Math.PI;
  const a = u * I.TAU;
  return tag(headLocal(-Math.cos(lat), Math.sin(lat) * Math.cos(a), Math.sin(lat) * Math.sin(a)), u, v);
};
const nearSide = I.dot(headSide, VIEW) > 0 ? 1 : -1;
const headPoint = (along, up) => headLocal(along, up, nearSide * Math.sqrt(Math.max(0.02, 1 - along * along - up * up)));

// The train. Each feather leaves the fan's centre behind the rump at its angle from the vertical and curves a little
// outward as it goes; the fan is cupped toward the viewer. Its vane is a narrow run of loose barbs that opens into the
// eye near the tip.

const featherOf = ({ alpha, L, depth, W }) => {
  const n = Math.ceil(L / 0.5);
  const xs = [FAN.centre[0]];
  const zs = [FAN.centre[2]];
  const as = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = alpha + 0.12 * Math.sin(alpha) * t * t;
    as.push(a);
    if (i < n) {
      xs.push(xs[i] + Math.sin(a) * (L / n));
      zs.push(zs[i] + Math.cos(a) * (L / n));
    }
  }
  const line = (l) => {
    const f = I.clamp01(l / L) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const t = f - i;
    return [mix(xs[i], xs[i + 1], t), mix(zs[i], zs[i + 1], t), mix(as[i], as[i + 1], t)];
  };
  const k = W / 3.6;
  const c = L - 6.6 * k;
  const hu = 6.6 * k;
  const hd = 11 * k;
  const width = (l) => {
    const head = l > c ? W * Math.sqrt(Math.max(0, 1 - ((l - c) / hu) ** 2)) : W * Math.max(0, 1 - ((c - l) / hd) ** 2);
    const core = (0.4 + (2.6 * l) / L) * (1 - S(c, L, l));
    return Math.max(head, core);
  };
  const point = (s, l) => {
    const [x, z, a] = line(l);
    return [x + s * Math.cos(a), depth - FAN.cup * l * l + (0.35 * s * s) / W, z - s * Math.sin(a)];
  };
  const eye = { l: c - 0.4 * k, a: 3.1 * k, b: 2.45 * k, off: 0.9 * k };
  const inEye = (s, l) => ((l - eye.l) / eye.a) ** 2 + (s / eye.b) ** 2 < 1;
  const reach = (l0) => Math.min(1.15 * width(l0), 0.8 * (L - l0));
  // Barbs: a line of constant v is one barb, from the rachis at l0 out and forward to the edge of the vane.
  const barbs = (side) => {
    const at = (u, v) => {
      const l0 = v * L;
      const l = Math.min(L, l0 + u * reach(l0));
      return tag(point(side * u * width(l), l), u, v);
    };
    const mask = (u, v) => {
      const l0 = v * L;
      const l = Math.min(L, l0 + u * reach(l0));
      return !inEye(side * u * width(l), l);
    };
    return { ...facing({ at, nu: 4, nv: Math.ceil(L / 1.6) }), mask };
  };
  // The same vane ruled straight across the rachis, for the crossing lines in its shadows.
  const across = (side) => {
    const at = (u, v) => tag(point(side * u * width(v * L), v * L), u, v);
    return { ...facing({ at, nu: 4, nv: Math.ceil(L / 2) }), mask: (u, v) => !inEye(side * u * width(v * L), v * L) };
  };
  const ocellus = facing({
    at: (u, v) => {
      const a = u * I.TAU;
      return tag(point(eye.b * v * Math.cos(a), eye.l - eye.off * (1 - v) * (1 - v) + eye.a * v * Math.sin(a)), u, v);
    },
    nu: 24,
    nv: 6,
  });
  return { L, W, c, eye, width, point, halves: [barbs(-1), barbs(1)], across: [across(-1), across(1)], ocellus };
};

const trainOf = () =>
  ROWS.flatMap(({ L, n, W }, r) =>
    range(n).map((k) => {
      const t = (k + 0.5) / n - 0.5;
      const alpha = 2 * FAN.spread * t + (r % 2 ? 0.5 / n : 0);
      return featherOf({ alpha, L, depth: 15 + 2.7 * r + 0.9 * (k % 2), W });
    }),
  );

// The wings, drooped at the bird's sides in display, from the shoulder down and out.

const wingOf = (side) => {
  const shoulder = [side * 9, -5, 46];
  const tip = [side * 15.5, -5, 19];
  const out = I.unit([side * 0.35, -0.25, 0.2]);
  const along = I.sub(tip, shoulder);
  const across = I.unit(I.cross(along, [0, -1, 0]));
  const sign = I.dot(across, [side, 0, 0]) > 0 ? 1 : -1;
  return (a, b) => {
    const w = 9 * Math.sin(Math.PI * (0.18 + 0.82 * a ** 0.85));
    const p = I.add(shoulder, I.add(I.mul(along, a), I.add(I.mul(across, sign * (b - 0.35) * w), I.mul(out, 2.5 * Math.sin(Math.PI * b) * Math.sin(Math.PI * a)))));
    return tag(p, a, b);
  };
};

// Legs and feet: tarsus from the foot up to the heel, the feathered thigh from the heel into the belly, three toes
// forward and one behind, each with its claw, and the spur on the back of the tarsus.

const LEGS = [-1, 1].map((side) => ({
  foot: [side * 7, -3, 1.1],
  heel: [side * 6.5, 0.5, 13.5],
  hip: [side * 5.5, 0, 31],
  toes: [[side * 0.55, -1, 0], [side * 0.05, -1, 0], [-side * 0.5, -1, 0]],
  back: [side * 0.2, 1, 0],
}));

const toe = (foot, dir, len) => {
  const d = I.unit([dir[0], dir[1], -0.06]);
  return {
    bone: I.lathe({ base: foot, axis: d, profile: [[0, 0.95], [len * 0.35, 0.75], [len * 0.4, 0.82], [len * 0.7, 0.6], [len * 0.75, 0.66], [len, 0.42, 1]] }),
    claw: I.lathe({ base: I.add(foot, I.mul(d, len)), axis: I.unit([d[0], d[1], -0.45]), profile: [[0, 0.42], [1.2, 0.26], [2.1, 0.04, 1]] }),
  };
};

// Botanical accents at the feet: four low tufts of grass.

const blade = (base, angle, h, lean, w) => {
  const dir = [Math.cos(angle), Math.sin(angle) * 0.3, 0];
  const side = I.unit([1, 0.25, 0]);
  return (u, v) => {
    const width = w * (1 - v) ** 0.8 * Math.min(1, v * 12 + 0.3);
    const p = I.add(base, I.add(I.mul(dir, lean * h * v * v), [0, 0, h * Math.sin((v * Math.PI) / 2.15)]));
    return tag(I.add(p, I.mul(side, (u - 0.5) * width)), u, v);
  };
};

const tufts = [
  { at: [-30, -22, 0], blades: [[-2.8, 12, 0.7], [-2.3, 17, 0.45], [-1.8, 22, 0.2], [-1.4, 19, -0.15], [-1, 14, -0.4], [-0.5, 10, -0.7], [-3, 7, 0.9]] },
  { at: [-14, -28, 0], blades: [[-2.9, 7, 0.9], [-2.4, 11, 0.6], [-1.9, 9, 0.3], [-0.9, 8, -0.5], [-0.3, 6, -0.9]] },
  { at: [17, -26, 0], blades: [[-2.6, 9, 0.7], [-2, 13, 0.4], [-1.5, 15, 0.1], [-1, 11, -0.35], [-0.5, 7, -0.7]] },
  { at: [33, -20, 0], blades: [[-2.7, 8, 0.8], [-1.9, 12, 0.35], [-1.2, 10, -0.2], [-0.4, 7, -0.8]] },
];

/** Where the light comes from: `angle` degrees left (negative) or right of the viewer, always from above. */
export const lightAt = (cam, angle) => {
  const a = angle * I.deg;
  return I.unit(I.add(I.add(I.mul(cam.right, Math.sin(a) * 0.8), I.mul(cam.up, 0.75)), I.mul(cam.view, Math.cos(a) * 0.65)));
};

export const scene = ({ ss = 3 } = {}) => {
  const feathers = trainOf();
  const body = facing({ at: bodyAt, nu: 72, nv: 100 });
  const head = (() => {
    const s = I.patch({ at: headAt, nu: 40, nv: 24 });
    const [p, n] = s.point(0.3, 0.5);
    return I.dot(n, I.sub(p, HEAD.c)) > 0 ? s : I.patch({ at: headAt, nu: 40, nv: 24, side: -1 });
  })();
  const beakBase = headPoint(0.93, -0.12);
  const beakAxis = I.unit(I.add(HEAD.f, [0, 0, -0.18]));
  const beak = I.lathe({ base: I.add(beakBase, I.mul(beakAxis, -0.6)), axis: beakAxis, profile: [[0, 1.25], [1.4, 1.05], [2.8, 0.6], [3.9, 0.08, 1]] });
  const wings = [-1, 1].map((side) => {
    const at = wingOf(side);
    return { at, surface: facing({ at, nu: 50, nv: 20 }) };
  });

  const legs = LEGS.map((g) => {
    const tarsus = I.lathe({ base: g.foot, axis: I.unit(I.sub(g.heel, g.foot)), profile: [[0, 1.25, 1], [1.2, 1.0], [10, 0.95], [12.4, 1.35], [13.6, 1.2, 1]] });
    const thighAxis = I.unit(I.sub(g.hip, g.heel));
    const thigh = I.lathe({ base: I.add(g.heel, I.mul(thighAxis, -0.6)), axis: thighAxis, profile: [[0, 1.05], [8, 1.15], [14, 1.5], [19, 2.3], [24, 3.2, 1]] });
    const toes = g.toes.map((d, i) => toe(g.foot, d, i === 1 ? 9 : 7));
    const hind = toe(g.foot, g.back, 3.8);
    const spur = I.lathe({ base: I.add(g.foot, I.mul(I.unit(I.sub(g.heel, g.foot)), 5.5)), axis: I.unit([0, 1, -0.25]), profile: [[0, 0.55], [1.6, 0.3], [2.6, 0.04, 1]] });
    return { tarsus, thigh, toes: [...toes, hind], spur };
  });

  const grass = tufts.flatMap((t) => t.blades.map(([angle, h, lean]) => facing({ at: blade(t.at, angle, h, lean, 2), nu: 3, nv: 24 })));
  const ground = I.face({
    points: steps(64).slice(0, -1).map((t) => [130 * Math.cos(t * I.TAU), 10 + 40 * Math.sin(t * I.TAU), 0]),
    along: [1, 0, 0],
    outward: [0, 0, 1],
  });

  const subject = [
    body,
    head,
    beak,
    ...wings.map((w) => w.surface),
    ...feathers.flatMap((f) => [...f.halves, f.ocellus]),
    ...legs.flatMap((g) => [g.tarsus, g.thigh, g.spur, ...g.toes.flatMap((t) => [t.bone, t.claw])]),
    ...grass,
  ];
  const solids = [ground, ...subject];

  const extremes = [[0, 0, -3], [-40, -30, 0], [40, -30, 0], ...feathers.map((f) => f.point(0, f.L))];
  const cam = I.fitCamera(extremes, { width: WIDTH, height: HEIGHT, pad: 30, azimuth: -90, elevation: ELEVATION });
  const occ = I.occlusion(solids, cam, { ss, halo: subject });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);

  const plume = { base: 0.3, ambient: 0.24, bounce: 0.2, gloss: 0.45, shine: 16 };
  const royal = { base: 0.4, ambient: 0.2, bounce: 0.24, gloss: 0.4, shine: 14 };
  const buff = { base: 0.12, ambient: 0.24, bounce: 0.16 };
  const horn = { base: 0.18, ambient: 0.2, bounce: 0.18, gloss: 0.25, shine: 20 };
  const turf = { base: 0.16, ambient: 0.3, bounce: 0 };
  const herb = { base: 0.16, ambient: 0.22, bounce: 0.14, gloss: 0.15, shine: 12 };

  const layers = [];
  const layer = (id, set, material, ink, { cls = "intaglio-ink", shape, fade } = {}) => layers.push({ id, set, material, ink, cls, shape, fade });

  // The bare white skin of the face: a stripe over the eye and a patch under it.
  const face = (s, t) => {
    const q = I.sub(s.p, HEAD.c);
    const al = I.dot(q, HEAD.f) / HEAD.A;
    const up = I.dot(q, headUp) / HEAD.B;
    const stripe = S(0.12, 0.03, Math.abs(up - 0.42)) * S(-0.55, -0.3, al) * S(0.75, 0.5, al);
    const patch = S(0.16, 0.06, Math.abs(up + 0.36)) * S(-0.35, -0.1, al) * S(0.7, 0.45, al);
    return t * (1 - 0.7 * Math.max(stripe, patch));
  };
  const scutes = (s, t) => I.clamp01(t + 0.3 * Math.exp(-(((((s.p[2] / 1.05) % 1) - 0.5) / 0.14) ** 2)));
  const groundFade = (s) => 1 - S(0.5, 1, Math.hypot(s.p[0] / 130, (s.p[1] - 10) / 40));

  const each = (list, fn) => merge(list.flatMap(fn));
  const eyes = (list, prefix, inks) => {
    const band = (id, lo, hi, material, ink, cls, spacing = 1.15) => layer(`${prefix}-${id}`, each(list, (f) => [H(f.ocellus, { range: [lo, hi], spacing, step: 0.8 })]), material, ink, { cls });
    band("heart", 0, 0.42, { ...plume, base: 0.9 }, { from: 0.1, to: 0.8, width: 0.9 }, inks.heart, 1.05);
    band("ring", 0.42, 0.56, { ...plume, base: 0.25 }, { from: 0.1, to: 0.8, width: 0.75 }, inks.ring);
    band("bronze", 0.56, 0.76, { ...plume, base: 0.62 }, { from: 0.12, to: 0.85, width: 0.85 }, inks.bronze);
    band("halo", 0.76, 1, { ...plume, base: 0.2 }, { from: 0.15, to: 0.85, width: 0.7 }, inks.halo);
  };

  layer("train", each(feathers, (f) => f.halves.map((h) => H(h, { spacing: 2.6, step: 1.8 }))), plume, { from: 0.16, to: 0.82, width: 0.9 }, { cls: "ink-green" });
  layer("train-x", each(feathers, (f) => f.across.map((h) => H(h, { spacing: 2.3, step: 1.9 }))), plume, { from: 0.6, to: 0.96, width: 0.7 });
  eyes(feathers, "eye", { heart: "intaglio-ink", ring: "ink-teal", bronze: "ink-orange", halo: "ink-olive" });


  layer("body", H(body, { spacing: 2, step: 1.2 }), royal, { from: 0.16, to: 0.8, width: 1 }, { cls: "ink-blue" });
  layer("body-x", H(body, { spacing: 2.7, slant: 0.3, step: 1.2 }), royal, { from: 0.58, to: 0.95, width: 0.75 });
  layer("head", H(head, { along: "v", spacing: 1.25, step: 0.8 }), royal, { from: 0.18, to: 0.8, width: 0.7 }, { cls: "ink-blue", shape: face });
  layer("head-x", H(head, { spacing: 1.7, slant: 0.35, step: 0.8 }), royal, { from: 0.62, to: 0.96, width: 0.5 }, { shape: face });
  layer("beak", H(beak, { along: "v", spacing: 1.3, step: 0.8 }), horn, { from: 0.12, to: 0.75, width: 0.7 }, { cls: "ink-orange" });
  layer("wings", merge(wings.map((w) => H(w.surface, { along: "v", spacing: 2, step: 1.1 }))), buff, { from: 0.14, to: 0.8, width: 0.95 }, { cls: "ink-olive" });
  layer("wings-x", merge(wings.map((w) => H(w.surface, { spacing: 2.7, slant: 0.3, step: 1.1 }))), buff, { from: 0.58, to: 0.95, width: 0.7 });

  const legParts = legs.flatMap((g) => [g.tarsus, g.spur, ...g.toes.flatMap((t) => [t.bone, t.claw])]);
  layer("legs", merge(legParts.map((p) => H(p, { spacing: 1.45, step: 0.9 }))), horn, { from: 0.15, to: 0.8, width: 0.75 }, { shape: scutes });
  layer("legs-x", merge(legParts.map((p) => H(p, { along: "v", spacing: 1.9, step: 0.9 }))), horn, { from: 0.6, to: 0.96, width: 0.55 });
  layer("thighs", merge(legs.map((g) => H(g.thigh, { spacing: 1.9, slant: 0.2, step: 1 }))), royal, { from: 0.2, to: 0.8, width: 0.85 }, { cls: "ink-blue" });

  layer("grass", merge(grass.map((g) => H(g, { along: "v", spacing: 1.5, step: 1 }))), herb, { from: 0.14, to: 0.78, width: 0.8 }, { cls: "ink-green" });
  layer("ground", H(ground, { spacing: 2.8, step: 1.6 }), turf, { from: 0.12, to: 0.85, width: 0.85 }, { fade: groundFade });
  layer("ground-x", H(ground, { spacing: 3.6, slant: 0.5, step: 1.6 }), turf, { from: 0.4, to: 0.95, width: 0.7 }, { fade: groundFade });

  // Engraved marks, by ink: each feather's rachis and vane outline, the wing coverts, the crest, the eye, the legs, the grass.
  const marks = {};
  const M = (cls, pts, opts) => (marks[cls] ??= []).push(I.stroke(pts, cam, occ.sees, opts));
  for (const f of feathers) {
    M("ink-green", steps(90).map((t) => f.point(0, mix(16, f.eye.l - f.eye.a * 0.9, t))), { width: 0.5, taper: 30 });
    const from = f.c - 11 * (f.W / 3.6);
    const edge = (side) => steps(60).map((t) => f.point(side * f.width(mix(from, f.L, t)), mix(from, f.L, t)));
    M("intaglio-ink", [...edge(-1), ...edge(1).reverse()], { width: 0.4, taper: 14 });
    M("intaglio-ink", steps(48).map((t) => {
      const a = t * I.TAU;
      return f.point(f.eye.b * Math.cos(a), f.eye.l + f.eye.a * Math.sin(a));
    }), { width: 0.32 });
  }
  for (const w of wings) {
    for (let r = 0; r < 6; r++) {
      const a0 = 0.05 + r * 0.1;
      for (let k = -1; k < 6; k++) {
        const b0 = (k + 0.5 + (r % 2) * 0.5) / 5.5;
        const arc = (depth, half) => steps(16)
          .map((t) => [a0 + depth * Math.sin(Math.PI * t), b0 + half * Math.cos(Math.PI * t)])
          .filter(([, b]) => b > 0.03 && b < 0.97)
          .map(([a, b]) => w.at(a, b));
        for (const [depth, half, width] of [[0.11, 0.09, 0.45], [0.075, 0.06, 0.8], [0.045, 0.035, 0.55]]) {
          const pts = arc(depth, half);
          if (pts.length > 2) M("ink-green", pts, { width, taper: 3, lift: 1.4 });
        }
      }
    }
    for (let k = 1; k < 5; k++) M("ink-orange", steps(30).map((t) => w.at(mix(0.64, 0.97 - 0.04 * k, t), k / 5 + 0.04 * t)), { width: 0.55, taper: 6, lift: 1.4 });
    M("intaglio-ink", [...steps(60).map((a) => w.at(a, 0)), ...steps(60).reverse().map((a) => w.at(a, 1)), w.at(0, 0)], { width: 0.45 });
  }
  const crown = headPoint(-0.05, 0.98);
  for (let k = 0; k < 18; k++) {
    const t = k / 17 - 0.5;
    const ang = (90 - 60 * t) * I.deg;
    const len = 5.6 + 0.9 * Math.cos(t * 3);
    const y = -1 + 2 * ((k * 0.618) % 1);
    const base = I.add(crown, [0.6 * t, y * 0.5, -0.4]);
    const tip = I.add(base, [Math.cos(ang) * len, y * 0.3 - 0.4, Math.sin(ang) * len]);
    M("ink-blue", [base, tip], { width: 0.28 });
    const dir = I.unit(I.sub(tip, base));
    M("ink-blue", steps(10).map((q) => I.add(tip, I.mul(dir, -0.2 + 1.5 * q))), { width: 1.7, taper: 5 });
  }
  const eye = headPoint(0.32, 0.12);
  M("intaglio-ink", I.circle(eye, I.mul(VIEW, -1), 0.75, 40), { width: 0.4, lift: 0.8 });
  M("intaglio-ink", [I.add(eye, [-0.12, 0, 0]), I.add(eye, [0.12, 0, 0])], { width: 1.5, lift: 0.8 });
  M("intaglio-ink", steps(10).map((t) => I.add(beakBase, I.add(I.mul(beakAxis, 0.2 + 3 * t), I.add(I.mul(headSide, nearSide * 0.9 * (1 - t)), [0, 0, -0.15])))), { width: 0.4, taper: 6, lift: 0.9 });
  const contour = (from, to, r0, r1) => {
    const side = I.unit(I.cross(I.sub(to, from), cam.view));
    for (const k of [-1, 1]) M("intaglio-ink", steps(20).map((t) => I.add(I.add(from, I.mul(I.sub(to, from), t)), I.mul(side, k * mix(r0, r1, t)))), { width: 0.32, taper: 4 });
  };
  for (const g of LEGS) {
    contour(I.add(g.foot, [0, 0, 1]), I.add(g.heel, I.mul(I.unit(I.sub(g.foot, g.heel)), 1.4)), 1.02, 0.97);
    g.toes.forEach((d, i) => {
      const dir = I.unit([d[0], d[1], -0.06]);
      contour(I.add(g.foot, I.mul(dir, 1.2)), I.add(g.foot, I.mul(dir, i === 1 ? 8.6 : 6.6)), 0.78, 0.44);
    });
  }
  for (const g of grass) M("ink-green", steps(30).map((v) => g.point(0.5, v * 0.96)[0]), { width: 0.3, taper: 10 });

  // Toes, claws and spurs cast too little shadow to be worth their triangles in the live shadow map.
  const casters = solids.filter((x) => !legs.some((g) => x === g.spur || g.toes.some((t) => x === t.bone || x === t.claw)));
  return { cam, solids, tris: I.trianglesOf(casters), layers, marks: Object.fromEntries(Object.entries(marks).map(([cls, d]) => [cls, d.join("")])) };
};

/** Ink every layer for a light angle. A negative plate (pale ink on dark paper) inks the light instead of the shade. */
export const inkAt = (S, angle, { size = 1024, negative = false } = {}) => {
  const light = lightAt(S.cam, angle);
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris, soft: 1.4 });
  const out = {};
  for (const l of S.layers) {
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    const shaded = l.shape ? (s) => l.shape(s, lit(s)) : lit;
    const plate = negative ? (s) => 1 - shaded(s) : shaded;
    out[l.id] = I.ink(l.set, l.fade ? (s) => plate(s) * l.fade(s) : plate, l.ink);
  }
  return out;
};
