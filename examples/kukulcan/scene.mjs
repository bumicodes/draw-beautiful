import * as I from "../../kit/intaglio.mjs";

// El Castillo, the Temple of Kukulcán at Chichén Itzá, on the afternoon of the spring equinox.
// World units are metres: x east, y north, z up. The pyramid is a square of 55.3 m stepped in nine terraces to a
// platform 24 m up, with the temple rising 6 m more to 30 m. Its axes are turned 17° clockwise from the compass, so
// the north stair faces NNE. Each side has a stair of 91 steps; with the platform that makes 365. The sun follows
// Chichén Itzá's sky (20.68° N, declination 0). Late in the day, as it sinks toward due west, the north-west corners
// of the terraces throw a sawtooth of shadow on the west balustrade of the north stair, and the triangles of light
// left between them make the body of the serpent coming down to its carved head at the foot.

export const WIDTH = 760;
export const HEIGHT = 450;

export const LATITUDE = 20.68;
export const DECLINATION = 0;
export const ROTATION = 17;

const HALF = 55.3 / 2;
const TERRACES = 9;
const STOREY = 24 / TERRACES;
const PLATFORM = 9.75;
const BATTER = 0.62;
const SETBACK = (HALF - PLATFORM - BATTER) / (TERRACES - 1);
const TALUD = STOREY - 0.48;
const BAND = 0.1;

const STEPS = 91;
const RISE = 24 / STEPS;
const GOING = RISE;
const FOOT = PLATFORM + STEPS * GOING;
const W_IN = 3.7;
const W_OUT = 4.9;
const RAIL = 0.95;
const END = FOOT + 0.3;

const TEMPLE = 6.6;
const DOOR = 2.45;

const lerp = (a, b, t) => a + (b - a) * t;
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
  return { altitude: alt / I.deg, bearing, light: I.sunDirection(Math.max(bearing, 0), Math.max(alt / I.deg, 1.5)) };
};

/** The frame of side k (0 north, 1 east, 2 south, 3 west): o points out of the face, l along it (left as you face it). */
const sideOf = (k) => {
  const b = (ROTATION + 90 * k) * I.deg;
  const o = [Math.sin(b), Math.cos(b), 0];
  const l = [Math.cos(b), -Math.sin(b), 0];
  return { o, l, P: (r, w, z) => [r * o[0] + w * l[0], r * o[1] + w * l[1], z] };
};
const SIDES = range(4).map(sideOf);
const N = SIDES[0];

/** A quad in side k's frame from (r, w, z) corners, its lines along `along`. */
const quad = (k, pts, along, outward) => {
  const { P } = SIDES[k];
  return I.face({ points: pts.map((q) => P(...q)), along, outward });
};

/** The nine terraces: a battered talud, a thin vertical band under the ledge, and the ledge. */
const terraces = () => {
  const taluds = [];
  const bands = [];
  const ledges = [];
  for (let i = 0; i < TERRACES; i++) {
    const z0 = i * STOREY;
    const z1 = z0 + STOREY;
    const zt = z0 + TALUD;
    const foot = HALF - i * SETBACK;
    const top = foot - BATTER;
    const next = i < TERRACES - 1 ? HALF - (i + 1) * SETBACK : 0;
    for (let k = 0; k < 4; k++) {
      const { o, l } = SIDES[k];
      const out = I.add(o, [0, 0, 0.3]);
      taluds.push({ i, k, f: quad(k, [[foot, -foot, z0], [foot, foot, z0], [top, top, zt], [top, -top, zt]], l, out) });
      bands.push({ i, k, f: quad(k, [[top + BAND, -top - BAND, zt], [top + BAND, top + BAND, zt], [top + BAND, top + BAND, z1], [top + BAND, -top - BAND, z1]], l, o) });
      if (i < TERRACES - 1) ledges.push({ i, k, f: quad(k, [[top + BAND, -top - BAND, z1], [top + BAND, top + BAND, z1], [next, next, z1], [next, -next, z1]], l, [0, 0, 1]) });
    }
  }
  return { taluds, bands, ledges };
};

/** One flight of 91 steps up side k: risers and treads as one surface, v climbing, one hatch line per riser and tread. */
const flight = (k) => {
  const { o, P } = SIDES[k];
  const n = STEPS * 2;
  const up = [0, 0, 1];
  const at = (u, v) => {
    const w = lerp(-W_IN, W_IN, u);
    const t = Math.min(n - 1e-6, Math.max(0, v * n));
    const i = Math.floor(t);
    const f = t - i;
    const j = i >> 1;
    if (i % 2 === 0) return [P(FOOT - j * GOING, w, (j + f) * RISE), o];
    return [P(FOOT - (j + f) * GOING, w, (j + 1) * RISE), up];
  };
  const triangles = () => {
    const tris = [];
    for (let i = 0; i < n; i++) {
      const a = at(0, i / n)[0];
      const b = at(1, i / n)[0];
      const c = at(1, (i + 1) / n - 1e-7)[0];
      const d = at(0, (i + 1) / n - 1e-7)[0];
      tris.push([a, b, c], [a, c, d]);
    }
    return tris;
  };
  return { point: at, triangles };
};

/** The balustrade tops follow the nosings RAIL metres higher: z at a distance r from the centre. */
const railZ = (r) => FOOT - r + RISE + RAIL;

/** A balustrade beside side k's stair, s -1 on the left of the steps (west, on the north stair), +1 on the right. */
const balustrade = (k, s) => {
  const { o, l } = SIDES[k];
  const wi = s * W_IN;
  const wo = s * W_OUT;
  const slope = I.unit(I.add(I.mul(o, -1), [0, 0, 1]));
  const top = railZ(PLATFORM);
  return {
    outer: quad(k, [[PLATFORM, wo, 0], [END, wo, 0], [END, wo, railZ(END)], [PLATFORM, wo, top]], o, I.mul(l, s)),
    inner: quad(k, [[FOOT, wi, 0], [END, wi, 0], [END, wi, railZ(END)], [PLATFORM, wi, top], [PLATFORM, wi, 24 - 0.05]], o, I.mul(l, -s)),
    cope: quad(k, [[END, wi, railZ(END)], [END, wo, railZ(END)], [PLATFORM, wo, top], [PLATFORM, wi, top]], slope, [0, 0, 1]),
    front: quad(k, [[END, wi, 0], [END, wo, 0], [END, wo, railZ(END)], [END, wi, railZ(END)]], l, o),
    back: quad(k, [[PLATFORM, wi, 24], [PLATFORM, wo, 24], [PLATFORM, wo, top], [PLATFORM, wi, top]], l, I.mul(o, -1)),
  };
};

/**
 * A carved serpent head at the foot of a north balustrade: a rounded block for the upper jaw and brow, its snout
 * scrolled up, over a lower jaw on the ground, the open mouth between them. Rings run round the head's long axis.
 */
const blob = ({ k, w, x0, x1, at }) => {
  const { o, l } = SIDES[k];
  const e = 0.42;
  const sq = (c) => Math.sign(c) * Math.abs(c) ** e;
  return I.patch({
    at: (u, v) => {
      const x = lerp(x0, x1, v);
      const [a, c, zc] = at((x - x0) / (x1 - x0));
      const th = u * I.TAU;
      const y = a * sq(Math.cos(th));
      const z = zc + c * sq(Math.sin(th));
      const r = END + x;
      return [r * o[0] + (w + y) * l[0], r * o[1] + (w + y) * l[1], z];
    },
    side: -1,
    nu: 40,
    nv: 24,
  });
};
const capped = (t, a, b) => Math.sqrt(Math.max(0, 1 - Math.max(0, (a - t) / a, (t - (1 - b)) / b) ** 2));

const serpent = (s) => {
  const w = s * (W_IN + W_OUT) / 2;
  const upper = blob({
    k: 0, w, x0: -0.25, x1: 2.25,
    at: (t) => {
      const cap = capped(t, 0.06, 0.16);
      const scroll = I.smoothstep(0.6, 1, t) * 0.32;
      return [0.74 * cap * (1 - 0.12 * t), (0.5 - 0.1 * t) * cap, 1.18 + scroll * 0.6 - 0.05 * t];
    },
  });
  const brow = blob({
    k: 0, w, x0: -0.2, x1: 0.95,
    at: (t) => {
      const cap = capped(t, 0.1, 0.35);
      return [0.68 * cap, 0.22 * cap, 1.62 + 0.04 * Math.sin(t * Math.PI)];
    },
  });
  const jaw = blob({
    k: 0, w, x0: -0.2, x1: 2.05,
    at: (t) => {
      const cap = capped(t, 0.05, 0.14);
      return [0.66 * cap, 0.25 * cap, 0.27];
    },
  });
  const tongue = blob({
    k: 0, w, x0: 1.2, x1: 2.85,
    at: (t) => {
      const cap = capped(t, 0.05, 0.3);
      return [0.2 * cap, 0.06 * cap, 0.05];
    },
  });
  const { o, l } = N;
  const P = (x, y, z) => [(END + x) * o[0] + (w + y) * l[0], (END + x) * o[1] + (w + y) * l[1], z];
  const throat = I.prism({ outline: [P(-0.1, -0.5, 0.45), P(1.8, -0.5, 0.45), P(1.8, 0.5, 0.45), P(-0.1, 0.5, 0.45)], extrude: [0, 0, 0.36], capAlong: l });
  return { stone: [upper, brow, jaw, tongue], throat };
};

/** The temple on the platform: a battered plinth, walls with doorways, a band, the frieze and the cornice. */
const temple = () => {
  const z0 = 24;
  const zp = z0 + 0.6;
  const zw = zp + 2.9;
  const zf = zw + 0.3;
  const zc = 29.55;
  const zr = 30;
  const plinth = [];
  const walls = [];
  const inside = [];
  const reveals = [];
  const bands = [];
  const friezes = [];
  const columns = [];
  const doors = (k) =>
    k === 0
      ? [[-3.3, -1.75], [-0.85, 0.85], [1.75, 3.3]]
      : [[-1.1, 1.1]];
  for (let k = 0; k < 4; k++) {
    const { o, l, P } = SIDES[k];
    plinth.push(quad(k, [[TEMPLE + 0.35, -TEMPLE - 0.35, z0], [TEMPLE + 0.35, TEMPLE + 0.35, z0], [TEMPLE, TEMPLE, zp], [TEMPLE, -TEMPLE, zp]], l, I.add(o, [0, 0, 0.5])));
    const open = doors(k);
    const H = zw - zp;
    walls.push(
      I.patch({
        at: (u, v) => P(TEMPLE, lerp(-TEMPLE, TEMPLE, u), lerp(zp, zw, v)),
        side: -1,
        nu: 132,
        nv: 30,
        mask: (u, v) => {
          const w = lerp(-TEMPLE, TEMPLE, u);
          return !(v * H < DOOR && open.some(([a, b]) => w > a && w < b));
        },
      }),
    );
    inside.push(quad(k, [[TEMPLE - 1.1, -TEMPLE + 1.1, zp], [TEMPLE - 1.1, TEMPLE - 1.1, zp], [TEMPLE - 1.1, TEMPLE - 1.1, zp + DOOR + 0.2], [TEMPLE - 1.1, -TEMPLE + 1.1, zp + DOOR + 0.2]], l, o));
    for (const [a, b] of open) {
      reveals.push(
        quad(k, [[TEMPLE, a, zp], [TEMPLE - 1.1, a, zp], [TEMPLE - 1.1, a, zp + DOOR], [TEMPLE, a, zp + DOOR]], o, l),
        quad(k, [[TEMPLE, b, zp], [TEMPLE - 1.1, b, zp], [TEMPLE - 1.1, b, zp + DOOR], [TEMPLE, b, zp + DOOR]], o, I.mul(l, -1)),
        quad(k, [[TEMPLE, a, zp + DOOR], [TEMPLE, b, zp + DOOR], [TEMPLE - 1.1, b, zp + DOOR], [TEMPLE - 1.1, a, zp + DOOR]], l, [0, 0, -1]),
      );
    }
    bands.push(quad(k, [[TEMPLE + 0.15, -TEMPLE - 0.15, zw], [TEMPLE + 0.15, TEMPLE + 0.15, zw], [TEMPLE + 0.15, TEMPLE + 0.15, zf], [TEMPLE + 0.15, -TEMPLE - 0.15, zf]], l, o));
    friezes.push(quad(k, [[TEMPLE + 0.05, -TEMPLE - 0.05, zf], [TEMPLE + 0.05, TEMPLE + 0.05, zf], [TEMPLE + 0.05, TEMPLE + 0.05, zc], [TEMPLE + 0.05, -TEMPLE - 0.05, zc]], l, o));
    bands.push(quad(k, [[TEMPLE + 0.25, -TEMPLE - 0.25, zc], [TEMPLE + 0.25, TEMPLE + 0.25, zc], [TEMPLE + 0.25, TEMPLE + 0.25, zr], [TEMPLE + 0.25, -TEMPLE - 0.25, zr]], l, o));
  }
  for (const w of [-1.3, 1.3]) {
    const base = N.P(TEMPLE - 0.45, w, zp);
    columns.push(I.lathe({ base, profile: [[0, 0.42, 1], [0.35, 0.42, 1], [0.35, 0.33, 1], [DOOR - 0.2, 0.33, 1], [DOOR - 0.2, 0.4, 1], [DOOR, 0.4, 1]] }));
  }
  const roof = quad(0, [[TEMPLE + 0.25, -TEMPLE - 0.25, zr], [TEMPLE + 0.25, TEMPLE + 0.25, zr], [-TEMPLE - 0.25, TEMPLE + 0.25, zr], [-TEMPLE - 0.25, -TEMPLE - 0.25, zr]], N.l, [0, 0, 1]);
  const floor = quad(0, [[PLATFORM, -PLATFORM, 24], [PLATFORM, PLATFORM, 24], [-PLATFORM, PLATFORM, 24], [-PLATFORM, -PLATFORM, 24]], N.l, [0, 0, 1]);
  const zs = { zp, zw, zf, zc };
  return { plinth, walls, inside, reveals, bands, friezes, columns, roof, floor, zs };
};

export const scene = ({ ss = 3 } = {}) => {
  const T = terraces();
  const flights = range(4).map(flight);
  const rails = range(4).flatMap((k) => [balustrade(k, -1), balustrade(k, 1)]);
  const heads = [serpent(-1), serpent(1)];
  const tm = temple();

  const railFaces = rails.flatMap((b) => [b.outer, b.inner, b.cope, b.front, b.back]);
  const headStone = heads.flatMap((h) => h.stone);
  const throats = heads.flatMap((h) => h.throat);
  const templeFaces = [...tm.plinth, ...tm.walls, ...tm.inside, ...tm.reveals, ...tm.bands, ...tm.friezes, ...tm.columns, tm.roof, tm.floor];
  const pyramid = [...T.taluds.map((t) => t.f), ...T.bands.map((t) => t.f), ...T.ledges.map((t) => t.f), ...flights, ...railFaces, ...headStone, ...throats, ...templeFaces];

  const corner = (k, z) => SIDES[k].P(HALF, HALF, z);
  const cam = I.fitCamera(
    [...range(4).flatMap((k) => [corner(k, 0), SIDES[k].P(TEMPLE, TEMPLE, 30)]), N.P(END + 3, 0, 0), SIDES[3].P(END + 3, 0, 0)],
    { width: WIDTH, height: HEIGHT, pad: 44, azimuth: 132, elevation: 12 },
  );
  const R = I.unit([cam.right[0], cam.right[1], 0]);
  const F = [-R[1], R[0], 0];
  const G = 85;
  const ground = I.face({ points: [I.add(I.mul(R, -G), I.mul(F, -G)), I.add(I.mul(R, G), I.mul(F, -G)), I.add(I.mul(R, G), I.mul(F, G)), I.add(I.mul(R, -G), I.mul(F, G))], along: R, outward: [0, 0, 1] });

  const solids = [ground, ...pyramid];
  const occ = I.occlusion(solids, cam, { ss, halo: pyramid });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const all = (list, opts) => merge(list.map((s) => H(s, opts)));
  const facing = (f) => I.dot(f.normal, cam.view) > 0;

  const limestone = { base: 0.05, ambient: 0.2, bounce: 0.14 };
  const worn = { base: 0.1, ambient: 0.2, bounce: 0.12 };
  const deep = { base: 0.5, ambient: 0.1, bounce: 0.04 };
  const top = { base: 0.02, ambient: 0.5, bounce: 0 };
  const grass = { base: 0.14, ambient: 0.24, bounce: 0 };
  const [cx, cy] = cam.project([0, 0, 0]);
  const near = (s) => {
    const [x, y] = cam.project(s.p);
    return 1 - I.smoothstep(0.55, 1, Math.hypot((x - cx) / (WIDTH * 0.52), (y - cy - 20) / (HEIGHT * 0.3)));
  };

  const layers = [];
  // A faded layer keeps each sample's fade and drops the runs that fade out entirely, so the live re-ink skips them.
  const faded = (set, shape) => {
    for (const runs of set.lines) for (const run of runs) for (const s of run) s.fade = shape(s);
    return { lines: set.lines.map((runs) => runs.filter((run) => run.some((s) => s.fade > 0))).filter((runs) => runs.length) };
  };
  const layer = (id, set, material, ink, shape) => layers.push({ id, set: shape ? faded(set, shape) : set, material, ink, fades: !!shape });
  const pick = (list) => list.filter((t) => facing(t.f)).map((t) => t.f);

  layer("ground", H(ground, { spacing: 2.6, step: 2.4 }), grass, { from: 0.2, to: 0.85, width: 1 }, near);

  const taluds = pick(T.taluds);
  layer("taluds", all(taluds, { spacing: 2.1 }), limestone, { from: 0.18, to: 0.72, width: 1.05 });
  layer("taluds-x", all(taluds, { spacing: 2.7, slant: 0.55 }), limestone, { from: 0.5, to: 0.9, width: 0.8 });
  layer("bands", all(pick(T.bands), { spacing: 1.3 }), limestone, { from: 0.16, to: 0.72, width: 0.8 });
  layer("ledges", all(pick(T.ledges), { spacing: 1.3 }), worn, { from: 0.2, to: 0.8, width: 0.8 });

  const visibleFlights = flights.filter((_, k) => I.dot(SIDES[k].o, cam.view) > -0.2);
  layer("steps", merge(visibleFlights.map((f) => H(f, { lines: STEPS * 2, step: 1.2 }))), limestone, { from: 0.14, to: 0.75, width: 1.1 });

  const outers = rails.map((b) => b.outer).filter(facing);
  const otherRails = rails.flatMap((b) => [b.inner, b.front, b.back]).filter(facing);
  layer("rails", all(outers, { spacing: 1.7, step: 1.2 }), limestone, { from: 0.16, to: 0.72, width: 0.95 });
  layer("rails-x", all(outers, { spacing: 2.2, slant: 0.6, step: 1.2 }), limestone, { from: 0.45, to: 0.85, width: 0.8 });
  layer("rails-in", all(otherRails, { spacing: 1.5, step: 1.2 }), limestone, { from: 0.16, to: 0.75, width: 0.85 });
  layer("copes", all(rails.map((b) => b.cope).filter(facing), { spacing: 1.4, step: 1.2 }), limestone, { from: 0.16, to: 0.72, width: 0.8 });

  layer("heads", all(headStone, { spacing: 1.1, along: "v", step: 0.8 }), limestone, { from: 0.1, to: 0.75, width: 0.75 });
  layer("throats", all(throats.filter(facing), { spacing: 1.2, step: 0.8 }), deep, { from: 0.2, to: 0.9, width: 0.7 });

  layer("temple", all([...tm.plinth, ...tm.walls].filter((f) => !f.normal || facing(f)), { spacing: 1.6, step: 1.2 }), limestone, { from: 0.16, to: 0.72, width: 0.9 });
  layer("temple-x", all(tm.walls, { spacing: 2.1, slant: 0.55, step: 1.2 }), limestone, { from: 0.58, to: 0.95, width: 0.7 });
  layer("frieze", all([...tm.bands, ...tm.friezes].filter(facing), { spacing: 1.3, step: 1.2 }), limestone, { from: 0.16, to: 0.72, width: 0.8 });
  layer("interior", all([...tm.inside, ...tm.reveals].filter(facing), { spacing: 1.2, step: 1 }), deep, { from: 0.2, to: 0.9, width: 0.8 });
  layer("columns", all(tm.columns, { spacing: 1.2, step: 1 }), limestone, { from: 0.16, to: 0.72, width: 0.7 });
  layer("roof", all([tm.roof, tm.floor], { spacing: 1.9, step: 1.2 }), top, { from: 0.12, to: 0.7, width: 0.8 });

  const horizon = cam.project(SIDES[2].P(HALF, 0, 0))[1] + 4;
  const sky = I.ruling(cam, occ, { spacing: 2.4, halo: 8, region: (x, y) => y < horizon - 6 });
  const skyTone = (s) => {
    const edge = 1 - I.smoothstep(0.62, 1, Math.hypot((s.x - cx) / (WIDTH * 0.52), (s.y - HEIGHT * 0.42) / (HEIGHT * 0.6)));
    return (0.16 + 0.5 * I.smoothstep(horizon, 0, s.y)) * edge * I.smoothstep(horizon - 6, horizon - 80, s.y);
  };

  // The recessed panels on each terrace and on the frieze, drawn as edges inked by the light of their face: the upper
  // and leading edges, where the recess throws its shadow, heavier than the others. The eyes and fangs of the heads
  // are fixed marks.
  const lips = [];
  const sills = [];
  const panel = (n, a, b, c, d) => {
    lips.push([c, d, a].map((p) => ({ p, n })));
    sills.push([a, b, c].map((p) => ({ p, n })));
  };
  const marks = [];
  const S = (pts, width = 0.35) => marks.push(I.stroke(pts, cam, occ.sees, { width }));
  for (const t of T.taluds) {
    if (!facing(t.f)) continue;
    const { P } = SIDES[t.k];
    const z0 = t.i * STOREY + 0.45;
    const z1 = t.i * STOREY + TALUD - 0.4;
    const foot = HALF - t.i * SETBACK;
    const rAt = (z) => foot - (BATTER * (z - t.i * STOREY)) / TALUD + 0.02;
    const reach = foot - 1;
    const panels = Math.max(2, Math.round((2 * reach) / 3.1));
    for (let p = 0; p < panels; p++) {
      const a = -reach + ((2 * reach) / panels) * (p + 0.12);
      const b = -reach + ((2 * reach) / panels) * (p + 0.88);
      if (b > -W_OUT - 0.2 && a < W_OUT + 0.2) continue;
      panel(t.f.normal, P(rAt(z0), a, z0), P(rAt(z0), b, z0), P(rAt(z1), b, z1), P(rAt(z1), a, z1));
    }
  }
  for (let k = 0; k < 4; k++) {
    const { P } = SIDES[k];
    const r = TEMPLE + 0.07;
    const { zf, zc } = tm.zs;
    for (let p = 0; p < 6; p++) {
      const a = -TEMPLE + 0.4 + p * ((2 * TEMPLE - 0.8) / 6);
      const b = a + (2 * TEMPLE - 0.8) / 6 - 0.35;
      panel(tm.friezes[k].normal, P(r, a, zf + 0.3), P(r, b, zf + 0.3), P(r, b, zc - 0.3), P(r, a, zc - 0.3));
    }
  }
  for (const s of [-1, 1]) {
    const w = s * (W_IN + W_OUT) / 2;
    const { o, l } = N;
    const P = (x, y, z) => [(END + x) * o[0] + (w + y) * l[0], (END + x) * o[1] + (w + y) * l[1], z];
    const side = (x) => 0.74 * (1 - (0.12 * (x + 0.25)) / 2.5) + 0.02;
    for (const y of [-1, 1]) {
      S(range(13).map((j) => { const a = (j / 12) * I.TAU; return P(1.25 + 0.2 * Math.cos(a), y * side(1.25), 1.42 + 0.14 * Math.sin(a)); }), 0.45);
      S([P(1.95, y * side(1.95), 0.8), P(2.0, y * side(2), 0.55)], 0.5);
      S([P(1.6, y * side(1.6), 0.8), P(1.63, y * side(1.63), 0.6)], 0.4);
    }
  }

  const engraved = { ...limestone, floor: 0.35 };
  layers.push({ id: "panel-lips", set: I.outline(lips, cam, occ.sees, { lift: 0.15 }), material: engraved, ink: { from: 0, to: 1, width: 0.6 } });
  layers.push({ id: "panel-sills", set: I.outline(sills, cam, occ.sees, { lift: 0.15 }), material: engraved, ink: { from: 0, to: 1, width: 0.3 } });

  return { cam, solids, tris: I.trianglesOf(solids), layers, sky, skyTone, marks: marks.join("") };
};

/** Ink every lit layer for a solar time. A negative plate (pale ink on dark paper) inks the light, not the shade. */
export const inkAt = (S, hours, { size = 1024, negative = false } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris });
  const out = {};
  for (const l of S.layers) {
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    const plate = negative ? (s) => 1 - lit(s) : lit;
    const floor = l.material.floor && (negative ? l.material.floor * 0.45 : l.material.floor);
    const tone = floor ? (s) => Math.max(floor, plate(s)) : plate;
    out[l.id] = I.ink(l.set, l.fades ? (s) => (s.fade > 0 ? tone(s) * s.fade : 0) : tone, l.ink);
  }
  return out;
};
