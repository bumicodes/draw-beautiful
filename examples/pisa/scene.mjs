import * as I from "../../kit/intaglio.mjs";

// The Leaning Tower of Pisa on the lawn of the Piazza dei Miracoli, engraved.
// World units are metres: x east, y north, z up. The tower is built upright in its own frame and leaned
// 3.97° to the south about its foot. The sun follows Pisa's latitude through the day.

export const WIDTH = 520;
export const HEIGHT = 680;

export const LATITUDE = 43.72;
export const DECLINATION = 12;
export const TILT = 3.97;

const GALLERIES = 6;
const BAYS = 30;
const STOREY = 5.75;
const BASE_TOP = 11.8;
const CORE_R = 6.2;
const ARCADE_R = 7.55;
const COLUMN_R = 0.27;
const SPRING = 3.95;
const BAND_TOP = 5.2;
const BELFRY_Z = BASE_TOP + GALLERIES * STOREY;
const BELFRY_R = 4.9;
const BELFRY_BAYS = 12;

const lean = TILT * I.deg;
const AXIS = [0, -Math.sin(lean), Math.cos(lean)];
const T = ([x, y, z]) => [x, y * Math.cos(lean) - z * Math.sin(lean), y * Math.sin(lean) + z * Math.cos(lean)];
const at = (r, th, z) => T([r * Math.cos(th), r * Math.sin(th), z]);
const frac = (x) => x - Math.floor(x);
const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });
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

const turned = (z0, profile) => I.lathe({ base: T([0, 0, z0]), axis: AXIS, profile });

const column = (th, rc, z0, h, r) =>
  I.patch({
    at: (u, v) => {
      const a = u * I.TAU;
      return T([rc * Math.cos(th) + r * Math.cos(a), rc * Math.sin(th) + r * Math.sin(a), z0 + v * h]);
    },
    nu: 12,
    nv: 1,
  });

/**
 * A wall round the axis pierced by `bays` arches. Each opening is `half` metres either side of its bay's centre,
 * runs from `sill` up to `spring` and closes in a semicircle. Heights are relative to the wall's foot z0.
 */
const pierced = ({ r, z0, h, bays, half, sill, spring }) => {
  const width = (I.TAU * r) / bays;
  const open = (u, z) => {
    const t = (frac(u * bays) - 0.5) * width;
    if (Math.abs(t) >= half || z <= sill) return false;
    return z < spring + Math.sqrt(half * half - t * t);
  };
  return I.patch({ at: (u, v) => at(r, u * I.TAU, z0 + v * h), mask: (u, v) => !open(u, v * h), nu: bays * 10, nv: Math.ceil(h * 3) });
};

const arch = (r, th, z, half, n = 24) =>
  range(n + 1).map((k) => {
    const a = Math.PI * (k / n);
    return at(r, th - (half * Math.cos(a)) / r, z + half * Math.sin(a));
  });

export const scene = ({ ss = 3 } = {}) => {
  const base = turned(0, [[0, 9.6, 1], [0.5, 9.6, 1], [0.5, 8.7, 1], [1, 8.7, 1], [1, 7.75, 1], [11, 7.75, 1]]);
  const baseCornice = turned(11, [[0, 7.75, 1], [0.15, 7.95], [0.45, 8.1, 1], [0.8, 8.1, 1], [0.8, CORE_R, 1]]);
  const engaged = range(15).map((k) => column(((k + 0.5) / 15) * I.TAU, 7.85, 1.3, 7.8, 0.42));

  const cores = [];
  const columns = [];
  const bands = [];
  const cornices = [];
  for (let g = 0; g < GALLERIES; g++) {
    const z0 = BASE_TOP + g * STOREY;
    cores.push(turned(z0, [[0, CORE_R, 1], [BAND_TOP, CORE_R, 1]]));
    for (let k = 0; k < BAYS; k++) columns.push(column((k / BAYS) * I.TAU, ARCADE_R, z0, SPRING, COLUMN_R));
    bands.push(pierced({ r: ARCADE_R + 0.05, z0: z0 + SPRING - 0.9, h: BAND_TOP - SPRING + 0.9, bays: BAYS, half: (I.TAU * ARCADE_R) / BAYS / 2 - COLUMN_R - 0.05, sill: -1, spring: 0.9 }));
    cornices.push(turned(z0 + BAND_TOP, [[0, ARCADE_R + 0.05, 1], [0.12, ARCADE_R + 0.2], [0.3, ARCADE_R + 0.32, 1], [0.3, ARCADE_R + 0.42, 1], [0.55, ARCADE_R + 0.42, 1], [0.55, CORE_R, 1]]));
  }

  const parapet = turned(BELFRY_Z, [[0, ARCADE_R + 0.42, 1], [0.9, ARCADE_R + 0.42, 1], [0.9, ARCADE_R + 0.2, 1]]);
  const chamber = turned(BELFRY_Z, [[0, BELFRY_R - 0.7, 1], [6.7, BELFRY_R - 0.7, 1]]);
  const belfry = pierced({ r: BELFRY_R, z0: BELFRY_Z, h: 6.7, bays: BELFRY_BAYS, half: 0.78, sill: 1.5, spring: 4.4 });
  const crown = turned(BELFRY_Z + 6.7, [[0, BELFRY_R, 1], [0.2, BELFRY_R + 0.2], [0.45, BELFRY_R + 0.3, 1], [0.45, BELFRY_R + 0.1, 1], [0.8, BELFRY_R - 0.4], [1.3, 3.2], [1.6, 1.4], [1.7, 0, 1]]);

  const tower = [base, baseCornice, ...engaged, ...cores, ...columns, ...bands, ...cornices, parapet, chamber, belfry, crown];

  const top = T([0, 0, BELFRY_Z + 8.4]);
  const cam = I.fitCamera([top, T([0, 0, 0]), [0, -14, 0], [0, 14, 0], [0, 12, 0], at(9.6, 0, 0), at(9.6, Math.PI, 0), at(9.6, Math.PI / 2, 0), at(9.6, -Math.PI / 2, 0), T([0, -8, BELFRY_Z]), T([0, 8, BELFRY_Z])], {
    width: WIDTH,
    height: HEIGHT,
    pad: 40,
    azimuth: 180,
    elevation: 9,
  });
  const ground = I.face({ points: [[-90, -90, 0], [90, -90, 0], [90, 90, 0], [-90, 90, 0]], along: [cam.right[0], cam.right[1], 0], outward: [0, 0, 1] });
  const solids = [ground, ...tower];
  const occ = I.occlusion(solids, cam, { ss, halo: tower });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const all = (list, opts) => merge(list.map((s) => H(s, opts)));

  const marble = { base: 0.03, ambient: 0.2, bounce: 0.14, gloss: 0.08, shine: 12 };
  const shade = { base: 0.3, ambient: 0.12, bounce: 0.1 };
  const dark = { base: 0.62, ambient: 0.1, bounce: 0.05 };
  const lawn = { base: 0.22, ambient: 0.24, bounce: 0 };
  const near = (p) => 1 - I.smoothstep(9, 21, Math.hypot(p[0] * 0.45, p[1]));

  const layers = [];
  const layer = (id, set, material, ink, shape) => layers.push({ id, set, material, ink, shape });

  layer("lawn", H(ground, { spacing: 2.6 }), lawn, { from: 0.2, to: 0.85, width: 1 }, near);
  layer("lawn-x", H(ground, { spacing: 3.3, slant: 0.5 }), lawn, { from: 0.6, to: 0.95, width: 0.8 }, near);
  layer("base", H(base, { spacing: 1.9 }), marble, { from: 0.16, to: 0.7, width: 1 });
  layer("base-x", H(base, { spacing: 2.5, slant: 0.18 }), marble, { from: 0.58, to: 0.95, width: 0.8 });
  layer("engaged", all(engaged, { along: "v", lines: 4 }), marble, { from: 0.14, to: 0.7, width: 0.9 });
  layer("cores", all(cores, { spacing: 1.7 }), shade, { from: 0.18, to: 0.75, width: 1 });
  layer("cores-x", all(cores, { spacing: 2.2, slant: 0.2 }), shade, { from: 0.55, to: 0.95, width: 0.8 });
  layer("columns", all(columns, { along: "v", lines: 3, step: 1.2 }), marble, { from: 0.14, to: 0.7, width: 0.75 });
  layer("bands", all(bands, { spacing: 1.6, step: 1 }), marble, { from: 0.16, to: 0.72, width: 0.9 });
  layer("cornices", all([baseCornice, ...cornices, parapet, crown], { spacing: 1.4, step: 1.2 }), marble, { from: 0.14, to: 0.7, width: 0.85 });
  layer("belfry", H(belfry, { spacing: 1.7, step: 1 }), marble, { from: 0.16, to: 0.72, width: 0.9 });
  layer("chamber", H(chamber, { spacing: 1.5 }), dark, { from: 0.2, to: 0.85, width: 0.9 });

  const horizon = cam.project([0, 90, 0])[1];
  const [cx] = cam.project([0, 0, 0]);
  const sky = I.ruling(cam, occ, { spacing: 2.4, halo: 7, region: (x, y) => y < horizon - 4 });
  const skyTone = (s) => {
    const edge = 1 - I.smoothstep(0.62, 1, Math.hypot((s.x - cx) / (WIDTH * 0.5), (s.y - HEIGHT * 0.45) / (HEIGHT * 0.56)));
    return (0.18 + 0.5 * I.smoothstep(horizon, 0, s.y)) * edge * I.smoothstep(horizon - 6, horizon - 90, s.y);
  };

  const marks = [];
  const S = (pts, width = 0.4) => marks.push(I.stroke(pts, cam, occ.sees, { width }));
  const blind = (I.TAU * 7.75) / 15 / 2 - 0.42;
  for (let k = 0; k < 15; k++) {
    const th = (k / 15) * I.TAU;
    S(arch(7.76, th, 9.1, blind), 0.5);
    S(arch(7.76, th, 9.1, blind + 0.3), 0.3);
  }
  for (let g = 0; g < GALLERIES; g++) {
    const z = BASE_TOP + g * STOREY + SPRING;
    const half = (I.TAU * ARCADE_R) / BAYS / 2 - COLUMN_R - 0.05;
    for (let k = 0; k < BAYS; k++) S(arch(ARCADE_R + 0.07, ((k + 0.5) / BAYS) * I.TAU, z, half + 0.22, 16), 0.3);
  }
  for (let k = 0; k < BELFRY_BAYS; k++) S(arch(BELFRY_R + 0.02, ((k + 0.5) / BELFRY_BAYS) * I.TAU, BELFRY_Z + 4.4, 1.05, 20), 0.4);

  return { cam, solids, tris: I.trianglesOf(solids), layers, sky, skyTone, marks: marks.join("") };
};

/** Ink every lit layer for a solar time. A negative plate (pale ink on dark paper) inks the light, not the shade. */
export const inkAt = (S, hours, { size = 1024, negative = false } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris, soft: 1.2 });
  const out = {};
  for (const l of S.layers) {
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    const tone = negative ? (s) => 1 - lit(s) : lit;
    out[l.id] = I.ink(l.set, l.shape ? (s) => tone(s) * l.shape(s.p) : tone, l.ink);
  }
  return out;
};
