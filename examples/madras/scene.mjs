import * as I from "../../kit/intaglio.mjs";

// Madras Central station, engraved from a photograph of about 1880 (reference.png).
// World units are metres: x east along the south wing, y north along the west wing, z up; the origin is the outer
// corner of the central pavilion at the foot of its walls. The west wing (arcaded, with the clock tower) faces west and
// the south wing faces south; the eye stands south-west of the corner behind the compound wall, where the camera stood.
// The camera is a level view camera with a shifted lens, fitted to landmarks measured on the photograph, so the
// verticals stay upright. The sun follows Madras's sky through a mid-October day.

export const WIDTH = 700;
export const HEIGHT = 560;

export const LATITUDE = 13.08;
export const DECLINATION = -9.5;

/** Where the photograph (637 × 481 px) sits on the plate, for the overlay check. */
export const PHOTO = { width: 637, height: 481, scale: 1.05, x: 15.5, y: 40 };
/** The fitted camera, in photograph px: eye, compass yaw of the line of sight (from +x toward +y), focal length, principal point. */
const LENS = { eye: [-85.5, -123.9, 1.53], yaw: 54.34, f: 1652, cx: 408.1, cy: 379.6 };

const P0 = 1.5;
const WING = { eave: 13.4, depth: 11, rise: 3.4, over: 0.55 };
const CENTRE = { size: 7.7, eave: 17.3, top: 22.4, plat: 1.3, crest: 1.6 };
const SMALL = { size: 5.1, eave: 15.1, top: 19.6, plat: 0.9, crest: 1.3 };
const EAST = { x0: 21.3, y0: -P0 };
const NORTH = { x0: P0 - 1, y0: 72.3 };
const FAR = { size: 5.1, eave: 14, top: 17.8, plat: 0.85, crest: 1.5 };
const TOWER = { x0: -1.8, y0: 36.8, w: 7.2, eave: 30.3, top: 38.8, plat: 1.05, crest: 2.7 };
const B_END = 31;
const FENCE = { x: -58.5, y0: -112, y1: -36, h: 1.1 };

const UP = [0, 0, 1];
const range = (n) => Array.from({ length: n }, (_, i) => i);
const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });

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

/** The photograph's camera on the plate. */
export const camera = () => {
  const a = LENS.yaw * I.deg;
  const D = 100;
  const { eye } = LENS;
  return I.perspective({
    eye,
    target: [eye[0] + D * Math.cos(a), eye[1] + D * Math.sin(a), eye[2]],
    scale: (LENS.f * PHOTO.scale) / D,
    offset: [PHOTO.x + LENS.cx * PHOTO.scale, PHOTO.y + LENS.cy * PHOTO.scale],
    width: WIDTH,
    height: HEIGHT,
  });
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
 * An arched opening of half width w on jambs from `sill` to `spring`, closed by two arcs meeting `rise` above the
 * springing: rise = w is a round arch, more is pointed. Its outline runs up one jamb, over the arch and down the other.
 */
const arch = ({ w, sill, spring, rise = w }) => {
  const e = (rise * rise - w * w) / (2 * w);
  const R = w + e;
  const inside = (t, z) => {
    const a = Math.abs(t);
    if (a >= w || z <= sill) return false;
    return z <= spring || (a + e) ** 2 + (z - spring) ** 2 < R * R;
  };
  const outline = (n = 16) => {
    const end = Math.acos(-e / R);
    const left = range(n + 1).map((k) => {
      const th = Math.PI + (end - Math.PI) * (k / n);
      return [e + R * Math.cos(th), spring + R * Math.sin(th)];
    });
    const right = left.slice(0, -1).reverse().map(([t, z]) => [-t, z]);
    return [[-w, sill], ...left, ...right, [w, sill]];
  };
  return { w, sill, spring, top: spring + rise, inside, outline };
};

/** A square-headed window. */
const square = ({ w, sill, top }) => ({
  w,
  sill,
  top,
  inside: (t, z) => Math.abs(t) < w && z > sill && z < top,
  outline: () => [[-w, sill], [-w, top], [w, top], [w, sill]],
});

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
 * A stretch of wall from t0 to t1 and z0 to z1, kept inside `clip`, pierced by openings each recessed `depth`:
 * the wall, the reveal round each opening (its lines run into the depth) and the back of each recess. An opening with
 * `inner` openings is a blind arch: its back is another wall, pierced in turn.
 */
const wall = (F, { t0, t1, z0, z1, out = 0, openings = [], clip, res = 6 }) => {
  const open = (t, z) => openings.some((o) => o.shape.inside(t - o.t, z));
  const keep = (t, z) => (!clip || clip(t, z)) && !open(t, z);
  const W = { walls: [], reveals: [], backs: [], n: F.n };
  W.walls.push(
    I.patch({
      at: (u, v) => F.at(t0 + (t1 - t0) * u, z0 + (z1 - z0) * v, out),
      mask: (u, v) => keep(t0 + (t1 - t0) * u, z0 + (z1 - z0) * v),
      nu: Math.ceil((t1 - t0) * res),
      nv: Math.ceil((z1 - z0) * res),
    }),
  );
  for (const o of openings) {
    const pts = o.shape.outline(16);
    const path = along(pts);
    W.reveals.push(
      I.patch({
        at: (u, v) => {
          const [t, z] = path(u);
          return F.at(o.t + t, z, out - o.depth * v);
        },
        side: -1,
        nu: 48,
        nv: 2,
      }),
    );
    if (o.inner) {
      const s = o.shape;
      const back = wall(F, { t0: o.t - s.w, t1: o.t + s.w, z0: s.sill, z1: s.top, out: out - o.depth, clip: (t, z) => s.inside(t - o.t, z), openings: o.inner.map((q) => ({ ...q, t: o.t + q.t })), res: 10 });
      W.walls.push(...back.walls);
      W.reveals.push(...back.reveals);
      W.backs.push(...back.backs);
    } else W.backs.push(I.face({ points: pts.map(([t, z]) => F.at(o.t + t, z, out - o.depth)), along: F.e, outward: F.n }));
  }
  return W;
};

const joinWalls = (list) => ({ walls: list.flatMap((w) => w.walls), reveals: list.flatMap((w) => w.reveals), backs: list.flatMap((w) => w.backs) });

/** A band (string course, cornice) along a wall frame from t0 to t1, between z0 and z1, standing `proj` proud of it. */
const band = (F, t0, t1, z0, z1, proj, back = 0.4) => {
  const p = (t, z, o) => F.at(t, z, o);
  const pts = [p(t0, z0, -back), p(t1, z0, -back), p(t1, z0, proj), p(t0, z0, proj)];
  return I.prism({ outline: pts, extrude: [0, 0, z1 - z0], capAlong: F.e });
};

/**
 * The bays of a wing: a round-headed door or window on the ground floor, two small square windows on the mezzanine
 * and a pair of round arches in the deep loggia above.
 */
const bays = (t0, t1, n, { pair = 0.72, aw = 0.55, gw = 1 } = {}) => {
  const pitch = (t1 - t0) / n;
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = t0 + pitch * (k + 0.5);
    out.push({ t, shape: arch({ w: gw, sill: 0.2, spring: 3.5 }), depth: 0.9 });
    for (const s of [-1, 1]) {
      out.push({ t: t + s * 0.7, shape: square({ w: 0.3, sill: 5.9, top: 7 }), depth: 0.35 });
      out.push({ t: t + s * pair, shape: arch({ w: aw, sill: 8.7, spring: 10.9 }), depth: 1.6 });
    }
  }
  return out;
};

/** A wing's face from t0 to t1 on frame F: its pierced wall, string courses and moulded cornice. */
const wingFace = (F, t0, t1, n, opts) => {
  const W = wall(F, { t0, t1, z0: 0, z1: WING.eave - 0.8, openings: bays(t0, t1, n, opts) });
  W.bands = [band(F, t0, t1, 5.1, 5.45, 0.14), band(F, t0, t1, 8.25, 8.65, 0.16), band(F, t0, t1, WING.eave - 0.8, WING.eave - 0.45, 0.22), band(F, t0, t1, WING.eave - 0.45, WING.eave, WING.over)];
  W.pitch = (t1 - t0) / n;
  W.t0 = t0;
  W.t1 = t1;
  W.n = F.n;
  W.F = F;
  return W;
};

/**
 * A pavilion: a square block of `size` with its outer corner at (x0, y0), a wall-dormer gable on each face with a
 * lancet, a moulded cornice and a steep truncated pyramid roof with a railed platform. Only the faces toward the eye
 * are pierced; `faces` lists them as [frame, t0, t1].
 */
const pavilion = ({ x0, y0, size, eave, top, plat, crest }, { big, door, triple }) => {
  const W = [];
  const bands = [];
  const gables = [];
  const roofs = [];
  const marks = [];
  const c = [x0 + size / 2, y0 + size / 2];
  const faces = [
    frameAt([x0, y0 + size / 2, 0], [-1, 0, 0]),
    frameAt([x0 + size / 2, y0, 0], [0, -1, 0]),
    frameAt([x0 + size, y0 + size / 2, 0], [1, 0, 0]),
    frameAt([x0 + size / 2, y0 + size, 0], [0, 1, 0]),
  ];
  const h = size / 2;
  const gh = Math.min(3, size * 0.42);
  const gw = size * 0.25;
  faces.forEach((F, k) => {
    if (k > 1) {
      W.push({ walls: [I.face({ points: [F.at(-h, 0), F.at(h, 0), F.at(h, eave), F.at(-h, eave)], along: F.e, outward: F.n })], reveals: [], backs: [] });
      return;
    }
    const lights = triple ? [-1.25, 0, 1.25] : [-0.75, 0.75];
    const inner = lights.map((t) => ({ t, shape: arch({ w: triple ? 0.42 : 0.46, sill: big.sill + 0.2, spring: big.spring - 0.8 }), depth: 0.5 }));
    W.push(
      wall(F, {
        t0: -h,
        t1: h,
        z0: 0,
        z1: eave - 0.9,
        openings: [
          { t: 0, shape: arch({ w: door, sill: 0.2, spring: 3.6 }), depth: 1 },
          { t: 0, shape: arch({ w: big.w, sill: big.sill, spring: big.spring }), depth: 0.45, inner },
        ],
      }),
    );
    bands.push(band(F, -h, h, 5.1, 5.45, 0.16), band(F, -h, h, big.sill - 0.4, big.sill, 0.18), band(F, -h, h, eave - 0.9, eave - 0.5, 0.25), band(F, -h, h, eave - 0.5, eave, 0.55));
    // The gable rises from the cornice in the plane of its front, with a lancet; its little roof runs back into the pyramid.
    const go = 0.55;
    const lancet = arch({ w: 0.32, sill: eave + 0.25, spring: eave + gh * 0.45, rise: 0.55 });
    const G = wall(F, { t0: -gw, t1: gw, z0: eave, z1: eave + gh, out: go, clip: (t, z) => z - eave < gh * (1 - Math.abs(t) / gw), openings: [{ t: 0, shape: lancet, depth: 0.4 }], res: 12 });
    gables.push(G);
    marks.push({ F, pts: [[-gw - 0.2, eave - 0.1], [0, eave + gh + 0.12], [gw + 0.2, eave - 0.1]], out: go + 0.16 });
  });
  // The roof: four steep planes from the cornice to the platform.
  const o = 0.55;
  const r0 = h + o;
  const corners = (r, z) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [c[0] + sx * r, c[1] + sy * r, z]);
  const lo = corners(r0, eave);
  const hi = corners(plat, top);
  for (let k = 0; k < 4; k++) {
    const a = lo[k];
    const b = lo[(k + 1) % 4];
    const fall = I.sub(I.mul(I.add(a, b), 0.5), I.mul(I.add(hi[k], hi[(k + 1) % 4]), 0.5));
    roofs.push(I.face({ points: [a, b, hi[(k + 1) % 4], hi[k]], along: fall, outward: I.add(I.sub(I.mul(I.add(a, b), 0.5), [c[0], c[1], eave]), [0, 0, 2]) }));
  }
  const platform = I.box({ min: [c[0] - plat, c[1] - plat, top], max: [c[0] + plat, c[1] + plat, top + 0.25], capAlong: [1, 1, 0] });
  return { ...joinWalls(W), bands, gables: joinWalls(gables), roofs, platform, marks, crest: { c, r: plat - 0.05, z: top + 0.25, h: crest } };
};

/** The clock tower: a square brick shaft with a door, twin lancets, a balconied belfry stage, clock gables and a spire roof. */
const clockTower = () => {
  const { x0, y0, w, eave, top, plat, crest } = TOWER;
  const h = w / 2;
  const c = [x0 + h, y0 + h];
  const F = [frameAt([x0, c[1], 0], [-1, 0, 0]), frameAt([c[0], y0, 0], [0, -1, 0]), frameAt([x0 + w, c[1], 0], [1, 0, 0]), frameAt([c[0], y0 + w, 0], [0, 1, 0])];
  const W = [];
  const bands = [];
  const gables = [];
  const roofs = [];
  const balconies = [];
  const marks = [];
  const clocks = [];
  const gw = 2.05;
  const gz = eave - 2.4;
  const gh = 6;
  F.forEach((G, k) => {
    const seen = k < 2;
    const openings = seen
      ? [
          { t: 0, shape: arch({ w: 1.45, sill: 0.2, spring: 4.6 }), depth: 1.2 },
          { t: -0.85, shape: arch({ w: 0.55, sill: 9.2, spring: 13.4, rise: 0.85 }), depth: 0.7 },
          { t: 0.85, shape: arch({ w: 0.55, sill: 9.2, spring: 13.4, rise: 0.85 }), depth: 0.7 },
          ...[-2.25, -1.3, 1.3, 2.25].map((t) => ({ t, shape: arch({ w: 0.36, sill: 21.2, spring: 24.6 }), depth: 0.6 })),
        ]
      : [];
    W.push(wall(G, { t0: -h, t1: h, z0: 0, z1: eave - 0.6, openings, res: seen ? 6 : 1 }));
    bands.push(band(G, -h, h, 8.3, 8.7, 0.18), band(G, -h, h, 15.6, 16, 0.18), band(G, -h, h, 27.1, 27.5, 0.2), band(G, -h - 0.6, h + 0.6, eave - 0.6, eave, 0.6, 0));
    balconies.push(band(G, -2.9, 2.9, 19.9, 20.4, 0.85));
    // The clock gable: a frontispiece standing proud of the cornice, its rakes meeting high above the eave.
    const go = 0.75;
    const gable = wall(G, { t0: -gw, t1: gw, z0: gz, z1: gz + gh + 0.2, out: go, clip: (t, z) => z - gz < 3.1 + (gh - 3.1) * (1 - Math.abs(t) / gw), res: seen ? 10 : 2 });
    gables.push(gable);
    for (const s of [-1, 1]) gables.push({ walls: [I.face({ points: [G.at(s * gw, gz, go), G.at(s * gw, gz + 3.1, go), G.at(s * gw, gz + 3.1, 0), G.at(s * gw, gz, 0)], along: UP, outward: I.mul(G.e, s) })], reveals: [], backs: [] });
    if (seen) {
      clocks.push({ G, c: G.at(0, gz + 3.55, go + 0.02), r: 1.3 });
      marks.push({ G, go });
    }
  });
  // The spire roof: four steep planes from the cornice to the railed platform.
  const r0 = h + 0.6;
  const corners = (r, z) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [c[0] + sx * r, c[1] + sy * r, z]);
  const lo = corners(r0, eave);
  const hi = corners(plat, top);
  for (let k = 0; k < 4; k++) {
    const a = lo[k];
    const b = lo[(k + 1) % 4];
    const fall = I.sub(I.mul(I.add(a, b), 0.5), I.mul(I.add(hi[k], hi[(k + 1) % 4]), 0.5));
    roofs.push(I.face({ points: [a, b, hi[(k + 1) % 4], hi[k]], along: fall, outward: I.add(I.sub(I.mul(I.add(a, b), 0.5), [c[0], c[1], eave]), [0, 0, 2]) }));
  }
  const platform = I.box({ min: [c[0] - plat, c[1] - plat, top], max: [c[0] + plat, c[1] + plat, top + 0.3], capAlong: [1, 1, 0] });
  return { ...joinWalls(W), bands, balconies, gables: joinWalls(gables), roofs, platform, clocks, marks, crest: { c, r: plat - 0.05, z: top + 0.3, h: crest } };
};

/**
 * A wing's roof plane from the eave line (a, b) up to the ridge, pushed in by `inward` and up by `rise`. It is ruled
 * along the eave: a long roof seen at a raking angle fans its fall lines into moiré.
 */
const roofPlane = (a, b, inward, rise) => {
  const c = I.add(b, [inward[0], inward[1], rise]);
  const d = I.add(a, [inward[0], inward[1], rise]);
  return I.face({ points: [a, b, c, d], along: I.sub(b, a), outward: [-inward[0], -inward[1], 1] });
};

export const scene = ({ ss = 3 } = {}) => {
  const cam = camera();

  // The west wing: from the central pavilion to the tower, and on to the north pavilion.
  const FA = frameAt([P0, 0, 0], [-1, 0, 0]);
  const FB = frameAt([0, P0, 0], [0, -1, 0]);
  const wingA1 = wingFace(FA, -TOWER.y0, -CENTRE.size, 9);
  const wingA2 = wingFace(FA, -NORTH.y0, -(TOWER.y0 + TOWER.w), 9);
  const wingB1 = wingFace(FB, CENTRE.size, EAST.x0, 3, { pair: 0.9, aw: 0.62, gw: 1.15 });
  const wingB2 = wingFace(FB, EAST.x0 + SMALL.size, B_END, 2, { pair: 0.9, aw: 0.62, gw: 1.15 });
  const wings = [wingA1, wingA2, wingB1, wingB2];

  const o = WING.over;
  const D = WING.depth / 2;
  const roofA = roofPlane([P0 - o, 2, WING.eave], [P0 - o, NORTH.y0 + FAR.size, WING.eave], [D + o, 0], WING.rise);
  const roofB = roofPlane([B_END + o, P0 - o, WING.eave], [2, P0 - o, WING.eave], [0, D + o], WING.rise);
  const hipB = I.face({ points: [[B_END + o, P0 - o, WING.eave], [B_END + o, P0 + WING.depth + o, WING.eave], [B_END - D, P0 + D, WING.eave + WING.rise]], along: [-1, 0, 0.6], outward: [1, 0, 1] });
  const wingRoofs = [roofA, roofB, hipB];

  const centre = pavilion({ x0: 0, y0: 0, ...CENTRE }, { big: { w: 2.35, sill: 6.4, spring: 11.3 }, door: 1.35, triple: true });
  const east = pavilion({ ...EAST, ...SMALL }, { big: { w: 1.75, sill: 6.2, spring: 10.6 }, door: 1.1 });
  const north = pavilion({ ...NORTH, ...FAR }, { big: { w: 1.75, sill: 6.2, spring: 10.6 }, door: 1.1 });
  const pavilions = [centre, east, north];
  const tower = clockTower();

  // The compound wall along the road: laterite with a stone coping that carries an iron railing.
  const fence = [
    ...I.box({ min: [FENCE.x - 0.45, FENCE.y0, 0], max: [FENCE.x, FENCE.y1, FENCE.h], capAlong: [0, 1, 0] }),
    ...I.box({ min: [FENCE.x - 0.55, FENCE.y0, FENCE.h], max: [FENCE.x + 0.1, FENCE.y1, FENCE.h + 0.16], capAlong: [0, 1, 0] }),
  ];

  const allWalls = [...wings, ...pavilions, tower];
  const subject = [
    ...allWalls.flatMap((w) => [...w.walls, ...w.reveals, ...w.backs]),
    ...wings.flatMap((w) => w.bands.flat()),
    ...pavilions.flatMap((p) => [...p.bands.flat(), ...p.gables.walls, ...p.gables.reveals, ...p.gables.backs, ...p.roofs, ...p.platform]),
    ...tower.bands.flat(),
    ...tower.balconies.flat(),
    ...tower.gables.walls,
    ...tower.roofs,
    ...tower.platform,
    ...wingRoofs,
  ];
  const occ = I.occlusion([...subject, ...fence], cam, { ss, halo: subject });

  const toward = (s) => !s.normal || I.dot(s.normal, I.unit(I.sub(cam.eye, s.point(0.5, 0.5)[0]))) > 0.01;
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const all = (list, opts) => merge(list.filter(toward).map((s) => H(s, opts)));

  const brick = { base: 0.1, ambient: 0.24, bounce: 0.14 };
  const stone = { base: 0.02, ambient: 0.26, bounce: 0.16 };
  const slate = { base: 0.2, ambient: 0.2, bounce: 0.08, gloss: 0.1, shine: 10 };
  const deep = { base: 0.8, ambient: 0.06, bounce: 0.02 };
  const laterite = { base: 0.45, ambient: 0.2, bounce: 0.06 };

  const layers = [];
  const layer = (id, set, material, ink, shape) => layers.push({ id, set, material, ink, shape });

  const walls = allWalls.flatMap((w) => w.walls);
  const reveals = allWalls.flatMap((w) => w.reveals);
  const backs = allWalls.flatMap((w) => w.backs);
  const gableParts = [...pavilions.map((p) => p.gables), tower.gables];
  const bandParts = [...wings.flatMap((w) => w.bands.flat()), ...pavilions.flatMap((p) => [...p.bands.flat(), ...p.platform]), ...tower.bands.flat(), ...tower.platform];

  layer("walls", all([...walls, ...gableParts.flatMap((g) => g.walls)], { spacing: 1.9, step: 1.3 }), brick, { from: 0.22, to: 0.8, width: 0.95 });
  layer("walls-x", all([...walls, ...gableParts.flatMap((g) => g.walls)], { spacing: 2.5, slant: 0.55, step: 1.6 }), brick, { from: 0.6, to: 0.95, width: 0.75 });
  layer("reveals", all([...reveals, ...gableParts.flatMap((g) => g.reveals)], { along: "v", spacing: 1.3, step: 0.9 }), brick, { from: 0.2, to: 0.8, width: 0.75 });
  layer("backs", all([...backs, ...gableParts.flatMap((g) => g.backs)], { spacing: 1.4, step: 0.9 }), deep, { from: 0.2, to: 0.85, width: 0.85 });
  layer("backs-x", all([...backs, ...gableParts.flatMap((g) => g.backs)], { spacing: 2, slant: 0.6, step: 0.9 }), deep, { from: 0.6, to: 0.97, width: 0.7 });
  layer("bands", all(bandParts, { spacing: 1.1, step: 0.9 }), stone, { from: 0.22, to: 0.8, width: 0.6 });
  layer("balconies", all(tower.balconies.flat(), { spacing: 1.1, step: 0.9 }), stone, { from: 0.22, to: 0.8, width: 0.6 });

  const roofs = [...wingRoofs, ...pavilions.flatMap((p) => p.roofs), ...tower.roofs];
  layer("roofs", all(roofs, { spacing: 1.8, step: 1 }), slate, { from: 0.18, to: 0.75, width: 0.85 });
  layer("roofs-x", all(roofs, { spacing: 2.4, slant: 0.5, step: 1 }), slate, { from: 0.58, to: 0.95, width: 0.7 });

  // The wall is a long low band seen at a raking angle: a fixed number of courses keeps them from crowding into moiré.
  const sides = (x) => 1 - I.smoothstep(0.8, 0.97, Math.abs(x - WIDTH / 2) / (WIDTH / 2));
  layer("fence", all(fence, { lines: 16, step: 2 }), laterite, { from: 0.1, to: 0.85, width: 1.1 }, (s) => sides(s.x));

  // The sky above the roofs, darkest at the top, fading to paper at its sides.
  const [, horizon] = cam.project([cam.eye[0] + 1e5 * Math.cos(LENS.yaw * I.deg), cam.eye[1] + 1e5 * Math.sin(LENS.yaw * I.deg), cam.eye[2]]);
  const sky = I.ruling(cam, occ, { spacing: 2.45, halo: 7, region: (x, y) => y < horizon - 8 });
  const skyTone = (s) => {
    const edge = 1 - I.smoothstep(0.7, 1, Math.hypot((s.x - WIDTH / 2) / (WIDTH * 0.52), (s.y - HEIGHT * 0.42) / (HEIGHT * 0.58)));
    return (0.14 + 0.5 * I.smoothstep(horizon, 0, s.y)) * edge;
  };

  // The road before the wall: ruled across, fading into the paper at the foot and the sides.
  const footY = (x) => {
    const a = cam.project([FENCE.x - 0.45, FENCE.y0, 0]);
    const b = cam.project([FENCE.x - 0.45, FENCE.y1, 0]);
    return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  };
  const road = I.ruling(cam, occ, { spacing: 2.6, halo: 0, region: (x, y) => y > footY(x) + 1.5 });
  const roadTone = (s) => {
    const fade = (1 - I.smoothstep(0.82, 1, Math.abs(s.x - WIDTH / 2) / (WIDTH / 2))) * (1 - I.smoothstep(HEIGHT - 50, HEIGHT - 8, s.y + 10 * noise(s.x / 24, 3.1)));
    return (0.12 + 0.34 * noise(s.x / 9, s.y / 2.2) + 0.3 * I.smoothstep(footY(s.x) + 10, footY(s.x), s.y)) * fade;
  };

  // Engraved marks: arch hoods and voussoirs in pale stone, corbel tables under the cornices, cresting, the clocks.
  const marks = [];
  const S = (pts, width = 0.4, taper = 0) => marks.push(I.stroke(pts, cam, occ.sees, { width, taper, lift: 0.25 }));
  const facing = (F) => I.dot(F.n, I.unit(I.sub(cam.eye, F.o))) > 0.02;
  const hood = (F, t, a, out, grow) => arch({ w: a.w + grow, sill: a.sill, spring: a.spring, rise: (a.top - a.spring) + grow }).outline(18).slice(1, -1).map(([u, z]) => F.at(t + u, z, out));
  for (const w of wings) {
    if (!facing(w.F)) continue;
    for (let k = 0; k < Math.round((w.t1 - w.t0) / w.pitch); k++) {
      const t = w.t0 + w.pitch * (k + 0.5);
      const pair = w.F === FB ? 0.9 : 0.72;
      const aw = w.F === FB ? 0.62 : 0.55;
      for (const s of [-1, 1]) S(hood(w.F, t + s * pair, arch({ w: aw, sill: 8.7, spring: 10.9 }), 0.03, 0.22), 0.45);
      S(hood(w.F, t, arch({ w: w.F === FB ? 1.15 : 1, sill: 0.2, spring: 3.5 }), 0.03, 0.3), 0.45);
    }
    // The arched corbel table under the cornice.
    const z = WING.eave - 0.8;
    const n = Math.round((w.t1 - w.t0) / 0.42);
    for (let k = 0; k < n; k++) {
      const t = w.t0 + ((k + 0.5) * (w.t1 - w.t0)) / n;
      S(range(7).map((i) => w.F.at(t - 0.16 * Math.cos((i / 6) * Math.PI), z - 0.12 - 0.16 * Math.sin((i / 6) * Math.PI), 0.03)), 0.35);
    }
  }
  for (const p of pavilions) {
    for (const g of p.marks) {
      if (!facing(g.F)) continue;
      // The stone coping on the rakes, a second line under it, and a finial at the apex.
      S(g.pts.map(([t, z]) => g.F.at(t, z, g.out)), 0.6);
      S(g.pts.map(([t, z], i) => g.F.at(t * 0.9, z - (i === 1 ? 0.3 : 0.05), g.out)), 0.35);
      const [, top] = g.pts[1];
      S([g.F.at(0, top, g.out), g.F.at(0, top + 0.9, g.out)], 0.55, 2);
    }
  }
  for (const { G, go } of tower.marks) {
    if (!facing(G)) continue;
    const gz = TOWER.eave - 2.4;
    const rake = [[-2.05, gz], [-2.05, gz + 3.1], [0, gz + 6], [2.05, gz + 3.1], [2.05, gz]];
    S(rake.map(([t, z]) => G.at(t * 1.04, z + (z > gz ? 0.1 : 0), go + 0.06)), 0.65);
    S(rake.slice(1, 4).map(([t, z], i) => G.at(t * 0.92, z - (i === 1 ? 0.3 : 0.08), go + 0.06)), 0.35);
    S([G.at(0, gz + 6.1, go), G.at(0, gz + 7.1, go)], 0.6, 2);
    S(hood(G, -0.85, arch({ w: 0.55, sill: 9.2, spring: 13.4, rise: 0.85 }), 0.03, 0.2), 0.45);
    S(hood(G, 0.85, arch({ w: 0.55, sill: 9.2, spring: 13.4, rise: 0.85 }), 0.03, 0.2), 0.45);
    S(hood(G, 0, arch({ w: 1.45, sill: 0.2, spring: 4.6 }), 0.03, 0.35), 0.5);
    // The balustrade of the belfry balcony.
    const b = 0.85;
    S([G.at(-2.9, 21.3, b), G.at(2.9, 21.3, b)], 0.45);
    for (let k = 0; k <= 22; k++) S([G.at(-2.8 + (5.6 * k) / 22, 20.4, b - 0.05), G.at(-2.8 + (5.6 * k) / 22, 21.25, b - 0.05)], 0.3);
  }

  // Cresting: a rail round each platform with close iron uprights and taller finials at the corners.
  const crest = ({ c, r, z, h }) => {
    const ring = (zz) => [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([sx, sy]) => [c[0] + sx * r, c[1] + sy * r, zz]);
    S(ring(z + h * 0.55), 0.4);
    S(ring(z + h * 0.3), 0.3);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) S([[c[0] + sx * r, c[1] + sy * r, z], [c[0] + sx * r, c[1] + sy * r, z + h]], 0.5, 2);
    for (let side = 0; side < 4; side++) {
      const [ax, ay] = [[-1, -1], [1, -1], [1, 1], [-1, 1]][side];
      const [bx, by] = [[1, -1], [1, 1], [-1, 1], [-1, -1]][side];
      const n = Math.round((2 * r) / 0.22);
      for (let k = 1; k < n; k++) {
        const f = k / n;
        const x = c[0] + r * (ax + (bx - ax) * f);
        const y = c[1] + r * (ay + (by - ay) * f);
        S([[x, y, z], [x, y, z + h * (k % 2 ? 0.55 : 0.75)]], 0.28, 1);
      }
    }
    S([[c[0], c[1], z], [c[0], c[1], z + h * 1.35]], 0.6, 3);
  };
  for (const p of pavilions) crest(p.crest);
  crest(tower.crest);
  // Ridge cresting along the wing roofs.
  for (const [a, b] of [[[P0 + D, CENTRE.size, WING.eave + WING.rise], [P0 + D, NORTH.y0, WING.eave + WING.rise]], [[CENTRE.size, P0 + D, WING.eave + WING.rise], [B_END - D, P0 + D, WING.eave + WING.rise]]]) {
    S([I.add(a, [0, 0, 0.5]), I.add(b, [0, 0, 0.5])], 0.35);
    const n = Math.round(Math.hypot(...I.sub(b, a)) / 0.3);
    for (let k = 0; k <= n; k++) {
      const p = I.add(a, I.mul(I.sub(b, a), k / n));
      S([p, I.add(p, [0, 0, k % 2 ? 0.5 : 0.7])], 0.25);
    }
  }
  // The iron railing on the wall: a top and a bottom rail and close bars with spear heads.
  // Towards the sides of the plate the railing thins out bar by bar, as the wall and the road fade into the paper.
  const rz = FENCE.h + 0.16;
  const rx = FENCE.x - 0.2;
  const keep = (y, k) => hash(k, 7) < sides(cam.project([rx, y, rz])[0]);
  for (let y = FENCE.y0, k = 0; y < FENCE.y1; y += 0.16, k++) {
    if (!keep(y, k)) continue;
    S([[rx, y, rz], [rx, y, rz + 1.2]], 0.3, 1);
    S([[rx, y, rz + 1.05], [rx, y + 0.16, rz + 1.05]], 0.4);
    S([[rx, y, rz + 0.12], [rx, y + 0.16, rz + 0.12]], 0.35);
  }

  // The clock faces: a moulded rim and twelve hour marks; the hands are inked with the light.
  for (const { G, c, r } of tower.clocks) {
    if (!facing(G)) continue;
    S(I.circle(c, G.n, r, 64), 0.55);
    S(I.circle(I.add(c, I.mul(G.n, 0.02)), G.n, r * 0.84, 64), 0.3);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * I.TAU;
      const d = (q) => I.add(I.add(c, I.mul(G.e, q * Math.sin(a))), [0, 0, q * Math.cos(a)]);
      S([d(r * 0.68), d(r * 0.82)], 0.4);
    }
  }
  const hands = (hours) => {
    const out = [];
    for (const { G, c, r } of tower.clocks) {
      if (!facing(G)) continue;
      const tip = (frac, q) => {
        const a = frac * I.TAU;
        return I.add(I.add(c, I.mul(G.e, q * Math.sin(a))), [0, 0, q * Math.cos(a)]);
      };
      out.push(I.stroke([c, tip((hours % 12) / 12, r * 0.5)], cam, occ.sees, { width: 0.75, taper: 0, lift: 0.3 }));
      out.push(I.stroke([c, tip(hours % 1, r * 0.72)], cam, occ.sees, { width: 0.5, taper: 0, lift: 0.3 }));
    }
    return out.join("");
  };

  // Only the building casts shadows that can be seen: the ground behind the wall is hidden from the eye.
  return { cam, solids: subject, tris: I.trianglesOf(subject), layers, sky, skyTone, road, roadTone, marks: marks.join(""), hands };
};

/** Ink every layer for a solar time. A negative plate (pale ink on dark paper) inks the light, not the shade. */
export const inkAt = (S, hours, { size = 1024, negative = false } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris, soft: 1.2 });
  const out = {};
  for (const l of S.layers) {
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    const tone = negative ? (s) => 1 - lit(s) : lit;
    out[l.id] = I.ink(l.set, l.shape ? (s) => tone(s) * l.shape(s) : tone, l.ink);
  }
  out.hands = S.hands(hours);
  return out;
};
