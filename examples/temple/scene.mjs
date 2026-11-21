import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// A Doric temple standing in ground fog on a stony plain, printed as a mezzotint.
// World units are metres: x east, y north, z up. The temple is an octastyle peripteros of 8 by 17 columns at about
// the Parthenon's size, its long axis east-west and its front to the east. The sun follows Athens' sky through the
// day; the fog lies on the ground, so the plain dissolves into it while the roof stays clear.

export const WIDTH = 760;
export const HEIGHT = 428;
export const RES = 2;

export const LATITUDE = 37.97;
export const DECLINATION = 8;

const L = 69.5;
const W = 30.9;
const STEP = 0.5;
const TREAD = 0.7;
const FLOOR = 3 * STEP;
const COLUMN = 10.4;
const R0 = 0.95;
const R1 = 0.74;
const TOP = FLOOR + COLUMN;
const ENTABLATURE = 3.3;
const RISE = 3.6;
const EYE = [96, -134, 9.5];
const TARGET = [0, 0, 6];

const range = (n) => Array.from({ length: n }, (_, i) => i);
const spread = (a, b, n) => range(n).map((i) => a + ((b - a) * i) / (n - 1));

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

/** A fluted-less Doric shaft with entasis, necking, echinus and the abacus's round stand-in, as a half-section. */
const shaft = (x, y, z0 = FLOOR, h = COLUMN) => {
  const r = (t) => R0 + (R1 - R0) * t - 0.05 * Math.sin(Math.PI * t);
  const body = spread(0, 0.86, 8).map((t) => [t * h, r(t)]);
  return I.lathe({
    base: [x, y, z0],
    profile: [[0, R0, 1], ...body.slice(1), [0.88 * h, R1 - 0.04, 1], [0.9 * h, R1 + 0.02], [0.93 * h, R1 + 0.28], [0.955 * h, R1 + 0.42, 1], [0.955 * h, R1 + 0.36, 1], [h, R1 + 0.36, 1], [h, 0, 1]],
  });
};

/** A field stone half sunk in the plain: a squashed, lumpy sphere. */
const rock = ([x, y], r, seed) =>
  I.patch({
    at: (u, v) => {
      const lon = u * I.TAU;
      const lat = (v - 0.5) * Math.PI;
      const k = r * (0.8 + 0.45 * M.noise(Math.cos(lon) * 1.6 + 3, Math.sin(lon) * 1.6 + lat * 1.2, seed));
      return [x + k * Math.cos(lat) * Math.cos(lon) * 1.3, y + k * Math.cos(lat) * Math.sin(lon), -0.25 * r + 0.62 * k * Math.sin(lat)];
    },
    nu: 24,
    nv: 12,
  });

/** A standing figure, turned like a chess piece: legs, coat, shoulders, head. Small enough that it only has to read. */
const figure = ([x, y]) =>
  I.lathe({ base: [x, y, 0], profile: [[0, 0.16, 1], [0.8, 0.15], [0.95, 0.2], [1.35, 0.23], [1.45, 0.21], [1.5, 0.08, 1], [1.56, 0.1], [1.68, 0.11], [1.78, 0, 1]] });

export const scene = ({ res = RES } = {}) => {
  const cam = I.perspective({ eye: EYE, target: TARGET, scale: 6.3, offset: [WIDTH * 0.5, HEIGHT * 0.47], width: WIDTH, height: HEIGHT });
  const fog = M.heightFog({ eye: EYE, density: 0.2, height: 2.2, haze: 0.0008, start: 70 });

  const steps = range(3).flatMap((k) => {
    const o = (3 - k) * TREAD;
    return I.box({ min: [-L / 2 - o, -W / 2 - o, k * STEP], max: [L / 2 + o, W / 2 + o, (k + 1) * STEP] });
  });
  const front = spread(-W / 2 + 1.25, W / 2 - 1.25, 8);
  const side = spread(-L / 2 + 1.25, L / 2 - 1.25, 17);
  const spots = [...side.flatMap((x) => [[x, front[0]], [x, front[7]]]), ...front.slice(1, -1).flatMap((y) => [[side[0], y], [side[16], y]])];
  const columns = spots.map(([x, y]) => shaft(x, y));
  const cella = I.box({ min: [-L / 2 + 6, -W / 2 + 5, FLOOR], max: [L / 2 - 6, W / 2 - 5, TOP] });
  const architrave = I.box({ min: [-L / 2 + 0.35, -W / 2 + 0.35, TOP], max: [L / 2 - 0.35, W / 2 - 0.35, TOP + 1.35] });
  const frieze = I.box({ min: [-L / 2 + 0.45, -W / 2 + 0.45, TOP + 1.35], max: [L / 2 - 0.45, W / 2 - 0.45, TOP + 2.75] });
  const cornice = I.box({ min: [-L / 2 - 0.2, -W / 2 - 0.2, TOP + 2.75], max: [L / 2 + 0.2, W / 2 + 0.2, TOP + ENTABLATURE] });
  const eave = TOP + ENTABLATURE;
  const roof = I.prism({ outline: [[-L / 2 - 0.2, -W / 2 - 0.2, eave], [-L / 2 - 0.2, W / 2 + 0.2, eave], [-L / 2 - 0.2, 0, eave + RISE]], extrude: [L + 0.4, 0, 0] });
  const acroteria = [[L / 2 + 0.1, 0, eave + RISE], [-L / 2 - 0.1, 0, eave + RISE], [L / 2, -W / 2, eave], [L / 2, W / 2, eave], [-L / 2, -W / 2, eave]].map((p) =>
    I.lathe({ base: p, profile: [[0, 0.5, 1], [0.3, 0.42], [0.7, 0.62], [1.1, 0.35], [1.4, 0, 1]] }),
  );
  const temple = [...steps, ...columns, ...cella, ...architrave, ...frieze, ...cornice, ...roof, ...acroteria];

  // A ruin far off to the north-west: two columns still standing and a fallen drum.
  const ruin = [shaft(-70, 92, 0, 9.6), shaft(-62.5, 92, 0, 9.6), ...I.box({ min: [-71.2, 90.8, 9.6], max: [-61.3, 93.2, 10.9] })];
  const stones = [
    [[38, -96], 2.1, 1], [[22, -106], 1.1, 2], [[66, -98], 1.4, 3], [[78, -112], 1.8, 4], [[-8, -72], 1.6, 5],
    [[50, -66], 1.2, 6], [[89, -86], 2.6, 7], [[12, -48], 1.4, 8], [[-30, -52], 2, 9], [[62, -120], 0.8, 10],
  ];
  const rocks = stones.map(([p, r, s]) => rock(p, r, s));
  const WALKER = [64, -74];
  const walker = figure(WALKER);

  // The plain: a patch laid out in front of the eye, its rows spaced in distance so they fall evenly on screen.
  const fwd = I.unit([-cam.view[0], -cam.view[1], 0]);
  const near = 18;
  const far = 1800;
  const plain = I.patch({
    at: (u, v) => {
      const d = near * Math.pow(far / near, v);
      const s = (u - 0.5) * 2.4 * d;
      const x = EYE[0] + fwd[0] * d + cam.right[0] * s;
      const y = EYE[1] + fwd[1] * d + cam.right[1] * s;
      const flat = I.smoothstep(0, 8, Math.hypot(Math.max(0, Math.abs(x) - L / 2), Math.max(0, Math.abs(y) - W / 2)));
      return [x, y, -0.6 * flat * (M.fbm(x / 40, y / 40, { octaves: 3, seed: 3 }) - 0.35)];
    },
    nu: 96,
    nv: 160,
  });

  const solids = [plain, ...temple, ...ruin, ...rocks, walker];
  const marble = { base: 0.02, ambient: 0.42, bounce: 0.14 };
  const stone = { base: 0.84, ambient: 0.2, bounce: 0.04 };
  const earth = { base: 0.7, ambient: 0.28, bounce: 0 };
  const cloth = { base: 0.8, ambient: 0.2, bounce: 0 };
  // The cella wall stands in the gloom of the porch, so the colonnade reads as pale shafts against it.
  const gloom = { base: 0.45, ambient: 0.3, bounce: 0.05 };
  const kinds = [earth, marble, stone, cloth, gloom];
  const kindOf = solids.map((s) => (s === plain ? 0 : rocks.includes(s) ? 2 : s === walker ? 3 : cella.includes(s) ? 4 : 1));

  const G = M.gbuffer(solids, cam, { res, mesh: (s) => (s === plain ? [96, 200] : s.normal ? [1, 1] : rocks.includes(s) ? [24, 12] : [48, 40]) });

  // Everything the sun doesn't change, once: each cell's point and normal, its material, the grit on the plain and
  // the stone, how much of it the fog lets through, and the sky.
  const N = G.w * G.h;
  const cells = [];
  const fixed = new Float32Array(N);
  const FOG = 0.015;
  for (let i = 0; i < N; i++) {
    const k = G.id[i];
    if (k < 0) {
      const x = i % G.w;
      const y = (i - x) / G.w;
      const dir = M.ray(cam, G.res, x + 0.5, y + 0.5);
      // The sky stays grey down to the horizon and only its last few degrees go into the ground fog.
      const t = I.smoothstep(-0.01, 0.09, dir[2]);
      const sky = 0.3 + 0.58 * I.smoothstep(0, 0.34, dir[2]);
      fixed[i] = sky * t + FOG * (1 - t);
      continue;
    }
    const p = [G.p[i * 3], G.p[i * 3 + 1], G.p[i * 3 + 2]];
    const n = [G.n[i * 3], G.n[i * 3 + 1], G.n[i * 3 + 2]];
    const kind = kindOf[k];
    const grit = kind === 0 ? 0.42 * (M.fbm(p[0] * 0.7, p[1] * 0.7, { octaves: 3, seed: 11 }) - 0.5) : kind === 2 ? 0.2 * (M.noise(p[0] * 3, p[1] * 3 + p[2] * 3, 5) - 0.5) : 0;
    const bank = 0.55 + 0.9 * M.fbm(p[0] / 70, p[1] / 50, { octaves: 2, seed: 21 });
    const t = fog.through(p, bank);
    fixed[i] = FOG * (1 - t);
    // A cell the fog has swallowed never changes with the sun, and a cell of open plain no shadow can reach (the
    // longest, at the tour's lowest sun, runs about 60 m from the temple) needs no shadow lookup.
    if (t < 0.01) continue;
    const reach = (q, r) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;
    const open = kind === 0 && Math.hypot(Math.max(0, Math.abs(p[0]) - L / 2), Math.max(0, Math.abs(p[1]) - W / 2)) > 64 && !reach(WALKER, 6) && !stones.some(([q, r]) => reach(q, r * 5));
    cells.push({ i, p, n, kind, grit, t, open });
  }
  const casters = [...temple.filter((s) => !columns.includes(s)), ...spots.map(([x, y]) => I.patch({ at: (u, v) => [x + R0 * Math.cos(u * I.TAU), y + R0 * Math.sin(u * I.TAU), FLOOR + v * COLUMN], nu: 10, nv: 1 })), ...rocks, walker];
  return { cam, G, cells, fixed, kinds, tris: I.trianglesOf(casters), threshold: M.grain(G.w, G.h, { seed: 4, clump: 0.25, size: 2 }) };
};

/** The tone of every cell at a solar time, and the cells printed through the grain. A negative plate inks the light. */
export const inkAt = (S, hours, { size = 1024, negative = false, grain = "film" } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(null, light, { size, tris: S.tris, soft: 2.2 });
  const lit = S.kinds.map((m) => I.lighting({ ...m, light, view: S.cam.view, shadow }));
  const bare = S.kinds.map((m) => I.lighting({ ...m, light, view: S.cam.view }));
  const tone = S.fixed.slice();
  for (const c of S.cells) tone[c.i] += Math.min(1, Math.max(0, (c.open ? bare : lit)[c.kind](c) + c.grit)) * c.t;
  if (negative) for (let i = 0; i < tone.length; i++) tone[i] = 1 - tone[i];
  return grain === "film" ? M.film(tone, S.threshold, { amount: 0.8 }) : M.print(tone, S.threshold);
};
