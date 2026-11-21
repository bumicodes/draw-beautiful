import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// Mont-Saint-Michel at high tide, seen from the bay to the south-west, printed as a mezzotint.
// World units are metres: x east, y north, z up, the water at z = 0 (a spring high tide), the origin under the
// summit. A granite island about 300 m across rises to 80 m; the abbey church stands on its crypts at the top, the
// crossing tower and the spire carry Saint Michael to 170 m. The Merveille's buttressed wall falls down the north
// side, the abbey lodgings down the south; the village climbs the gentler south-east slope inside its ramparts and
// round towers; woods hang on the steep north-west. The footbridge runs south on its piles over the flooded flats,
// Tombelaine lies 3 km north and the coast of Normandy beyond. The sun follows the bay's sky (48.6° N) in late April;
// mist lies on the water, so the ramparts' feet and their reflection go under while the abbey stands clear.

export const WIDTH = 720;
export const HEIGHT = 520;
export const RES = 2;

export const LATITUDE = 48.64;
export const DECLINATION = 13;

const EYE = [-640, -900, 3.5];
const TARGET = [10, 0, 62];
const RISE = 80;

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

/**
 * The rock's height at a point: a granite dome on the summit, its flanks falling steeply to the north and west
 * (cliffs) and gently to the south-east (where the village climbs), roughened by noise, running under the water.
 */
export const rockAt = (x, y) => {
  const bearing = Math.atan2(x, y);
  const gentle = 1 + 0.32 * Math.max(0, Math.cos(bearing - 140 * I.deg)) ** 2 - 0.12 * Math.max(0, Math.cos(bearing + 50 * I.deg)) ** 2;
  const r = Math.hypot(x, y - 8) / (112 * gentle);
  const dome = RISE * Math.exp(-(r ** 2.05));
  const rough = 7 * (M.fbm(x / 38 + 3, y / 38, { octaves: 4, seed: 4 }) - 0.5) * Math.min(1, dome / 20 + 0.3);
  return dome + rough - 6;
};

const solid = (at, inside, opts) => {
  const [p, n] = I.patch({ at, nu: 2, nv: 2 }).point(0.5, 0.5);
  return I.patch({ at, side: I.dot(n, I.sub(p, inside)) < 0 ? -1 : 1, ...opts });
};

/** A block turned `turn` radians about z, centred at (x, y), from z0 to z1. */
const block = (x, y, w, d, z0, z1, turn = 0) => {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const P = (a, b) => [x + a * c - b * s, y + a * s + b * c, z0];
  return I.prism({ outline: [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)], extrude: [0, 0, z1 - z0] });
};

/** A gabled roof over the same footprint: a triangular prism along its length from eave `z` rising `h`. */
const roof = (x, y, w, d, z, h, turn = 0, over = 0.4) => {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const P = (a, b, zz) => [x + a * c - b * s, y + a * s + b * c, zz];
  const L = w / 2 + over;
  const D = d / 2 + over;
  return I.prism({ outline: [P(-L, -D, z), P(-L, D, z), P(-L, 0, z + h)], extrude: [2 * L * c, 2 * L * s, 0] });
};

/** A round tower: a slightly battered drum with a parapet. */
const tower = (x, y, r, z0, z1) => I.lathe({ base: [x, y, z0], profile: [[0, r * 1.08, 1], [z1 - z0 - 2, r, 1], [z1 - z0 - 2, r * 1.1, 1], [z1 - z0, r * 1.1, 1], [z1 - z0, 0, 1]] });

/** The abbey on the summit: crypt massif, church, crossing tower, spire, the Merveille and the lodgings. */
const abbey = () => {
  const stone = [];
  const roofs = [];
  // The crypts and substructures carry the church floor at 80 m.
  stone.push(...block(-2, 11, 92, 30, 30, 80));
  stone.push(...block(-55, 10, 20, 24, 36, 79));
  // The church: nave (west), crossing, and the taller flamboyant choir with its apse (east).
  stone.push(...block(-22, 11, 40, 14, 80, 97));
  roofs.push(...roof(-22, 11, 40, 14, 97, 9));
  stone.push(...block(16, 11, 26, 17, 80, 101));
  roofs.push(...roof(16, 11, 26, 17, 101, 10));
  stone.push(I.lathe({ base: [29, 11, 80], profile: [[0, 8.5, 1], [21, 8.5, 1], [21, 9, 1], [26, 0, 1]] }));
  // Pinnacles round the choir: the flying buttresses' uprights.
  for (const [x, y] of [[8, 1], [16, 0.5], [24, 1], [32, 3], [36, 9], [8, 21], [16, 21.5], [24, 21], [32, 19]]) stone.push(I.lathe({ base: [x, y, 80], profile: [[0, 1.1, 1], [24, 0.9, 1], [24, 0, 1]] }));
  // The crossing tower and the spire with the archangel.
  stone.push(...block(-0.5, 11, 12, 12, 80, 124));
  const spire = I.lathe({ base: [-0.5, 11, 124], profile: [[0, 5.2, 1], [3, 5.2, 1], [3, 4.4, 1], [38, 0.7], [41, 0.5, 1], [41, 0, 1]] });
  const angel = I.lathe({ base: [-0.5, 11, 165], profile: [[0, 0.45, 1], [2.6, 0.6], [3.8, 0.4], [4.4, 0.3], [5, 0, 1]] });
  // The Merveille: three storeys of Gothic wall on the north flank, buttressed, roofed at the cloister.
  stone.push(...block(26, 34, 62, 15, 14, 86));
  roofs.push(...roof(26, 34, 62, 15, 86, 7));
  for (const x of range(9).map((i) => -3 + i * 7.3)) stone.push(...block(x, 42.2, 2.2, 2.4, 14, 82));
  // The abbatial lodgings and the west buildings down the south side.
  stone.push(...block(16, -12, 50, 13, 30, 90));
  roofs.push(...roof(16, -12, 50, 13, 90, 6));
  stone.push(...block(-34, -10, 30, 14, 24, 76));
  roofs.push(...roof(-34, -10, 30, 14, 76, 5));
  stone.push(...block(-48, -26, 14, 10, 14, 56));
  return { stone, roofs, spire, angel };
};

/** The village: houses stepped up the south-east slope along the Grande Rue, each standing on the rock. */
const village = () => {
  const walls = [];
  const roofs = [];
  for (let i = 0; i < 64; i++) {
    const t = i / 63;
    const bearing = (75 + 140 * t + 18 * (M.hash(i, 1) - 0.5)) * I.deg;
    const rho = 150 - 70 * t + 30 * (M.hash(i, 2) - 0.5);
    const x = rho * Math.sin(bearing);
    const y = 8 + rho * Math.cos(bearing);
    const ground = rockAt(x, y);
    if (ground < 3 || ground > 52) continue;
    const w = 7 + 5 * M.hash(i, 3);
    const d = 6 + 3 * M.hash(i, 4);
    const h = 8 + 6 * M.hash(i, 5);
    const turn = -bearing + Math.PI / 2 + 0.3 * (M.hash(i, 6) - 0.5);
    walls.push(...block(x, y, w, d, ground - 6, ground + h, turn));
    roofs.push(...roof(x, y, w, d, ground + h, 3.5 + 2 * M.hash(i, 7), turn));
  }
  return { walls, roofs };
};

/** The ramparts round the south and east foot, with their round towers, and the King's Gate by the bridge. */
const ramparts = () => {
  const out = [];
  const towers = [];
  const path = range(15).map((i) => {
    const bearing = (40 + (i / 14) * 200) * I.deg;
    let rho = 150;
    // Walk out from the summit until the rock meets the tide, then stand the wall just inside the shore.
    for (; rho < 260 && rockAt(rho * Math.sin(bearing), 8 + rho * Math.cos(bearing)) > 1.5; rho += 2);
    return [(rho - 4) * Math.sin(bearing), 8 + (rho - 4) * Math.cos(bearing)];
  });
  for (let i = 0; i < path.length - 1; i++) {
    const [a, b] = [path[i], path[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    out.push(...block((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, len + 1, 3.2, -2, 13, Math.atan2(b[1] - a[1], b[0] - a[0])));
  }
  path.forEach(([x, y], i) => i % 2 === 0 && towers.push(tower(x, y, 5.5 + 1.5 * M.hash(i, 9), -2, 17 + 3 * M.hash(i, 8))));
  return { walls: out, towers, foot: path[Math.floor(path.length * 0.62)] };
};

/** Trees on the steep north-west: clumps of crowns clinging to the slope. */
const woods = () =>
  range(180).flatMap((i) => {
    const bearing = (250 + 120 * M.hash(i, 11)) * I.deg;
    const rho = 80 + 90 * M.hash(i, 12);
    const x = rho * Math.sin(bearing);
    const y = 8 + rho * Math.cos(bearing);
    const g = rockAt(x, y);
    if (g < 2 || g > 50) return [];
    const r = 2.2 + 2 * M.hash(i, 13);
    return [I.sphere({ center: [x, y, g + r * 0.7], radius: r })];
  });

/** The footbridge: a deck on piles running south from the King's Gate over the flooded flats. */
const bridge = ([fx, fy]) => {
  const end = [fx - 60, -760];
  const len = Math.hypot(end[0] - fx, end[1] - fy);
  const turn = Math.atan2(end[1] - fy, end[0] - fx);
  const deck = block((fx + end[0]) / 2, (fy + end[1]) / 2, len, 6, 5.6, 6.6, turn);
  const piles = range(Math.floor(len / 14)).map((i) => {
    const t = (i + 0.5) / Math.floor(len / 14);
    return I.lathe({ base: [fx + (end[0] - fx) * t, fy + (end[1] - fy) * t, -2], profile: [[0, 0.45, 1], [7.6, 0.45, 1], [7.6, 0, 1]] });
  });
  return { deck, piles };
};

export const scene = ({ res = RES } = {}) => {
  const cam = I.perspective({ eye: EYE, target: TARGET, scale: 1.62, offset: [WIDTH * 0.5, HEIGHT * 0.5], width: WIDTH, height: HEIGHT });
  const fog = M.heightFog({ eye: EYE, density: 0.0045, height: 7, haze: 0.00007, start: 300 });

  // The rock: polar rows out from the summit, so the mesh is finest where the shape changes most.
  const rock = I.patch({
    at: (u, v) => {
      const th = u * I.TAU;
      const rho = 260 * v ** 1.3;
      const x = rho * Math.sin(th);
      const y = 8 + rho * Math.cos(th);
      return [x, y, Math.max(-8, rockAt(x, y))];
    },
    nu: 96,
    nv: 40,
  });
  const A = abbey();
  const V = village();
  const R = ramparts();
  const trees = woods();
  const B = bridge(R.foot);

  // Tombelaine and the coast, for the haze to grade.
  const isle = I.patch({
    at: (u, v) => {
      const th = u * I.TAU;
      const rho = 140 * v;
      const x = 900 + rho * Math.sin(th) * 1.3;
      const y = 2900 + rho * Math.cos(th);
      return [x, y, 45 * Math.exp(-((v / 0.55) ** 2)) * (0.85 + 0.3 * M.fbm(x / 60, y / 60, { seed: 2 })) - 3];
    },
    nu: 48,
    nv: 12,
  });
  const fwd = I.unit([-cam.view[0], -cam.view[1], 0]);
  const side = I.unit([cam.right[0], cam.right[1], 0]);
  const ridge = (d, h, seed) =>
    solid(
      (u, v) => {
        const s = (u - 0.5) * 22000;
        const top = h * (0.3 + 0.7 * M.fbm(s / 1600 + seed, seed, { octaves: 4, seed }));
        const back = d + v * top * 8;
        return [EYE[0] + fwd[0] * back + side[0] * s, EYE[1] + fwd[1] * back + side[1] * s, v * top - 1];
      },
      I.add(EYE, I.mul(fwd, d * 3)),
      { nu: 128, nv: 4 },
    );
  const coast = [ridge(6500, 40, 3), ridge(11000, 90, 7)];

  // The water, laid out in front of the eye, rows spaced in distance so they fall evenly on screen.
  const near = 30;
  const far = 30000;
  const water = I.patch({
    at: (u, v) => {
      const d = near * Math.pow(far / near, v);
      const s = (u - 0.5) * 2.4 * d;
      return [EYE[0] + fwd[0] * d + side[0] * s, EYE[1] + fwd[1] * d + side[1] * s, 0];
    },
    nu: 4,
    nv: 4,
  });

  const groups = [
    [[rock, isle], { base: 0.6, grit: 0.22 }],
    [[...A.stone, ...R.walls, ...R.towers, ...B.deck], { base: 0.2, grit: 0.08 }],
    [[...A.roofs, A.spire, ...V.roofs], { base: 0.74, grit: 0.05 }],
    [[A.angel], { base: 0.15, grit: 0 }],
    [V.walls, { base: 0.3, grit: 0.08 }],
    [trees, { base: 0.8, grit: 0.25 }],
    [B.piles, { base: 0.7, grit: 0 }],
    [coast, { base: 0.5, grit: 0.05 }],
  ];
  const matOf = new Map(groups.flatMap(([list, m]) => list.map((s) => [s, m])));
  const solids = [water, ...groups.flatMap(([list]) => list)];
  const mesh = (s) => (s === water ? [4, 8] : s.normal ? [1, 1] : s === rock ? [360, 140] : s === isle ? [64, 16] : coast.includes(s) ? [256, 4] : trees.includes(s) ? [16, 8] : [24, 12]);
  const D = M.gbuffer(solids, cam, { res, mesh });
  const reflectable = solids.slice(1);
  const images = reflectable.map((s) => M.mirrored(s));
  const Rf = M.gbuffer(images, cam, { res, mesh: (m) => mesh(reflectable[images.indexOf(m)]) });

  const W = D.w;
  const H = D.h;
  const horizon = cam.project(I.add(EYE, I.mul(fwd, 1e6)))[1] * res;
  const bank = (p) => 0.3 + 1.4 * M.fbm(p[0] / 420 + 4, p[1] / 160, { octaves: 3, seed: 31 });
  const pt = (buf, i) => [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]];
  const gritAt = (p, m) => (m.grit ? m.grit * (M.fbm(p[0] * 0.45 + p[2] * 0.3, p[1] * 0.45 - p[2] * 0.4, { octaves: 3, seed: 11 }) - 0.5) : 0);
  const cells = new Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = M.ray(cam, res, x + 0.5, y + 0.5);
      const h = I.unit([d[0], d[1], 0]);
      const low = 1 - I.smoothstep(0, 0.45, Math.abs(d[2]));
      const k = D.id[i];
      if (k < 0) {
        cells[i] = { kind: 0, d, h, low, t: I.smoothstep(-0.002, 0.04, d[2]) };
        continue;
      }
      const p = pt(D.p, i);
      const t = fog.through(p, bank(p));
      if (solids[k] !== water) {
        const mat = matOf.get(solids[k]);
        cells[i] = { kind: 1, h, t, p, n: pt(D.n, i), mat, grit: gritAt(p, mat) };
        continue;
      }
      const near01 = Math.max(0, (y - horizon) / (H - horizon));
      const amp = res * (0.5 + 5 * near01 * near01);
      const dy = Math.round(amp * 2 * (M.fbm(x / (40 * res), y / (1.3 * res), { octaves: 2, seed: 5 }) - 0.5));
      const dx = Math.round(amp * 0.6 * (M.noise(x / (9 * res), y / (2 * res), 9) - 0.5));
      const j = Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx));
      const cos = Math.max(0, -d[2]);
      const F = 0.02 + 0.98 * Math.pow(1 - cos, 5);
      const rd = [d[0], d[1], -d[2]];
      const fx = Math.floor(x / (4 * res) + 0.5 * (Math.floor(y / res) % 2));
      const fy = Math.floor(y / res);
      const tip = [0.03 * (M.hash(fx, fy, 41) - 0.5), 0, 0.3 * (M.hash(fx, fy, 43) - 0.5) * (0.35 + near01)];
      const cell = { kind: 2, h, low, t, F, rd, glint: I.unit(I.add(rd, tip)) };
      if (Rf.id[j] >= 0) {
        const m = pt(Rf.p, j);
        const q = [m[0], m[1], -m[2]];
        const nm = pt(Rf.n, j);
        const mat = matOf.get(reflectable[Rf.id[j]]);
        cell.q = { p: q, n: [nm[0], nm[1], -nm[2]], mat, grit: gritAt(q, mat), t: fog.between(p, q, bank(p)) };
      } else cell.ts = I.smoothstep(-0.002, 0.04, rd[2]);
      cells[i] = cell;
    }
  }
  const wet = new Float32Array(W * H);
  cells.forEach((c, i) => (wet[i] = c.kind === 2 ? 1 : 0));
  // Shadows only from what is near enough to cast on the Mont: the rock and everything built on it.
  // Trees cast through coarse stand-ins: a full sphere is 5,000 triangles, an octahedron of the crown is enough for a shadow.
  const crowns = trees.map((t) => {
    const [c] = t.point(0.5, 0.5);
    const [top] = t.point(0, 1);
    const r = Math.hypot(...I.sub(top, c));
    return { triangles: () => I.trianglesOf([I.patch({ at: (u, v) => I.add(c, I.mul(I.direction(u * 360, (v - 0.5) * 180), r)), nu: 4, nv: 2 })]) };
  });
  const casters = [rock, ...A.stone.filter((s) => s.normal), A.spire, ...A.roofs, ...V.walls, ...V.roofs, ...R.walls, ...crowns];
  return { cam, W, H, res, cells, wet, tris: I.trianglesOf(casters), grains: new Map() };
};

/**
 * A shadow map from the sun, like the kit's but looked up with scalars: it runs for every lit cell of the plate and of
 * its reflection, every frame, so it must not allocate. Depth is along the light; `lit` is 0 in shadow, 1 in sun.
 */
const sunShadow = (tris, L, { size = 768, soft = 1.5 } = {}) => {
  const f = I.unit(L);
  const r = I.unit(Math.abs(f[2]) > 0.99 ? [1, 0, 0] : I.cross([0, 0, 1], f));
  const u = I.cross(f, r);
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const tri of tris) for (const p of tri) {
    const x = I.dot(p, r);
    const y = I.dot(p, u);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const k = (size - 4) / Math.max(x1 - x0, y1 - y0);
  const buf = new Float32Array(size * size).fill(-Infinity);
  for (const tri of tris) {
    const [a, b, c] = tri.map((p) => [(I.dot(p, r) - x0) * k + 2, (y1 - I.dot(p, u)) * k + 2, I.dot(p, f)]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-9) continue;
    const xa = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const xb = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const ya = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const yb = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0])) / area;
        const w1 = ((a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0])) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
        const d = w0 * a[2] + w1 * b[2] + w2 * c[2];
        if (d > buf[y * size + x]) buf[y * size + x] = d;
      }
    }
  }
  const lift = 1.5 / k;
  const lit = (p, n) => {
    const qx = p[0] + n[0] * lift;
    const qy = p[1] + n[1] * lift;
    const qz = p[2] + n[2] * lift;
    const x = (qx * r[0] + qy * r[1] + qz * r[2] - x0) * k + 2;
    const y = (y1 - (qx * u[0] + qy * u[1] + qz * u[2])) * k + 2;
    const d = qx * f[0] + qy * f[1] + qz * f[2] + 2 / k;
    let sum = 0;
    for (let dj = -0.5; dj <= 0.5; dj++) {
      const j = Math.floor(y + dj * soft);
      for (let di = -0.5; di <= 0.5; di++) {
        const i = Math.floor(x + di * soft);
        if (i < 0 || j < 0 || i >= size || j >= size || d >= buf[j * size + i]) sum++;
      }
    }
    return sum / 4;
  };
  return { lit };
};

/** Light, sky and mist at a solar time: the glow and the mist depend only on a ray's angle to the sun, tabulated. */
const GLOW = 4096;
const MIST = 1024;
const dayAt = (hours) => {
  const sun = sunAt(hours);
  const L = sun.light;
  const day = I.smoothstep(-7, 6, sun.altitude);
  const direct = I.smoothstep(-0.4, 3, sun.altitude);
  // Low sun warms the haze round it; high sun leaves a pale even sky.
  const low = 1 - I.smoothstep(8, 40, sun.altitude);
  const glow = new Float32Array(GLOW + 1);
  for (let k = 0; k <= GLOW; k++) {
    const a = 2 * Math.asin(k / GLOW);
    const g = (0.25 + 0.75 * day) * ((0.3 + 0.4 * low) * Math.exp(-((a / 0.6) ** 2)) + 0.3 * Math.exp(-((a / 0.13) ** 2)));
    glow[k] = 0.32 * g + direct * I.smoothstep(0.012, 0.008, a);
  }
  // Darker overhead, paling to the horizon, so the Mont's pale stone and dark roofs both have something to stand on.
  const sky = (d) => {
    const c = d[0] * L[0] + d[1] * L[1] + d[2] * L[2];
    const up = 0.1 + (0.62 + 0.1 * (1 - day)) * I.smoothstep(-0.01, 0.2, d[2]);
    return Math.max(0, up - glow[Math.round(Math.sqrt(Math.max(0, (1 - c) / 2)) * GLOW)]);
  };
  const flat = I.unit([L[0], L[1], 0]);
  const haze = new Float32Array(MIST + 1);
  for (let k = 0; k <= MIST; k++) haze[k] = Math.max(0.03, 0.42 - 0.3 * day - 0.12 * low * day * Math.exp(-(2 - (2 * k) / MIST) / 0.12));
  const mist = (h) => haze[Math.round(((h[0] * flat[0] + h[1] * flat[1] + 1) / 2) * MIST)];
  return { L, day, direct, sky, mist };
};

/** `streak` smears the reflection down the swell (viewBox px), `bloom` glows the bright light, `soft` rounds the grain. */
export const OPTICS = { streak: 4, bloom: 0.5, soft: 0.3 };

/** The tone of every cell at a solar time, through the optics, printed as film grain. A negative plate inks the light. */
export const inkAt = (S, hours, { size = 1024, negative = false, optics = OPTICS } = {}) => {
  const { L, day, direct, sky, mist } = dayAt(hours);
  const shadow = direct > 0 ? sunShadow(S.tris, L, { size, soft: 1.5 * (size / 1024) }) : null;
  const amb = 0.06 + 0.2 * day;
  const [Lx, Ly, Lz] = L;
  const shade = (p, n, mat, grit) => {
    const l = n[0] * Lx + n[1] * Ly + n[2] * Lz;
    const lit = l > 0 && direct > 0 ? l * direct * shadow.lit(p, n) : 0;
    const level = amb + 0.1 * day * Math.max(0, n[2]) + (1 - amb) * 1.25 * lit;
    return Math.min(1, Math.max(0, 1 - Math.min(1, level) * (1 - mat.base) + grit));
  };
  const tone = new Float32Array(S.W * S.H);
  const glints = new Float32Array(S.W * S.H);
  for (let i = 0; i < tone.length; i++) {
    const c = S.cells[i];
    const fogInk = mist(c.h);
    if (c.kind === 0) tone[i] = sky(c.d, c.low) * c.t + fogInk * (1 - c.t);
    else if (c.kind === 1) tone[i] = c.t < 0.01 ? fogInk : shade(c.p, c.n, c.mat, c.grit) * c.t + fogInk * (1 - c.t);
    else {
      const r = c.q ? (c.q.t < 0.01 ? fogInk : shade(c.q.p, c.q.n, c.q.mat, c.q.grit) * c.q.t + fogInk * (1 - c.q.t)) : sky(c.rd, c.low) * c.ts + fogInk * (1 - c.ts);
      const off = 1 - (c.glint[0] * L[0] + c.glint[1] * L[1] + c.glint[2] * L[2]);
      glints[i] = direct && off < 0.001 ? 1.2 * direct * Math.exp(-off / 0.00008) * c.t : 0;
      tone[i] = (c.F * r + (1 - c.F) * 0.78) * c.t + fogInk * (1 - c.t);
    }
  }
  const { W, H, res } = S;
  let out = tone;
  if (optics.streak) out = M.soften(out, W, H, S.wet, 0, optics.streak * res);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, out[i] - glints[i]);
  if (optics.bloom) out = M.bloom(out, W, H, { threshold: 0.82, r: 8 * res, strength: optics.bloom });
  if (negative) for (let i = 0; i < out.length; i++) out[i] = 1 - out[i];
  const key = optics.soft ?? 0;
  if (!S.grains.has(key)) S.grains.set(key, M.grain(W, H, { seed: 8, clump: 0.25, size: 2, soft: key }));
  return M.film(out, S.grains.get(key), { amount: 0.45 });
};
