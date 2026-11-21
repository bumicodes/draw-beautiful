import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// The Golden Gate Bridge in the summer fog, printed as a mezzotint.
// World units are metres: x east, y north, z up, the strait at z = 0. The bridge runs north-south along x = 0 at its
// real size: the north tower at y = 0, the south tower 1280 m away at y = -1280, side spans of 343 m, towers 227 m
// above the water, the roadway 67 m up on a 7.6 m stiffening truss, two main cables 27.4 m apart hung in parabolas
// from the tower tops, suspenders every 15.2 m. The eye stands on the Marin headlands north-west of the north tower
// and looks south-east down the span. The marine layer fills the strait, its billowed top just under the deck, so
// the deck runs into it, the south tower stands up out of it and the city is a ridge in haze. The sun follows San
// Francisco's sky (37.8° N) at midsummer: in the morning it is behind the bridge and the towers stand dark against the
// glare, in the evening it comes over the viewer's shoulder and lights the faces we see.

export const WIDTH = 760;
export const HEIGHT = 460;
export const RES = 2;

const PAINT = 4;

export const LATITUDE = 37.82;
export const DECLINATION = 21;

const MAIN = 1280;
const SIDE = 343;
const ROAD = 67;
const TRUSS = 7.6;
const TOP = 227;
const SADDLE = 213;
const SAG = 72;
const HALF = 27.4 / 2;
const HANGER = 15.2;

const lerp = (a, b, t) => a + (b - a) * t;

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

/** The main cable's height over y: a parabola across the main span, shallower ones down to the anchorages. */
export const cableZ = (y) => {
  if (y <= 0 && y >= -MAIN) return SAG + (SADDLE - SAG) * ((y + MAIN / 2) / (MAIN / 2)) ** 2;
  const s = y > 0 ? y / SIDE : (-MAIN - y) / SIDE;
  return lerp(SADDLE, ROAD + 4, s) - 4 * 14 * s * (1 - s);
};

/** The Marin headlands: low by the road, rising steeply to the west, falling into the strait along the shore. */
const shore = (x) => 40 + 30 * Math.sin(x / 260) + 0.08 * Math.abs(x);
const land = (x, y) => {
  const d = Math.max(0, y - shore(x));
  const peak = 130 + 140 * I.smoothstep(-80, -520, x) + 60 * I.smoothstep(120, 700, x);
  return peak * (1 - Math.exp(-d / 260)) - 6 + 14 * (M.fbm(x / 90, y / 90, { octaves: 4, seed: 2 }) - 0.5);
};

const EYE_XY = [-470, 390];
const EYE = [...EYE_XY, land(...EYE_XY) + 30];
const TARGET = [129, -532, 60];
// The viewer stands on a bluff, and a knoll off to the left frames the view.
const bump = (x, y, [cx, cy], r, h) => h * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r));
const KNOLL = [-330, 380];
const ground = (x, y) => land(x, y) + bump(x, y, EYE_XY, 50, 28) + bump(x, y, KNOLL, 60, 30);

/**
 * One tower leg: a shaft of stacked blocks, each set back from the one below, as the real legs step in at every
 * portal. Centred on x, the tower's line at y.
 */
const STAGES = [
  [13, 72, 5.0, 8.4],
  [72, 112, 4.5, 7.6],
  [112, 150, 4.0, 6.8],
  [150, 186, 3.6, 6.0],
  [186, TOP - 4, 3.2, 5.3],
  [TOP - 4, TOP, 3.5, 5.6],
];
const leg = (x, y) => STAGES.flatMap(([z0, z1, w, d]) => I.box({ min: [x - w, y - d, z0], max: [x + w, y + d, z1] }));

/** A straight member in the tower's plane from a to b ([x, z] pairs), `width` across, `depth` through. */
const strut = (y, [ax, az], [bx, bz], width, depth) => {
  const len = Math.hypot(bx - ax, bz - az);
  const px = (-(bz - az) / len) * (width / 2);
  const pz = ((bx - ax) / len) * (width / 2);
  const outline = [[ax - px, y - depth, az - pz], [bx - px, y - depth, bz - pz], [bx + px, y - depth, bz + pz], [ax + px, y - depth, az + pz]];
  return I.prism({ outline, extrude: [0, 2 * depth, 0] });
};

const tower = (y) => {
  const legs = [-HALF, HALF].flatMap((x) => leg(x, y));
  // Four portals above the roadway, the last at the crown; X-bracing between the legs below it.
  const portals = [[108, 118], [146, 155], [182, 190], [TOP - 14, TOP - 4]].flatMap(([z0, z1]) => I.box({ min: [-HALF + 3, y - 4.4, z0], max: [HALF - 3, y + 4.4, z1] }));
  const inner = HALF - 4.6;
  const bracing = [
    ...strut(y, [-inner, 16], [inner, 56], 3, 4.8),
    ...strut(y, [inner, 16], [-inner, 56], 3, 4.8),
    ...I.box({ min: [-inner, y - 4.8, 56], max: [inner, y + 4.8, ROAD - TRUSS - 0.4] }),
  ];
  const saddles = [-HALF, HALF].flatMap((x) => I.box({ min: [x - 2.6, y - 4.5, TOP], max: [x + 2.6, y + 4.5, TOP + 3.2] }));
  const pier = I.box({ min: [-HALF - 11, y - 16, -4], max: [HALF + 11, y + 16, 13] });
  return { steel: [...legs, ...portals, ...bracing, ...saddles], pier };
};

/** A Warren truss face along x = `x` from y0 to y1: chords, posts and diagonals, open between. */
const truss = (x, y0, y1) => {
  const len = Math.abs(y1 - y0);
  const panel = 7.6;
  return I.patch({
    at: (u, v) => [x, lerp(y0, y1, u), ROAD - TRUSS + v * TRUSS],
    nu: 1,
    nv: 1,
    side: x < 0 ? -1 : 1,
    mask: (u, v) => {
      const s = (u * len) / panel;
      const k = Math.floor(s);
      const f = s - k;
      const h = v;
      if (h < 0.1 || h > 0.88) return true;
      if (f < 0.05 || f > 0.95) return true;
      const diag = k % 2 ? 1 - h : h;
      return Math.abs(f - diag) < 0.08;
    },
  });
};

export const scene = ({ res = RES } = {}) => {
  const cam = I.perspective({ eye: EYE, target: TARGET, scale: 0.7, offset: [WIDTH * 0.5, HEIGHT * 0.5], width: WIDTH, height: HEIGHT });
  const focal = 0.7 * Math.hypot(...I.sub(TARGET, EYE));
  // At least `px` screen px across at the distance of p, so a cable or a hanger never breaks up into dots.
  const atLeast = (p, real, px) => Math.max(real, (px * Math.hypot(...I.sub(p, EYE))) / focal);

  const north = tower(0);
  const south = tower(-MAIN);
  const Y0 = SIDE + 170;
  const Y1 = -MAIN - SIDE - 60;

  // The deck: the roadway slab and the two stiffening trusses under it, the whole length.
  const road = I.box({ min: [-HALF - 0.6, Y1, ROAD - 0.9], max: [HALF + 0.6, Y0, ROAD] });
  const trusses = [-HALF, HALF].map((x) => truss(x, Y0, Y1));
  const chord = I.box({ min: [-HALF + 0.4, Y1, ROAD - TRUSS], max: [HALF - 0.4, Y0, ROAD - TRUSS + 0.5] });
  const rails = [-HALF - 0.6, HALF + 0.6].flatMap((x) => I.box({ min: [x - 0.15, Y1, ROAD], max: [x + 0.15, Y0, ROAD + 1.3] }));

  // The cables, thickened only as far as they must be to stay whole on the plate.
  const cable = (x, y0, y1, n) =>
    I.patch({
      at: (u, a) => {
        const y = lerp(y0, y1, u);
        const c = [x, y, cableZ(y)];
        const r = atLeast(c, 0.46, 0.7);
        return [x + r * Math.cos(a * I.TAU), y, c[2] + r * Math.sin(a * I.TAU)];
      },
      nu: n,
      nv: 6,
    });
  const cables = [-HALF, HALF].flatMap((x) => [cable(x, SIDE, 0, 60), cable(x, 0, -MAIN, 200), cable(x, -MAIN, -MAIN - SIDE, 60)]);

  // Hangers every 15.2 m, flat ribbons turned to the eye.
  const hangers = [];
  for (const x of [-HALF, HALF]) {
    for (let y = SIDE - HANGER; y > -MAIN - SIDE + HANGER / 2; y -= HANGER) {
      if (Math.abs(y) < 10 || Math.abs(y + MAIN) < 10) continue;
      const top = cableZ(y);
      if (top - ROAD < 2.5) continue;
      const base = [x, y, ROAD];
      const half = atLeast(base, 0.1, 0.45) / 2;
      const side = I.unit([-(EYE[1] - y), EYE[0] - x, 0]);
      hangers.push(
        I.patch({
          at: (u, v) => [x + side[0] * half * (2 * u - 1), y + side[1] * half * (2 * u - 1), lerp(ROAD, top, v)],
          nu: 1,
          nv: 1,
        }),
      );
    }
  }

  const steel = [...north.steel, ...south.steel, ...road, ...trusses, ...chord, ...rails];
  const piers = [...north.pier, ...south.pier];

  // The top of the marine layer: a billowed sheet a little under the deck, laid out in front of the eye with its
  // rows spaced in distance so they fall evenly on screen. The strait is under it and never seen.
  const fwd = I.unit([-cam.view[0], -cam.view[1], 0]);
  const side = I.unit([cam.right[0], cam.right[1], 0]);
  const billow = (x, y) => {
    const a = M.fbm(x / 240 + 5, y / 150, { octaves: 5, seed: 13 });
    return 46 + 34 * a * a + 6 * (M.noise(x / 40, y / 30, 17) - 0.5);
  };
  const near = 60;
  const far = 9000;
  const sea = I.patch({
    at: (u, v) => {
      const d = near * Math.pow(far / near, v);
      const s = (u - 0.5) * 2.2 * d;
      const x = EYE[0] + fwd[0] * d + side[0] * s;
      const y = EYE[1] + fwd[1] * d + side[1] * s;
      return [x, y, billow(x, y)];
    },
    nu: 260,
    nv: 260,
  });

  // The headlands before the eye: laid out like the fog's top, so no part of them lies behind the eye.
  const hills = I.patch({
    at: (u, v) => {
      const d = 25 * Math.pow(2400 / 25, v);
      const s = (u - 0.5) * 2.4 * d;
      const x = EYE[0] + fwd[0] * d + side[0] * s;
      const y = EYE[1] + fwd[1] * d + side[1] * s;
      return [x, y, ground(x, y)];
    },
    nu: 240,
    nv: 220,
  });

  // The city's hills across the strait, and the East Bay ridge behind them, for the haze to grade.
  const ridge = (d, h, seed) =>
    I.patch({
      at: (u, v) => {
        const s = (u - 0.5) * 2.6 * d;
        const top = h * (0.3 + 0.7 * M.fbm(s / (d * 0.12) + seed, seed, { octaves: 4, seed }));
        const back = d + v * top * 2.5;
        return [EYE[0] + fwd[0] * back + side[0] * s, EYE[1] + fwd[1] * back + side[1] * s, v * top];
      },
      side: -1,
      nu: 160,
      nv: 6,
    });
  const ridges = [ridge(3600, 110, 3), ridge(9000, 380, 7)];

  const solids = [sea, hills, ...ridges, ...piers, ...steel, ...cables, ...hangers];
  const kinds = [
    { base: 0.08, ambient: 0.6, bounce: 0 }, // the fog's top, lit like cloud
    { base: 0.5, ambient: 0.3, bounce: 0.04 }, // headland scrub
    { base: 0.5, ambient: 0.34, bounce: 0 }, // far hills
    { base: 0.18, ambient: 0.32, bounce: 0.05 }, // concrete
    { base: 0.36, ambient: 0.28, bounce: 0.08 }, // International Orange, in one ink
  ];
  const kindSet = [new Set([sea]), new Set([hills]), new Set(ridges), new Set(piers)];
  const kindOf = solids.map((s) => {
    const k = kindSet.findIndex((set) => set.has(s));
    return k < 0 ? PAINT : k;
  });
  const thin = new Set(hangers);
  const mesh = (s) =>
    s === sea ? [400, 300] : s === hills ? [240, 200] : ridges.includes(s) ? [320, 6] : thin.has(s) ? [1, 1] : s.normal ? [1, 1] : trusses.includes(s) ? [400, 1] : cables.includes(s) ? [s === cables[1] || s === cables[4] ? 400 : 120, 6] : [24, 12];
  const G = M.gbuffer(solids, cam, { res, mesh });

  // Wisps over the layer's top, thinning upward, and a faint haze over the distance.
  const fog = M.heightFog({ eye: EYE, density: 0.06, height: 12, floor: 48, haze: 0.00012 });
  const bank = (p) => 0.1 + 2.2 * I.smoothstep(0.3, 0.75, M.fbm(p[0] / 300 + 3, p[1] / 180, { octaves: 4, seed: 31 }));

  const N = G.w * G.h;
  const cells = [];
  const fixed = new Float32Array(N);
  const haze = new Float32Array(N);
  // Fog is a pale grey, not the paper: the plate keeps a body of tone and the lit billow crowns stay the lightest thing.
  const FOG = 0.1;
  // High cloud, streaked along the wind, on a deck 1.8 km up: thin where the fbm is low, a grey veil where it gathers.
  const cloud = (dir) => {
    if (dir[2] < 0.01) return 0;
    const k = (1800 - EYE[2]) / dir[2];
    const x = EYE[0] + dir[0] * k;
    const y = EYE[1] + dir[1] * k;
    const c = M.fbm(x / 5200 + 2, y / 1500, { octaves: 5, seed: 41 });
    return I.smoothstep(0.45, 0.68, c) * I.smoothstep(0.01, 0.08, dir[2]);
  };
  for (let i = 0; i < N; i++) {
    const k = G.id[i];
    if (k < 0) {
      const x = i % G.w;
      const y = (i - x) / G.w;
      const dir = M.ray(cam, G.res, x + 0.5, y + 0.5);
      const t = I.smoothstep(-0.005, 0.05, dir[2]);
      const c = cloud(dir);
      // The clouds are paler than the sky between them, their bellies a soft grey where they are thickest.
      const belly = I.smoothstep(0.55, 1, c) * M.fbm(x / 70, y / 30, { octaves: 3, seed: 43 });
      const sky = (0.36 + 0.5 * I.smoothstep(0, 0.3, dir[2])) * (1 - c) + c * (0.1 + 0.45 * belly);
      fixed[i] = sky * t + FOG * (1 - t);
      haze[i] = 0.8;
      continue;
    }
    const p = [G.p[i * 3], G.p[i * 3 + 1], G.p[i * 3 + 2]];
    const n = [G.n[i * 3], G.n[i * 3 + 1], G.n[i * 3 + 2]];
    const kind = kindOf[k];
    // Whatever stands in the layer fades into it over the last metres above its top, rather than ending on the sheet.
    const sink = kind === 0 ? 1 : I.smoothstep(-2, 22, p[2] - billow(p[0], p[1]));
    const t = fog.through(p, bank(p)) * sink;
    fixed[i] = FOG * (1 - t);
    // The haze softens what the fog thickens: the billows always a little, anything as far as it has sunk.
    haze[i] = kind === 0 ? 0.5 + 0.5 * (1 - t) : 1 - t;
    if (t < 0.01) continue;
    // The billows' troughs lie in their own shade and the crowns catch the light, so the layer has volume at any hour.
    const trough = kind === 0 ? 0.32 * (1 - I.smoothstep(46, 74, p[2])) + 0.12 * (M.fbm(p[0] / 60, p[1] / 40, { octaves: 3, seed: 23 }) - 0.5) : 0;
    const grit = kind === 0 ? trough : kind === 1 ? 0.5 * (M.fbm(p[0] * 0.25, p[1] * 0.25, { octaves: 3, seed: 11 }) - 0.5) : kind === 3 ? 0.1 * (M.noise(p[0] * 2, p[2] * 2, 5) - 0.5) : 0;
    // Only what lies near the bridge can be shaded by it: its own parts, the fog beside it, the shore by the road.
    const open = (kind === 0 && Math.abs(p[0]) > 700) || kind === 2 || (kind === 1 && Math.abs(p[0]) > 260);
    cells.push({ i, p, n, kind, grit, t, open });
  }
  const casters = [...north.steel, ...south.steel, ...north.pier, ...south.pier, ...road, ...chord];
  return { cam, G, cells, fixed, kinds, tris: I.trianglesOf(casters), haze, grains: new Map() };
};

/**
 * The optics the plates are printed with (0 turns one off): `haze` blurs what the fog thickens, in viewBox px;
 * `bloom` is how much the bright fog glows into the dark beside it; `soft` rounds the grain (0..1).
 */
export const OPTICS = { haze: 2.5, bloom: 0.25, soft: 0.3 };

/**
 * The two plates at a solar time, through the optics, printed through their grains: `key`, the dark plate that carries
 * every tone, and `paint`, a second plate inked in International Orange that prints only the bridge, as a colour
 * mezzotint was printed from one plate per ink. On paper the paint goes down first and the key over it carries the
 * bridge's shading; a negative plate inks the light, so there the paint goes on top, strongest on the lit faces.
 */
export const inkAt = (S, hours, { size = 1024, negative = false, grain = "film", optics = OPTICS } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(null, light, { size, tris: S.tris, soft: 1.6 });
  const lit = S.kinds.map((m) => I.lighting({ ...m, light, view: S.cam.view, shadow }));
  const bare = S.kinds.map((m) => I.lighting({ ...m, light, view: S.cam.view }));
  let tone = S.fixed.slice();
  const paint = new Float32Array(tone.length);
  for (const c of S.cells) {
    const v = Math.min(1, Math.max(0, (c.open ? bare : lit)[c.kind](c) + c.grit));
    if (c.kind !== PAINT) {
      tone[c.i] += v * c.t;
      continue;
    }
    const shade = I.smoothstep(0.3, 1, v);
    tone[c.i] += c.t * (negative ? 1 : 0.85 * shade);
    paint[c.i] = c.t * (negative ? 1 - 0.75 * shade : 0.92);
  }
  const { w, h, res } = S.G;
  // The paint plate stays sharp: blurred, the orange bleeds into a glow along the deck.
  if (optics.haze) tone = M.soften(tone, w, h, S.haze, optics.haze * res);
  // The key is a positive here even for the dark plate, so the bloom always spreads the fog's light.
  if (optics.bloom) tone = M.bloom(tone, w, h, { threshold: 0.9, r: 6 * res, strength: optics.bloom });
  if (negative) for (let i = 0; i < tone.length; i++) tone[i] = 1 - tone[i];
  const soft = optics.soft ?? 0;
  if (!S.grains.has(soft)) S.grains.set(soft, [6, 9].map((seed) => M.grain(w, h, { seed, clump: 0.25, size: 2, soft })));
  const [g1, g2] = S.grains.get(soft);
  const pull = (t, g) => (grain === "film" ? M.film(t, g, { amount: 0.8 }) : M.print(t, g));
  return { key: pull(tone, g1), paint: pull(paint, g2) };
};
