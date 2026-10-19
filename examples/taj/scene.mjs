import * as I from "../../kit/intaglio.mjs";

// The Taj Mahal seen from the far end of its long canal, engraved.
// World units are metres: x east, y north, z up, the origin at the centre of the plinth's foot.
// The marble plinth (95 m square, 6.7 m high) carries the chamfered tomb with its four great iwans, the drum and the
// onion dome, four chhatris and four minarets. The eye is in perspective near the water at the canal's end; the canal
// holds the tomb's reflection, found by casting each sample of the water along the mirrored ray. The sun follows
// Agra's sky through a mid-October day.

export const WIDTH = 560;
export const HEIGHT = 760;

export const LATITUDE = 27.17;
export const DECLINATION = -9.5;

const PLINTH = 47.5;
const PH = 6.7;
const A = 28.3;
const CH = 8.6;
const WALL = 31;
const PISH = { half: 10.6, out: 0.9, top: 35.5 };
const IWAN = { w: 6.6, sill: PH, spring: 19.5, depth: 5.5 };
const BAY = { w: 3, lo: PH + 0.6, hi: 19, depth: 2.4 };
const DRUM = { r: 12.2, z0: WALL, z1: 39 };
const EYE = [0, -280, 2.6];
const CANAL = { x: 8, y0: EYE[1] + 1, y1: -62, z: -0.35 };
const MINARET = 42.5;

const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });
const range = (n) => Array.from({ length: n }, (_, i) => i);
const UP = [0, 0, 1];

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

/** Smooth 2D value noise in 0..1. */
const hash = (i, j) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (x, y) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * u;
  const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * u;
  return a + (b - a) * v;
};

/**
 * A pointed (two-centred) arch of half width w springing at `spring` from jambs that start at `sill`.
 * `rise` is the height of the point above the springing. Returns its outline in (t, z) and an inside test.
 */
const arch = ({ w, sill, spring, rise = w * 1.3 }) => {
  // Centres at ±e on the springing line, radius R = w + e, meeting at the crown: R² = e² + rise².
  const e = (rise * rise - w * w) / (2 * w);
  const R = w + e;
  const inside = (t, z) => {
    const a = Math.abs(t);
    if (a >= w || z <= sill) return false;
    return z <= spring || (a + e) ** 2 + (z - spring) ** 2 < R * R;
  };
  const outline = (n = 20) => {
    const end = Math.acos(-e / R);
    const left = range(n + 1).map((k) => {
      const th = Math.PI + (end - Math.PI) * (k / n);
      return [e + R * Math.cos(th), spring + R * Math.sin(th)];
    });
    const right = left.slice(0, -1).reverse().map(([t, z]) => [-t, z]);
    return [[-w, sill], ...left, ...right, [w, sill]];
  };
  return { w, sill, spring, rise, inside, outline };
};

/** A vertical wall frame: origin o on the wall line, n its outward normal; at(t, z) is a point on it, pushed out by `out`. */
const frameAt = (o, n) => {
  const e = I.cross(UP, n);
  return { o, n, e, at: (t, z, out = 0) => [o[0] + e[0] * t + n[0] * out, o[1] + e[1] * t + n[1] * out, z] };
};

/** A polyline as a function of 0..1 by arc length. */
const along = (pts) => {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[len.length - 1];
  return (u) => {
    const target = u * total;
    let i = 1;
    while (i < pts.length - 1 && len[i] < target) i++;
    const f = (target - len[i - 1]) / (len[i] - len[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
  };
};

/**
 * A stretch of wall from t0 to t1 and z0 to z1, pierced by arched openings, each recessed `depth` into the wall:
 * the wall itself, the reveal round each opening (lines run into the depth) and the dark back of each recess.
 */
const wall = (F, { t0, t1, z0, z1, out = 0, openings = [] }) => {
  const open = (t, z) => openings.some((o) => o.arch.inside(t - o.t, z));
  const surface = I.patch({
    at: (u, v) => F.at(t0 + (t1 - t0) * u, z0 + (z1 - z0) * v, out),
    mask: (u, v) => !open(t0 + (t1 - t0) * u, z0 + (z1 - z0) * v),
    nu: Math.ceil((t1 - t0) * 2.5),
    nv: Math.ceil((z1 - z0) * 2.5),
  });
  const reveals = [];
  const backs = [];
  for (const o of openings) {
    const pts = o.arch.outline(16);
    const path = along(pts);
    reveals.push(
      I.patch({
        at: (u, v) => {
          const [t, z] = path(u);
          return F.at(o.t + t, z, out - o.depth * v);
        },
        side: -1,
        nu: 64,
        nv: 2,
      }),
    );
    backs.push(I.face({ points: pts.map(([t, z]) => F.at(o.t + t, z, out - o.depth)), along: F.e, outward: F.n }));
  }
  return { surface, reveals, backs, n: F.n };
};

/** A cylinder round a vertical axis pierced by `bays` pointed arches, for the open pavilions of the chhatris. */
const colonnade = ({ c, r, z0, h, bays, half, spring, rise }) => {
  const width = (I.TAU * r) / bays;
  const a = arch({ w: half, sill: -1, spring, rise });
  const open = (u, z) => a.inside((u * bays - Math.floor(u * bays) - 0.5) * width, z);
  return I.patch({
    at: (u, v) => [c[0] + r * Math.cos(u * I.TAU), c[1] + r * Math.sin(u * I.TAU), z0 + v * h],
    mask: (u, v) => !open(u, v * h),
    nu: bays * 12,
    nv: Math.ceil(h * 4),
  });
};

/** A chhatri: an octagonal drum, an open pavilion of eight arches, a broad chhajja, a small onion dome. */
const chhatri = ({ c, z, r }) => {
  const body = I.lathe({ base: [c[0], c[1], z], profile: [[0, r * 1.02, 1], [r * 0.7, r * 1.02, 1], [r * 0.7, r * 1.1, 1], [r * 0.82, r * 1.1, 1], [r * 0.82, r * 0.92, 1]] });
  const core = I.lathe({ base: [c[0], c[1], z + r * 0.82], profile: [[0, r * 0.55, 1], [r * 1.25, r * 0.55, 1]] });
  const zc = z + r * 0.82;
  const h = r * 1.25;
  const open = colonnade({ c, r: r * 0.92, z0: zc, h, bays: 8, half: r * 0.26, spring: h * 0.55, rise: h * 0.3 });
  const eave = I.lathe({ base: [c[0], c[1], zc + h], profile: [[0, r * 0.92, 1], [r * 0.12, r * 1.28, 1], [r * 0.2, r * 1.3, 1], [r * 0.24, r * 0.95, 1], [r * 0.4, r * 0.85, 1]] });
  const zd = zc + h + r * 0.4;
  const dome = I.lathe({
    base: [c[0], c[1], zd],
    profile: [[0, r * 0.82, 1], [r * 0.35, r * 0.95], [r * 0.75, r * 0.98], [r * 1.15, r * 0.78], [r * 1.45, r * 0.4], [r * 1.62, r * 0.12], [r * 1.68, r * 0.08, 1]],
  });
  return { stone: [body, eave], dark: [core], open: [open], dome: [dome], finial: [[c[0], c[1], zd + r * 1.62], [c[0], c[1], zd + r * 2.3]] };
};

/** A minaret: a tapering shaft in three stages divided by balconies, crowned by a chhatri. */
const minaret = ([x, y]) => {
  const z0 = PH;
  const r0 = 3.4;
  const r1 = 2.7;
  const tops = [11.5, 22, 31.5];
  const rAt = (s) => r0 + ((r1 - r0) * s) / tops[2];
  const shaft = [];
  const balconies = [];
  let s0 = 0;
  for (const s1 of tops) {
    shaft.push(I.lathe({ base: [x, y, z0 + s0], profile: [[0, rAt(s0) * 1.04, 1], [0.5, rAt(s0), 1], [s1 - s0, rAt(s1), 1]] }));
    const r = rAt(s1);
    balconies.push(
      I.lathe({
        base: [x, y, z0 + s1],
        profile: [[-1.4, r, 1], [-0.7, r + 0.5], [-0.15, r + 1.15, 1], [0.25, r + 1.2, 1], [0.25, r + 1.05, 1], [1.1, r + 1.05, 1], [1.1, r, 1]],
      }),
    );
    s0 = s1 + 1.1;
  }
  const base = I.lathe({ base: [x, y, z0], profile: [[0, r0 + 1.4, 1], [1.2, r0 + 1.4, 1], [1.2, r0 + 0.9, 1], [1.7, r0 + 0.5], [2.2, r0 + 0.3, 1]] });
  const top = chhatri({ c: [x, y], z: z0 + s0, r: r1 * 1.05 });
  return { shaft: [base, ...shaft], balconies, top };
};

/** A slender pinnacle (guldasta) rising from a parapet. */
const guldasta = ([x, y], z, h = 5.6, r = 0.55) =>
  I.lathe({ base: [x, y, z], profile: [[0, r, 1], [h * 0.68, r * 0.82, 1], [h * 0.72, r * 1.35, 1], [h * 0.78, r * 1.4], [h * 0.9, r * 0.9], [h, 0.05, 1]] });

/**
 * A coarse stand-in for a curved surface, for the live shadow map: its point function resampled on an nu × nv grid,
 * skipping masked cells so openings still let the light through. Flat faces are already minimal and pass through.
 */
const coarse = (s) => {
  if (s.normal) return s;
  const [nu, nv] = s.mask ? [48, 32] : [24, 14];
  const tris = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (s.mask && !s.mask((i + 0.5) / nu, (j + 0.5) / nv)) continue;
      const a = s.point(i / nu, j / nv)[0];
      const b = s.point((i + 1) / nu, j / nv)[0];
      const c = s.point((i + 1) / nu, (j + 1) / nv)[0];
      const d = s.point(i / nu, (j + 1) / nv)[0];
      tris.push([a, b, c], [a, c, d]);
    }
  }
  return { triangles: () => tris };
};

/**
 * A pick buffer: rasterise triangles seen by a perspective camera, keeping the nearest one's depth and normal per
 * pixel. `hit(p)` follows the ray from the eye through p beyond it and returns the first surface met.
 */
const pickBuffer = (tris, cam, ss = 2) => {
  const w = Math.ceil(cam.width * ss);
  const h = Math.ceil(cam.height * ss);
  const depth = new Float32Array(w * h).fill(-Infinity);
  const normal = new Float32Array(w * h * 3);
  for (const tri of tris) {
    const [a, b, c] = tri.map((p) => {
      const [x, y, d] = cam.project(p);
      return [x * ss, y * ss, d];
    });
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-9) continue;
    let n = I.unit(I.cross(I.sub(tri[1], tri[0]), I.sub(tri[2], tri[0])));
    if (I.dot(n, cam.toward(tri[0])) < 0) n = I.mul(n, -1);
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const l1 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
        const l2 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const d = l1 * a[2] + l2 * b[2] + l3 * c[2];
        const k = y * w + x;
        if (d > depth[k]) {
          depth[k] = d;
          normal[k * 3] = n[0];
          normal[k * 3 + 1] = n[1];
          normal[k * 3 + 2] = n[2];
        }
      }
    }
  }
  return (p) => {
    const [x, y, d] = cam.project(p);
    const i = Math.floor(x * ss);
    const j = Math.floor(y * ss);
    if (i < 0 || j < 0 || i >= w || j >= h) return null;
    const k = j * w + i;
    if (!(depth[k] > -Infinity) || depth[k] > d) return null;
    return { p: I.add(cam.eye, I.mul(I.sub(p, cam.eye), d / depth[k])), n: [normal[k * 3], normal[k * 3 + 1], normal[k * 3 + 2]] };
  };
};

export const scene = ({ ss = 3 } = {}) => {
  // The plinth, its moulded top edge, and the roof of the tomb.
  const plinth = I.box({ min: [-PLINTH, -PLINTH, 0], max: [PLINTH, PLINTH, PH - 0.5], capAlong: [1, 0, 0] });
  const lip = I.box({ min: [-PLINTH - 0.25, -PLINTH - 0.25, PH - 0.5], max: [PLINTH + 0.25, PLINTH + 0.25, PH], capAlong: [1, 0, 0] });
  const oct = [
    [A - CH, -A], [A, -A + CH], [A, A - CH], [A - CH, A], [-A + CH, A], [-A, A - CH], [-A, -A + CH], [-A + CH, -A],
  ];
  const roof = I.face({ points: oct.map(([x, y]) => [x, y, WALL]), along: [1, 0, 0], outward: UP });

  // The eight faces of the tomb. Main faces carry the pishtaq with its iwan and two stacked bays either side;
  // chamfered faces carry two stacked bays.
  const walls = [];
  const pishtaq = [];
  const frames = [];
  const bayLo = arch({ w: BAY.w, sill: BAY.lo, spring: BAY.lo + 5.8, rise: 3.3 });
  const bayHi = arch({ w: BAY.w, sill: BAY.hi, spring: BAY.hi + 5.2, rise: 3.3 });
  const iwan = arch({ w: IWAN.w, sill: IWAN.sill, spring: IWAN.spring, rise: 9 });
  const bays = (t) => [
    { t, arch: bayLo, depth: BAY.depth },
    { t, arch: bayHi, depth: BAY.depth },
  ];
  for (let k = 0; k < 4; k++) {
    const a = (-90 + k * 90) * I.deg;
    const n = [Math.cos(a), Math.sin(a), 0];
    const F = frameAt([n[0] * A, n[1] * A, 0], n);
    const side = (A - CH + PISH.half) / 2;
    walls.push(wall(F, { t0: -(A - CH), t1: -PISH.half, z0: PH, z1: WALL, openings: bays(-side) }));
    walls.push(wall(F, { t0: PISH.half, t1: A - CH, z0: PH, z1: WALL, openings: bays(side) }));
    const P = wall(F, { t0: -PISH.half, t1: PISH.half, z0: PH, z1: PISH.top, out: PISH.out, openings: [{ t: 0, arch: iwan, depth: IWAN.depth }] });
    walls.push(P);
    for (const s of [-1, 1]) {
      const t = s * PISH.half;
      pishtaq.push(I.face({ points: [F.at(t, PH, 0), F.at(t, PH, PISH.out), F.at(t, PISH.top, PISH.out), F.at(t, PISH.top, 0)], along: F.n, outward: I.mul(F.e, s) }));
    }
    pishtaq.push(I.face({ points: [F.at(-PISH.half, PISH.top, 0), F.at(PISH.half, PISH.top, 0), F.at(PISH.half, PISH.top, PISH.out), F.at(-PISH.half, PISH.top, PISH.out)], along: F.e, outward: UP }));
    // The pishtaq rises above the parapet: its back above the roof line closes it.
    pishtaq.push(I.face({ points: [F.at(-PISH.half, WALL, -1.2), F.at(PISH.half, WALL, -1.2), F.at(PISH.half, PISH.top, -1.2), F.at(-PISH.half, PISH.top, -1.2)], along: F.e, outward: I.mul(F.n, -1) }));
    frames.push({ F, kind: "main" });

    const b = (-45 + k * 90) * I.deg;
    const m = [Math.cos(b), Math.sin(b), 0];
    const d = (A - CH / 2) * Math.SQRT2;
    const C = frameAt([m[0] * d, m[1] * d, 0], m);
    const half = (CH * Math.SQRT2) / 2;
    walls.push(wall(C, { t0: -half, t1: half, z0: PH, z1: WALL, openings: bays(0) }));
    frames.push({ F: C, kind: "chamfer" });
  }

  // Pinnacles at the eight corners of the parapet and either side of each pishtaq.
  const pinnacles = [];
  for (const [x, y] of oct) pinnacles.push(guldasta([x, y], WALL, 5.4, 0.5));
  for (const { F, kind } of frames) {
    if (kind !== "main") continue;
    for (const s of [-1, 1]) pinnacles.push(guldasta(F.at(s * (PISH.half - 0.4), 0, PISH.out - 0.4), PISH.top, 5.8, 0.55));
  }

  // The drum and the onion dome with its lotus crown.
  const drum = I.lathe({
    base: [0, 0, DRUM.z0],
    profile: [[0, DRUM.r, 1], [DRUM.z1 - DRUM.z0 - 1.4, DRUM.r, 1], [DRUM.z1 - DRUM.z0 - 1.1, DRUM.r + 0.45], [DRUM.z1 - DRUM.z0 - 0.5, DRUM.r + 0.55, 1], [DRUM.z1 - DRUM.z0, DRUM.r + 0.1, 1]],
  });
  const domeZ = DRUM.z1;
  const dome = I.lathe({
    base: [0, 0, domeZ],
    profile: [[0, DRUM.r - 0.5, 1], [1.6, 13.3], [4.6, 14.9], [9.6, 15.4], [14.6, 14.4], [19.4, 11.6], [23.6, 7.6], [27, 4], [29.4, 1.9], [31.2, 1], [32, 0.8, 1]],
  });
  const crown = I.lathe({ base: [0, 0, domeZ + 32], profile: [[0, 0.8, 1], [0.5, 2.1], [0.9, 2.3, 1], [1.2, 0.7, 1], [1.9, 0.9], [2.6, 0.5, 1]] });
  const finial = [[0, 0, domeZ + 34.4], [0, 0, domeZ + 40]];

  // The four chhatris round the dome and the four minarets at the corners of the plinth.
  const chhatris = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => chhatri({ c: [sx * 17.2, sy * 17.2], z: WALL, r: 4.4 }));
  const minarets = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => minaret([sx * MINARET, sy * MINARET]));

  const C = (key) => chhatris.flatMap((c) => c[key]);
  const M = (key) => minarets.flatMap((m) => m.top[key]);
  const surfaces = walls.flatMap((w) => [w.surface, ...w.reveals, ...w.backs]);
  const tomb = [plinth, lip, roof].flat().concat(surfaces, pishtaq, pinnacles, [drum, dome, crown], C("stone"), C("dark"), C("open"), C("dome"));
  const towers = minarets.flatMap((m) => [...m.shaft, ...m.balconies, ...m.top.stone, ...m.top.dark, ...m.top.open, ...m.top.dome]);
  const subject = [...tomb.flat(), ...towers];

  // The garden: the canal with its marble kerb set in the lawn, the lawn as four slabs round it.
  const K = 1.4;
  // The kerbs start where the canal's edges leave the frame, about 30 m from the eye.
  const KY = EYE[1] + 26;
  const kerb = [
    ...I.box({ min: [-CANAL.x - K, KY, CANAL.z], max: [-CANAL.x, CANAL.y1 + K, 0.3], capAlong: [0, 1, 0] }),
    ...I.box({ min: [CANAL.x, KY, CANAL.z], max: [CANAL.x + K, CANAL.y1 + K, 0.3], capAlong: [0, 1, 0] }),
    ...I.box({ min: [-CANAL.x, CANAL.y1, CANAL.z], max: [CANAL.x, CANAL.y1 + K, 0.3], capAlong: [1, 0, 0] }),
  ];
  // Level planes for hatching, parametrised in 1/distance so their lines fall evenly on screen, not evenly in metres.
  // Each line spans only what the eye can see at its distance (`spread` is the half width per metre away).
  // Where a level plane at height z enters the bottom of the frame.
  const entry = (z) => {
    let lo = 0.5;
    let hi = 400;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (cam.project([0, EYE[1] + m, z])[1] > HEIGHT + 4) lo = m;
      else hi = m;
    }
    return EYE[1] + lo;
  };
  const level = (half, y0, y1, z, mask) => {
    const spread = (WIDTH / 2 + 12) / (cam.scale * Math.hypot(...I.sub(EYE, cam.target)));
    const n0 = 1 / (Math.max(y0, entry(z)) - EYE[1]);
    const n1 = 1 / (y1 - EYE[1]);
    const at = (u, v) => {
      const d = 1 / (n0 + (n1 - n0) * v);
      const w = Math.min(half, d * spread);
      return [(2 * u - 1) * w, EYE[1] + d, z];
    };
    return I.patch({ at, mask: mask && ((u, v) => mask(at(u, v))), nu: 2, nv: 2 });
  };

  const top = [0, 0, finial[1][2]];
  const target = [0, 0, 30];
  // Frame the tomb and the reflection of its finial in the canal: the mirror image of the top, seen from the eye.
  const cam = I.fitCamera([top, [0, 0, 2 * CANAL.z - top[2]], [-PLINTH - 2, -PLINTH, 0], [PLINTH + 2, -PLINTH, 0]], {
    width: WIDTH,
    height: HEIGHT,
    pad: 34,
    eye: EYE,
    target,
  });
  const G = 160;
  const near = entry(0);
  const wy = entry(CANAL.z);
  const water = I.face({ points: [[-CANAL.x, wy, CANAL.z], [CANAL.x, wy, CANAL.z], [CANAL.x, CANAL.y1, CANAL.z], [-CANAL.x, CANAL.y1, CANAL.z]], along: [1, 0, 0], outward: UP });
  const flat = (x0, y0, x1, y1) => I.face({ points: [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], along: [1, 0, 0], outward: UP });
  const X = CANAL.x + K;
  const lawns = [flat(-G, CANAL.y1 + K, G, G), flat(-G, near, -X, CANAL.y1 + K), flat(X, near, G, CANAL.y1 + K)];
  const offCanal = (p) => !(Math.abs(p[0]) < X && p[1] < CANAL.y1 + K);
  const lawnPlane = level(G, near, G, 0, offCanal);
  const waterPlane = level(CANAL.x, CANAL.y0, CANAL.y1, CANAL.z);

  const casters = [...subject, ...kerb];
  const solids = [...lawns, ...casters, water];
  const occ = I.occlusion(solids, cam, { ss, halo: subject });
  const toward = (n) => I.dot(n, cam.view) > 0.02;
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const all = (list, opts) => merge(list.filter((s) => !s.normal || toward(s.normal)).map((s) => H(s, opts)));
  const seen = walls.filter((w) => toward(w.n));

  const marble = { base: 0.02, ambient: 0.22, bounce: 0.16, gloss: 0.06, shine: 14 };
  const recess = { base: 0.4, ambient: 0.16, bounce: 0.08 };
  const deep = { base: 0.72, ambient: 0.08, bounce: 0.02 };
  const lawn = { base: 0.38, ambient: 0.26, bounce: 0 };

  const layers = [];
  const layer = (id, set, material, ink, shape) => layers.push({ id, set, material, ink, shape });

  // The lawn: ruled across the screen, crossed in cast shadow, fading into the paper away from the canal.
  const [cx0] = cam.project([0, 0, 0]);
  const meadow = ({ x, y }) => {
    const sideFade = 1 - I.smoothstep(0.8, 1, Math.abs(x - cx0) / (WIDTH / 2));
    const bottom = 1 - I.smoothstep(HEIGHT - 70, HEIGHT - 16, y + 8 * noise(x / 22, 1.7));
    return sideFade * bottom * (0.78 + 0.3 * noise(x / 9, y / 3));
  };
  const lawnSet = H(lawnPlane, { spacing: 2.6, step: 1.4 });
  const lawnX = H(lawnPlane, { spacing: 3.3, step: 1.4, slant: 0.5 });
  layer("lawn", lawnSet, lawn, { from: 0.26, to: 0.9, width: 0.95 }, meadow);
  layer("lawn-x", lawnX, lawn, { from: 0.55, to: 0.95, width: 0.75 }, meadow);
  layer("kerb", all(kerb, { spacing: 1.3, step: 1 }), marble, { from: 0.2, to: 0.75, width: 0.7 });

  // The canal: level lines, each sample toned by what the mirrored ray meets, broken by ripples.
  const box3 = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [0, top[2]].map((z) => [sx * (PLINTH + 6), sy * (PLINTH + 6), z])));
  const mirrorEye = [EYE[0], EYE[1], 2 * CANAL.z - EYE[2]];
  const mirror = I.fitCamera(box3, { width: 480, height: 600, pad: 4, eye: mirrorEye, target: [0, 0, 30] });
  const pick = pickBuffer(I.trianglesOf(subject), mirror, 2);
  const canal = H(waterPlane, { spacing: 1.5, step: 2.4 });
  for (const runs of canal.lines) for (const run of runs) for (const s of run) s.hit = pick(s.p);
  // The water vignettes into the paper at the sides and along a ragged lower edge.
  const [, yHorizon] = cam.project([0, 1e5, EYE[2]]);
  const pool = ({ x, y }) => (1 - I.smoothstep(0.84, 1, Math.abs(x - WIDTH / 2) / (WIDTH / 2))) * (1 - I.smoothstep(HEIGHT - 60, HEIGHT - 8, y + 12 * noise(x / 26, 4.2)));
  const skyBelow = ({ y }) => 0.16 + 0.36 * I.smoothstep(yHorizon, HEIGHT, y);
  // Everything about a water sample but the light on what it reflects is fixed: cache it.
  for (const runs of canal.lines) {
    for (const run of runs) {
      for (const s of run) {
        s.k = (0.72 + 0.42 * noise(s.x / 7, s.y * 0.75)) * pool(s);
        s.sky = skyBelow(s);
      }
    }
  }
  layers.push({ id: "canal", set: canal, reflect: true, ink: { from: 0.12, to: 0.9, width: 0.85 } });

  layer("plinth", all(plinth, { spacing: 2.2, step: 1.2 }), marble, { from: 0.16, to: 0.72, width: 1 });
  layer("plinth-x", all(plinth, { spacing: 2.9, slant: 0.5, step: 1.2 }), marble, { from: 0.58, to: 0.95, width: 0.8 });
  layer("lip", all([...lip, roof], { spacing: 1.2, step: 1 }), marble, { from: 0.2, to: 0.75, width: 0.7 });

  layer("walls", merge(seen.map((w) => H(w.surface, { spacing: 1.9, step: 1.1 }))), marble, { from: 0.3, to: 0.78, width: 0.95 });
  layer("walls-x", merge(seen.map((w) => H(w.surface, { spacing: 2.5, slant: 0.55, step: 1.1 }))), marble, { from: 0.58, to: 0.95, width: 0.75 });
  layer("pishtaq", all(pishtaq, { spacing: 1.5, step: 1 }), marble, { from: 0.18, to: 0.75, width: 0.8 });
  layer("reveals", merge(seen.flatMap((w) => w.reveals.map((r) => H(r, { along: "v", spacing: 1.5, step: 0.8 })))), marble, { from: 0.18, to: 0.8, width: 0.8 });
  layer("backs", merge(seen.flatMap((w) => w.backs.map((b) => H(b, { spacing: 1.5, step: 1 })))), recess, { from: 0.2, to: 0.85, width: 0.85 });
  layer("backs-x", merge(seen.flatMap((w) => w.backs.map((b) => H(b, { spacing: 2.1, slant: 0.6, step: 1 })))), recess, { from: 0.6, to: 0.97, width: 0.7 });

  layer("drum", H(drum, { spacing: 1.6, step: 1 }), marble, { from: 0.16, to: 0.72, width: 0.85 });
  layer("dome", H(dome, { spacing: 2.1, step: 1 }), marble, { from: 0.26, to: 0.78, width: 1.05 });
  layer("dome-x", H(dome, { spacing: 2.8, slant: 0.3, step: 1 }), marble, { from: 0.62, to: 0.97, width: 0.8 });
  layer("crown", H(crown, { spacing: 1.1, step: 0.7 }), marble, { from: 0.2, to: 0.8, width: 0.6 });
  layer("pinnacles", all(pinnacles, { spacing: 1.1, step: 0.7 }), marble, { from: 0.22, to: 0.8, width: 0.6 });

  layer("chhatri", all([...C("stone"), ...M("stone")], { spacing: 1.2, step: 0.8 }), marble, { from: 0.18, to: 0.78, width: 0.7 });
  layer("chhatri-open", all([...C("open"), ...M("open")], { along: "v", spacing: 1.2, step: 0.6 }), marble, { from: 0.18, to: 0.78, width: 0.65 });
  layer("chhatri-in", all([...C("dark"), ...M("dark")], { spacing: 1.1, step: 0.8 }), deep, { from: 0.2, to: 0.9, width: 0.7 });
  layer("chhatri-dome", all([...C("dome"), ...M("dome")], { spacing: 1.3, step: 0.8 }), marble, { from: 0.16, to: 0.74, width: 0.75 });

  const shafts = minarets.flatMap((m) => m.shaft);
  layer("minarets", all(shafts, { spacing: 1.5, step: 1 }), marble, { from: 0.16, to: 0.72, width: 0.85 });
  layer("minarets-x", all(shafts, { spacing: 2, slant: 0.35, step: 1 }), marble, { from: 0.58, to: 0.95, width: 0.65 });
  layer("balconies", all(minarets.flatMap((m) => m.balconies), { spacing: 1, step: 0.7 }), marble, { from: 0.2, to: 0.8, width: 0.6 });

  // The sky: ruled above the far lawn, darkest at the top, fading at its sides.
  const [, horizon] = cam.project([0, 1e5, EYE[2]]);
  const sky = I.ruling(cam, occ, { spacing: 2.45, halo: 7, region: (x, y) => y < horizon - 6 });
  const [, yTop] = cam.project(top);
  const skyTone = (s) => {
    const edge = 1 - I.smoothstep(0.66, 1, Math.hypot((s.x - cx0) / (WIDTH * 0.52), (s.y - HEIGHT * 0.32) / (HEIGHT * 0.42)));
    return (0.16 + 0.5 * I.smoothstep(horizon, yTop - 30, s.y)) * edge * I.smoothstep(horizon - 6, horizon - 70, s.y);
  };

  // Engraved marks: the rectangular frames round each arch, the plinth's blind arcade, the minarets' bands, the finials.
  const marks = [];
  const S = (pts, width = 0.4, taper = 0) => marks.push(I.stroke(pts, cam, occ.sees, { width, taper, lift: 0.3 }));
  const rect = (F, t0, t1, z0, z1, out) => [F.at(t0, z0, out), F.at(t0, z1, out), F.at(t1, z1, out), F.at(t1, z0, out)];
  const archLine = (F, t, a, out, grow = 0) => arch({ w: a.w + grow, sill: a.sill, spring: a.spring, rise: a.rise + grow }).outline(18).slice(1, -1).map(([u, z]) => F.at(t + u, z, out));
  for (const { F, kind } of frames) {
    if (!toward(F.n)) continue;
    if (kind === "main") {
      const o = PISH.out + 0.04;
      S(rect(F, -PISH.half + 1.1, PISH.half - 1.1, PH + 0.2, PISH.top - 1.2, o), 0.55);
      S(rect(F, -PISH.half + 1.9, PISH.half - 1.9, PH + 0.2, PISH.top - 2, o), 0.35);
      S(archLine(F, 0, iwan, o, 0.9), 0.45);
      const side = (A - CH + PISH.half) / 2;
      for (const t of [-side, side]) {
        S(rect(F, t - BAY.w - 0.9, t + BAY.w + 0.9, BAY.lo - 0.1, bayLo.spring + bayLo.rise + 0.9, 0.04), 0.35);
        S(rect(F, t - BAY.w - 0.9, t + BAY.w + 0.9, BAY.hi - 0.1, bayHi.spring + bayHi.rise + 0.9, 0.04), 0.35);
      }
      // Inside the iwan: the door below and the arched window above on its back wall.
      const back = PISH.out - IWAN.depth + 0.04;
      S(archLine(F, 0, arch({ w: 2.6, sill: PH, spring: PH + 6, rise: 2.4 }), back), 0.45);
      S(archLine(F, 0, arch({ w: 2.6, sill: PH + 9.6, spring: PH + 13.2, rise: 2.4 }), back), 0.4);
      S([F.at(-IWAN.w, PH + 8.8, back), F.at(IWAN.w, PH + 8.8, back)], 0.35);
    } else {
      for (const a of [bayLo, bayHi]) S(rect(F, -BAY.w - 0.9, BAY.w + 0.9, a.sill - 0.1, a.spring + a.rise + 0.9, 0.04), 0.35);
    }
  }
  // The parapet line and the plinth's arcade of blind niches.
  S(oct.concat([oct[0]]).map(([x, y]) => [x * 1.006, y * 1.006, WALL - 0.7]), 0.4);
  const niche = arch({ w: 1.35, sill: 0.9, spring: 4, rise: 1.4 });
  const P = frameAt([0, -PLINTH, 0], [0, -1, 0]);
  for (let k = -16; k <= 16; k++) S(archLine(P, k * 2.8, niche, 0.03), 0.38);
  const Pe = frameAt([PLINTH, 0, 0], [1, 0, 0]);
  const Pw = frameAt([-PLINTH, 0, 0], [-1, 0, 0]);
  for (let k = -16; k <= 16; k++) for (const F of [Pe, Pw]) if (toward(F.n)) S(archLine(F, k * 2.8, niche, 0.03), 0.38);
  S(finial, 1.5, 4);
  for (const c of chhatris) S(c.finial, 0.9, 2.5);
  for (const m of minarets) S(m.top.finial, 0.8, 2.2);

  return { cam, solids, tris: I.trianglesOf(casters), liveTris: I.trianglesOf(casters.map(coarse)), layers, sky, skyTone, marks: marks.join("") };
};

/** Ink every layer for a solar time. A negative plate (pale ink on dark paper) inks the light, not the shade. */
export const inkAt = (S, hours, { size = 1024, negative = false, live = false } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(S.solids, light, { size, tris: live ? S.liveTris : S.tris, soft: 1.2 });
  const out = {};
  for (const l of S.layers) {
    if (l.reflect) {
      const lit = I.lighting({ base: 0.02, ambient: 0.22, bounce: 0.16, light, view: S.cam.view, shadow });
      const tone = (s) => {
        if (s.k < 0.02) return 0;
        const t = s.hit ? 0.08 + 0.86 * lit(s.hit) : s.sky;
        // On the negative the water carries the light, so it is held back to keep the tomb the brightest thing.
        return (negative ? 0.78 * (1 - t) : t) * s.k;
      };
      out[l.id] = I.ink(l.set, tone, l.ink);
      continue;
    }
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    const tone = negative ? (s) => 1 - lit(s) : lit;
    out[l.id] = I.ink(l.set, l.shape ? (s) => ((s.fade ??= l.shape(s)) > 0.01 ? tone(s) * s.fade : 0) : tone, l.ink);
  }
  return out;
};
