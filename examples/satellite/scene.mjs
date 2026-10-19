import * as I from "../../kit/intaglio.mjs";

// A geostationary communications satellite over the Earth's limb, engraved. Its antennas hold on the Earth, so in
// its own frame the sun goes once round it a day: the solar wings turn on their drives 15° an hour to keep their
// cells square to the sun, while the bus, the reflectors and the Earth below pass from day into night and back.
// World units are metres in the satellite's frame: x east (along the orbit), y north (the wing axis), z away from
// the Earth (zenith). The Earth is set behind and below at plate scale; only its lighting is true.

export const WIDTH = 720;
export const HEIGHT = 430;

/** The sun's declination on the build date, in degrees. Below about 8.7° the sun clears the Earth: no eclipse. */
const DAY = (Date.UTC(2026, 9, 19) - Date.UTC(2026, 0, 1)) / 864e5 + 1;
export const DECLINATION = -23.44 * Math.cos((I.TAU / 365) * (DAY + 10));

/** The wing drive's angle at local solar time `hours` at the sub-satellite point: 0 at noon, 15° an hour. */
export const driveAngle = (hours) => (hours - 12) * 15 * I.deg;

/** The direction to the sun from the satellite: overhead at local noon, behind the Earth at midnight. */
export const sunAt = (hours) => {
  const th = driveAngle(hours);
  const d = DECLINATION * I.deg;
  return [-Math.sin(th) * Math.cos(d), Math.sin(d), Math.cos(th) * Math.cos(d)];
};

const AZIMUTH = 18;
const ELEVATION = 24;

const BX = 1.2;
const BY = 1.1;
const BZ = 1.5;
const DRIVE = BY + 0.4;
const ROOT = 2.7;
const PANEL_L = 2.4;
const PANEL_GAP = 0.12;
const PANEL_W = 1.9;
const PANELS = 3;
const TIP = ROOT + PANELS * PANEL_L + (PANELS - 1) * PANEL_GAP;
const BLOCKS = 4;
const PER_BLOCK = 9;

const DISH_R = 1.3;
const DISH_F = 1.1;
const SAG = (DISH_R * DISH_R) / (4 * DISH_F);

// Hash noise for the foil's crinkle and the clouds.
const hash = (x, y, z) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
};
const noise = ([x, y, z]) => {
  const [i, j, k] = [Math.floor(x), Math.floor(y), Math.floor(z)];
  const [u, v, w] = [x - i, y - j, z - k].map((t) => t * t * (3 - 2 * t));
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (a, b, d) => hash(i + a, j + b, k + d);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v), lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
};
const fbm = (p, octaves = 4) => {
  let sum = 0;
  let amp = 0.5;
  let q = p;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(q);
    q = I.add(I.mul(q, 2.03), [5.2, 1.3, 7.7]);
    amp /= 2;
  }
  return sum / (1 - 0.5 ** octaves);
};

/** A plain rod from one point to another with exact normals; u runs round it, v along it. */
const rod = (from, to, r, sides = 10) => {
  const d = I.sub(to, from);
  const { b, c } = I.frameOf(d);
  const point = (u, v) => {
    const n = I.add(I.mul(b, Math.cos(u * I.TAU)), I.mul(c, Math.sin(u * I.TAU)));
    return [I.add(I.add(from, I.mul(d, v)), I.mul(n, r)), n];
  };
  const triangles = () => {
    const tris = [];
    for (let i = 0; i < sides; i++) {
      const [p, q, s, t] = [[i, 0], [i + 1, 0], [i + 1, 1], [i, 1]].map(([x, y]) => point(x / sides, y)[0]);
      tris.push([p, q, s], [p, s, t]);
    }
    return tris;
  };
  return { point, triangles };
};

/** A lathe seen from both sides: [outer, inner]. Hatch both, occlude with the first. */
const shell = (opts) => [I.lathe(opts), I.lathe({ ...opts, profile: [...opts.profile].reverse() })];

const gold = { base: 0.2, ambient: 0.1, bounce: 0.22, gloss: 0.55, shine: 16 };
const white = { base: 0.1, ambient: 0.12, bounce: 0.22 };
const metal = { base: 0.14, ambient: 0.1, bounce: 0.2, gloss: 0.8, shine: 50 };
const mirror = { base: 0.42, ambient: 0.08, bounce: 0.14, gloss: 0.9, shine: 60 };
const cells = { base: 0.62, ambient: 0.08, bounce: 0.08, gloss: 0.45, shine: 26 };
const ocean = { base: 0.46, ambient: 0.02, bounce: 0 };
const cloud = { base: 0, ambient: 0.03, bounce: 0 };

/** The fixed parts: bus, drives, reflectors with arms and feeds, nozzle, omni mast and thrusters. Each part lists its hatch layers. */
const fixedParts = () => {
  const parts = [];
  const add = (solid, layers, occlude = true) => parts.push({ solid, layers, occlude });
  const crinkle = (p) => fbm(I.mul(p, 2.6), 3);

  const bus = I.box({ min: [-BX, -BY, -BZ], max: [BX, BY, BZ], capAlong: [1, 0, 0] });
  bus.forEach((f, i) => {
    const radiator = i >= 2 && Math.abs(f.normal[1]) > 0.9;
    const mat = radiator ? mirror : gold;
    const shape = radiator ? null : (s) => (s.cr ??= crinkle(s.p));
    add(f, [
      { opts: { spacing: 1.8 }, mat, ink: { from: 0.22, to: 0.74, width: 1 }, shape },
      { opts: { spacing: 2.3, slant: 0.55 }, mat, ink: { from: 0.58, to: 0.95, width: 0.8 }, shape },
    ]);
  });

  for (const s of [-1, 1]) {
    const drive = I.lathe({ base: [0, s * BY, 0], axis: [0, s, 0], profile: [[0, 0.24, 1], [0.07, 0.24, 1], [0.07, 0.13, 1], [0.32, 0.13, 1], [0.32, 0.17, 1], [0.4, 0.17, 1]] });
    add(drive, [{ opts: { spacing: 1.4, along: "v", step: 1 }, mat: metal, ink: { from: 0.16, to: 0.72, width: 0.7 } }]);

    // The reflector opens down and inward toward its feed, which sits at the focus on a boom from the Earth deck.
    const vertex = [s * 2.7, 0, -0.3];
    const axis = I.unit([-s * 0.42, 0, -1]);
    const profile = Array.from({ length: 13 }, (_, k) => {
      const r = 0.04 + ((DISH_R - 0.04) * k) / 12;
      return [(r * r) / (4 * DISH_F), r];
    });
    const [back, front] = shell({ base: vertex, axis, profile });
    add(back, [
      { opts: { spacing: 1.7 }, mat: white, ink: { from: 0.04, to: 0.72, width: 0.95 } },
      { opts: { spacing: 2.4, slant: 0.35 }, mat: white, ink: { from: 0.55, to: 0.95, width: 0.7 } },
    ]);
    add(front, [
      { opts: { spacing: 1.7 }, mat: white, ink: { from: 0.04, to: 0.72, width: 0.95 } },
      { opts: { spacing: 2.4, slant: 0.35 }, mat: white, ink: { from: 0.55, to: 0.95, width: 0.7 } },
    ], false);
    const arm = rod([s * BX, 0, 0.95], I.add(vertex, I.mul(axis, -0.04)), 0.05);
    add(arm, [{ opts: { along: "v", lines: 6, step: 1 }, mat: metal, ink: { from: 0.14, to: 0.7, width: 0.6 } }]);

    const focus = I.add(vertex, I.mul(axis, DISH_F));
    const hornBase = I.add(focus, I.mul(axis, 0.42));
    const [horn, mouth] = shell({ base: hornBase, axis: I.mul(axis, -1), profile: [[0, 0.07, 1], [0.12, 0.08], [0.36, 0.19, 1]] });
    add(horn, [{ opts: { spacing: 1.2, step: 1 }, mat: metal, ink: { from: 0.16, to: 0.75, width: 0.6 } }]);
    add(mouth, [{ opts: { spacing: 1.2, step: 1 }, mat: metal, ink: { from: 0.16, to: 0.75, width: 0.6 } }], false);
    const boom = rod([s * (BX - 0.15), 0, -BZ], I.add(hornBase, I.mul(axis, 0.02)), 0.04);
    add(boom, [{ opts: { along: "v", lines: 5, step: 1 }, mat: metal, ink: { from: 0.14, to: 0.7, width: 0.55 } }]);
  }

  // The apogee engine on the anti-Earth deck: a flange, the throat and the bell.
  const [bell, bellIn] = shell({
    base: [0, 0, BZ],
    profile: [[0, 0.24, 1], [0.06, 0.24, 1], [0.06, 0.12, 1], [0.14, 0.11], [0.3, 0.17], [0.52, 0.26], [0.74, 0.34, 1]],
  });
  add(bell, [
    { opts: { spacing: 1.3, step: 1 }, mat: metal, ink: { from: 0.16, to: 0.72, width: 0.75 } },
    { opts: { spacing: 1.7, slant: 0.3, step: 1 }, mat: metal, ink: { from: 0.6, to: 0.95, width: 0.55 } },
  ]);
  add(bellIn, [{ opts: { spacing: 1.3, step: 1 }, mat: metal, ink: { from: 0.16, to: 0.75, width: 0.75 } }], false);

  const mast = rod([-0.75, 0.7, BZ], [-0.75, 0.7, BZ + 1.05], 0.035, 8);
  add(mast, [{ opts: { along: "v", lines: 4, step: 1 }, mat: metal, ink: { from: 0.14, to: 0.7, width: 0.5 } }]);
  const omni = I.lathe({ base: [-0.75, 0.7, BZ + 1.0], profile: [[0, 0.03, 1], [0.11, 0.15, 1], [0.13, 0.15, 1], [0.24, 0.03, 1]] });
  add(omni, [{ opts: { spacing: 1.1, step: 0.8 }, mat: white, ink: { from: 0.22, to: 0.75, width: 0.55 } }]);

  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const [jet, jetIn] = shell({ base: [sx * (BX - 0.16), sy * (BY - 0.16), BZ], axis: I.unit([sx * 0.5, sy * 0.5, 1]), profile: [[0, 0.06, 1], [0.05, 0.06, 1], [0.05, 0.03, 1], [0.2, 0.08, 1]] });
    add(jet, [{ opts: { spacing: 1.1, step: 0.8 }, mat: metal, ink: { from: 0.16, to: 0.75, width: 0.5 } }]);
    add(jetIn, [{ opts: { spacing: 1.1, step: 0.8 }, mat: metal, ink: { from: 0.16, to: 0.8, width: 0.5 } }], false);
  }
  return parts;
};

/** The wings at a drive angle: yoke rods and three panels each, cells on the sun side, plain white on the back. */
const wingsAt = (th) => {
  const t = [Math.cos(th), 0, Math.sin(th)];
  const parts = [];
  const hulls = [];
  const edges = [];
  for (const s of [-1, 1]) {
    const y = (d) => [0, s * d, 0];
    const corner = (d, w) => I.add(y(d), I.mul(t, w));
    for (const w of [-0.82, 0.82]) {
      const r = rod(y(DRIVE), corner(ROOT, w), 0.04, 8);
      parts.push({ solid: r, kind: "rod" });
      hulls.push([y(DRIVE), corner(ROOT, w)]);
    }
    for (let k = 0; k < PANELS; k++) {
      const y0 = ROOT + k * (PANEL_L + PANEL_GAP);
      const at = (u, v) => I.add(y(y0 + u * PANEL_L), I.mul(t, (v - 0.5) * PANEL_W));
      const front = I.patch({ at, side: -s, nu: 2, nv: 2 });
      const back = I.patch({ at, side: s, nu: 2, nv: 2 });
      // Paper gaps between the strings of cells: one line dropped at each block edge, a break down the middle.
      const lines = BLOCKS * PER_BLOCK;
      front.mask = (u, v) => {
        const j = Math.floor(u * lines);
        return !(j % PER_BLOCK === 0 && j > 0) && Math.abs(v - 0.5) > 0.014;
      };
      parts.push({ solid: front, kind: "front", lines }, { solid: back, kind: "back", hidden: true });
      const c = [corner(y0, -PANEL_W / 2), corner(y0 + PANEL_L, -PANEL_W / 2), corner(y0 + PANEL_L, PANEL_W / 2), corner(y0, PANEL_W / 2)];
      hulls.push(c);
      edges.push([...c, c[0]]);
    }
  }
  return { parts, hulls, edges };
};

export const scene = ({ ss = 3 } = {}) => {
  const fixed = fixedParts();
  const reach = [
    [BX, BY, BZ + 1.3], [-BX, -BY, -BZ], [2.7 + 1.4, 0, -1.5], [-2.7 - 1.4, 0, -1.5], [3.4, 0, 0.6], [-3.4, 0, 0.6],
    ...[-1, 1].flatMap((s) => I.circle([0, s * TIP, 0], [0, 1, 0], PANEL_W / 2, 24)),
  ];
  const fit = I.fitCamera(reach, { width: WIDTH, height: HEIGHT * 0.66, pad: 28, azimuth: AZIMUTH, elevation: ELEVATION });
  const cam = I.camera({ azimuth: AZIMUTH, elevation: ELEVATION, scale: fit.scale, offset: [fit.offset[0], fit.offset[1] + HEIGHT * 0.05], width: WIDTH, height: HEIGHT });

  // The Earth: a cap of a big sphere behind the satellite, its limb arcing across the foot of the plate.
  const RS = 1050;
  const limbY = HEIGHT * 0.69;
  const R = RS / cam.scale;
  const earthCenter = I.add(I.add(I.mul(cam.right, (WIDTH / 2 - cam.offset[0]) / cam.scale), I.mul(cam.up, -(limbY + RS - cam.offset[1]) / cam.scale)), I.mul(cam.view, -R - 30));
  const [ex, ey] = cam.project(earthCenter);
  // Lines run round the view axis, so they follow the limb like the courses an engraver cuts round a globe.
  const earthAt = (u, v) => {
    const phi = (90 + (u - 0.5) * 56) * I.deg;
    const psi = (58 + v * 32) * I.deg;
    const radial = I.add(I.mul(cam.right, Math.cos(phi)), I.mul(cam.up, Math.sin(phi)));
    return I.add(earthCenter, I.mul(I.add(I.mul(radial, Math.sin(psi)), I.mul(cam.view, Math.cos(psi))), R));
  };
  const earth = I.patch({ at: earthAt, nu: 48, nv: 48 });
  const inPlate = (u, v) => {
    const [x, y] = cam.project(earthAt(u, v));
    return x > -8 && x < WIDTH + 8 && y < HEIGHT + 8;
  };
  earth.mask = inPlate;
  const outward = I.sub(earth.point(0.5, 0.5)[0], earthCenter);
  if (I.dot(earth.point(0.5, 0.5)[1], outward) < 0) {
    const flip = earth.point;
    earth.point = (u, v) => {
      const [p, n] = flip(u, v);
      return [p, I.mul(n, -1)];
    };
  }

  const satSolids = fixed.filter((f) => f.occlude).map((f) => f.solid);
  const occ = I.occlusion([earth, ...satSolids], cam, { ss, halo: satSolids });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);

  // Clouds ride with the Earth's face, which a geostationary satellite always sees the same.
  const cloudAt = (p) => {
    const n = I.unit(I.sub(p, earthCenter));
    const band = Math.exp(-((n[1] / 0.12) ** 2)) * 0.12;
    const q = I.add(I.mul(n, 13), I.mul([fbm(I.mul(n, 5), 3), fbm(I.add(I.mul(n, 5), [3.1, 0, 1.7]), 3), 0], 2.2));
    return I.smoothstep(0.54, 0.64, fbm(q, 5) + band);
  };
  const rim = (s) => I.smoothstep(RS, RS - 16, Math.hypot(s.x - ex, s.y - ey));
  const gap = (s) => I.smoothstep(1.2, 4, occ.clear(s.x, s.y));
  const earthShape = (s) => (s.shape ??= rim(s) * gap(s));
  const earthLayers = [
    { id: "earth", set: H(earth, { spacing: 2.6, step: 2 }), ink: { from: 0.12, to: 0.72, width: 1.15 } },
    { id: "earth-x", set: H(earth, { spacing: 3.4, slant: 0.5, step: 2 }), ink: { from: 0.62, to: 0.95, width: 0.8 } },
  ];

  // Space: ruled dark, darkest at the top, with stars left as paper.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = [];
  while (stars.length < 150) {
    const x = rand() * WIDTH;
    const y = rand() * limbY;
    const bright = rand();
    const size = bright > 0.95 ? 5 + rand() * 4 : bright > 0.8 ? 2.4 : 1.4;
    if (Math.hypot(x - ex, y - ey) < RS + 14 || occ.clear(x, y) < 14) continue;
    stars.push({ x, y, size });
  }
  const starAt = (x, y) => stars.some((st) => {
    const dx = Math.abs(x - st.x) / st.size;
    const dy = Math.abs(y - st.y) / st.size;
    return st.size > 3 ? Math.sqrt(dx) + Math.sqrt(dy) < 1 : dx * dx + dy * dy < 1;
  });
  const sky = I.ruling(cam, occ, {
    spacing: 2.4,
    halo: 8,
    region: (x, y) => Math.hypot(x - ex, y - ey) > RS + 7 && !starAt(x, y),
  });
  const skyTone = (s) => 0.6 + 0.3 * I.smoothstep(limbY, 0, s.y);

  const fixedLayers = fixed.flatMap((f) => f.layers.map((l) => ({ ...l, surface: f.solid })));
  const fixedTris = I.trianglesOf(satSolids);
  return { cam, occ, earth, earthCenter, earthLayers, earthShape, cloudAt, sky, skyTone, stars, fixedLayers, fixedTris, ex, ey, RS };
};

/**
 * One frame at local solar time `hours`: the Earth re-inked, the whole satellite re-hatched with the wings at their
 * drive angle (they hide and are hidden through the static depth buffer plus themselves), and the paper knock-outs
 * that lift the wings off the Earth and sky behind them. A negative plate inks the light, not the shade.
 */
export const inkAt = (S, hours, { size = 640, negative = false } = {}) => {
  const { cam } = S;
  const light = sunAt(hours);
  const wings = wingsAt(driveAngle(hours));
  const wingTris = I.trianglesOf(wings.parts.filter((p) => !p.hidden).map((p) => p.solid));
  const sees = S.occ.plus([{ triangles: () => wingTris }]);
  const shadow = I.shadowMap(null, light, { size, tris: [...S.fixedTris, ...wingTris], soft: 1 });
  const neg = (f) => (negative ? (s) => 1 - f(s) : f);
  const lit = (mat) => I.lighting({ ...mat, light, view: cam.view, shadow });
  const H = (surface, opts) => I.hatch(surface, cam, sees, opts);
  const out = {};

  const sea = I.lighting({ ...ocean, light, view: cam.view });
  const sky = I.lighting({ ...cloud, light, view: cam.view });
  const earthTone = neg((s) => {
    const c = (s.cloud ??= S.cloudAt(s.p));
    return sea(s) * (1 - c) + sky(s) * c;
  });
  for (const l of S.earthLayers) out[l.id] = I.ink(l.set, (s) => earthTone(s) * S.earthShape(s), l.ink);

  const ink = [];
  for (const l of S.fixedLayers) {
    const base = lit(l.mat);
    const tone = l.shape ? (s) => I.clamp01(base(s) + 0.5 * (l.shape(s) - 0.5)) : base;
    ink.push(I.ink(H(l.surface, l.opts), neg(tone), l.ink));
  }
  const cellTone = neg(lit(cells));
  const backTone = neg(lit(white));
  const rodTone = neg(lit(metal));
  for (const p of wings.parts) {
    if (p.kind === "rod") ink.push(I.ink(H(p.solid, { along: "v", lines: 5, step: 1 }), rodTone, { from: 0.14, to: 0.7, width: 0.55 }));
    else if (p.kind === "front") {
      ink.push(I.ink(H(p.solid, { along: "v", lines: p.lines, step: 1.2 }), cellTone, { from: 0.18, to: 0.8, width: 1 }));
      ink.push(I.ink(H(p.solid, { spacing: 2.6, slant: 0.4, step: 1.2 }), cellTone, { from: 0.7, to: 0.98, width: 0.7 }));
    } else {
      ink.push(I.ink(H(p.solid, { along: "v", spacing: 2, step: 1.2 }), backTone, { from: 0.2, to: 0.75, width: 0.95 }));
      ink.push(I.ink(H(p.solid, { spacing: 2.6, slant: 0.45, step: 1.2 }), backTone, { from: 0.62, to: 0.95, width: 0.7 }));
    }
  }
  for (const e of wings.edges) ink.push(I.stroke(e, cam, sees, { width: 0.5 }));
  out.sat = ink.join("");
  out.knock = wings.hulls.map((h) => I.hullPath(h.map((p) => cam.project(p)))).join("");
  return out;
};
