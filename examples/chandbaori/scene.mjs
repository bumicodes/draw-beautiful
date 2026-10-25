import * as I from "../../kit/intaglio.mjs";

// Chand Baori, the stepwell at Abhaneri in Rajasthan, seen from its south rim looking down into the pit.
// World units are metres: x east, y north, z up, the rim at z = 0. The pit is an inverted pyramid 35 m square at the
// top and 20 m deep in 13 storeys. On the east, west and south sides each storey is a landing and a band of steps:
// rows of stepped pyramids whose stepped flanks are the double flights, the plain slope between them showing as the
// inverted triangles of the zigzag. The north side is a pavilion of four stages stepping out over the well as it
// descends, galleries and niched walls in turn, two balconies, and a pillared hall on the rim. Green water stands
// at the bottom. The sun follows Abhaneri's sky (27° N) on 24 October, and the rim's shadow and the shadows of every
// step sweep down and across the terraces.

export const WIDTH = 620;
export const HEIGHT = 760;

export const LATITUDE = 27.01;
export const DECLINATION = -11.6;

const H = 17.5;
const TIERS = 13;
const RISE = 20 / TIERS;
const RUN = 1.1;
const LANDING = 0.32;
const STEPS = 7;
const PERIOD = 2.1;
const R = (RUN - LANDING) / STEPS;
const h = RISE / STEPS;
const WATER = -19.25;
const EYE = [2.6, -24, 15];

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
  return { altitude: alt / I.deg, bearing, light: I.sunDirection(bearing, alt / I.deg) };
};

// The four stages of the pavilion: stage s holds tiers 3s..3s+2 and its front stands where the pit's side meets
// the bottom of the stage, so each stage projects over the one below it.
const STAGES = range(4).map((s) => ({ s, zt: -3 * s * RISE, zb: -(3 * s + 3) * RISE, F: H - (3 * s + 3) * RUN }));
const stageOf = (k) => STAGES[Math.min(3, Math.floor(k / 3))];
/** The pit's half-width at height z, through the outer edges of the landings. */
const X = (z) => H + (z / RISE) * RUN;

// A side wall: origin on the rim's middle, N inward and level, T along the wall. A point is (t, d, z): d inward.
const WALLS = {
  south: { O: [0, -H, 0], N: [0, 1, 0], T: [1, 0, 0], north: false },
  east: { O: [H, 0, 0], N: [-1, 0, 0], T: [0, 1, 0], north: true },
  west: { O: [-H, 0, 0], N: [1, 0, 0], T: [0, 1, 0], north: true },
  north: { O: [0, H, 0], N: [0, -1, 0], T: [1, 0, 0], north: false },
};
const at = (w, t, d, z) => [w.O[0] + w.N[0] * d + w.T[0] * t, w.O[1] + w.N[1] * d + w.T[1] * t, z];
const local = (w, p) => {
  const q = I.sub(p, w.O);
  return [I.dot(q, w.T), I.dot(q, w.N), p[2]];
};
/** The wall's reach along T at depth d in tier k: mitred to its neighbours, stopped by the pavilion on the north. */
const reach = (w, k, d) => [-(H - d), w.north ? Math.min(H - d, stageOf(k).F) : H - d];

/** The polygon of the wall's surface between depths d0 (at z0) and d1 (at z1) in tier k, as 3D points. */
const strip = (w, k, d0, z0, d1, z1) => {
  const zAt = (d) => (d1 === d0 ? z0 : lerp(z0, z1, (d - d0) / (d1 - d0)));
  const pts = [];
  const [s0] = reach(w, k, d0);
  const [s1] = reach(w, k, d1);
  pts.push(at(w, s0, d0, z0), at(w, s1, d1, z1));
  const [, n1] = reach(w, k, d1);
  pts.push(at(w, n1, d1, z1));
  if (w.north) {
    const kink = H - stageOf(k).F;
    if (kink > d0 && kink < d1) pts.push(at(w, stageOf(k).F, kink, zAt(kink)));
  }
  const [, n0] = reach(w, k, d0);
  pts.push(at(w, n0, d0, z0));
  return pts.filter((p, i, a) => i === 0 || Math.hypot(...I.sub(p, a[i - 1])) > 1e-6);
};

/** The centres of the stepped pyramids in tier k of a wall, spaced PERIOD apart and centred on the band. */
const teethOf = (w, k) => {
  const dm = k * RUN + LANDING + (RUN - LANDING) / 2;
  const [t0, t1] = reach(w, k, dm);
  const m = Math.floor((t1 - t0) / PERIOD);
  return range(m).map((j) => (t0 + t1) / 2 + (j - (m - 1) / 2) * PERIOD);
};

/** One side wall: landings, the slopes between the pyramids, and every step of every pyramid as tread, riser, ends. */
const wallOf = (w, { bars = true } = {}) => {
  const landings = [];
  const slopes = [];
  const planes = [];
  const treads = [];
  const risers = [];
  const ends = [];
  const teeth = [];
  for (let k = 0; k < TIERS; k++) {
    const zk = -k * RISE;
    const a = k * RUN + LANDING;
    const b = (k + 1) * RUN;
    landings.push(I.face({ points: strip(w, k, k * RUN, zk, a, zk), along: w.T, outward: [0, 0, 1] }));
    const cs = bars ? teethOf(w, k) : [];
    teeth.push(cs);
    const slope = I.face({ points: strip(w, k, a, zk, b, zk - RISE), along: I.add(I.mul(w.N, b - a), [0, 0, -RISE]), outward: I.add(w.N, [0, 0, 1]) });
    // Hatch the slope only between the pyramids; the whole slope still hides and casts.
    const inPyramid = (p) => {
      const [t, d] = local(w, p);
      const i = Math.ceil(((d - a) / (b - a)) * STEPS - 1e-9);
      const half = (Math.max(1, i) / STEPS) * (PERIOD / 2);
      return cs.some((c) => Math.abs(t - c) < half);
    };
    planes.push(slope);
    slopes.push({ ...slope, mask: (u, v) => slope.mask(u, v) && !inPyramid(slope.point(u, v)[0]) });
    for (let i = 1; i <= STEPS; i++) {
      const d0 = a + (i - 1) * R;
      const d1 = a + i * R;
      const zt = zk - (i - 1) * h;
      const [lo, hi] = reach(w, k, d1);
      const half = (i / STEPS) * (PERIOD / 2);
      for (const c of cs) {
        const t0 = Math.max(c - half, lo);
        const t1 = Math.min(c + half, hi);
        if (t1 - t0 < 0.05) continue;
        const P = (t, d, z) => at(w, t, d, z);
        treads.push(I.face({ points: [P(t0, d0, zt), P(t1, d0, zt), P(t1, d1, zt), P(t0, d1, zt)], along: w.T, outward: [0, 0, 1] }));
        risers.push(I.face({ points: [P(t0, d1, zt), P(t1, d1, zt), P(t1, d1, zt - h), P(t0, d1, zt - h)], along: w.T, outward: w.N }));
        if (i < STEPS) {
          if (t0 > lo) ends.push(I.face({ points: [P(t0, d0, zt), P(t0, d1, zt), P(t0, d1, zt - h)], along: [0, 0, 1], outward: I.mul(w.T, -1) }));
          if (t1 < hi) ends.push(I.face({ points: [P(t1, d0, zt), P(t1, d1, zt), P(t1, d1, zt - h)], along: [0, 0, 1], outward: w.T }));
        }
      }
    }
  }
  return { w, landings, slopes, planes, treads, risers, ends, teeth };
};

/**
 * The shadow each step throws on the tread below it, exactly: the riser behind a tread is h tall, so with the sun
 * behind the wall its shadow reaches h·(−L·N)/L_z across the tread. Where a pyramid narrows, the outer end of each
 * tread has no riser behind it and stays lit. The shadow map, which holds only the big casters, does the rest.
 */
const stepShadow = (wall, L) => {
  const { w, teeth } = wall;
  const ln = I.dot(L, w.N);
  if (ln >= 0 || L[2] <= 0) return () => 1;
  const throw_ = (h * -ln) / L[2];
  return (p, n) => {
    if (n[2] < 0.5) return 1;
    const [t, d, z] = local(w, p);
    const m = Math.round(-z / h);
    const k = Math.floor(m / STEPS);
    const i = m - k * STEPS + 1;
    if (k <= 0 && i === 1) return 1;
    let back;
    if (i === 1) {
      const cs = teeth[k - 1] ?? [];
      if (!cs.some((c) => Math.abs(t - c) <= PERIOD / 2)) return 1;
      back = k * RUN;
    } else {
      const cs = teeth[k] ?? [];
      const half = ((i - 1) / STEPS) * (PERIOD / 2);
      if (!cs.some((c) => Math.abs(t - c) < half)) return 1;
      back = k * RUN + LANDING + (i - 1) * R;
    }
    const x = d - back;
    return I.smoothstep(throw_ - 0.012, throw_ + 0.012, x);
  };
};

// The pavilion.

const quad = (points, along, outward) => I.face({ points, along, outward });
const box = (min, max, capAlong = [1, 0, 0]) => I.box({ min, max, capAlong });
const SOUTH = [0, -1, 0];
const UP = [0, 0, 1];
const EAST = [1, 0, 0];

/** Bay centres across a stage, roughly `width` apart, kept inside its narrowest (bottom) width. */
const bays = (zb, width) => {
  const X0 = X(zb) - 0.4;
  const n = Math.max(1, Math.round((2 * X0) / width));
  return range(n).map((j) => -X0 + ((j + 0.5) * 2 * X0) / n);
};

const arched = (cs, half, sill, spring) => (x, z) => cs.some((c) => Math.abs(x - c) < half && z > sill && z < spring + Math.sqrt(Math.max(0, half * half - (x - c) ** 2)));

/** An opening's jambs and sill, `depth` deep behind the façade at y = F, and optionally its back. */
const opening = (F, c, half, sill, spring, depth, back) => {
  const out = [
    quad([[c - half, F, sill], [c - half, F + depth, sill], [c - half, F + depth, spring], [c - half, F, spring]], UP, EAST),
    quad([[c + half, F, sill], [c + half, F + depth, sill], [c + half, F + depth, spring], [c + half, F, spring]], UP, I.mul(EAST, -1)),
    quad([[c - half, F, sill], [c + half, F, sill], [c + half, F + depth, sill], [c - half, F + depth, sill]], EAST, UP),
  ];
  if (back) out.push(quad([[c - half - 0.1, F + depth, sill], [c + half + 0.1, F + depth, sill], [c + half + 0.1, F + depth, spring + half + 0.1], [c - half - 0.1, F + depth, spring + half + 0.1]], EAST, SOUTH));
  return out;
};

const dome = (base, r, tall) =>
  I.lathe({ base, profile: [[0, r * 1.06, 1], [0.12 * tall, r * 1.06, 1], [0.14 * tall, r, 1], [0.4 * tall, r * 0.94], [0.68 * tall, r * 0.74], [0.88 * tall, r * 0.42], [0.97 * tall, r * 0.14], [tall, 0.05, 1]] });

const stageParts = ({ s, zt, zb, F }, next) => {
  const front = [];
  const inside = [];
  const reveals = [];
  const eaves = [];
  const roofs = [];
  const posts = [];
  const domes = [];
  const arches = [];
  const top = s === 0 ? zt : zt - 0.38;
  const gallery = s % 2 === 0;
  const cs = bays(zb, gallery ? 2.6 : 2.4);
  const half = gallery ? 0.86 : 0.52;
  const sill = gallery ? zb + 0.85 : zb + 1.35;
  const spring = gallery ? top - 2.05 : top - 1.75;
  const open = arched(cs, half, sill, spring);
  const facade = (nu, nv) =>
    I.patch({
      at: (u, v) => {
        const z = lerp(zb, top, v);
        return [lerp(-X(z), X(z), u), F, z];
      },
      mask: (u, v) => {
        const z = lerp(zb, top, v);
        return !open(lerp(-X(z), X(z), u), z);
      },
      nu,
      nv,
    });
  // A fine grid for the depth buffer, so the lines stop cleanly on each arch, and a coarse one for the shadow map.
  front.push({ ...facade(cs.length * 40, 110), coarse: facade(cs.length * 10, 28) });
  const deep = gallery ? 2.4 : 0.5;
  for (const c of cs) {
    reveals.push(...opening(F, c, half, sill, spring, gallery ? 0.55 : deep, !gallery));
    arches.push(range(17).map((j) => {
      const a = Math.PI * (j / 16);
      return [c - (half + 0.18) * Math.cos(a), F - 0.03, spring + (half + 0.18) * Math.sin(a)];
    }));
  }
  if (gallery) {
    const yb = F + deep;
    inside.push(
      quad([[-X(zb), yb, zb], [X(zb), yb, zb], [X(top), yb, top], [-X(top), yb, top]], EAST, SOUTH),
      quad([[-X(zb), F, zb], [X(zb), F, zb], [X(zb), yb, zb], [-X(zb), yb, zb]], EAST, UP),
    );
  }
  if (s > 0) {
    // The chajja: a sloping stone eave over the stage, its thin front edge, and the terrace above it.
    const xt = X(zt);
    eaves.push(
      quad([[-xt, F, zt], [xt, F, zt], [xt, F - 0.95, zt - 0.3], [-xt, F - 0.95, zt - 0.3]], EAST, [0, -0.3, 1]),
      quad([[-xt, F - 0.95, zt - 0.3], [xt, F - 0.95, zt - 0.3], [xt, F - 0.95, zt - 0.44], [-xt, F - 0.95, zt - 0.44]], EAST, SOUTH),
    );
  }
  // The terrace on top of the stage, in front of the stage above it (or the rim, for the top stage).
  const behind = s === 0 ? H : STAGES[s - 1].F;
  roofs.push(quad([[-X(zt), F, zt], [X(zt), F, zt], [X(zt), behind, zt], [-X(zt), behind, zt]], EAST, UP));
  if (s === 1) {
    // Two jharokha balconies, each on a corbelled slab with four posts, a roof slab and a small dome.
    for (const c of [cs[1], cs[cs.length - 2]]) {
      const z0 = zb + 1.0;
      roofs.push(...box([c - 1.15, F - 1.05, z0 - 0.35], [c + 1.15, F, z0]));
      for (const dx of [-0.98, 0.98]) for (const y of [F - 0.92, F - 0.12]) posts.push(...box([c + dx - 0.09, y - 0.09, z0], [c + dx + 0.09, y + 0.09, z0 + 1.75]));
      roofs.push(...box([c - 1.3, F - 1.2, z0 + 1.75], [c + 1.3, F + 0.05, z0 + 2.0]));
      domes.push(dome([c, F - 0.58, z0 + 2.0], 0.78, 1.25));
    }
  }
  if (s === 3) {
    // The last stage stands on the water: its foot is the wall that runs on down below the surface.
    inside.push(quad([[-X(zb), F, zb], [X(zb), F, zb], [X(WATER - 0.6), F, WATER - 0.6], [-X(WATER - 0.6), F, WATER - 0.6]], EAST, SOUTH));
  }
  return { front, inside, reveals, eaves, roofs, posts, domes, arches };
};

/** The pillared hall on the north rim with three domes on its roof. */
const hallParts = () => {
  const y0 = STAGES[0].F + 0.6;
  const y1 = 19.4;
  const xw = 8.8;
  const tall = 3.3;
  const posts = [];
  const cols = range(9).map((j) => -xw + 0.3 + (j * (2 * xw - 0.6)) / 8);
  for (const x of cols) posts.push(...box([x - 0.19, y0 - 0.19, 0], [x + 0.19, y0 + 0.19, tall]));
  const inside = [
    quad([[-xw, y1, 0], [xw, y1, 0], [xw, y1, tall], [-xw, y1, tall]], EAST, SOUTH),
    quad([[-xw, y0, 0], [-xw, y1, 0], [-xw, y1, tall], [-xw, y0, tall]], [0, 1, 0], EAST),
    quad([[xw, y0, 0], [xw, y1, 0], [xw, y1, tall], [xw, y0, tall]], [0, 1, 0], I.mul(EAST, -1)),
  ];
  const roofs = [...box([-xw - 0.4, y0 - 0.6, tall], [xw + 0.4, y1 + 0.3, tall + 0.42])];
  const eaves = [quad([[-xw - 0.4, y0 - 0.6, tall + 0.05], [xw + 0.4, y0 - 0.6, tall + 0.05], [xw + 1.0, y0 - 1.4, tall - 0.25], [-xw - 1.0, y0 - 1.4, tall - 0.25]], EAST, [0, -0.3, 1])];
  const zr = tall + 0.42;
  const domes = [dome([0, (y0 + y1) / 2, zr], 2.0, 3.0), dome([-5.6, (y0 + y1) / 2, zr], 1.35, 2.1), dome([5.6, (y0 + y1) / 2, zr], 1.35, 2.1)];
  return { posts, inside, roofs, eaves, domes, top: [0, (y0 + y1) / 2, zr + 3.2] };
};

/** The courtyard round the pit: a level patch whose lines are spaced evenly on screen in perspective. */
const groundOf = () => {
  const [ya, yb] = [-19.6, 25];
  const n0 = 1 / (ya - EYE[1]);
  const n1 = 1 / (yb - EYE[1]);
  const yAt = (v) => EYE[1] + 1 / lerp(n0, n1, v);
  const at = (u, v) => [lerp(-H - 6, H + 6, u), yAt(v), 0];
  const hole = ([x, y]) => Math.abs(x) < H && y > -H && y < STAGES[0].F;
  const draw = I.patch({ at, nu: 4, nv: 4, mask: (u, v) => !hole(at(u, v)) });
  const F0 = STAGES[0].F;
  const solids = [
    quad([[-44, ya, 0], [44, ya, 0], [44, -H, 0], [-44, -H, 0]], EAST, UP),
    quad([[-44, F0, 0], [44, F0, 0], [44, yb, 0], [-44, yb, 0]], EAST, UP),
    quad([[-44, -H, 0], [-H, -H, 0], [-H, F0, 0], [-44, F0, 0]], EAST, UP),
    quad([[H, -H, 0], [44, -H, 0], [44, F0, 0], [H, F0, 0]], EAST, UP),
  ];
  // Only a ring round the pit casts into it; the far courtyard would only stretch the shadow map.
  const R0 = H + 9;
  const casters = [
    quad([[-R0, -R0, 0], [R0, -R0, 0], [R0, -H, 0], [-R0, -H, 0]], EAST, UP),
    quad([[-R0, F0, 0], [R0, F0, 0], [R0, R0, 0], [-R0, R0, 0]], EAST, UP),
    quad([[-R0, -H, 0], [-H, -H, 0], [-H, F0, 0], [-R0, F0, 0]], EAST, UP),
    quad([[H, -H, 0], [R0, -H, 0], [R0, F0, 0], [H, F0, 0]], EAST, UP),
  ];
  return { draw, solids, casters };
};

export const scene = ({ ss = 3 } = {}) => {
  const hall = hallParts();
  const cam = I.fitCamera(
    [[-13, 0, 0], [13, 0, 0], hall.top, [0, -H, 0], [0, -H + 3, -3]],
    { width: WIDTH, height: HEIGHT, pad: 30, eye: EYE, target: [-0.4, 1, -14] },
  );

  const sides = { east: wallOf(WALLS.east), west: wallOf(WALLS.west), south: wallOf(WALLS.south, { bars: false }) };
  // Below the pavilion's last stage the north side runs plain into the water.
  const north = [
    I.face({ points: strip(WALLS.north, 12, 12 * RUN, -12 * RISE, 12 * RUN + LANDING, -12 * RISE), along: EAST, outward: UP }),
    I.face({ points: strip(WALLS.north, 12, 12 * RUN + LANDING, -12 * RISE, 13 * RUN, -13 * RISE), along: EAST, outward: [0, -1, 1] }),
  ];
  const stages = STAGES.map((st) => stageParts(st));
  const pav = (key) => [...stages.flatMap((p) => p[key] ?? []), ...(hall[key] ?? [])];
  const pavilion = ["front", "inside", "reveals", "eaves", "roofs", "posts", "domes"].flatMap(pav);

  const wx = X(WATER) + 0.3;
  const water = I.face({ points: [[-wx, -wx, WATER], [wx, -wx, WATER], [wx, wx, WATER], [-wx, wx, WATER]], along: [cam.right[0], cam.right[1], 0], outward: UP });
  const ground = groundOf();

  const walls = Object.values(sides).flatMap((s) => [...s.landings, ...s.slopes, ...s.treads, ...s.risers, ...s.ends]);
  const well = [...walls, ...north, ...pavilion, water];
  const solids = [...ground.solids, ...well];
  const occ = I.occlusion(solids, cam, { ss, halo: [...pavilion, ...walls] });
  const Hx = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const all = (list, opts) => merge(list.map((s) => Hx(s, opts)));

  const stone = { base: 0.07, ambient: 0.2, bounce: 0.13 };
  const worn = { base: 0.3, ambient: 0.2, bounce: 0.1 };
  // Treads face the open sky, so even in shade they stay lighter than the risers between them.
  const sky = { base: 0.05, ambient: 0.42, bounce: 0.1 };
  const deep = { base: 0.42, ambient: 0.12, bounce: 0.06 };
  const earth = { base: 0.04, ambient: 0.34, bounce: 0 };
  const pond = { base: 0.52, ambient: 0.3, bounce: 0 };

  // The courtyard shows as a band round the rim that fades into the paper a few metres out.
  const fade = (s) => {
    const out = Math.max(Math.abs(s.p[0]) - H, s.p[1] < 0 ? -s.p[1] - H : s.p[1] - 19.4, 0);
    return 1 - I.smoothstep(0.8, 4.5, out);
  };

  // Everything tapers out toward the sides and foot of the picture, so the walls cut by the frame fade into the paper.
  const edge = (s) => {
    const [x, y] = cam.project(s.p);
    return I.smoothstep(0, 46, Math.min(x, WIDTH - x)) * I.smoothstep(0, 40, HEIGHT - y);
  };
  const layers = [];
  const layer = (id, set, material, ink, extra = {}) => layers.push({ id, set, material, ink, shape: edge, ...extra });

  layer("ground", Hx(ground.draw, { spacing: 2.2, step: 4 }), earth, { from: 0.32, to: 0.9, width: 1 }, { shape: (s) => fade(s) * edge(s), dim: 0.45 });
  // The south wall drops away below the eye, a few pixels to a storey, too small for single steps: it is built as
  // its landings and slopes, one line on each landing and the slopes ruled along the wall.
  const south = sides.south;
  layer("south-landings", all(south.landings, { lines: 1, step: 1.4 }), stone, { from: 0.1, to: 0.8, width: 0.9 }, { steps: "south" });
  layer("south-slopes", all(south.planes, { spacing: 1.9, step: 1.4 }), worn, { from: 0.25, to: 0.9, width: 0.8 });
  for (const key of ["east", "west"]) {
    const s = sides[key];
    const steps = key;
    layer(`${key}-landings`, all(s.landings, { spacing: 1.6, step: 1.4 }), stone, { from: 0.3, to: 0.8, width: 0.85 }, { steps, dark: { from: 0.1, to: 0.75, width: 0.85 } });
    layer(`${key}-slopes`, all(s.slopes, { along: "v", spacing: 1.8, step: 1.4 }), worn, { from: 0.16, to: 0.85, width: 1 }, { dark: { from: 0.08, to: 0.8, width: 0.9 } });
    layer(`${key}-treads`, all(s.treads, { spacing: 1.6, step: 1.4 }), sky, { from: 0.45, to: 0.85, width: 0.8 }, { steps, dark: { from: 0.12, to: 0.8, width: 0.85 } });
    layer(`${key}-risers`, all(s.risers, { spacing: 1.6, step: 1.4 }), stone, { from: 0.28, to: 0.78, width: 0.95 });
    layer(`${key}-ends`, all(s.ends, { spacing: 1.3, step: 1 }), stone, { from: 0.16, to: 0.8, width: 0.75 });
  }
  layer("north", all(north, { spacing: 1.6 }), worn, { from: 0.2, to: 0.8, width: 0.9 });
  layer("front", all(pav("front"), { spacing: 1.7, step: 1.2 }), stone, { from: 0.15, to: 0.72, width: 0.95 });
  layer("front-x", all(pav("front"), { spacing: 2.3, slant: 0.5, step: 1.2 }), stone, { from: 0.6, to: 0.95, width: 0.75 });
  layer("reveals", all(pav("reveals"), { spacing: 1.3, step: 1 }), stone, { from: 0.16, to: 0.8, width: 0.8 });
  layer("inside", all(pav("inside"), { spacing: 1.5, step: 1.2 }), deep, { from: 0.2, to: 0.85, width: 0.95 });
  layer("inside-x", all(pav("inside"), { spacing: 2.1, slant: 0.55, step: 1.2 }), deep, { from: 0.6, to: 0.97, width: 0.75 });
  layer("eaves", all(pav("eaves"), { spacing: 1.3, step: 1.2 }), stone, { from: 0.16, to: 0.75, width: 0.8 });
  layer("roofs", all(pav("roofs"), { spacing: 1.6, step: 1.2 }), stone, { from: 0.18, to: 0.78, width: 0.85 });
  layer("posts", all(pav("posts"), { along: "v", spacing: 1.2, step: 1 }), stone, { from: 0.14, to: 0.75, width: 0.7 });
  layer("domes", all(pav("domes"), { spacing: 1.4, step: 1 }), stone, { from: 0.14, to: 0.72, width: 0.85 });
  layer("domes-x", all(pav("domes"), { spacing: 1.9, slant: 0.3, step: 1 }), stone, { from: 0.58, to: 0.95, width: 0.7 });
  const still = (s) => {
    const e = Math.max(Math.abs(s.p[0]), Math.abs(s.p[1])) / wx;
    return 0.85 + 0.2 * I.smoothstep(0.6, 1, e);
  };
  layer("water", Hx(water, { spacing: 1.45, step: 1.4 }), pond, { from: 0.18, to: 0.9, width: 0.85 }, { shape: (s) => still(s) * edge(s), cls: "intaglio-ink-2", dark: { from: 0.02, to: 0.6, width: 0.8 } });

  const marks = [];
  const S = (pts, width) => marks.push(I.stroke(pts, cam, occ.sees, { width }));
  for (const st of stages) for (const a of st.arches) S(a, 0.32);
  S([[-wx, -wx, WATER + 0.01], [wx, -wx, WATER + 0.01], [wx, wx, WATER + 0.01], [-wx, wx, WATER + 0.01], [-wx, -wx, WATER + 0.01]], 0.45);

  const tris = I.trianglesOf([...ground.casters, ...Object.values(sides).flatMap((s) => [...s.landings, ...s.slopes]), ...north, ...pavilion.map((f) => f.coarse ?? f)]);
  return { cam, sides, solids, tris, layers, marks: marks.join("") };
};

/** Ink every lit layer for a solar time. A negative plate (pale ink on dark paper) inks the light, not the shade. */
export const inkAt = (S, hours, { size = 1024, negative = false } = {}) => {
  const { light } = sunAt(hours);
  const L = I.unit(light);
  const map = I.shadowMap(null, light, { size, tris: S.tris, soft: 1 });
  const out = {};
  for (const l of S.layers) {
    const stepLit = l.steps ? stepShadow(S.sides[l.steps], L) : null;
    const shadow = stepLit ? { lit: (p, n) => map.lit(p, n) * stepLit(p, n) } : map;
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    // The negative plate inks the light; layers that must still show their form in shade carry their own range.
    const tone = negative ? (s) => (1 - lit(s)) * (l.dim ?? 1) : lit;
    out[l.id] = I.ink(l.set, l.shape ? (s) => tone(s) * l.shape(s) : tone, negative ? (l.dark ?? l.ink) : l.ink);
  }
  return out;
};
