import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// The nave of a High Gothic cathedral, seen from the west end looking east, printed as a mezzotint.
// World units are metres: x east, y north, z up. Ten bays of 7 m between piers 14 m apart, an arcade, a triforium and
// a clerestory under a quadripartite rib vault 33 m high, about the size of Chartres and at its latitude. The church is
// dark; the sun gets in only through the windows. Each window is tested exactly (tracery and all) along the ray to the
// sun, the piers and arcades cast through a shadow map, and the sunbeams are marched through the haze of the nave, so
// the shafts are the windows' shapes carried across the air and laid on the floor and up the piers.

export const WIDTH = 560;
export const HEIGHT = 720;
export const RES = 2;

export const LATITUDE = 48.45;
export const DECLINATION = -11;

const BAY = 7;
const X0 = -7;
const X1 = 63;
const WEST = -17;
const NAVE = 6.4;
const OUTER = 7.6;
const AISLE = 14;
const PIER = 7;
const SPRING = 12;
const TRIFORIUM = [17.5, 21];
const AISLE_TOP = 17;
const VAULT = 26;
const CROWN = 33;
const EYE = [-14, 0.6, 1.7];
const FOCAL = 580;

/** How far v is from the nearest multiple of w: the distance to a joint or a bar. */
const off = (v, w) => {
  const f = (((v / w) % 1) + 1) % 1;
  return Math.min(f, 1 - f) * w;
};
const range = (n) => Array.from({ length: n }, (_, i) => i);
const smooth = I.smoothstep;

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

/** A pointed arch of half-span s and rise h, both sides struck from centres on the springing line: height over the
 * springing at offset q from the middle, and the offset at a height. Equilateral when h = s√3. */
const pointed = (s, h) => {
  const c = (h * h - s * s) / (2 * s);
  const R = c + s;
  return {
    z: (q) => Math.sqrt(Math.max(0, R * R - (Math.abs(q) + c) ** 2)),
    q: (z) => Math.sqrt(Math.max(0, R * R - z * z)) - c,
  };
};
/** Whether (q, z) is inside an opening of half-width s with an equilateral pointed head springing at `spring`. */
const underArch = (q, z, s, spring) => {
  const a = Math.abs(q);
  if (a > s || z < 0) return false;
  const h = z - spring;
  return h <= 0 || h * h + (a + s) * (a + s) <= 4 * s * s;
};

const nave = pointed(NAVE, CROWN - VAULT);
const cell = pointed(BAY / 2, CROWN - VAULT);
/** Offset from the middle of the bay at x. */
const inBay = (x) => x - X0 - (Math.floor((x - X0) / BAY) + 0.5) * BAY;

/** A two-light window with an oculus over the lights, `half` wide each side of q = 0, from `sill` to the springing. */
const window = (q, z, { half, sill, spring }) => {
  if (z < sill || !underArch(q, z - sill, half, spring - sill)) return false;
  const w = 0.444 * half;
  if (underArch(q + 0.5 * half, z - sill, w, spring - sill) || underArch(q - 0.5 * half, z - sill, w, spring - sill)) return true;
  const dz = z - spring - 1.26 * half;
  return q * q + dz * dz < 0.1296 * half * half;
};

// Where the walls are open, as functions of the wall's own coordinates (along it, up it).
const CLERESTORY = { half: 2.5, sill: 22, spring: 27 };
const AISLE_LIGHT = { half: 1.5, sill: 4, spring: 10 };
const arcadeOpen = (x, z) => {
  const q = inBay(x);
  if (x < X0 || x > X1) return false;
  if (z < TRIFORIUM[0]) return underArch(q, z, 2.6, SPRING);
  if (z < TRIFORIUM[1]) return underArch(q - 1.5 * Math.round((q + 0.75) / 1.5) + 0.75, z - 17.9, 0.45, 2) && Math.abs(q) < 3;
  return window(q, z, CLERESTORY);
};
const clerestoryOpen = (x, z) => x > X0 - BAY && x < X1 && window(inBay(x), z, CLERESTORY);
const aisleOpen = (x, z) => x > X0 - BAY && x < X1 && window(inBay(x), z, AISLE_LIGHT);
const ROSE = [25.5, 4.3];
const eastOpen = (y, z) => {
  if ([-3.4, 0, 3.4].some((c) => underArch(y - c, z - 4, 1.3, 13))) return true;
  const r = Math.hypot(y, z - ROSE[0]);
  const a = Math.atan2(z - ROSE[0], y);
  const bar = (n, w) => Math.abs((((a / I.TAU) * n + 0.5) % 1 + 1) % 1 - 0.5) * (I.TAU / n) * r > w;
  return r < 0.8 || (r > 1.1 && r < 3.6 && bar(16, 0.1)) || (r > 3.82 && r < ROSE[1] && bar(32, 0.07));
};

/** How much light a pane of stained glass passes: each pane of the armature its own colour, most of them deep. */
const pane = (a, z, seed, clear = 0.2) => {
  const h = M.hash(Math.floor(a / 0.7), Math.floor(z / 0.8), seed);
  return clear + (1 - clear) * h * h;
};
const DEPTH = 1.2;

/**
 * How much of the sun reaches p through the shell of the church, 0 to 1. The sun is to the south, so a ray from
 * anywhere inside leaves through the south: through a clerestory light, or under the south arcade and out by an aisle
 * window, or through the east window in the morning. The walls are DEPTH thick and a ray has to clear the opening at
 * both faces, so a low sun gets in as a narrow blade; then the glass takes its share. Piers and arcades between are
 * the shadow map's business.
 */
const shell = (x, y, z, L) => {
  if (L[1] > -1e-6 || L[2] <= 0) return 0;
  const tEnd = L[0] > 1e-6 ? (X1 - x) / L[0] : L[0] < -1e-6 ? (WEST - x) / L[0] : Infinity;
  if (y > NAVE) {
    const t = (NAVE - y) / L[1];
    if (t > tEnd || z + t * L[2] > TRIFORIUM[0]) return 0;
  }
  if (y > -NAVE) {
    const t = (-NAVE - y) / L[1];
    if (tEnd < t) {
      if (L[0] < 0) return 0;
      const tb = (X1 + DEPTH - x) / L[0];
      const by = y + tb * L[1];
      const bz = z + tb * L[2];
      return eastOpen(y + tEnd * L[1], z + tEnd * L[2]) && eastOpen(by, bz) ? pane(by, bz, 3, 0.3) : 0;
    }
    const zc = z + t * L[2];
    if (zc >= TRIFORIUM[1]) {
      const tb = (-OUTER - y) / L[1];
      const bx = x + tb * L[0];
      const bz = z + tb * L[2];
      return clerestoryOpen(x + t * L[0], zc) && clerestoryOpen(bx, bz) ? pane(bx, bz, 1) : 0;
    }
    if (zc > TRIFORIUM[0]) return 0;
  }
  const t = (-AISLE - y) / L[1];
  const zc = z + t * L[2];
  if (tEnd < t || zc > AISLE_TOP) return 0;
  const tb = (-AISLE - DEPTH - y) / L[1];
  const bx = x + tb * L[0];
  const bz = z + tb * L[2];
  return aisleOpen(x + t * L[0], zc) && aisleOpen(bx, bz) ? pane(bx, bz, 2, 0.25) : 0;
};

/** The haze is not even: it hangs in slow drifts, a field sampled on a 1.5 m lattice and read back trilinearly. */
const DRIFT = (() => {
  const o = [-16, -16, 0];
  const h = 1.5;
  const [nx, ny, nz] = [56, 22, 25];
  const f = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const [x, y, z] = [o[0] + i * h, o[1] + j * h, o[2] + k * h];
        const v = (M.fbm(x / 9 + z / 14, y / 8 - z / 21, { octaves: 3, seed: 31 }) + M.fbm(x / 12 - y / 17, z / 7, { octaves: 3, seed: 37 })) / 2;
        f[(k * ny + j) * nx + i] = 0.3 + 1.4 * I.smoothstep(0.3, 0.7, v);
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

/** A level rectangle or a wall as a patch: `at(u, v)` over the rectangle, with the normal turned toward `face`. */
const plane = (corner, du, dv, face, mask) => {
  const n = I.cross(du, dv);
  const side = I.dot(n, face) >= 0 ? 1 : -1;
  return I.patch({ at: (u, v) => I.add(corner, I.add(I.mul(du, u), I.mul(dv, v))), side, nu: 1, nv: 1, mask });
};

/** A round moulding of radius r along a curve c(t), t in [0, 1]: a rib, a transverse arch. */
const tube = (c, r, nv = 40) => {
  const frame = (v) => {
    const t = I.unit(I.sub(c(Math.min(1, v + 1e-3)), c(Math.max(0, v - 1e-3))));
    const a = I.unit(Math.abs(t[2]) > 0.95 ? I.cross(t, [1, 0, 0]) : I.cross(t, [0, 0, 1]));
    return [a, I.cross(t, a)];
  };
  const at = (u, v) => {
    const [a, b] = frame(v);
    return I.add(c(v), I.add(I.mul(a, r * Math.cos(u * I.TAU)), I.mul(b, r * Math.sin(u * I.TAU))));
  };
  const probe = I.patch({ at, nu: 1, nv: 1 }).point(0.1, 0.5);
  const side = I.dot(probe[1], I.sub(probe[0], c(0.5))) >= 0 ? 1 : -1;
  return I.patch({ at, side, nu: 10, nv });
};

/** A compound pier: a round core with four colonnettes, each on its base and under a shared capital. */
const pier = (x, y) => {
  const core = I.lathe({
    base: [x, y, 0],
    profile: [[0, 1.75, 1], [0.55, 1.75, 1], [0.55, 1.55, 1], [0.62, 1.5], [0.8, 1.56], [0.95, 1.36], [1.02, 1.2, 1], [1.1, 1.05, 1], [11.0, 1.05, 1], [11.06, 1.14], [11.16, 1.14], [11.2, 1.05, 1], [11.3, 1.08], [11.75, 1.3], [12.0, 1.52, 1], [12.0, 1.64, 1], [12.4, 1.64, 1], [12.4, 0, 1]],
  });
  const colonnettes = [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].map(([dx, dy]) =>
    I.lathe({ base: [x + dx, y + dy, 0.55], profile: [[0, 0.4, 1], [0.12, 0.42], [0.3, 0.3], [0.45, 0.27, 1], [10.45, 0.27, 1], [10.55, 0.33], [10.65, 0.27, 1], [11.45, 0.32], [11.45, 0, 1]] }),
  );
  // The vaulting shaft rises on the nave side from the abacus to the springing of the vault.
  const ny = y > 0 ? y - 0.85 : y + 0.85;
  const shaft = I.lathe({ base: [x, ny, 12.4], profile: [[0, 0.32, 1], [0.15, 0.36], [0.3, 0.27, 1], [13.0, 0.27, 1], [13.1, 0.33], [13.2, 0.27, 1], [13.25, 0.3], [13.5, 0.46, 1], [13.6, 0.46, 1], [13.6, 0, 1]] });
  return { core, colonnettes, shaft };
};

export const scene = ({ res = RES, haze = 0.5 } = {}) => {
  const target = [EYE[0] + 74, EYE[1], EYE[2]];
  const cam = I.perspective({ eye: EYE, target, scale: FOCAL / 74, offset: [WIDTH * 0.5, HEIGHT * 0.66], width: WIDTH, height: HEIGHT });
  const near = EYE[0] + 1;

  const floor = plane([near, -AISLE, 0], [X1 - near, 0, 0], [0, 2 * AISLE, 0], [0, 0, 1]);
  // The nave walls: one plane each side through the inner face, open at the arcade, triforium and clerestory.
  const walls = [1, -1].map((s) => plane([near, s * NAVE, 0], [X1 - near, 0, 0], [0, 0, CROWN + 1], [0, -s, 0], (u, v) => !arcadeOpen(near + u * (X1 - near), v * (CROWN + 1))));
  // The soffits of the arcade arches, the depth of the wall from its inner to its outer face.
  const arch = (t) => {
    const a = t < 0.5 ? Math.PI - (t / 0.5) * (Math.PI / 3) : (2 * Math.PI) / 3 - ((t - 0.5) / 0.5) * (Math.PI / 3);
    const c = t < 0.5 ? 2.6 : -2.6;
    return [c + 5.2 * Math.cos(a), SPRING + 5.2 * Math.sin(a)];
  };
  const bays = range((X1 - X0) / BAY).map((k) => X0 + (k + 0.5) * BAY);
  const soffits = [1, -1].flatMap((s) =>
    bays.map((mid) => {
      const at = (u, v) => {
        const [q, z] = arch(u);
        return [mid + q, s * (NAVE + v * (OUTER - NAVE)), z];
      };
      const probe = I.patch({ at, nu: 1, nv: 1 }).point(0.5, 0.5);
      return I.patch({ at, side: probe[1][2] < 0 ? 1 : -1, nu: 24, nv: 1 });
    }),
  );
  const back = [1, -1].map((s) => plane([near, s * 8.2, TRIFORIUM[0]], [X1 - near, 0, 0], [0, 0, TRIFORIUM[1] - TRIFORIUM[0]], [0, -s, 0]));
  const courses = [1, -1].flatMap((s) =>
    [TRIFORIUM[0], TRIFORIUM[1]].flatMap((z) => I.box({ min: [near, s > 0 ? NAVE - 0.28 : -NAVE, z - 0.3], max: [X1, s > 0 ? NAVE : -NAVE + 0.28, z] })),
  );
  const piers = [1, -1].flatMap((s) => range((X1 - X0) / BAY + 1).map((k) => pier(X0 + k * BAY, s * PIER)));
  const aisleWalls = [1, -1].map((s) => plane([near, s * AISLE, 0], [X1 - near, 0, 0], [0, 0, AISLE_TOP], [0, -s, 0], (u, v) => !aisleOpen(near + u * (X1 - near), v * AISLE_TOP)));
  const aisleCeilings = [1, -1].map((s) => plane([near, s * OUTER, AISLE_TOP], [X1 - near, 0, 0], [0, s * (AISLE - OUTER), 0], [0, 0, -1]));
  const east = plane([X1, -NAVE, 0], [0, 2 * NAVE, 0], [0, 0, CROWN + 1], [-1, 0, 0], (u, v) => !eastOpen(-NAVE + u * 2 * NAVE, v * (CROWN + 1)));
  const aisleEnds = [1, -1].map((s) => plane([X1, s * NAVE, 0], [0, s * (AISLE - NAVE), 0], [0, 0, AISLE_TOP], [-1, 0, 0]));

  // The glass, a little outside each opening, so every window cell knows where it is and how far.
  const glass = [
    ...[1, -1].map((s) => plane([near, s * OUTER, TRIFORIUM[1]], [X1 - near, 0, 0], [0, 0, CROWN - TRIFORIUM[1]], [0, -s, 0])),
    ...[1, -1].map((s) => plane([near, s * (AISLE + DEPTH), 0], [X1 - near, 0, 0], [0, 0, AISLE_TOP], [0, -s, 0])),
    plane([X1 + DEPTH, -NAVE, 0], [0, 2 * NAVE, 0], [0, 0, CROWN], [-1, 0, 0]),
  ];

  // The vault: two pointed barrels crossing in every bay, the ceiling the higher of the two, so the cells rise into
  // lunettes over the clerestory and meet the nave's barrel along the groins.
  const height = (x, y) => VAULT + Math.max(nave.z(y), cell.z(inBay(x)));
  const vault = I.patch({ at: (u, v) => { const x = near + u * (X1 - near); const y = (v - 0.5) * 2 * NAVE; return [x, y, height(x, y)]; }, side: -1, nu: 1, nv: 1 });
  const hang = 0.12;
  const ribs = [
    ...range((X1 - X0) / BAY + 1).map((k) => tube((t) => { const y = (t - 0.5) * 2 * NAVE; return [X0 + k * BAY, y, VAULT + nave.z(y) - hang]; }, 0.32)),
    ...bays.flatMap((mid) => [1, -1].map((d) => tube((t) => { const y = (t - 0.5) * 2 * NAVE; const z = nave.z(y); return [mid + d * Math.sign(y) * cell.q(z), y, VAULT + z - hang]; }, 0.2))),
    tube((t) => [near + t * (X1 - near), 0, CROWN - hang], 0.16, 4),
  ];
  const bosses = bays.map((mid) => I.sphere({ center: [mid, 0, CROWN - 0.35], radius: 0.42 }));

  const stoneParts = [...walls, ...soffits, ...courses, ...piers.flatMap((p) => [p.core, ...p.colonnettes, p.shaft]), ...aisleWalls, east, ...aisleEnds, vault, ...ribs, ...bosses];
  const solids = [floor, ...stoneParts, ...back, ...aisleCeilings, ...glass];
  const kindOf = (s) => (s === floor ? 0 : glass.includes(s) ? 2 : back.includes(s) || aisleCeilings.includes(s) ? 3 : 1);
  const kinds = solids.map(kindOf);

  const G = M.gbuffer(solids, cam, {
    res,
    mesh: (s) => (s === vault ? [176, 32] : s === floor ? [16, 8] : s.normal || walls.includes(s) || glass.includes(s) || s === east || aisleWalls.includes(s) ? [8, 8] : ribs.includes(s) ? [8, 40] : soffits.includes(s) ? [24, 1] : [32, 40]),
  });

  // The light in the air: the haze takes out sigma of the light per metre and sends it on, mostly forward.
  const SIGMA = 0.02 * (haze / 0.5);
  const AMBIENT_HAZE = 0.3;

  const N = G.w * G.h;
  const fixed = new Float32Array(N);
  const dist = new Float32Array(N);
  const cells = { i: new Int32Array(N), kind: new Uint8Array(N), albedo: new Float32Array(N), t: new Float32Array(N), count: 0 };
  for (let i = 0; i < N; i++) {
    const k = G.id[i];
    if (k < 0) {
      dist[i] = 200;
      fixed[i] = AMBIENT_HAZE;
      continue;
    }
    const p = [G.p[i * 3], G.p[i * 3 + 1], G.p[i * 3 + 2]];
    const n = [G.n[i * 3], G.n[i * 3 + 1], G.n[i * 3 + 2]];
    const d = Math.hypot(p[0] - EYE[0], p[1] - EYE[1], p[2] - EYE[2]);
    const t = Math.exp(-SIGMA * d);
    dist[i] = d;
    let kind = kinds[k];
    let albedo = 0.6;
    let glow = 0;
    if (kind === 0) {
      // Flagstones laid in courses across the nave, each its own shade, worn pale down the middle; the joints fade
      // with distance before they get finer than the grain.
      const row = Math.floor(p[0] / 0.9);
      const shift = (((row % 2) + 2) % 2) * 0.625;
      const col = Math.floor((p[1] + shift) / 1.25);
      const joint = (1 - smooth(0.012, 0.03, Math.min(off(p[0], 0.9), off(p[1] + shift, 1.25)))) * smooth(45, 12, d);
      albedo = (0.42 + 0.12 * (M.hash(row, col, 3) - 0.5) + 0.1 * smooth(5, 0, Math.abs(p[1]))) * (1 - 0.55 * joint) + 0.06 * (M.fbm(p[0] * 0.6, p[1] * 0.6, { octaves: 3, seed: 9 }) - 0.5);
    } else if (kind === 1) {
      albedo = 0.6 + 0.08 * (M.fbm(p[0] * 0.5 + p[1] * 0.3, p[2] * 0.5, { octaves: 3, seed: 4 }) - 0.5);
    } else if (kind === 3) {
      albedo = 0.15;
    } else {
      // Stained glass, the same panes the sun comes through, held in iron saddle bars. Where the glass plane shows
      // past the edge of the opening it is the stone of the window's jamb.
      const east = Math.abs(n[0]) > 0.5;
      const high = !east && p[2] > TRIFORIUM[1] - 0.01 && Math.abs(p[1]) < AISLE;
      const open = east ? eastOpen(p[1], p[2]) : high ? clerestoryOpen(p[0], p[2]) : aisleOpen(p[0], p[2]);
      const along = east ? p[1] : p[0];
      const bar = Math.min(off(p[2], 0.8), off(along, 0.7));
      if (!open) kind = 1;
      else glow = (0.3 + 0.7 * (east ? pane(along, p[2], 3, 0.3) : high ? pane(along, p[2], 1) : pane(along, p[2], 2, 0.25))) * (bar < 0.03 ? 0.4 : 1);
    }
    // Light from the windows and the haze: brighter up in the clerestory, darkest in the aisles and low down.
    const aisle = smooth(OUTER, OUTER + 1.5, Math.abs(p[1]));
    // The ambient light comes from the windows above and the bright air of the nave, so every pier has a pale flank
    // toward the middle of the church and a dark one toward the aisle.
    const inward = Math.max(0, -n[1] * Math.sign(p[1] || 1));
    const ambient = (0.05 + 0.1 * smooth(2, 30, p[2])) * (1 - 0.5 * aisle) * (0.45 + 0.9 * inward + 0.3 * Math.max(0, n[2]));
    const surface = kind === 2 ? glow : albedo * ambient;
    fixed[i] = surface * t + AMBIENT_HAZE * (1 - t);
    const c = cells.count++;
    cells.i[c] = i;
    cells.kind[c] = kind;
    cells.albedo[c] = kind === 2 ? glow : albedo;
    cells.t[c] = t;
  }

  // The air is marched on a coarser grid; each of its cells takes the distance of the surface it ends on.
  const VR = 4;
  const vw = Math.ceil(G.w / VR);
  const vh = Math.ceil(G.h / VR);
  const rays = [];
  for (let j = 0; j < vh; j++) {
    for (let i = 0; i < vw; i++) {
      const x = Math.min(G.w - 1, i * VR + (VR >> 1));
      const y = Math.min(G.h - 1, j * VR + (VR >> 1));
      rays.push({ dir: M.ray(cam, G.res, x + 0.5, y + 0.5), d: Math.min(120, dist[y * G.w + x]), jitter: M.hash(i, j, 5) });
    }
  }

  // How each plate cell takes the coarse air: bilinearly from its four coarse neighbours, but only from those whose
  // rays end about as far away as its own, so the light behind a pier never bleeds onto the pier. Fixed, so once.
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
      const d = Math.min(120, dist[i]);
      const k = j0 * vw + i0;
      const ws = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty].map((w0, n) => (w0 + 1e-4) / (1 + 40 * Math.abs(Math.log(rays[k + (n & 1) + (n >> 1) * vw].d / d))));
      const sum = ws[0] + ws[1] + ws[2] + ws[3];
      base[i] = k;
      for (let n = 0; n < 4; n++) weight[i * 4 + n] = ws[n] / sum;
    }
  }

  // What casts inside the church, kept light for a live shadow map: each pier as one cylinder in the plan of its core
  // and colonnettes, its vaulting shaft, and the arcade wall above the springing with its arches cut out.
  const column = (x, y, z0, z1, r, nu) => I.patch({ at: (u, v) => { const a = u * I.TAU; const k = r(a); return [x + k * Math.cos(a), y + k * Math.sin(a), z0 + v * (z1 - z0)]; }, nu, nv: 1 });
  const casters = [
    ...piers.flatMap((_, k) => {
      const s = k < piers.length / 2 ? 1 : -1;
      const x = X0 + (k % (piers.length / 2)) * BAY;
      return [column(x, s * PIER, 0, 12.4, (a) => 1.05 + 0.42 * smooth(0.55, 1, Math.cos(4 * a)), 48), column(x, s * (PIER - 0.85), 12.4, VAULT, () => 0.27, 8)];
    }),
    ...[1, -1].map((s) => {
      const z = (v) => SPRING - 0.1 + v * (TRIFORIUM[1] - SPRING + 0.1);
      return I.patch({ at: (u, v) => [X0 + u * (X1 - X0), s * NAVE, z(v)], nu: 4 * (X1 - X0), nv: 20, mask: (u, v) => !(z(v) < TRIFORIUM[0] && underArch(inBay(X0 + u * (X1 - X0)), z(v), 2.6, SPRING)) });
    }),
  ];
  return {
    cam, G, cells, fixed, sigma: SIGMA, rays, spread: { base, weight, vw },
    tris: I.trianglesOf(casters),
    threshold: M.grain(G.w, G.h, { seed: 4, clump: 0.25, size: 2, soft: 0.4 }),
  };
};

/** The light the haze sends toward the eye along every coarse ray: sunlit air, thinned by the haze in front of it. */
const air = (S, L, shadow, samples) => {
  const { rays, sigma } = S;
  const out = new Float32Array(rays.length);
  const g = 0.35;
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
      const sun = shell(p[0], p[1], p[2], L);
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

/** The tone of every cell at a solar time, printed through the grain. A negative plate inks the light. */
export const inkAt = (S, hours, { size = 1024, samples = 48, negative = false, grain = "film", sun = 3.2, beams = 3.5, curve = 0.8 } = {}) => {
  const { light } = sunAt(hours);
  const L = I.unit(light);
  const shadow = I.shadowMap(null, L, { size, tris: S.tris, soft: 1.4 });
  const light_ = S.fixed.slice();
  const { i: at, kind, albedo, t, count } = S.cells;
  const { p: P, n: Nm } = S.G;
  const p = [0, 0, 0];
  const n = [0, 0, 0];
  for (let c = 0; c < count; c++) {
    const i = at[c];
    const k = i * 3;
    const l = Nm[k] * L[0] + Nm[k + 1] * L[1] + Nm[k + 2] * L[2];
    if (kind[c] === 2) {
      // A window with the sun behind it burns white; the others glow with the sky.
      light_[i] += albedo[c] * 0.5 * smooth(0, 0.25, -l) * t[c];
      continue;
    }
    if (l <= 0) continue;
    const through = shell(P[k], P[k + 1], P[k + 2], L);
    if (through <= 0) continue;
    p[0] = P[k]; p[1] = P[k + 1]; p[2] = P[k + 2];
    n[0] = Nm[k]; n[1] = Nm[k + 1]; n[2] = Nm[k + 2];
    light_[i] += sun * through * albedo[c] * l * shadow.lit(p, n) * t[c];
  }
  const lit = lay(S, air(S, L, shadow, samples));
  // Light to ink through a curve that opens the darks, read from a table.
  const curveOf = Float32Array.from({ length: 1025 }, (_, j) => Math.pow(j / 1024, curve));
  const tone = new Float32Array(light_.length);
  for (let i = 0; i < tone.length; i++) {
    // A soft shoulder, so the brightest haze keeps a little grain instead of burning out.
    const x = light_[i] + beams * lit[i];
    const v = curveOf[Math.round((x < 0.6 ? x : 1 - 0.4 * Math.exp((0.6 - x) / 0.4)) * 1024)];
    tone[i] = negative ? v : 1 - v;
  }
  return grain === "film" ? M.film(tone, S.threshold, { amount: 0.5 }) : M.print(tone, S.threshold);
};
