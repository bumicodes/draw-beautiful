import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// The rotunda of the Pantheon seen from the floor by the apse, looking north and up, printed as a mezzotint.
// World units are metres: x east, y north, z up, the origin at the middle of the floor. The rotunda is 43.3 m across
// and as high: a drum of radius R under a hemisphere whose sphere would just touch the floor, five rings of 28 stepped
// coffers, and the oculus 8.2 m across at the crown. The only light is the oculus. The sky through it lights the room
// from above, and the sun comes in as one beam, a disc of light crossing the coffers through the day. The day is
// 21 April, the birthday of Rome, when the noon sun falls on the entrance.

export const WIDTH = 600;
export const HEIGHT = 760;
export const RES = 2;

export const LATITUDE = 41.9;
export const DECLINATION = 11.9;

const R = 21.65;
const SPRING = R;
const OC = 4.1;
const RIM = SPRING + Math.sqrt(R * R - OC * OC);
const TOP = RIM + 1.5;
const EL_OC = Math.asin((RIM - SPRING) / R);
const ENTABLATURE = 10.6;
const ARCH = 15.2;
const DOOR = 4.4;
const EXEDRA = 4.6;
const NICHE = 4.2;
const PASSAGE = 6;
const EYE = [0, -17, 1.6];
const PITCH = 41;
const FOCAL = 486;

const range = (n) => Array.from({ length: n }, (_, i) => i);
const smooth = I.smoothstep;
const wrap = (a) => a - I.TAU * Math.round(a / I.TAU);
const frac = (x) => x - Math.floor(x);

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

// The eight bays of the ground order, centred every 45° from the entrance in the north: the entrance (0) and the
// apse (4) arched up into the attic, semicircular exedrae east and west (2, 6), rectangular ones on the diagonals.
const bayAz = (k) => (90 + 45 * k) * I.deg;
const bayOf = (az) => {
  const k = (((Math.round((az / I.deg - 90) / 45) % 8) + 8) % 8);
  return { k, q: R * wrap(az - bayAz(k)) };
};
/** Whether the drum is open at (az, z): the arches of the entrance and apse, the exedrae under the entablature. */
const opening = (az, z) => {
  const { k, q } = bayOf(az);
  if (k === 0 || k === 4) return Math.abs(q) < DOOR && (z < ARCH || q * q + (z - ARCH) ** 2 < DOOR * DOOR);
  return Math.abs(q) < EXEDRA && z < ENTABLATURE;
};

/** A moulding profile as steps [z, change, width]: the offset changes by `change` over `width` up to z. */
const profile = (start, steps) => (z) => {
  let r = start;
  for (const [at, d, w] of steps) {
    if (z <= at - w) break;
    r += d * smooth(at - w, at, z);
  }
  return r;
};
// How far the drum's face stands from radius R (negative is into the room): plinth, the entablature of the ground
// order with its architrave, frieze and corona, the attic's base and its cornice under the dome.
const drum = profile(-0.25, [
  [0.4, 0.25, 0.04], [ENTABLATURE + 0.04, -0.3, 0.04], [11.0, -0.05, 0.03], [11.45, 0.09, 0.03], [12.0, -0.12, 0.08], [12.3, -0.5, 0.25],
  [12.62, 0.76, 0.03], [13.1, 0.12, 0.03], [20.5, -0.12, 0.04], [20.75, -0.15, 0.1], [21.1, -0.4, 0.3], [21.6, 0.67, 0.04],
]);
const ATTIC_UNIT = (R * Math.PI) / 16;
/** The attic: four blind windows a bay in moulded frames, pilaster strips between. */
const attic = (q, z) => {
  if (z < 13.1 || z > 20.5) return { r: 0, kind: 0 };
  const x = frac((q + 8 * ATTIC_UNIT) / ATTIC_UNIT) * ATTIC_UNIT - ATTIC_UNIT / 2;
  const a = Math.abs(x);
  const pil = ATTIC_UNIT / 2 - a;
  if (pil < 0.42) return { r: -0.12 * smooth(0.42, 0.38, pil), kind: 1 };
  const inWin = Math.min(1.0 - a, z - 14.4, 18.4 - z);
  if (inWin > -0.2) return { r: inWin > 0 ? 0.3 * smooth(0, 0.04, inWin) : -0.08 * smooth(-0.2, -0.16, inWin), kind: inWin > 0 ? 2 : 3 };
  return { r: 0, kind: 4 };
};
const wallRelief = (az, z) => {
  const { k, q } = bayOf(az);
  let r = drum(z);
  if (k !== 0 && k !== 4 && z > 0.4 && z < ENTABLATURE) {
    const e = Math.abs(q) - EXEDRA;
    if (e > 0 && e < 0.95) r -= 0.25 * smooth(0, 0.04, e) * smooth(0.95, 0.91, e);
  }
  return r + attic(q, z).r;
};

// The coffers: 28 a ring, five rings, each ring's coffers about square, the rib and the four steps of the frame
// scaling with the coffer.
const COLS = 28;
const ROWS = (() => {
  const e = [4 * I.deg];
  for (let k = 0; k < 5; k++) e.push(e[k] + (I.TAU / COLS) * Math.cos(e[k] + 0.5 * (I.TAU / COLS) * Math.cos(e[k])) * 0.97);
  return e;
})();
/** How deep the dome is cut at (az, el), outward from the sphere, and how far into its coffer the point is (0..1). */
const coffer = (az, el) => {
  if (el > EL_OC - 1.4 * I.deg) return { d: -0.3 * smooth(EL_OC - 1.4 * I.deg, EL_OC - 1.3 * I.deg, el), into: 0 };
  if (el < ROWS[0] || el > ROWS[5]) return { d: 0, into: 0 };
  let k = 0;
  while (el > ROWS[k + 1]) k++;
  const wide = R * Math.cos(0.5 * (ROWS[k] + ROWS[k + 1])) * (I.TAU / COLS);
  const s = frac((az - Math.PI / 2) / (I.TAU / COLS) + 0.5);
  const a = Math.min(s, 1 - s) * R * Math.cos(el) * (I.TAU / COLS);
  // The steps sit lower at the bottom of the coffer than at its top, so from the floor the frames read even.
  const b = Math.min((el - ROWS[k]) * R * 1.25, (ROWS[k + 1] - el) * R * 0.8);
  const m = Math.min(a, b) / wide;
  let d = 0;
  for (let j = 0; j < 4; j++) d += smooth(0.075 + 0.045 * j, 0.083 + 0.045 * j, m);
  return { d: 0.055 * wide * d, into: d / 4 };
};

const domePoint = (az, el) => {
  const r = R + coffer(az, el).d;
  const c = Math.cos(el);
  return [r * c * Math.cos(az), r * c * Math.sin(az), SPRING + r * Math.sin(el)];
};
const wallPoint = (az, z) => {
  const r = R + wallRelief(az, z);
  return [r * Math.cos(az), r * Math.sin(az), z];
};

/** A surface from `at(u, v)` with normals by fine differences (the coffer steps are only centimetres wide), turned toward `toward(p)`. */
const relief = ({ at, toward, mask, e = 2e-5 }) => ({
  mask,
  point: (u, v) => {
    const p = at(u, v);
    const n = I.unit(I.cross(I.sub(at(u + e, v), at(u - e, v)), I.sub(at(u, v + e), at(u, v - e))));
    return [p, I.dot(n, toward(p)) < 0 ? I.mul(n, -1) : n];
  },
});
const inward = (p) => [-p[0], -p[1], SPRING - p[2]];

/** A level rectangle or a wall as a patch: `at(u, v)` over the rectangle, with the normal turned toward `face`. */
const plane = (corner, du, dv, face, mask) => {
  const side = I.dot(I.cross(du, dv), face) >= 0 ? 1 : -1;
  return I.patch({ at: (u, v) => I.add(corner, I.add(I.mul(du, u), I.mul(dv, v))), side, nu: 1, nv: 1, mask });
};
/** A patch with its normals turned toward `face(p)`. */
const facing = (at, face, nu = 16, nv = 16, mask) => {
  const probe = I.patch({ at, nu: 1, nv: 1 }).point(0.5, 0.5);
  return I.patch({ at, side: I.dot(probe[1], face(probe[0])) >= 0 ? 1 : -1, nu, nv, mask });
};

// The bay's own frame: out from the middle of the room, and along the wall.
const frame = (a) => ({ er: [Math.cos(a), Math.sin(a), 0], et: [-Math.sin(a), Math.cos(a), 0] });
const at3 = ({ er, et }, r, t, z) => [er[0] * r + et[0] * t, er[1] * r + et[1] * t, z];
const chord = (t) => Math.sqrt(R * R - t * t);

/** An oriented block in a bay's frame: t across, r out from the middle, z up. Only the faces that show. */
const block = (f, [t0, t1], [r0, r1], [z0, z1]) => {
  const c = at3(f, r0, t0, z0);
  const T = I.mul(f.et, t1 - t0);
  const Rr = I.mul(f.er, r1 - r0);
  const Z = [0, 0, z1 - z0];
  return [
    plane(c, T, Z, I.mul(f.er, -1)),
    plane(c, Rr, Z, I.mul(f.et, -1)),
    plane(I.add(c, T), Rr, Z, f.et),
    plane(I.add(c, Z), T, Rr, [0, 0, 1]),
    ...(z0 > 0 ? [plane(c, T, Rr, [0, 0, -1])] : []),
  ];
};

/** A fluted shaft of 24 flutes with a little entasis, on a base and under a capital. */
const column = (base, h, r0, r1) => {
  const flute = 0.06 * r0;
  const r = (t) => r0 + (r1 - r0) * t + 0.03 * r0 * Math.sin(Math.PI * t);
  const shaft = relief({
    at: (u, v) => {
      const a = u * I.TAU;
      const k = r(v) - flute * Math.pow(Math.abs(Math.sin(12 * a)), 0.6) * smooth(0, 0.03, v) * smooth(1, 0.97, v);
      return [base[0] + k * Math.cos(a), base[1] + k * Math.sin(a), base[2] + 0.07 * h + v * 0.82 * h];
    },
    toward: (p) => [p[0] - base[0], p[1] - base[1], 0],
    e: 1e-4,
  });
  const foot = I.lathe({ base, profile: [[0, r0 * 1.42, 1], [0.02 * h, r0 * 1.42, 1], [0.03 * h, r0 * 1.3], [0.045 * h, r0 * 1.12], [0.06 * h, r0 * 1.22], [0.07 * h, r0, 1], [0.07 * h, 0, 1]] });
  // A Corinthian capital as a turned bell, flaring to the abacus; the leaves are in the albedo.
  const head = I.lathe({ base: [base[0], base[1], base[2] + 0.89 * h], profile: [[0, r1 * 1.08, 1], [0.012 * h, r1 * 1.08, 1], [0.02 * h, r1, 1], [0.06 * h, r1 * 1.12], [0.095 * h, r1 * 1.4], [0.1 * h, r1 * 1.55, 1], [0.11 * h, r1 * 1.55, 1], [0.11 * h, 0, 1]] });
  return { shaft, foot, head, caster: I.patch({ at: (u, v) => [base[0] + r0 * Math.cos(u * I.TAU), base[1] + r0 * Math.sin(u * I.TAU), base[2] + v * h], nu: 12, nv: 1 }) };
};


/**
 * How much of the sun reaches p, 0 to 1. The rotunda is convex, so a ray from inside leaves it only through the
 * oculus: it has to clear the rim and the top of the 1.5 m throat. A point in a niche or the passage first has to see
 * back into the rotunda through its opening. The sun's half-degree disc softens the edge with distance.
 */
const through = (x, y, z, L) => {
  if (L[2] <= 1e-6) return 0;
  let px = x;
  let py = y;
  let pz = z;
  if (x * x + y * y > (R + 0.05) ** 2) {
    const a = L[0] * L[0] + L[1] * L[1];
    const b = 2 * (x * L[0] + y * L[1]);
    const c = x * x + y * y - R * R;
    const disc = b * b - 4 * a * c;
    if (a < 1e-9 || disc < 0) return 0;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0) return 0;
    px = x + t * L[0];
    py = y + t * L[1];
    pz = z + t * L[2];
    if (!opening(Math.atan2(py, px), pz)) return 0;
  }
  return clear(px, py, pz, L, RIM) * clear(px, py, pz, L, TOP);
};
/** How much of the sun's disc, seen from p along L, is inside the oculus where the ray crosses height h. */
const clear = (x, y, z, L, h) => {
  const t = (h - z) / L[2];
  if (t < 0) return 1;
  const ax = x + t * L[0];
  const ay = y + t * L[1];
  const w = 0.03 + 0.0045 * t;
  const r2 = ax * ax + ay * ay;
  if (r2 > (OC + w) ** 2) return 0;
  if (r2 < (OC - w) ** 2) return 1;
  return smooth(-w, w, OC - Math.sqrt(r2));
};

/** Whether a point is inside the masonry of the drum, the dome or the throat, for the shadows of mouldings and coffer steps. */
const solid = (x, y, z) => {
  if (z < 0) return true;
  if (z >= SPRING) {
    const h = z - SPRING;
    const d = Math.hypot(x, y, h);
    const el = Math.asin(h / d);
    if (el > EL_OC) return z < TOP && Math.hypot(x, y) > OC;
    return d > R + coffer(Math.atan2(y, x), el).d;
  }
  const rho = Math.hypot(x, y);
  if (rho < R - 1) return false;
  const az = Math.atan2(y, x);
  return !opening(az, z) && rho > R + wallRelief(az, z);
};

/** The haze hangs in slow drifts, a field on a 1.5 m lattice read back trilinearly. */
const DRIFT = (() => {
  const o = [-24, -24, 0];
  const h = 1.5;
  const [nx, ny, nz] = [34, 34, 32];
  const f = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const [x, y, z] = [o[0] + i * h, o[1] + j * h, o[2] + k * h];
        const v = (M.fbm(x / 8 + z / 13, y / 9 - z / 19, { octaves: 3, seed: 41 }) + M.fbm(x / 11 - y / 15, z / 6, { octaves: 3, seed: 43 })) / 2;
        f[(k * ny + j) * nx + i] = 0.35 + 1.3 * smooth(0.3, 0.7, v);
      }
    }
  }
  return (x, y, z) => {
    const gx = Math.min(nx - 1.001, Math.max(0, (x - o[0]) / h));
    const gy = Math.min(ny - 1.001, Math.max(0, (y - o[1]) / h));
    const gz = Math.min(nz - 1.001, Math.max(0, (z - o[2]) / h));
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const k = Math.floor(gz);
    const u = gx - i;
    const v = gy - j;
    const w = gz - k;
    const c = (di, dj, dk) => f[((k + dk) * ny + j + dj) * nx + i + di];
    const a = (c(0, 0, 0) * (1 - u) + c(1, 0, 0) * u) * (1 - v) + (c(0, 1, 0) * (1 - u) + c(1, 1, 0) * u) * v;
    const b = (c(0, 0, 1) * (1 - u) + c(1, 0, 1) * u) * (1 - v) + (c(0, 1, 1) * (1 - u) + c(1, 1, 1) * u) * v;
    return a * (1 - w) + b * w;
  };
})();

/** Where the middle of the beam lands, and the normal there: the first of the dome, the drum or the floor. */
const landing = (L) => {
  const d = I.mul(L, -1);
  const o = [0, 0, RIM];
  // The sphere, from inside: the far root.
  const oc = [o[0], o[1], o[2] - SPRING];
  const b = I.dot(oc, d);
  const t = -b + Math.sqrt(Math.max(0, b * b - (I.dot(oc, oc) - R * R)));
  let p = I.add(o, I.mul(d, t));
  if (p[2] >= SPRING) return { p, n: I.unit([-p[0], -p[1], SPRING - p[2]]) };
  const a = d[0] * d[0] + d[1] * d[1];
  const tc = a > 1e-9 ? Math.sqrt((R * R) / a) : Infinity;
  const tf = RIM / -d[2];
  if (tc < tf) {
    p = I.add(o, I.mul(d, tc));
    return { p, n: I.unit([-p[0], -p[1], 0]) };
  }
  return { p: I.add(o, I.mul(d, tf)), n: [0, 0, 1] };
};

// The pavement: a grid of squares on the axes, a porphyry roundel in one, a granite square in the next, bands between.
const PAVE = 3.1;
const pavement = (x, y) => {
  const i = Math.floor(x / PAVE + 0.5);
  const j = Math.floor(y / PAVE + 0.5);
  const fx = x / PAVE - i;
  const fy = y / PAVE - j;
  const edge = 0.5 - Math.max(Math.abs(fx), Math.abs(fy));
  const band = 1 - smooth(0.05, 0.065, edge);
  let a;
  if ((i + j) & 1) {
    const sq = 0.31 - Math.max(Math.abs(fx), Math.abs(fy));
    a = 0.66 - 0.28 * smooth(0, 0.01, sq);
  } else {
    const rr = 0.36 - Math.hypot(fx, fy);
    a = 0.6 - 0.36 * smooth(0, 0.01, rr) - 0.12 * smooth(0.015, 0.025, -rr) * smooth(-0.06, -0.05, -rr);
  }
  return a * (1 - band) + 0.4 * band + 0.08 * (M.hash(i, j, 7) - 0.5);
};

export const scene = ({ res = RES, haze = 0.5 } = {}) => {
  const pitch = PITCH * I.deg;
  const D = 40;
  const target = [EYE[0], EYE[1] + D * Math.cos(pitch), EYE[2] + D * Math.sin(pitch)];
  const cam = I.perspective({ eye: EYE, target, scale: FOCAL / D, offset: [WIDTH * 0.5, HEIGHT * 0.5], width: WIDTH, height: HEIGHT });

  // The shell, only the half in front of the eye: the drum, open at its bays, and the coffered dome.
  const AZ0 = -90 * I.deg;
  const AZ1 = 270 * I.deg;
  const azOf = (u) => AZ0 + u * (AZ1 - AZ0);
  const wall = relief({ at: (u, v) => wallPoint(azOf(u), v * SPRING), toward: inward, mask: (u, v) => !opening(azOf(u), v * SPRING) });
  const dome = relief({ at: (u, v) => domePoint(azOf(u), v * EL_OC), toward: inward });
  const throat = facing((u, v) => [OC * Math.cos(u * I.TAU), OC * Math.sin(u * I.TAU), RIM - 0.1 + v * (TOP - RIM + 0.1)], (p) => [-p[0], -p[1], 0], 64, 1);
  const floor = plane([-30, -18, 0], [60, 0, 0], [0, 48, 0], [0, 0, 1]);

  // The exedrae behind their columns, the passage to the doors, and the aedicules between the bays.
  const niches = [];
  const dark = [];
  const columns = [];
  const aedicules = [];
  for (const k of [1, 2, 3, 5, 6, 7]) {
    const f = frame(bayAz(k));
    const c0 = chord(EXEDRA);
    const top = ENTABLATURE;
    if (k === 2 || k === 6) {
      niches.push(facing((u, v) => { const a = (u - 0.5) * Math.PI; return at3(f, c0 + EXEDRA * Math.cos(a), EXEDRA * Math.sin(a), v * top); }, (p) => I.sub(at3(f, c0, 0, p[2]), p), 32, 1));
      niches.push(facing((u, v) => { const t = (u - 0.5) * 2 * EXEDRA; const a = chord(t); return at3(f, a + v * (c0 + Math.sqrt(EXEDRA * EXEDRA - t * t) - a), t, top); }, () => [0, 0, -1], 24, 4));
    } else {
      niches.push(plane(at3(f, R + NICHE, -EXEDRA, 0), I.mul(f.et, 2 * EXEDRA), [0, 0, top], I.mul(f.er, -1)));
      for (const s of [-1, 1]) niches.push(plane(at3(f, c0, s * EXEDRA, 0), I.mul(f.er, R + NICHE - c0), [0, 0, top], I.mul(f.et, -s)));
      niches.push(facing((u, v) => { const t = (u - 0.5) * 2 * EXEDRA; const a = chord(t); return at3(f, a + v * (R + NICHE - a), t, top); }, () => [0, 0, -1], 24, 1));
    }
    for (const t of [-EXEDRA / 3, EXEDRA / 3]) columns.push(column(at3(f, chord(t) - 0.15, t, 0), ENTABLATURE, 0.56, 0.48));
  }
  {
    const f = frame(bayAz(0));
    const c0 = chord(DOOR);
    const end = R + PASSAGE;
    for (const s of [-1, 1]) niches.push(plane(at3(f, c0, s * DOOR, 0), I.mul(f.er, end - c0), [0, 0, ARCH], I.mul(f.et, -s)));
    niches.push(facing((u, v) => { const a = u * Math.PI; return at3(f, c0 + v * (end - c0), DOOR * Math.cos(a), ARCH + DOOR * Math.sin(a)); }, (p) => [0, 0, ARCH - p[2]], 32, 1));
    // The end of the passage: the doorway, and the bronze grille in the lunette over it, both open to the portico.
    const grille = (t, z) => z > 11.9 && Math.min(frac((t + 8) / 0.62) * 0.62, frac(z / 0.62) * 0.62) > 0.1 && t * t + Math.max(0, z - ARCH) ** 2 < (DOOR - 0.5) ** 2;
    dark.push(plane(at3(f, end, -DOOR, 0), I.mul(f.et, 2 * DOOR), [0, 0, ARCH + DOOR], I.mul(f.er, -1), (u, v) => {
      const t = (u - 0.5) * 2 * DOOR;
      const z = v * (ARCH + DOOR);
      return !(Math.abs(t) < 3.1 && z < 11.4) && !grille(t, z);
    }));
  }
  for (let k = 0; k < 8; k++) {
    const f = frame(bayAz(k) + 22.5 * I.deg);
    const r = R - 1.6;
    aedicules.push(...block(f, [-2.6, 2.6], [r, R], [0, 2.4]));
    for (const t of [-1.9, 1.9]) columns.push(column(at3(f, R - 1.15, t, 2.4), 4.6, 0.28, 0.24));
    aedicules.push(...block(f, [-2.55, 2.55], [r + 0.05, R], [7.0, 7.7]));
    // Triangular and segmental pediments in turn.
    const roof = k % 2 ? (t) => 7.7 + 1.0 * (1 - (t / 2.6) ** 2) : (t) => 7.7 + 1.25 * (1 - Math.abs(t) / 2.6);
    aedicules.push(plane(at3(f, r, -2.6, 7.7), I.mul(f.et, 5.2), [0, 0, 1.3], I.mul(f.er, -1), (u, v) => 7.7 + v * 1.3 <= roof((u - 0.5) * 5.2)));
    aedicules.push(facing((u, v) => { const t = (u - 0.5) * 5.2; return at3(f, r + v * 1.6, t, roof(t)); }, () => [0, 0, 1], 24, 1));
  }

  const parts = columns.flatMap((c) => [c.shaft, c.foot, c.head]);
  const solids = [floor, wall, dome, throat, ...niches, ...dark, ...parts, ...aedicules];
  const kind = new Map([[floor, 0], [wall, 1], [dome, 2], [throat, 3]]);
  for (const s of niches) kind.set(s, 4);
  for (const s of dark) kind.set(s, 5);
  for (const c of columns) { kind.set(c.shaft, 6); kind.set(c.foot, 7); kind.set(c.head, 7); }
  for (const s of aedicules) kind.set(s, 7);

  const G = M.gbuffer(solids, cam, {
    res,
    mesh: (s) => (s === dome ? [1300, 340] : s === wall ? [1300, 300] : s === floor ? [48, 40] : columns.some((c) => c.shaft === s) ? [72, 24] : s === throat ? [64, 1] : s.normal || !s.triangles ? [1, 1] : [24, 24]),
  });

  // The light in the air: the haze takes out sigma of the light per metre and sends it on, mostly forward.
  const SIGMA = 0.016 * (haze / 0.5);
  /** The oculus as a light: what share of it a point sees, by the cosines at both ends over the square of the distance. */
  const sky = (p, n) => {
    let sum = 0;
    for (const [dx, dy] of [[0, 0], [2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6]]) {
      const w = I.sub([dx, dy, RIM], p);
      const d2 = I.dot(w, w);
      const d = Math.sqrt(d2);
      const u = I.mul(w, 1 / d);
      const cp = n ? I.dot(n, u) : 1;
      if (cp <= 0 || through(p[0], p[1], p[2], u) <= 0.5) continue;
      sum += (cp * u[2]) / d2;
    }
    return (sum / 5) * OC * OC;
  };
  const SKY_FLOOR = (OC * OC) / (RIM * RIM);
  const POOL = 0.3 * 26 * 26;

  const N = G.w * G.h;
  const fixed = new Float32Array(N);
  const dist = new Float32Array(N);
  const cells = { i: new Int32Array(N), kind: new Uint8Array(N), albedo: new Float32Array(N), t: new Float32Array(N), count: 0 };
  for (let i = 0; i < N; i++) {
    const k = G.id[i];
    const x = i % G.w;
    const y = (i - x) / G.w;
    if (k < 0) {
      // Through the oculus, the sky; through the doors, the portico in the shade.
      const dir = M.ray(cam, G.res, x + 0.5, y + 0.5);
      const up = dir[2] > 0.7;
      const d = up ? (RIM - EYE[2]) / dir[2] : 48;
      dist[i] = d;
      const tr = Math.exp(-SIGMA * d);
      fixed[i] = (up ? 1.6 - 0.25 * smooth(0.98, 0.9, dir[2]) : 0.55) * tr;
      continue;
    }
    const p = [G.p[i * 3], G.p[i * 3 + 1], G.p[i * 3 + 2]];
    const n = [G.n[i * 3], G.n[i * 3 + 1], G.n[i * 3 + 2]];
    const d = Math.hypot(p[0] - EYE[0], p[1] - EYE[1], p[2] - EYE[2]);
    const t = Math.exp(-SIGMA * d);
    dist[i] = d;
    const kd = kind.get(solids[k]);
    let albedo = 0.6;
    let occl = 1;
    if (kd === 0) albedo = pavement(p[0], p[1]);
    else if (kd === 1) {
      const az = Math.atan2(p[1], p[0]);
      const { k: bay, q } = bayOf(az);
      const a = attic(q, p[2]).kind;
      const z = p[2];
      // White marble for the entablature and cornices, the attic's porphyry and serpentine panels and blind
      // windows, coloured marble revetment in big slabs on the ground order.
      albedo = a === 2 ? 0.2 : a === 3 ? 0.7 : a === 1 ? 0.62 : a === 4 ? 0.36 + 0.08 * M.hash(Math.floor((q + 40) / ATTIC_UNIT), Math.floor(z / 2.2), 3) : 0.62;
      if (z > ENTABLATURE && z < 12.62) albedo = 0.74;
      else if (z < ENTABLATURE && z > 0.4) {
        const slab = M.hash(Math.floor((q + 40) / 1.4), Math.floor(z / 2.1), 5);
        albedo = 0.48 + 0.16 * slab;
        // The statue niche in the back of each aedicule.
        const qa = R * wrap(az - bayAz(bay) - 22.5 * I.deg * Math.sign(wrap(az - bayAz(bay)) || 1));
        if (Math.abs(qa) < 1.25 && z > 2.6 && z < 6.7) albedo = 0.16;
      } else if (z >= 20.5) albedo = 0.7;
      albedo += 0.05 * (M.fbm(az * 30, z * 0.6, { octaves: 3, seed: 2 }) - 0.5);
    } else if (kd === 2) {
      const h = p[2] - SPRING;
      const el = Math.asin(Math.max(-1, Math.min(1, h / Math.hypot(p[0], p[1], h))));
      const c = coffer(Math.atan2(p[1], p[0]), el);
      // Old concrete and stucco, stained in drifts; deeper into a coffer is darker, the light reaches it less.
      albedo = 0.56 + 0.16 * (M.fbm(Math.atan2(p[1], p[0]) * 9, el * 14, { octaves: 4, seed: 6 }) - 0.5);
      occl = 1 - 0.4 * c.into;
    } else if (kd === 3) albedo = 0.45;
    else if (kd === 4) {
      albedo = 0.5;
      occl = 0.6;
    } else if (kd === 5) albedo = 0.18;
    else if (kd === 6) albedo = 0.6 + 0.12 * (M.fbm(p[2] * 0.8, Math.atan2(p[1], p[0]) * 20, { octaves: 3, seed: 8 }) - 0.5);
    else if (kd === 7) albedo = 0.7;
    else albedo = 0.15;
    // The sky through the oculus, and the light that has bounced round the room many times: even, a little less low down.
    // The pool of skylight on the pavement lights the room again from below, so the coffers' upper steps and
    // the soffits of the cornices are not black.
    const fd2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2] + 1;
    const pool = (Math.max(0, -(n[0] * p[0] + n[1] * p[1] + n[2] * p[2])) * p[2]) / (fd2 * fd2);
    const lightIn = (0.55 * sky(p, n)) / SKY_FLOOR + 0.05 * (0.6 + 0.4 * smooth(0, 30, p[2])) + POOL * pool;
    fixed[i] = albedo * lightIn * occl * t;
    const c = cells.count++;
    cells.i[c] = i;
    cells.kind[c] = kd;
    cells.albedo[c] = albedo * occl;
    cells.t[c] = t;
  }

  // The air on a coarser grid. The sky lights it from above, brightest in the column under the oculus; that never
  // changes, so it goes into the fixed tone now.
  const VR = 4;
  const vw = Math.ceil(G.w / VR);
  const vh = Math.ceil(G.h / VR);
  const rays = [];
  const skyAir = [];
  for (let j = 0; j < vh; j++) {
    for (let i = 0; i < vw; i++) {
      const x = Math.min(G.w - 1, i * VR + (VR >> 1));
      const y = Math.min(G.h - 1, j * VR + (VR >> 1));
      const dir = M.ray(cam, G.res, x + 0.5, y + 0.5);
      const d = Math.min(70, dist[y * G.w + x]);
      const ray = { dir, d, jitter: M.hash(i, j, 5) };
      rays.push(ray);
      let sum = 0;
      const n = 24;
      for (let s = 0; s < n; s++) {
        const tt = ((s + ray.jitter) / n) * d;
        const q = I.add(EYE, I.mul(dir, tt));
        sum += (sky(q) / SKY_FLOOR) * DRIFT(q[0], q[1], q[2]) * Math.exp(-SIGMA * tt);
      }
      skyAir.push((sum * SIGMA * d) / n);
    }
  }

  // How each plate cell takes the coarse air: from its four coarse neighbours, but only from those whose rays end
  // about as far away as its own, so the beam behind a column never bleeds onto the column.
  const base = new Int32Array(N);
  const weight = new Float32Array(N * 4);
  for (let y = 0; y < G.h; y++) {
    const fy = Math.min(vh - 1.001, Math.max(0, (y + 0.5) / VR - 0.5));
    const j0 = Math.floor(fy);
    const ty = fy - j0;
    for (let x = 0; x < G.w; x++) {
      const fx = Math.min(vw - 1.001, Math.max(0, (x + 0.5) / VR - 0.5));
      const i0 = Math.floor(fx);
      const tx = fx - i0;
      const i = y * G.w + x;
      const d = Math.min(70, dist[i]);
      const k = j0 * vw + i0;
      const ws = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty].map((w0, n) => (w0 + 1e-4) / (1 + 40 * Math.abs(Math.log(rays[k + (n & 1) + (n >> 1) * vw].d / d))));
      const sum = ws[0] + ws[1] + ws[2] + ws[3];
      base[i] = k;
      for (let n = 0; n < 4; n++) weight[i * 4 + n] = ws[n] / sum;
    }
  }
  const S = { cam, G, cells, fixed, sigma: SIGMA, rays, spread: { base, weight, vw } };
  const AIR_SKY = 0.08;
  const glow = lay(S, Float32Array.from(skyAir));
  for (let i = 0; i < N; i++) fixed[i] += AIR_SKY * glow[i];

  // The oculus burns into the dark round it, as on film. Its light never changes, so neither does the halo.
  const bright = Float32Array.from(fixed, (x) => Math.max(0, x - 0.9));
  const glare = M.blur(bright, G.w, G.h, 14);
  for (let i = 0; i < N; i++) glare[i] *= 0.6;

  // What casts inside the room besides the shell itself: the columns and the aedicules.
  const casters = [...columns.map((c) => c.caster), ...aedicules];
  return { ...S, glare, tris: I.trianglesOf(casters), threshold: M.grain(G.w, G.h, { seed: 4, clump: 0.25, size: 2, soft: 0.4 }) };
};

/** The light the haze sends toward the eye along every coarse ray: the beam, thinned by the haze in front of it. */
const air = (S, L, shadow, samples) => {
  const { rays, sigma } = S;
  const out = new Float32Array(rays.length);
  const g = 0.45;
  const p = [0, 0, 0];
  for (let r = 0; r < rays.length; r++) {
    const { dir, d, jitter } = rays[r];
    const cos = I.dot(dir, L);
    const phase = (1 - g * g) / Math.pow(1 + g * g - 2 * g * cos, 1.5);
    const step = d / samples;
    const fade = Math.exp(-sigma * step);
    let left = Math.exp(-sigma * jitter * step);
    let sum = 0;
    for (let s = 0; s < samples; s++, left *= fade) {
      const t = (s + jitter) * step;
      p[0] = EYE[0] + dir[0] * t;
      p[1] = EYE[1] + dir[1] * t;
      p[2] = EYE[2] + dir[2] * t;
      const sun = through(p[0], p[1], p[2], L);
      if (sun > 0 && shadow.seen(p)) sum += sun * DRIFT(p[0], p[1], p[2]) * left;
    }
    out[r] = sum * sigma * step * phase;
  }
  return out;
};

/** The coarse air laid back on the plate: each cell a weighted sum of its four coarse neighbours (see `spread`). */
const lay = (S, a) => {
  const { base, weight, vw } = S.spread;
  const out = new Float32Array(base.length);
  for (let i = 0; i < base.length; i++) {
    const k = base[i];
    const w = i * 4;
    out[i] = a[k] * weight[w] + a[k + 1] * weight[w + 1] + a[k + vw] * weight[w + 2] + a[k + vw + 1] * weight[w + 3];
  }
  return out;
};

/** Whether the sun at p is cut off by a moulding or a coffer step: a short march toward the sun through the masonry. */
const relit = (p, n, L) => {
  let t = 0.03;
  const x = p[0] + n[0] * 0.015;
  const y = p[1] + n[1] * 0.015;
  const z = p[2] + n[2] * 0.015;
  while (t < 3.5) {
    if (solid(x + L[0] * t, y + L[1] * t, z + L[2] * t)) return 0;
    t *= 1.18;
  }
  return 1;
};

/** The tone of every cell at a solar time, printed through the grain. A negative plate inks the light. */
export const inkAt = (S, hours, { size = 1024, samples = 48, negative = false, grain = "film", sun = 2.6, beams = 5, bounce = 1.2, curve = 0.75 } = {}) => {
  const { light } = sunAt(hours);
  const L = I.unit(light);
  const shadow = I.shadowMap(null, L, { size, tris: S.tris, soft: 1.4 });
  const out = S.fixed.slice();
  const { i: at, kind, albedo, t, count } = S.cells;
  const { p: P, n: Nm } = S.G;
  // The sunlit disc lights the room again, as a lamp where the beam lands.
  const land = landing(L);
  const power = bounce * sun * 0.6 * L[2] * Math.max(0, I.dot(land.n, L)) * OC * OC;
  const p = [0, 0, 0];
  const n = [0, 0, 0];
  for (let c = 0; c < count; c++) {
    const i = at[c];
    const k = i * 3;
    p[0] = P[k]; p[1] = P[k + 1]; p[2] = P[k + 2];
    n[0] = Nm[k]; n[1] = Nm[k + 1]; n[2] = Nm[k + 2];
    const wx = land.p[0] - p[0];
    const wy = land.p[1] - p[1];
    const wz = land.p[2] - p[2];
    const d2 = wx * wx + wy * wy + wz * wz + 4;
    const d = Math.sqrt(d2);
    const cp = (n[0] * wx + n[1] * wy + n[2] * wz) / d;
    const cl = -(land.n[0] * wx + land.n[1] * wy + land.n[2] * wz) / d;
    if (cp > 0 && cl > 0) out[i] += (albedo[c] * power * cp * cl * t[c]) / d2;
    const l = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    if (l <= 0) continue;
    const th = through(p[0], p[1], p[2], L);
    if (th <= 0) continue;
    const self = kind[c] === 1 || kind[c] === 2 ? relit(p, n, L) : 1;
    if (!self) continue;
    out[i] += sun * th * albedo[c] * l * shadow.lit(p, n) * t[c];
  }
  const beam = lay(S, air(S, L, shadow, samples));
  const curveOf = Float32Array.from({ length: 1025 }, (_, j) => Math.pow(j / 1024, curve));
  const tone = new Float32Array(out.length);
  for (let i = 0; i < tone.length; i++) {
    // A soft shoulder, so the brightest air keeps a little grain instead of burning out.
    const x = out[i] + beams * beam[i] + S.glare[i];
    const v = curveOf[Math.round((x < 0.6 ? x : 1 - 0.4 * Math.exp((0.6 - x) / 0.4)) * 1024)];
    tone[i] = negative ? v : 1 - v;
  }
  return grain === "film" ? M.film(tone, S.threshold, { amount: 0.5 }) : M.print(tone, S.threshold);
};
