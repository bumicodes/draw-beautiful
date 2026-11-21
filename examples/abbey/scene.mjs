import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// The west front of a ruined Cistercian abbey in the Wye valley, after Tintern, printed as a mezzotint.
// World units are metres: x east, y north, z up. The west wall stands in the plane x = 0 to 1.5, 25 m across: a great
// pointed window of equilateral arches, open to the sky since the tracery fell, over a pointed west door, between two
// stepped buttresses, the gable broken off in ragged courses. The aisle walls run east behind it into the fog. The eye
// stands on a grassy bank to the south-west. The sun follows Tintern's midsummer sky (51.7° N): all morning it is
// behind the wall, so the west face is in shade, the wall's shadow lies across the meadow toward the eye and the
// window's light, a pointed arch of sun, walks across the grass inside it. The fog is lit the same way, so the shadow
// of the wall and the beam through the window both stand in the mist.

export const WIDTH = 700;
export const HEIGHT = 640;
export const RES = 2;

export const LATITUDE = 51.7;
export const DECLINATION = 23.4;

const T = 1.5;
const YW = 12.5;
const COURSE = 0.42;
const WINDOW = { a: 3.8, zb: 9.2, zs: 16.5, splay: [[0, 0.9], [0.16, 0.62], [0.3, 0.62], [0.44, 0.34], [0.58, 0.34], [0.72, 0.12], [1, 0.12]] };
const DOOR = { a: 1.7, zb: 0, zs: 3.4, splay: [[0, 0.55], [0.2, 0.32], [0.4, 0.32], [0.6, 0.1], [1, 0.1]] };
const BUTTRESS = 7.6;
const EYE = [-58, 1, 13];
const TARGET = [0, -3, 13];
const DENSITY = 0.12;
const HEIGHTF = 2.8;
const HAZE = 0.0022;
const START = 8;

/** The meadow: flat round the abbey, gently humped beyond. */
const ground = (x, y) => {
  const off = Math.hypot(Math.max(0, x - 80), Math.max(0, Math.abs(y) - 16), Math.max(0, -x - 6));
  return 0.8 * I.smoothstep(0, 14, off) * (M.fbm(x / 30, y / 30, { octaves: 3, seed: 5 }) - 0.4);
};

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

// The openings. Each is a pointed arch of two arcs struck from the opposite springing points (an equilateral arch,
// radius = span) on straight jambs, offset outward by d for the splayed orders of its reveal.

const splayAt = (o, v) => {
  const s = o.splay;
  for (let k = 1; k < s.length; k++) if (v <= s[k][0]) return s[k - 1][1] + ((s[k][1] - s[k - 1][1]) * (v - s[k - 1][0])) / (s[k][0] - s[k - 1][0]);
  return s[s.length - 1][1];
};

const inside = (o, y, z, d) =>
  z > o.zb - d && Math.abs(y) < o.a + d && (z <= o.zs || (Math.hypot(y - o.a, z - o.zs) < 2 * o.a + d && Math.hypot(y + o.a, z - o.zs) < 2 * o.a + d));

/** The opening's outline offset by d, at u ∈ [0, 1]: up the left jamb, over both arcs, down the right jamb, across the sill. */
const outline = (o, u, d) => {
  const { a, zb, zs } = o;
  const R = 2 * a + d;
  const crown = Math.acos(-a / R);
  if (u < 0.2) return [-a - d, zb - d + (zs - zb + d) * (u / 0.2)];
  if (u < 0.4) {
    const th = Math.PI + (crown - Math.PI) * ((u - 0.2) / 0.2);
    return [a + R * Math.cos(th), zs + R * Math.sin(th)];
  }
  if (u < 0.6) {
    const th = Math.PI - crown - (Math.PI - crown) * ((u - 0.4) / 0.2);
    return [-a + R * Math.cos(th), zs + R * Math.sin(th)];
  }
  if (u < 0.8) return [a + d, zs - (zs - zb + d) * ((u - 0.6) / 0.2)];
  return [a + d - 2 * (a + d) * ((u - 0.8) / 0.2), zb - d];
};

/** The reveal: the outline swept through the wall's thickness, stepping in at each order. */
const reveal = (o, nu) => I.patch({ at: (u, v) => { const [y, z] = outline(o, u, splayAt(o, v)); return [v * T, y, z]; }, nu, nv: 14 });

/** The hood mould over the window: a half-round drip following the arch a little outside the reveal, with short returns. */
const hood = (o, d = 1.2, r = 0.22) =>
  I.patch({
    at: (u, v) => {
      // u from 0.14 to 0.66 of the outline: the top of the left jamb, both arcs, the top of the right jamb.
      const s = 0.14 + 0.52 * u;
      const [y, z] = outline(o, s, d);
      const [y1, z1] = outline(o, Math.min(0.999, s + 0.002), d);
      const [y0, z0] = outline(o, Math.max(0, s - 0.002), d);
      const t = I.unit([0, y1 - y0, z1 - z0]);
      const m = [0, t[2], -t[1]];
      const out = I.dot(m, [0, y, z - o.zs]) > 0 ? m : I.mul(m, -1);
      const th = v * Math.PI;
      return I.add([0, y, z], I.add(I.mul(out, r * Math.cos(th)), [-r * Math.sin(th), 0, 0]));
    },
    side: -1,
    nu: 160,
    nv: 8,
  });

// The broken gable: the line of the roof, lower over the aisles, with the courses fallen away block by block. It is
// kept a course or three above the window's arch, which still stands.

const gable = (y) => {
  const ay = Math.abs(y);
  return ay < BUTTRESS + 0.75 ? 27.8 - 1.2 * ay : 13.2 - 0.32 * (ay - BUTTRESS - 0.75);
};

const archTop = (o, y, d) => {
  const ay = Math.abs(y);
  if (ay >= o.a + d) return -Infinity;
  return o.zs + Math.sqrt(Math.max(0, (2 * o.a + d) ** 2 - (ay + o.a) ** 2));
};

const rawTop = (y) => {
  // Blocks of uneven width, each missing a random depth of courses below a slow line of loss, and each one height
  // across, so no block is split into slivers.
  const cut = y + 40 + 0.5 * M.noise(y * 0.8, 3, 6);
  const block = Math.floor(cut / 0.55);
  const yb = (block + 0.5) * 0.55 - 40;
  let z = gable(yb) - 2.6 * M.fbm(yb / 4.2 + 3, 1.7, { octaves: 3, seed: 2 }) - 1.5 * M.noise(yb / 0.9, 5, 8) - 2.2 * M.hash(block, 0, 9) ** 1.6;
  if (yb > 9.4) z -= 2.6 + 1.5 * M.noise(yb * 0.9, 2, 4);
  // Over the window the arch still stands: no block falls below a course or so above its extrados.
  const edge = Math.min(Math.abs(y), Math.abs(yb));
  z = Math.max(z, archTop(WINDOW, edge, 1.4) + 0.7 + 1.8 * M.hash(block, 1, 9) ** 2);
  return Math.floor(z / COURSE) * COURSE;
};

// The courses step at block edges, so the top is tabulated: exact to a centimetre, and cheap where it is used most.
const TOP = Float32Array.from(range(2601), (k) => rawTop(-13 + k * 0.01));
const top = (y) => TOP[Math.max(0, Math.min(2600, Math.round((y + 13) * 100)))];
const ZMAX = 29;

/** Is the point (y, z) in the plane of the wall solid stone, judged at the middle of its thickness? */
const solid = (y, z) => Math.abs(y) < YW && z > 0 && z < top(y) && !inside(WINDOW, y, z, 0.34) && !inside(DOOR, y, z, 0.2);

/** One face of the west wall, x = at, its openings cut at the splay of that face. */
const wallFace = (x, side, v) =>
  I.patch({
    at: (u, w) => [x, -YW + 2 * YW * u, ZMAX * w],
    side,
    mask: (u, w) => {
      const y = -YW + 2 * YW * u;
      const z = ZMAX * w;
      return z < top(y) && !inside(WINDOW, y, z, splayAt(WINDOW, v)) && !inside(DOOR, y, z, splayAt(DOOR, v));
    },
    nu: 220,
    nv: 240,
  });

/** An upright wall face from a to b (plan points) rising from z0, cut off along a broken top `crest(u)`. */
const broken = (a, b, z0, crest, outward, nu = 24) => {
  const along = I.sub(b, a);
  const side = I.dot(I.cross(along, [0, 0, 1]), outward) > 0 ? 1 : -1;
  const z1 = 30;
  return I.patch({ at: (u, v) => I.add(I.add(a, I.mul(along, u)), [0, 0, z0 + (z1 - z0) * v]), side, mask: (u, v) => z0 + (z1 - z0) * v < crest(u), nu, nv: 60 });
};

/**
 * A stepped buttress against the west face: two whole stages, each set back with a sloping weathering, and a third
 * whose top has fallen away in ragged courses.
 */
const buttress = (yc, k) => {
  const w = 0.78;
  const stages = [[0, 8.2, 2.7], [8.2, 15.4, 1.95]];
  const out = [];
  stages.forEach(([z0, z1, d], i) => {
    out.push(...I.box({ min: [-d, yc - w, z0], max: [0, yc + w, z1] }));
    const next = i + 1 < stages.length ? stages[i + 1][2] : 1.2;
    const rise = (d - next) * 0.85;
    out.push(...I.prism({ outline: [[-d, yc - w, z1], [-next, yc - w, z1], [-next, yc - w, z1 + rise]], extrude: [0, 2 * w, 0] }));
  });
  // The top stage, its crest walked round the three outer faces so the courses break continuously at the corners.
  const d = 1.2;
  const crest = (h) => {
    const b = Math.floor(h / 0.45);
    const z = 18.6 + 1.1 * k - 1.4 * M.noise((b * 0.45) / 0.8, k, 41) - 1.2 * M.hash(b, k, 43) ** 1.5;
    return Math.floor(z / COURSE) * COURSE;
  };
  const p = [[0, yc - w, 0], [-d, yc - w, 0], [-d, yc + w, 0], [0, yc + w, 0]];
  const run = [0, d, d + 2 * w, 2 * d + 2 * w];
  for (let i = 0; i < 3; i++) {
    const mid = I.mul(I.add(p[i], p[i + 1]), 0.5);
    out.push(broken(I.add(p[i], [0, 0, 0]), p[i + 1], 15.4, (u) => crest(run[i] + (run[i + 1] - run[i]) * u), I.sub(mid, [-d / 2, yc, 0])));
  }
  return out;
};

/** An aisle wall running east from the west front into the fog, its top broken into ragged steps. */
const aisleWall = (y0, y1, seed) => {
  const len = 78;
  const h = (x) => {
    const block = Math.floor(x / 1.1);
    const z = 9.5 * Math.pow(1 - x / len, 0.7) * (0.45 + 0.55 * M.fbm(x / 9, seed, { octaves: 3, seed })) + 1.2 * M.hash(block, seed, 3);
    return Math.max(0.6, Math.floor(z / COURSE) * COURSE);
  };
  const wall = (y, side) => I.patch({ at: (u, v) => [T + len * u, y, 12 * v], side, mask: (u, v) => 12 * v < h(len * u), nu: 240, nv: 48 });
  return [wall(y0, 1), wall(y1, -1)];
};

/** A fallen block half sunk in the turf: a squashed, lumpy sphere. */
const rock = ([x, y], r, seed) =>
  I.patch({
    at: (u, v) => {
      const lon = u * I.TAU;
      const lat = (v - 0.5) * Math.PI;
      const k = r * (0.8 + 0.4 * M.noise(Math.cos(lon) * 1.6 + 3, Math.sin(lon) * 1.6 + lat * 1.2, seed));
      return [x + k * Math.cos(lat) * Math.cos(lon) * 1.2, y + k * Math.cos(lat) * Math.sin(lon), -0.3 * r + 0.7 * k * Math.sin(lat)];
    },
    nu: 24,
    nv: 12,
  });

export const scene = ({ res = RES } = {}) => {
  const cam = I.perspective({ eye: EYE, target: TARGET, scale: 11.8, offset: [WIDTH * 0.5, HEIGHT * 0.3], width: WIDTH, height: HEIGHT });
  const fog = M.heightFog({ eye: EYE, density: DENSITY, height: HEIGHTF, haze: HAZE, start: START });
  const fwd = I.unit([-cam.view[0], -cam.view[1], 0]);
  const side = I.unit([cam.right[0], cam.right[1], 0]);

  const front = wallFace(0, -1, 0);
  const back = wallFace(T, 1, 1);
  const ends = [-YW, YW].map((y) => I.face({ points: [[0, y, 0], [T, y, 0], [T, y, top(y * 0.999)], [0, y, top(y * 0.999)]], along: [1, 0, 0], outward: [0, y, 0] }));
  const reveals = [reveal(WINDOW, 200), reveal(DOOR, 100)];
  const mould = hood(WINDOW);
  const buttresses = [-BUTTRESS, BUTTRESS].flatMap((y, k) => buttress(y, k));
  const aisles = [...aisleWall(-YW, -YW + 1.2, 3), ...aisleWall(YW - 1.2, YW, 7)];
  const west = [front, back, ...ends, ...reveals, mould, ...buttresses];
  const stones = [[[-5.5, -4.6], 0.9, 1], [[-4, -9.6], 0.6, 2], [[-9, 5], 1.1, 3], [[-14, -11], 0.7, 4], [[-7.5, 10.5], 0.8, 5], [[-21, 1.5], 0.5, 6], [[-3, -15.5], 0.7, 7]];
  const rocks = stones.map(([p, r, s]) => rock(p, r, s));

  const near = 3;
  const far = 2500;
  const turf = I.patch({
    at: (u, v) => {
      const d = near * Math.pow(far / near, v);
      const s = (u - 0.5) * 2.4 * d;
      const x = EYE[0] + fwd[0] * d + side[0] * s;
      const y = EYE[1] + fwd[1] * d + side[1] * s;
      return [x, y, ground(x, y)];
    },
    nu: 96,
    nv: 220,
  });

  // Long grass: rows of blades, each row a sheet standing on the turf from a to b with the blades cut out of it
  // (three overlapping sets, leaning, tapering, gathered in clumps), and here and there a seeding stem standing above.
  const tuft = (a, b, height, seed, pitch = 0.07) => {
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]) / pitch;
    // A clump rises to the middle and thins out to its ends, so no row of grass shows a straight foot.
    const mask = (u, v) => {
      const env = Math.pow(Math.sin(Math.PI * u), 0.6);
      for (let k = 0; k < 3; k++) {
        const s = u * n + k * 0.37;
        const i = Math.floor(s);
        const clump = M.noise(s / 16, k * 3.1, seed);
        if (M.hash(i, k, seed + 3) > 0.15 + 0.95 * clump) continue;
        const stem = M.hash(i, k, seed + 5) < 0.025;
        const h = env * (stem ? 0.75 + 0.25 * M.hash(i, k, seed) : (0.18 + 0.4 * M.hash(i, k, seed)) * (0.45 + 0.75 * clump));
        if (v > h) continue;
        const lean = (M.hash(i, k, seed + 1) - 0.5) * (stem ? 0.5 : 2.2);
        const f = s - i - lean * v * v;
        const half = stem ? (v > h - 0.12 ? 0.38 * Math.sin((Math.PI * (h - v)) / 0.12) : 0.07) : (0.08 + 0.18 * M.hash(i, k, seed + 2)) * Math.pow(1 - v / h, 0.7);
        if (Math.abs(f - 0.5) < half) return true;
      }
      return false;
    };
    return I.patch({
      at: (u, v) => {
        const x = a[0] + (b[0] - a[0]) * u;
        const y = a[1] + (b[1] - a[1]) * u;
        return [x, y, ground(x, y) - 0.05 + height * v];
      },
      mask,
      nu: Math.ceil(n / 40),
      nv: 1,
    });
  };
  const grass = [
    ...[-0.4, -1.1, -2, -3.2, -4.8, -7, -10].map((x, k) => tuft([x, -24 - k], [x, 22], 1.1 - 0.04 * k, k + 1)),
    ...[-13.9, -14.8, -16.2, -18].map((y, k) => tuft([-2 - 2 * k, y], [60, y], 1.0, k + 11)),
    // Long grass along the foot of the plate, close enough to stand dark against the meadow.
    ...range(34).map((k) => {
      const d = 19.5 + 3.5 * M.hash(k, 1, 61);
      const s = (k / 33 - 0.5) * 1.3 * d + 1.2 * (M.hash(k, 2, 61) - 0.5);
      const c = [EYE[0] + fwd[0] * d + side[0] * s, EYE[1] + fwd[1] * d + side[1] * s];
      const w = 0.5 + 0.9 * M.hash(k, 3, 61);
      return tuft([c[0] - side[0] * w, c[1] - side[1] * w], [c[0] + side[0] * w, c[1] + side[1] * w], 1.0 + 0.7 * M.hash(k, 4, 61), k + 601, 0.15);
    }),
    // Tussocks scattered over the meadow, each a short clump turned roughly to the eye.
    ...range(420).map((k) => {
      const x = -46 + 44 * M.hash(k, 1, 51);
      const y = -34 + 62 * M.hash(k, 2, 51);
      const w = 0.25 + 0.6 * M.hash(k, 3, 51);
      const turn = Math.atan2(y - EYE[1], x - EYE[0]) + Math.PI / 2 + (M.hash(k, 4, 51) - 0.5) * 0.8;
      return tuft([x - w * Math.cos(turn), y - w * Math.sin(turn)], [x + w * Math.cos(turn), y + w * Math.sin(turn)], 0.55 + 0.5 * M.hash(k, 5, 51), k + 101);
    }),
  ];
  const solids = [turf, ...west, ...aisles, ...rocks, ...grass];
  const KIND = { turf: 0, stone: 1, rock: 2, grass: 3, aisle: 4 };
  const kindOf = solids.map((s) => (s === turf ? KIND.turf : rocks.includes(s) ? KIND.rock : grass.includes(s) ? KIND.grass : aisles.includes(s) ? KIND.aisle : KIND.stone));
  const mesh = (s) => (s === turf ? [96, 260] : s.normal ? [1, 1] : rocks.includes(s) ? [24, 12] : grass.includes(s) ? [32, 1] : s === mould ? [160, 8] : reveals.includes(s) ? [200, 14] : aisles.includes(s) ? [60, 4] : [8, 8]);
  const G = M.gbuffer(solids, cam, { res, mesh });

  // Everything the sun doesn't change, per cell, once: the ray, what it hits, the stone's own darkness (courses and
  // joints, weathering streaks, ivy), the grit of the turf, and how much of it the fog lets through.
  const N = G.w * G.h;
  const cells = [];
  const sky = [];
  // The mist lies in the valley floor round the ruin and thins up the meadow toward the eye, in slow banks.
  const patchy = (p) => (0.3 + 0.9 * I.smoothstep(-45, 5, p[0])) * (0.6 + 0.8 * M.fbm(p[0] / 60 + 7, p[1] / 34, { octaves: 2, seed: 21 }));
  const fixedT = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i % G.w;
    const y = (i - x) / G.w;
    const d = M.ray(cam, G.res, x + 0.5, y + 0.5);
    const k = G.id[i];
    if (k < 0) {
      fixedT[i] = 0;
      sky.push({ i, d, low: 1 - I.smoothstep(0, 0.5, d[2]) });
      continue;
    }
    const p = [G.p[i * 3], G.p[i * 3 + 1], G.p[i * 3 + 2]];
    const n = [G.n[i * 3], G.n[i * 3 + 1], G.n[i * 3 + 2]];
    const kind = kindOf[k];
    let base = 0;
    if (kind === KIND.stone || kind === KIND.aisle) {
      const across = Math.abs(n[0]) > 0.7 ? p[1] : p[0];
      const c = Math.floor(p[2] / COURSE);
      const len = 0.95;
      const h = across / len + M.hash(c, 0, 13);
      const blk = Math.floor(h);
      const fz = p[2] / COURSE - c;
      const fh = h - blk;
      const joint = Math.abs(n[2]) > 0.7 ? 0 : Math.max(I.smoothstep(0.1, 0.0, Math.min(fz, 1 - fz)), I.smoothstep(0.06, 0.0, Math.min(fh, 1 - fh)));
      const streak = M.fbm(across * 1.6, p[2] * 0.12, { octaves: 3, seed: 17 });
      // Ivy climbs the north end of the front and its buttress, thinning upward.
      const ivy = I.smoothstep(0.52, 0.6, M.fbm(across * 0.55 + 11, p[2] * 0.5, { octaves: 4, seed: 31 }) + 0.2 * I.smoothstep(4, 13, p[1]) - 0.025 * p[2]);
      base = 0.36 + 0.12 * (M.hash(c, blk, 7) - 0.5) + 0.22 * (streak - 0.5) + 0.22 * joint;
      base = base * (1 - ivy) + ivy * (0.78 + 0.18 * (M.hash(Math.floor(across * 9), Math.floor(p[2] * 9), 3) - 0.5));
      if (kind === KIND.aisle) base += 0.08;
    } else if (kind === KIND.rock) base = 0.45 + 0.25 * (M.noise(p[0] * 3, p[1] * 3 + p[2] * 3, 5) - 0.5);
    else if (kind === KIND.grass) base = 0.74 + 0.16 * (M.hash(Math.floor(p[0] * 40), Math.floor(p[2] * 30), 2) - 0.5);
    else {
      const tuft = M.fbm(p[0] * 0.9, p[1] * 0.9, { octaves: 3, seed: 11 });
      base = 0.42 + 0.34 * (tuft - 0.5) + 0.1 * (M.hash(Math.floor(p[0] * 6), Math.floor(p[1] * 6), 12) - 0.5);
    }
    const t = fog.through(p, patchy(p));
    fixedT[i] = t;
    if (t < 0.004) continue;
    // The turf's soft shadows are looked up once per 4 × 4 block of cells and shared.
    const block = kind === KIND.turf ? (y >> 2) * ((G.w >> 2) + 1) + (x >> 2) + 1 : 0;
    cells.push({ i, p, n, kind, base: Math.min(0.95, Math.max(0, base)), t, block });
  }

  // The fog's light is marched on a coarser grid (it is smooth) along each cell's ray: where the ray runs through
  // sunlit mist the plate lightens, where it runs through the wall's shadow it stays grey. Fixed per sample: where it
  // is and how much it adds to what the eye sees of the fog.
  const STEP = 4;
  const cw = Math.ceil(G.w / STEP);
  const ch = Math.ceil(G.h / STEP);
  const SAMPLES = 20;
  const march = new Float32Array(cw * ch * SAMPLES * 4);
  const dirs = new Float32Array(cw * ch * 3);
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const cx = Math.min(G.w - 1, i * STEP + 1);
      const cy = Math.min(G.h - 1, j * STEP + 1);
      const c = j * cw + i;
      const d = M.ray(cam, G.res, cx + 0.5, cy + 0.5);
      dirs.set(d, c * 3);
      const k = G.id[cy * G.w + cx];
      const hit = k < 0 ? 260 : Math.min(260, Math.hypot(G.p[(cy * G.w + cx) * 3] - EYE[0], G.p[(cy * G.w + cx) * 3 + 1] - EYE[1], G.p[(cy * G.w + cx) * 3 + 2] - EYE[2]));
      // Samples crowd toward the eye, where the fog is lit and shaded in the finest detail, jittered against banding.
      let tau = 0;
      let prev = START;
      const jit = M.hash(i, j, 77);
      for (let s = 0; s < SAMPLES; s++) {
        const f = (s + jit) / SAMPLES;
        const r = START + (hit - START) * f * f;
        const ds = Math.max(0, r - prev);
        prev = r;
        const p = [EYE[0] + d[0] * r, EYE[1] + d[1] * r, EYE[2] + d[2] * r];
        const dens = DENSITY * patchy(p) * Math.exp(-Math.max(0, p[2]) / HEIGHTF) + HAZE;
        const w = dens * ds * Math.exp(-tau);
        tau += dens * ds;
        const o = (c * SAMPLES + s) * 4;
        march[o] = p[0];
        march[o + 1] = p[1];
        march[o + 2] = p[2];
        march[o + 3] = w;
      }
    }
  }

  const casters = [front, ...reveals, ...buttresses, ...aisles, ...rocks];
  return { cam, G, cells, sky, fixedT, march, dirs, cw, ch, STEP, SAMPLES, tris: I.trianglesOf(casters), threshold: M.grain(G.w, G.h, { seed: 4, clump: 0.28, size: 2 }) };
};

const UP = [0, 0, 1];

/** Is the sun at p, or does the west wall (cut by its window and door) stand between? Analytic, for the fog. */
const sunlit = (x, y, z, L) => {
  let plane;
  if (L[0] > 1e-3 && x < 0) plane = 0;
  else if (L[0] < -1e-3 && x > T) plane = T;
  else return 1;
  const t = (plane - x) / L[0];
  return solid(y + t * L[1], z + t * L[2]) ? 0 : 1;
};

/** The sky at a ray: grey, darker overhead, with the sun's glow; `low` (0 overhead .. 1 at the horizon) fades it into fog. */
const skyTone = (d, low, L, up) => {
  const c = d[0] * L[0] + d[1] * L[1] + d[2] * L[2];
  const a = Math.acos(Math.min(1, Math.max(-1, c)));
  const glow = up * (0.16 * Math.exp(-((a / 0.45) ** 2)) + 0.22 * Math.exp(-((a / 0.1) ** 2)) + I.smoothstep(0.016, 0.01, a));
  return Math.max(0, 0.6 - 0.44 * low - glow);
};

/** The tone of every cell at a solar time, printed as film grain. A negative plate inks the light. */
export const inkAt = (S, hours, { size = 1024, negative = false } = {}) => {
  const sun = sunAt(hours);
  const L = sun.light;
  const direct = I.smoothstep(-0.5, 3, sun.altitude);
  const day = I.smoothstep(-8, 6, sun.altitude);
  const shadow = direct > 0 ? I.shadowMap(null, L, { size, tris: S.tris, soft: 1.6 }) : null;
  const { G, cw, ch, STEP, SAMPLES, march, dirs } = S;

  // The fog's light per coarse cell: the share of what the eye sees of it that stands in the sun, weighted forward.
  const litFog = new Float32Array(cw * ch);
  for (let c = 0; c < cw * ch; c++) {
    let sum = 0;
    let all = 0;
    for (let s = 0; s < SAMPLES; s++) {
      const o = (c * SAMPLES + s) * 4;
      const w = march[o + 3];
      all += w;
      if (direct > 0 && w > 0) sum += w * sunlit(march[o], march[o + 1], march[o + 2], L);
    }
    const cos = dirs[c * 3] * L[0] + dirs[c * 3 + 1] * L[1] + dirs[c * 3 + 2] * L[2];
    const phase = 0.55 + 0.9 * Math.pow(Math.max(0, cos), 6) + 0.25 * Math.max(0, cos);
    litFog[c] = all > 0 ? (sum / all) * direct * phase : 0;
  }
  const fogAt = (x, y) => {
    const fx = Math.min(cw - 1.001, Math.max(0, (x - 1) / STEP));
    const fy = Math.min(ch - 1.001, Math.max(0, (y - 1) / STEP));
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fy);
    const tx = fx - i0;
    const ty = fy - j0;
    const a = litFog[j0 * cw + i0] * (1 - tx) + litFog[j0 * cw + i0 + 1] * tx;
    const b = litFog[(j0 + 1) * cw + i0] * (1 - tx) + litFog[(j0 + 1) * cw + i0 + 1] * tx;
    return a * (1 - ty) + b * ty;
  };
  // Fog in shade is a pale grey, fog in the sun nearly paper.
  const SHADE = 0.32 - 0.08 * day;
  const fogInk = (i) => {
    const x = i % G.w;
    const f = fogAt(x, (i - x) / G.w);
    return Math.max(0.012, 0.06 + (SHADE - 0.06) * (1 - Math.min(1, f)) - 0.05 * Math.max(0, f - 1));
  };

  const amb = 0.07 + 0.25 * day;
  const tone = new Float32Array(G.w * G.h);
  const shared = new Float32Array(((G.w >> 2) + 1) * ((G.h >> 2) + 1) + 2).fill(-1);
  const sees = (c) => {
    if (!c.block) return shadow.lit(c.p, c.kind === 3 ? UP : c.n);
    if (shared[c.block] < 0) shared[c.block] = shadow.lit(c.p, c.n);
    return shared[c.block];
  };
  for (const c of S.cells) {
    const l = c.n[0] * L[0] + c.n[1] * L[1] + c.n[2] * L[2];
    // Turf and grass are full of upright blades, so the low sun lights them more than a flat floor's cosine says.
    const facing = c.kind === 0 ? 0.6 + 0.4 * Math.max(0, l) : c.kind === 3 ? 0.3 + 0.35 * Math.abs(l) : Math.max(0, l);
    const lit = direct > 0 && (l > 0 || c.kind === 3) ? facing * direct * sees(c) : 0;
    const sky = 0.14 * day * Math.max(0, c.n[2]) + 0.06 * day * Math.max(0, -l);
    // Stone in shade still takes the light of the bright mist and the sunlit meadow in front of it.
    const fill = c.kind === 1 || c.kind === 4 ? 0.08 * day : 0;
    const level = Math.min(1, amb + fill + sky + (1 - amb) * 0.95 * lit);
    const surf = 1 - level * (1 - c.base);
    tone[c.i] = surf * c.t + fogInk(c.i) * (1 - c.t);
  }
  for (let i = 0; i < tone.length; i++) if (G.id[i] >= 0 && S.fixedT[i] < 0.004) tone[i] = fogInk(i);
  for (const c of S.sky) {
    const t = I.smoothstep(-0.02, 0.3, c.d[2]);
    tone[c.i] = skyTone(c.d, c.low, L, day) * t + fogInk(c.i) * (1 - t);
  }
  if (negative) for (let i = 0; i < tone.length; i++) tone[i] = 1 - tone[i];
  return M.film(tone, S.threshold, { amount: 0.75 });
};
