import * as I from "../../kit/intaglio.mjs";

// The Colosseum as it stands, seen from the west and above on 21 April, the day Rome keeps as its birthday.
// World units are metres: x east, y north, z up, the long axis east-west. The rings are offset curves of the
// outer ellipse (188 × 156 m) and the 80 bays are spaced evenly along its perimeter. The outer ring survives on
// the north side only, stepping down at its broken ends; to the south the second ring stands open and broken,
// and the arena floor is gone except at its east end, so the walls of the hypogeum show.

export const WIDTH = 760;
export const HEIGHT = 560;

export const LATITUDE = 41.89;
export const DECLINATION = 11.9;

const A = 94;
const B = 78;
const BAYS = 80;
const LEVELS = [0, 10.5, 22.4, 34, 48.5];
const OUTER = [[4.5, 36.5], [5.5, 35.5], [6.5, 34.5], [7.5, 33.5]].map(([lo, hi]) => [lo / BAYS, hi / BAYS]);
const STOREYS = [
  { half: 2.1, sill: -1, spring: 5 },
  { half: 2, sill: 12, spring: 16.6 },
  { half: 2, sill: 23.9, spring: 28.4 },
];
const WINDOW = { half: 0.7, sill: 38.3, top: 40.6 };
const R1 = [0, 2.4];
const R2 = [7.4, 9.4];
const R3 = [14, 16];
const ARENA = 51;
const PIT = -6;

const DEEP = { base: 0.34, ambient: 0.12, bounce: 0.06 };

const frac = (x) => x - Math.floor(x);
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

const SAMPLES = 2048;
const arc = (() => {
  const s = new Float64Array(SAMPLES + 1);
  for (let i = 1; i <= SAMPLES; i++) {
    const a = ((i - 1) / SAMPLES) * I.TAU;
    const b = (i / SAMPLES) * I.TAU;
    s[i] = s[i - 1] + Math.hypot(A * (Math.cos(b) - Math.cos(a)), B * (Math.sin(b) - Math.sin(a)));
  }
  return s;
})();
const BAY = arc[SAMPLES] / BAYS;

/** The ellipse angle at a fraction s of the outer perimeter, counted counterclockwise from the east end. */
const thetaAt = (s) => {
  const target = frac(s) * arc[SAMPLES];
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (arc[m] <= target) lo = m;
    else hi = m;
  }
  return ((lo + (target - arc[lo]) / (arc[hi] - arc[lo])) / SAMPLES) * I.TAU;
};

/** The outer ellipse at s with its outward normal n and counterclockwise tangent t. */
const frameAt = (s) => {
  const th = thetaAt(s);
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const n = I.unit([c / A, sn / B, 0]);
  return { th, e: [A * c, B * sn, 0], n, t: [-n[1], n[0], 0] };
};

/** A point d metres inside the outer face at s, at height z. */
const ring = (s, d, z) => {
  const { e, n } = frameAt(s);
  return [e[0] - d * n[0], e[1] - d * n[1], z];
};

/** Metres along the ring d from the centre of the nearest bay (an arch's axis) at s. */
const across = (s, d) => {
  const th = thetaAt(s);
  const q = A * A * Math.sin(th) ** 2 + B * B * Math.cos(th) ** 2;
  return (frac(s * BAYS + 0.5) - 0.5) * BAY * (1 - (d * A * B) / q ** 1.5);
};

const arched = ({ half, sill, spring }) => (t, z) => Math.abs(t) < half && z > sill && z < spring + Math.sqrt(half * half - t * t);
const windowed = (t, z, s) => Math.round(s * BAYS) % 2 === 0 && Math.abs(t) < WINDOW.half && z > WINDOW.sill && z < WINDOW.top;

/** How far s lies outside the span [lo, hi], in bays, going round the short way. */
const outside = (s, [lo, hi]) => {
  const x = frac(s - lo);
  const w = hi - lo;
  return x <= w ? 0 : Math.min(x - w, 1 - x) * BAYS;
};

const wave = (s, terms) => terms.reduce((sum, [a, k, p]) => sum + a * Math.sin(I.TAU * s * k + p), 0);
const hash = (i) => frac(Math.sin(i * 12.9898 + 78.233) * 43758.5453);

/** Masonry breaks by the bay: a height per bay with short falls between, over a slow swell. */
const broken = (s, seed, amp) => {
  const b = frac(s) * BAYS;
  const i = Math.floor(b);
  const h = (k) => hash(((k % BAYS) + BAYS) % BAYS + seed) - 0.5;
  return amp * lerp(h(i), h(i + 1), I.smoothstep(0.7, 0.95, b - i));
};

/** The broken top of the third ring and the cavea: whole under the standing outer wall, ruined to the south. */
const capAt = (s) => {
  const w = I.smoothstep(0, 3, outside(s, OUTER[2]));
  return lerp(LEVELS[3], 27 + wave(s, [[2.2, 3, 1.1], [1.2, 7, 0.3]]) + broken(s, 0, 4), w);
};
const top2At = (s) => {
  const w = I.smoothstep(0, 3, outside(s, OUTER[2]));
  return lerp(LEVELS[3], 21 + wave(s, [[2, 4, 0.4], [1.2, 9, 1.9]]) + broken(s, 40, 5), w);
};

/** The seating slope in section: [d, z] corners from the third ring down to the arena wall. */
const CAVEA = [
  [[16, 34], [27, 25]],
  [[27, 23], [40, 13]],
  [[40, 11], [48.5, 6]],
  [[48.5, 4.5], [ARENA, 4.5]],
];
const profileAt = (d) => {
  const seg = CAVEA.find(([[d0], [d1]]) => d >= d0 && d <= d1) ?? CAVEA[CAVEA.length - 1];
  const [[d0, z0], [d1, z1]] = seg;
  return lerp(z0, z1, (d - d0) / (d1 - d0));
};

const wall = ({ d, from, to, z0, z1, side = 1, open, top, nu = 3, nv = 0.4 }) => {
  const s = (u) => lerp(from, to, u);
  const z = (v) => lerp(z0, z1, v);
  const mask = open || top ? (u, v) => !(top && z(v) > top(s(u))) && !(open && open(across(s(u), d), z(v), s(u))) : undefined;
  return I.patch({ at: (u, v) => ring(s(u), d, z(v)), side, mask, nu: Math.ceil((to - from) * BAYS * nu), nv: Math.ceil((z1 - z0) * nv) });
};

const ledge = ({ from, to, d0, d1, z, mask }) =>
  I.patch({
    at: (u, v) => {
      const s = lerp(from, to, u);
      return ring(s, lerp(d0, d1, v), typeof z === "function" ? z(s) : z);
    },
    mask: mask && ((u, v) => mask(lerp(from, to, u), lerp(d0, d1, v))),
    nu: Math.ceil((to - from) * BAYS * 3),
    nv: 1,
  });

/** A straight-through opening's reveal, from the outer face d0 to d1: the jambs and soffit round the arch. */
const reveal = (s, d0, d1, { half, sill, spring }, top) => {
  const { e, n, t } = frameAt(s);
  const jamb = spring - Math.max(sill, 0);
  const total = 2 * jamb + Math.PI * half;
  const outline = (u) => {
    const l = u * total;
    if (l < jamb) return [-half, Math.max(sill, 0) + l];
    if (l > total - jamb) return [half, Math.max(sill, 0) + (total - l)];
    const a = Math.PI * (1 - (l - jamb) / (Math.PI * half));
    return [half * Math.cos(a), spring + half * Math.sin(a)];
  };
  const at = (u, v) => {
    const [x, z] = outline(u);
    const d = lerp(d0, d1, v);
    return [e[0] - d * n[0] + x * t[0], e[1] - d * n[1] + x * t[1], z];
  };
  return I.patch({ at, side: -1, nu: 28, nv: 2, mask: top && ((u) => outline(u)[1] < top(s)) });
};

const sillOf = (s, d0, d1, { half, sill }) => {
  const { e, n, t } = frameAt(s);
  const p = (x, d) => [e[0] - d * n[0] + x * t[0], e[1] - d * n[1] + x * t[1], sill];
  return I.face({ points: [p(-half, d0), p(half, d0), p(half, d1), p(-half, d1)], along: t, outward: [0, 0, 1] });
};

/** A half column engaged on the outer face at s, from z0 to z1. */
const column = (s, r, z0, z1) => {
  const { e, n, t } = frameAt(s);
  return I.patch({
    at: (u, v) => {
      const a = (u - 0.5) * Math.PI;
      const x = r * Math.sin(a);
      const y = r * Math.cos(a);
      return [e[0] + y * n[0] + x * t[0], e[1] + y * n[1] + x * t[1], lerp(z0, z1, v)];
    },
    nu: 8,
    nv: 1,
  });
};

/** A flat pilaster on the attic at s: its two sides and its face as one strip. */
const pilaster = (s, w, depth, z0, z1) => {
  const { e, n, t } = frameAt(s);
  const total = 2 * depth + w;
  return I.patch({
    at: (u, v) => {
      const l = u * total;
      const [x, y] = l < depth ? [-w / 2, l] : l > depth + w ? [w / 2, total - l] : [l - depth - w / 2, depth];
      return [e[0] + y * n[0] + x * t[0], e[1] + y * n[1] + x * t[1], lerp(z0, z1, v)];
    },
    nu: 9,
    nv: 1,
  });
};

/** A radial wall standing proud of the cavea at s, from d0 to d1: [one side, the other side, its top]. */
const radial = (s, d0, d1, tall, thick) => {
  const { e, n, t } = frameAt(s);
  const at = (d, x, z) => [e[0] - d * n[0] + x * t[0], e[1] - d * n[1] + x * t[1], z];
  const base = (d) => profileAt(d) - 0.4;
  const crest = (d) => profileAt(d) + tall;
  const keep = (z) => z <= capAt(s);
  const sideOf = (x, side) =>
    I.patch({ at: (u, v) => at(lerp(d0, d1, u), x, lerp(base(lerp(d0, d1, u)), crest(lerp(d0, d1, u)), v)), side, nu: 6, nv: 2, mask: (u, v) => keep(lerp(base(lerp(d0, d1, u)), crest(lerp(d0, d1, u)), v)) });
  const top = I.patch({ at: (u, v) => at(lerp(d0, d1, u), lerp(-thick / 2, thick / 2, v), crest(lerp(d0, d1, u))), side: -1, nu: 6, nv: 1, mask: (u) => keep(crest(lerp(d0, d1, u))) });
  return [sideOf(thick / 2, 1), sideOf(-thick / 2, -1), top];
};

/** The plain around the building: a square of ground with the arena cut out, its lines level on screen. */
const groundOf = (cam, half, hole) => {
  const R = I.unit([cam.right[0], cam.right[1], 0]);
  const F = [-R[1], R[0], 0];
  const at = (u, v) => I.add(I.mul(R, lerp(-half, half, u)), I.mul(F, lerp(-half, half, v)));
  const inside = ([x, y]) => (x / hole[0]) ** 2 + (y / hole[1]) ** 2 < 1;
  const triangles = () => {
    const K = 144;
    const tris = [];
    const rim = (k) => {
      const a = (k / K) * I.TAU;
      return [hole[0] * Math.cos(a), hole[1] * Math.sin(a), 0];
    };
    const far = (k) => {
      const a = (k / K) * I.TAU;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const r = (half * 1.5) / Math.max(Math.abs(c), Math.abs(sn));
      return [r * c, r * sn, 0];
    };
    for (let k = 0; k < K; k++) {
      const [a, b, c, d] = [rim(k), rim(k + 1), far(k + 1), far(k)];
      tris.push([a, b, c], [a, c, d]);
    }
    return tris;
  };
  return { point: (u, v) => [at(u, v), [0, 0, 1]], mask: (u, v) => !inside(at(u, v)), triangles };
};

const arenaPoints = (d, z, keep = () => true, n = 96) =>
  range(n)
    .map((k) => ring(k / n, d, z))
    .filter(keep);

export const scene = ({ ss = 3 } = {}) => {
  const cam = I.fitCamera(
    range(16).flatMap((k) => [ring(k / 16, -1, 0), ring(k / 16, -1, LEVELS[4])]),
    { width: WIDTH, height: HEIGHT, pad: 36, azimuth: 180, elevation: 30 },
  );
  const faces = (s) => I.dot(frameAt(s).n, cam.view) > 0.05;
  const south = [OUTER[0][1], OUTER[0][0] + 1];

  const facade = [];
  const inner = [];
  const fronts = [];
  const ledges = [];
  const columns = [];
  const reveals = [];
  const ends = [];
  const floors = [];

  for (let i = 0; i < 4; i++) {
    const [lo, hi] = OUTER[i];
    const z0 = LEVELS[i];
    const zt = LEVELS[i + 1];
    const open = i < 3 ? arched(STOREYS[i]) : windowed;
    const fine = { open, nu: 14, nv: 2.5 };
    facade.push(wall({ d: R1[0], from: lo, to: hi, z0, z1: i < 3 ? zt - 1.9 : zt - 1.7, ...fine }));
    inner.push(wall({ d: R1[1], from: lo, to: hi, z0, z1: zt, side: -1, ...fine }));
    fronts.push(wall({ d: -0.6, from: lo, to: hi, z0: zt - (i < 3 ? 1.9 : 1.7), z1: zt - 0.55 }), wall({ d: -1, from: lo, to: hi, z0: zt - 0.55, z1: zt }));
    const up = OUTER[i + 1];
    if (up) {
      ledges.push(ledge({ from: up[0], to: up[1], d0: -1, d1: 0, z: zt }));
      ledges.push(ledge({ from: lo, to: up[0], d0: -1, d1: R1[1], z: zt }), ledge({ from: up[1], to: hi, d0: -1, d1: R1[1], z: zt }));
    } else ledges.push(ledge({ from: lo, to: hi, d0: -1, d1: R1[1], z: zt }));

    for (const s of [lo, hi]) {
      const { t } = frameAt(s);
      const p = (d, z) => ring(s, d, z);
      ends.push(I.face({ points: [p(-1, z0), p(R1[1], z0), p(R1[1], zt), p(-1, zt)], along: frameAt(s).n, outward: s === hi ? t : I.mul(t, -1) }));
    }

    for (let k = Math.ceil(lo * BAYS); k < hi * BAYS; k++) {
      const s = k / BAYS;
      const pier = (k + 0.5) / BAYS;
      if (i < 3 && pier < hi) columns.push(column(pier, 0.62, z0, zt - 1.9));
      if (i === 3 && pier < hi) columns.push(pilaster(pier, 1.3, 0.3, z0 + 0.6, zt - 1.7));
      if (i < 3 && faces(s)) {
        reveals.push(reveal(s, R1[0], R1[1], STOREYS[i]));
        if (STOREYS[i].sill > 0) reveals.push(sillOf(s, R1[0], R1[1], STOREYS[i]));
      }
    }
    if (i < 3) floors.push(ledge({ from: lo, to: hi, d0: R1[1], d1: i === 2 ? R3[1] : R2[0], z: zt }));
  }

  const upper2 = { half: 1.9, sill: LEVELS[1], spring: 16.2 };
  const open2 = (t, z) => (z < LEVELS[1] ? arched(STOREYS[0])(t, z) : arched(upper2)(t, z));
  const r2 = [
    wall({ d: R2[0], from: south[0], to: south[1], z0: 0, z1: 30, open: open2, top: top2At, nu: 14, nv: 2.5 }),
    wall({ d: R2[0], from: OUTER[0][0], to: OUTER[0][1], z0: 0, z1: LEVELS[3] }),
    wall({ d: R2[1], from: south[0], to: south[1], z0: 0, z1: 30, side: -1, open: open2, top: top2At, nu: 14, nv: 2.5 }),
    wall({ d: R2[1], from: OUTER[0][0], to: OUTER[0][1], z0: 0, z1: LEVELS[3], side: -1 }),
    ledge({ from: south[0], to: south[1], d0: R2[0], d1: R2[1], z: top2At }),
  ];
  for (let k = Math.ceil(south[0] * BAYS); k < south[1] * BAYS; k++) {
    const s = k / BAYS;
    if (!faces(s)) continue;
    reveals.push(reveal(s, R2[0], R2[1], STOREYS[0], top2At), reveal(s, R2[0], R2[1], upper2, top2At));
  }
  const r3 = [
    wall({ d: R3[0], from: 0, to: 1, z0: 0, z1: LEVELS[3], top: capAt, nv: 1.5 }),
    ledge({ from: south[0], to: south[1], d0: R3[0], d1: R3[1], z: capAt }),
  ];
  floors.push(
    ledge({ from: 0, to: 1, d0: R2[1], d1: R3[0], z: LEVELS[1] }),
    ledge({ from: south[0], to: south[1], d0: R2[1], d1: R3[0], z: LEVELS[2], mask: (s) => top2At(s) > LEVELS[2] + 0.3 }),
  );

  const slopes = CAVEA.map(([[d0, z0], [d1, z1]]) =>
    I.patch({
      at: (u, v) => {
        const s = u;
        return ring(s, lerp(d0, d1, v), Math.min(lerp(z0, z1, v), capAt(s)));
      },
      nu: BAYS * 12,
      nv: 10,
    }),
  );
  const steps = CAVEA.slice(1).map(([[d, z1]], k) => wall({ d, from: 0, to: 1, z0: z1, z1: CAVEA[k][1][1], side: -1, top: capAt, nv: 2 }));
  const podium = wall({ d: ARENA, from: 0, to: 1, z0: PIT, z1: 4.5, side: -1, nu: 2, nv: 0.5 });

  const radials = [];
  for (let k = 0; k < BAYS; k++) {
    const s = (k + 0.5) / BAYS;
    if (Math.cos(frameAt(s).th) < -0.35) continue;
    radials.push(...radial(s, 16.6, 26.6, 1.5, 0.9), ...radial(s, 27.6, 39.6, 1.4, 0.8));
  }

  const pit = I.face({ points: arenaPoints(ARENA, PIT), along: [0, 1, 0], outward: [0, 0, 1] });
  const pitCross = I.face({ points: arenaPoints(ARENA, PIT), along: [1, 0.7, 0], outward: [0, 0, 1] });
  const rim = arenaPoints(ARENA, 0.2);
  const first = rim.findIndex((p, k) => p[0] > 16 && rim.at(k - 1)[0] <= 16);
  const east = [...rim.slice(first), ...rim.slice(0, first)].filter((p) => p[0] > 16);
  const chord = (p) => [16, p[1], 0.2];
  const deck = I.face({ points: [chord(east[0]), ...east, chord(east.at(-1))], along: [0, 1, 0], outward: [0, 0, 1] });
  const deckEdge = I.face({ points: [[16, -24.8, -0.8], [16, 24.8, -0.8], [16, 24.8, 0.2], [16, -24.8, 0.2]], along: [0, 1, 0], outward: [-1, 0, 0] });
  const hypogeum = [];
  for (const y of [-21, -17.5, -14, -10.5, -7, -3.2, 3.2, 7, 10.5, 14, 17.5, 21]) {
    const reach = 43 * Math.sqrt(1 - (y / 27) ** 2) - 4;
    hypogeum.push(...I.box({ min: [-reach, y - 0.4, PIT], max: [Math.min(reach, 17), y + 0.4, -0.6] }));
  }

  const building = [...facade, ...inner, ...fronts, ...ledges, ...columns, ...reveals, ...ends, ...floors, ...r2, ...r3, ...slopes, ...steps, podium, ...radials, pit, deck, deckEdge, ...hypogeum];
  const ground = groundOf(cam, 260, [44.5, 28.5]);
  const solids = [ground, ...building];
  const occ = I.occlusion(solids, cam, { ss, halo: building });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const all = (list, opts) => merge(list.map((s) => H(s, opts)));

  const travertine = { base: 0.04, ambient: 0.2, bounce: 0.14 };
  const brick = { base: 0.14, ambient: 0.18, bounce: 0.12 };
  const deep = DEEP;
  const turf = { base: 0.08, ambient: 0.24, bounce: 0 };
  const [cx, cy] = cam.project([0, 0, 0]);
  const near = (s) => {
    const [x, y] = cam.project(s.p);
    return 1 - I.smoothstep(0.7, 1, Math.hypot((x - cx) / (WIDTH * 0.55), (y - cy - 40) / (HEIGHT * 0.5)));
  };

  const layers = [];
  const layer = (id, set, material, ink, shape, covered) => layers.push({ id, set, material, ink, shape, covered });

  const covered = (s) => (s.p[0] / A) ** 2 + (s.p[1] / B) ** 2 < 1;
  layer("ground", H(ground, { spacing: 2.8 }), turf, { from: 0.2, to: 0.85, width: 1 }, near, covered);
  layer("ground-x", H(ground, { spacing: 3.6, slant: 0.5 }), turf, { from: 0.6, to: 0.95, width: 0.8 }, near, covered);
  layer("facade", all(facade, { spacing: 2, step: 1.2 }), travertine, { from: 0.16, to: 0.72, width: 1 });
  layer("facade-x", all(facade, { spacing: 2.7, slant: 0.5, step: 1.2 }), travertine, { from: 0.58, to: 0.95, width: 0.8 });
  layer("inner", all(inner, { spacing: 2, step: 1.2 }), brick, { from: 0.18, to: 0.75, width: 1 });
  layer("fronts", all(fronts, { spacing: 1.3, step: 1.2 }), travertine, { from: 0.14, to: 0.7, width: 0.8 });
  layer("ledges", all([...ledges, ...ends], { spacing: 1.6, step: 1.2 }), travertine, { from: 0.16, to: 0.72, width: 0.8 });
  layer("columns", all(columns, { along: "v", lines: 3, step: 1.2 }), travertine, { from: 0.14, to: 0.7, width: 0.7 });
  layer("reveals", all(reveals, { spacing: 1.4, step: 1 }), travertine, { from: 0.16, to: 0.8, width: 0.8 });
  layer("floors", all(floors, { spacing: 1.6, step: 1.2 }), deep, { from: 0.2, to: 0.85, width: 0.9 });
  const outerRings = [r2[0], r2[4], r3[1]];
  const innerRings = [r2[1], r2[2], r2[3], r3[0]];
  layer("rings", all(outerRings, { spacing: 2, step: 1.2 }), brick, { from: 0.18, to: 0.75, width: 1 });
  layer("rings-x", all(outerRings, { spacing: 2.7, slant: 0.5, step: 1.2 }), brick, { from: 0.6, to: 0.95, width: 0.8 });
  layer("passages", all(innerRings, { spacing: 1.8, step: 1.2 }), deep, { from: 0.2, to: 0.8, width: 1 });
  layer("passages-x", all(innerRings, { spacing: 2.5, slant: 0.5, step: 1.2 }), deep, { from: 0.55, to: 0.95, width: 0.8 });
  const across0 = ([[d0, z0], [d1, z1]], spacing) => {
    const [ax, ay] = cam.project(ring(0, d0, z0));
    const [bx, by] = cam.project(ring(0, d1, z1));
    return Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / spacing));
  };
  layer("cavea", merge(slopes.map((p, k) => H(p, { lines: across0(CAVEA[k], 2) }))), brick, { from: 0.2, to: 0.75, width: 1 });
  layer("cavea-x", merge(slopes.map((p, k) => H(p, { lines: across0(CAVEA[k], 2.7), slant: 0.4 }))), brick, { from: 0.6, to: 0.95, width: 0.8 });
  layer("steps", all([...steps, podium], { spacing: 1.8 }), brick, { from: 0.18, to: 0.75, width: 0.9 });
  layer("radials", all(radials, { spacing: 1.5, step: 1.2 }), brick, { from: 0.18, to: 0.75, width: 0.8 });
  layer("pit", all([pit, ...hypogeum], { spacing: 1.8 }), brick, { from: 0.2, to: 0.8, width: 0.9 });
  layer("pit-x", merge([H(pitCross, { spacing: 2.5 }), ...hypogeum.map((f) => H(f, { spacing: 2.5, slant: 0.6 }))]), brick, { from: 0.62, to: 0.95, width: 0.75 });
  layer("deck", all([deck, deckEdge], { spacing: 1.6 }), travertine, { from: 0.18, to: 0.75, width: 0.9 });

  const horizon = cam.project([A + 30, 0, 0])[1];
  const sky = I.ruling(cam, occ, { spacing: 2.4, halo: 8, region: (x, y) => y < horizon });
  const skyTone = (s) => {
    const edge = 1 - I.smoothstep(0.62, 1, Math.hypot((s.x - cx) / (WIDTH * 0.52), (s.y - HEIGHT * 0.4) / (HEIGHT * 0.56)));
    return (0.16 + 0.5 * I.smoothstep(horizon, 0, s.y)) * edge * I.smoothstep(horizon, horizon - 60, s.y);
  };

  const marks = [];
  for (let i = 0; i < 3; i++) {
    const [lo, hi] = OUTER[i];
    const { half, spring } = STOREYS[i];
    for (let k = Math.ceil(lo * BAYS); k < hi * BAYS; k++) {
      const s = k / BAYS;
      const { e, n, t } = frameAt(s);
      const pts = range(17).map((j) => {
        const a = Math.PI * (j / 16);
        const r = half + 0.35;
        return [e[0] + 0.05 * n[0] - r * Math.cos(a) * t[0], e[1] + 0.05 * n[1] - r * Math.cos(a) * t[1], spring + r * Math.sin(a)];
      });
      marks.push(I.stroke(pts, cam, occ.sees, { width: 0.35 }));
    }
  }

  const shadowTris = I.trianglesOf(building);
  return { cam, solids, tris: shadowTris, layers, sky, skyTone, marks: marks.join("") };
};

/** Ink every lit layer for a solar time. A negative plate (pale ink on dark paper) inks the light, not the shade. */
export const inkAt = (S, hours, { size = 1024, negative = false } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris });
  const out = {};
  for (const l of S.layers) {
    const open = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    const under = l.covered && I.lighting({ ...DEEP, light, view: S.cam.view, shadow });
    const lit = under ? (s) => (l.covered(s) ? under(s) : open(s)) : open;
    const tone = negative ? (s) => 1 - lit(s) : lit;
    out[l.id] = I.ink(l.set, l.shape ? (s) => tone(s) * l.shape(s) : tone, l.ink);
  }
  return out;
};
