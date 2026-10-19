import * as I from "../../kit/intaglio.mjs";

// A secluded mountain lake in the Alps, engraved as a panoramic bank-note vignette in one ink.
// A granite outcrop with two pines runs into the still water in the foreground; a wooded point and forested hills
// stand round the shore, every pine a tree of its own; behind them a snowy range, and behind that a far range
// engraved in the sky's own ruling, only a little heavier, so it dissolves into the air.
// The lake mirrors all of it: each water line is toned by what the mirrored ray from the eye meets.
// World units are metres: x east (screen right), y north (away from the eye), z up, the lake at z = 0.
// The sun crosses the afternoon sky; the faces of the peaks turn from the light, and the reflection follows.

export const WIDTH = 960;
export const HEIGHT = 420;

const H0 = 236; // the horizon row
const F = 780; // focal length in px
const EYE = [0, 0, 7];

export const LATITUDE = 46.5;
export const DECLINATION = 14;

const range = (n) => Array.from({ length: n }, (_, i) => i);
const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });

// Deterministic noise.
const hash = (i, j = 0) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const fade = (t) => t * t * (3 - 2 * t);
const noise = (x, y = 0) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = fade(x - i);
  const fy = fade(y - j);
  const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * fx;
  const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * fx;
  return a + (b - a) * fy;
};
const fbm = (x, y) => 0.5 * noise(x, y) + 0.3 * noise(2.1 * x + 5, 2.1 * y + 1) + 0.2 * noise(4.3 * x + 9, 4.3 * y + 3);
const rand = (seed) => {
  let k = seed;
  return () => hash(k++, seed * 0.37);
};

/** The sun at a solar time in hours, as a direction toward it (x east, y north). */
export const sunAt = (hours) => {
  const phi = LATITUDE * I.deg;
  const dec = DECLINATION * I.deg;
  const ha = (hours - 12) * 15 * I.deg;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const cosA = (Math.sin(dec) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
  const az = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const bearing = (ha > 0 ? I.TAU - az : az) / I.deg;
  return { altitude: alt / I.deg, bearing, light: I.sunDirection(bearing, Math.max(5, alt / I.deg)) };
};

// One eye, three depth scales. They project identically; only the depth buffer's tolerance differs, so each
// distance band is tested against nearer surfaces at a precision that suits it.
const camAt = (d) => I.perspective({ eye: EYE, target: [0, d, EYE[2]], scale: F / d, offset: [WIDTH / 2, H0], width: WIDTH, height: HEIGHT });

/** A world point from a screen column, a distance and a screen row (the height that row has at that distance). */
const placed = (sx, D, row) => [((sx - WIDTH / 2) * D) / F, D, EYE[2] + ((H0 - row) * D) / F];
/** The world point on the lake under a screen pixel. */
const onWater = (x, y) => {
  const d = (EYE[2] * F) / (y - H0);
  return [((x - WIDTH / 2) * d) / F, d, 0];
};

const table = (f, n = 2048) => {
  const t = Float64Array.from({ length: n + 1 }, (_, i) => f((i / n) * I.TAU));
  return (th) => {
    const x = ((((th / I.TAU) % 1) + 1) % 1) * n;
    const i = Math.floor(x);
    return t[i] + (t[i + 1] - t[i]) * (x - i);
  };
};

/**
 * A massif: peaks given by where their summits stand on screen, each a cone with arêtes (its footprint reaches out
 * along a few ridges, so its faces are planes that take the light one by one), ravines down its faces and a fine
 * lumpiness. The height is the highest cone; each peak owns the ground where its cone is highest, so the fall lines
 * of neighbouring peaks meet along the cols between them.
 */
const massif = (specs, { profile, seed, rough = 0.02 }) => {
  const peaks = specs.map((p, i) => {
    const [x, y, H] = placed(p.sx, p.D, p.top);
    const r = rand(seed * 31 + i);
    const arms = range(p.arms ?? 4).map((k) => ({ phase: (k / (p.arms ?? 4)) * I.TAU + (r() - 0.5) * 1.2 + (p.turn ?? 0), reach: 0.45 + 0.45 * r() }));
    const shape = table((th) => {
      let g = 0;
      for (const a of arms) g = Math.max(g, a.reach * Math.max(0, Math.cos(th - a.phase)) ** 6);
      return 0.72 + g;
    });
    const ravines = range(11).map(() => ({ phase: r() * I.TAU, width: 30 + 60 * r(), depth: 0.4 + 0.6 * r() }));
    const groove = table((th) => {
      let g = 0;
      for (const v of ravines) g += v.depth * (0.5 + 0.5 * Math.cos(th - v.phase)) ** v.width;
      return Math.min(1, g);
    });
    return { ...p, x, y, H, r: p.r, shape, groove, R: p.r * 1.25, k: i };
  });
  const cone = (P, x, y) => {
    const dx = x - P.x;
    const dy = y - P.y;
    const th = Math.atan2(dy, dx);
    const s = 1 - Math.hypot(dx, dy) / (P.r * P.shape(th));
    if (s <= 0) return P.H * 0.5 * s - 30;
    const band = I.smoothstep(0.02, 0.2, s) * (1 - I.smoothstep(0.6, 0.95, s));
    const lumps = rough * (noise(x / (P.r * 0.07), y / (P.r * 0.07)) - 0.5) * I.smoothstep(0.03, 0.3, 1 - s);
    return P.H * (profile(s) - 0.09 * P.groove(th) * band + lumps) - 30 * (1 - s) ** 3;
  };
  const exact = (x, y) => {
    let h = -Infinity;
    let k = 0;
    peaks.forEach((P, i) => {
      const c = cone(P, x, y);
      if (c > h) {
        h = c;
        k = i;
      }
    });
    return [h, k];
  };
  // Tabulated once on a fine grid: every sample would otherwise evaluate every cone, many times over.
  const cell = Math.min(...peaks.map((P) => P.r)) * 0.008;
  const gx0 = Math.min(...peaks.map((P) => P.x - P.R * 1.6));
  const gy0 = Math.min(...peaks.map((P) => P.y - P.R * 1.6));
  const nx = Math.ceil((Math.max(...peaks.map((P) => P.x + P.R * 1.6)) - gx0) / cell) + 1;
  const ny = Math.ceil((Math.max(...peaks.map((P) => P.y + P.R * 1.6)) - gy0) / cell) + 1;
  const hs = new Float32Array(nx * ny);
  const ks = new Int8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const [h, k] = exact(gx0 + i * cell, gy0 + j * cell);
      hs[j * nx + i] = h;
      ks[j * nx + i] = k;
    }
  }
  const height = (x, y) => {
    const fx = (x - gx0) / cell;
    const fy = (y - gy0) / cell;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1) return exact(x, y)[0];
    const tx = fx - i;
    const ty = fy - j;
    const k = j * nx + i;
    return (hs[k] * (1 - tx) + hs[k + 1] * tx) * (1 - ty) + (hs[k + nx] * (1 - tx) + hs[k + nx + 1] * tx) * ty;
  };
  const owner = (x, y, margin = 0) => {
    if (!margin) {
      const i = Math.round((x - gx0) / cell);
      const j = Math.round((y - gy0) / cell);
      if (i >= 0 && j >= 0 && i < nx && j < ny) return ks[j * nx + i];
    }
    let best = -Infinity;
    let k = -1;
    const all = peaks.map((P) => cone(P, x, y));
    all.forEach((h, i) => {
      if (h > best) {
        best = h;
        k = i;
      }
    });
    return margin ? all.map((h) => h >= best - margin) : k;
  };
  const normal = (x, y) => {
    const e = 3;
    const dx = (height(x + e, y) - height(x - e, y)) / (2 * e);
    const dy = (height(x, y + e) - height(x, y - e)) / (2 * e);
    return I.unit([-dx, -dy, 1]);
  };
  // One polar patch per peak, u round the summit (front at 0.5), v from the summit out. Its lines are drawn only on
  // the peak's own ground; its triangles reach a little past it so the seams between peaks never open.
  const surfaces = peaks.map((P, i) => {
    const at = (u, v) => {
      const th = (u - 0.5) * I.TAU - Math.PI / 2;
      const rho = 0.002 * P.R + v * P.R;
      const x = P.x + rho * Math.cos(th);
      const y = P.y + rho * Math.sin(th);
      return [x, y, height(x, y)];
    };
    const nu = P.nu ?? 180;
    const nv = P.nv ?? 60;
    const strict = I.patch({ at, nu, nv, side: -1, mask: (u, v) => owner(...at(u, v).slice(0, 2)) === i });
    const loose = I.patch({ at, nu, nv, side: -1, mask: (u, v) => owner(...at(u, v).slice(0, 2), 0.02 * P.H)[i] });
    return { ...strict, triangles: loose.triangles, peak: P };
  });
  return { peaks, height, normal, owner, surfaces };
};

const alpine = (s) => s ** 1.45;
const dome = (s) => Math.sin((Math.PI / 2) * Math.min(1, s * 1.15)) ** 1.6;

// The ranges, back to front. Summits are set where they stand on screen.
const FAR = massif(
  [
    { sx: 70, D: 18000, top: 112, r: 5200, nu: 120, nv: 40 },
    { sx: 235, D: 19500, top: 128, r: 4600, nu: 120, nv: 40, turn: 0.5 },
    { sx: 405, D: 18500, top: 118, r: 4300, nu: 120, nv: 40 },
    { sx: 700, D: 20000, top: 120, r: 5000, nu: 120, nv: 40 },
    { sx: 985, D: 17500, top: 132, r: 5200, nu: 120, nv: 40, turn: 1 },
  ],
  { profile: alpine, seed: 1 },
);
const RANGE = massif(
  [
    { sx: 612, D: 8200, top: 50, r: 2900, arms: 4, turn: 0.3 },
    { sx: 478, D: 9300, top: 104, r: 2500, arms: 3 },
    { sx: 762, D: 8900, top: 92, r: 2500, arms: 4, turn: 1.1 },
    { sx: 900, D: 9800, top: 126, r: 2700, arms: 3 },
    { sx: 352, D: 10200, top: 134, r: 2600, arms: 4, turn: 2 },
    { sx: 548, D: 7300, top: 156, r: 1300, arms: 3, turn: 0.8 },
  ],
  { profile: alpine, seed: 2, rough: 0.06 },
);
const HILLS = massif(
  [
    { sx: 40, D: 2500, top: 150, r: 950, arms: 3, nu: 120, nv: 40 },
    { sx: 205, D: 2850, top: 172, r: 820, arms: 3, nu: 120, nv: 40 },
    { sx: 350, D: 3300, top: 200, r: 700, arms: 3, nu: 100, nv: 36 },
    { sx: 790, D: 3100, top: 194, r: 760, arms: 3, nu: 100, nv: 36 },
    { sx: 925, D: 2600, top: 156, r: 950, arms: 3, nu: 120, nv: 40 },
  ],
  { profile: dome, seed: 3, rough: 0.04 },
);
const BANKS = massif(
  [
    { sx: 40, D: 640, top: 213, r: 330, arms: 2, nu: 90, nv: 30 },
    { sx: 175, D: 760, top: 222, r: 260, arms: 2, nu: 90, nv: 30 },
    { sx: 995, D: 1450, top: 204, r: 620, arms: 2, nu: 90, nv: 30 },
  ],
  { profile: dome, seed: 4, rough: 0.05 },
);
const MASSIFS = { far: FAR, range: RANGE, hills: HILLS, banks: BANKS };

// The range's snow: above a ragged line, lying lower in the ravines.
const snowAt = (P, p) => {
  const dx = p[0] - P.x;
  const dy = p[1] - P.y;
  const th = Math.atan2(dy, dx);
  const rel = p[2] / 1000;
  const line = 1.28 + 0.08 * Math.sin(3 * th + P.k) + 0.12 * (noise(th * 6 + P.k * 3, P.k) - 0.5) - 0.18 * P.groove(th);
  return I.smoothstep(line - 0.03, line + 0.03, rel);
};
const treeline = (p) => 520 + 120 * noise(p[0] / 400, p[1] / 400);

/**
 * A pine seen at a distance: a card that faces the eye, cut to a spire of drooping tiers, ragged at the tips.
 * Its normals are those of the cone it stands for (lit on the sunward side, turning down under each tier),
 * so horizontal lines across it swell into the shade and taper out into the light.
 */
const pineCard = ({ base, h, w, tiers, seed }) => {
  const toEye = I.unit([EYE[0] - base[0], EYE[1] - base[1], 0]);
  const side = [-toEye[1], toEye[0], 0];
  const up = [0, 0, 1];
  const r = rand(seed);
  const phase = r() * 0.4;
  const lean = (r() - 0.5) * 0.06;
  const half = (v, s) => {
    const f = (v * tiers + phase) % 1;
    const tier = 0.42 + 0.58 * f ** 1.3;
    const rag = 1 + 0.3 * (noise(v * tiers * 2.3 + s * 7, seed) - 0.5);
    return (w / 2) * v ** 0.9 * tier * rag;
  };
  const at = (u, v) => {
    const x = u < 0.5 ? -half(v, 0) * (1 - 2 * u) : half(v, 1) * (2 * u - 1);
    const z = h * (1 - 0.94 * v);
    return I.add(base, I.add(I.mul(side, x + lean * h * (1 - v)), I.mul(up, z)));
  };
  const point = (u, v) => {
    const f = (v * tiers + phase) % 1;
    const down = 0.7 * I.smoothstep(0.55, 1, f);
    const n = I.unit(I.add(I.add(I.mul(toEye, 0.55), I.mul(side, (2 * u - 1) * 0.95)), I.mul(up, 0.3 - down)));
    return [at(u, v), n];
  };
  const vs = range(tiers * 3 + 1).map((i) => i / (tiers * 3));
  const triangles = () => {
    const tris = [];
    for (let j = 0; j < vs.length - 1; j++) {
      const a = at(0, vs[j]);
      const b = at(1, vs[j]);
      const c = at(1, vs[j + 1]);
      const d = at(0, vs[j + 1]);
      tris.push([a, b, c], [a, c, d]);
    }
    return tris;
  };
  return { point, triangles, base, h };
};

/** A pine near the eye, in the round: a tiered cone whose drooping whorls are ragged round the trunk. */
const pine = ({ base, h, r: R, tiers, seed }) => {
  const r = rand(seed);
  const lean = [(r() - 0.5) * 0.08, (r() - 0.5) * 0.05];
  const crown = 0.82;
  const at = (u, v) => {
    const th = u * I.TAU;
    const f = v * tiers;
    const i = Math.floor(f);
    const fr = f - i;
    const grow = fr < 0.8 ? 0.3 + 0.7 * (fr / 0.8) ** 1.25 : 1 - 0.7 * ((fr - 0.8) / 0.2) ** 0.8;
    const rag = 1 + 0.38 * (noise(th * 1.6 + i * 5.3, i * 1.7 + seed) - 0.5) + 0.12 * Math.sin(5 * th + i * 2.1);
    const env = R * (0.08 + 0.92 * v ** 0.85);
    const rr = env * grow * rag;
    const droop = (h / tiers) * 0.35 * Math.max(0, (fr - 0.5) / 0.5) ** 2;
    const z = h * (1 - crown * v) - droop * (fr < 0.8 ? 1 : 1 - (fr - 0.8) / 0.2);
    return [base[0] + rr * Math.cos(th) + lean[0] * z, base[1] + rr * Math.sin(th) + lean[1] * z, base[2] + z];
  };
  const crownSurface = I.patch({ at, nu: 48, nv: tiers * 10, side: -1 });
  const trunk = I.lathe({
    base,
    profile: [
      [-1, R * 0.07],
      [0, R * 0.065],
      [h * 0.6, R * 0.04],
      [h * 0.98, R * 0.01],
    ],
  });
  return { crown: crownSurface, trunk, base, h };
};

/** The outcrop: a granite rib along a spine from the shore out into the lake, its sides broken into ledges. */
const SPINE = { a: [-36, 51], b: [-5.5, 44.6] };
const outcrop = () => {
  const ax = SPINE.b[0] - SPINE.a[0];
  const ay = SPINE.b[1] - SPINE.a[1];
  const L = Math.hypot(ax, ay);
  const dir = [ax / L, ay / L];
  const nearSide = [dir[1], -dir[0]];
  const at = (u, v) => {
    const t = u * 1.12;
    const phi = v * Math.PI;
    const w = 7 * Math.max(0, 1 - t) ** 0.5 + 1.1;
    const top = 5.4 * Math.max(0, 1 - t) ** 0.8 + 0.3 - 1.2 * Math.max(0, t - 0.95);
    const c = [SPINE.a[0] + dir[0] * L * t, SPINE.a[1] + dir[1] * L * t];
    let lat = -w * Math.cos(phi);
    let z = (top + 0.8) * Math.sin(phi) ** 0.55 - 0.8;
    // Ledges: the rock steps back at each bed of the granite, and bulges between the joints.
    const bed = z / 0.62 + 0.6 * noise(t * 9, 2);
    const step = bed - Math.floor(bed);
    const out = 0.16 * I.smoothstep(0.7, 1, step) - 0.08;
    const bulge = 0.35 * (noise(t * 14, v * 6) - 0.5) + 0.18 * (noise(t * 40, v * 15) - 0.5);
    const k = Math.sign(-Math.cos(phi)) || 1;
    lat += k * -(out + bulge) * Math.abs(Math.cos(phi)) ** 0.5;
    z += 0.12 * (noise(t * 22 + 4, v * 8) - 0.5) + 0.9 * (noise(t * 7 + 1, 5) - 0.5) * Math.sin(phi) ** 2;
    // Joint blocks: the rib breaks into slabs that stand a little proud of each other.
    const block = Math.floor(t * 13 + 0.5 * noise(v * 3, 1));
    lat += 0.45 * (hash(block, 4) - 0.5) * Math.abs(Math.cos(phi));
    z += 0.35 * (hash(block, 6) - 0.5) * Math.sin(phi);
    return [c[0] + nearSide[0] * lat, c[1] + nearSide[1] * lat, z];
  };
  return I.patch({ at, nu: 320, nv: 90, side: -1 });
};
/** A boulder half sunk in the lake: a squashed, lumpy ball. */
const boulder = (c, R, seed) => {
  const r = rand(seed);
  const squash = 0.55 + 0.2 * r();
  const at = (u, v) => {
    const lon = u * I.TAU;
    const lat = (v - 0.5) * Math.PI;
    const d = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    const k = 1 + 0.18 * (noise(lon * 1.3 + seed, lat * 1.3) - 0.5) + 0.12 * Math.max(0, Math.cos(2 * lon + seed)) ** 6;
    return [c[0] + d[0] * R * k, c[1] + d[1] * R * k * 0.9, c[2] + d[2] * R * k * squash];
  };
  return I.patch({ at, nu: 40, nv: 24 });
};

/**
 * A pick buffer: rasterise triangles seen by a perspective camera, keeping the nearest one's depth, normal and
 * group per pixel. `hit(p)` follows the ray from the eye through p beyond it and returns the first surface met.
 */
const pickBuffer = (groups, cam, ss = 2) => {
  const w = Math.ceil(cam.width * ss);
  const h = Math.ceil(cam.height * ss);
  const depth = new Float32Array(w * h).fill(-Infinity);
  const normal = new Float32Array(w * h * 3);
  const group = new Int8Array(w * h).fill(-1);
  groups.forEach(({ tris }, g) => {
    for (const tri of tris) {
      const [a, b, c] = tri.map((p) => {
        const [x, y, d] = cam.project(p);
        return [x * ss, y * ss, d];
      });
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
      const x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
      const y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      if (x0 > x1 || y0 > y1) continue;
      let n = I.unit(I.cross(I.sub(tri[1], tri[0]), I.sub(tri[2], tri[0])));
      if (I.dot(n, cam.toward(tri[0])) < 0) n = I.mul(n, -1);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const l1 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
          const l2 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
          const l3 = 1 - l1 - l2;
          if (l1 < -0.01 || l2 < -0.01 || l3 < -0.01) continue;
          const d = l1 * a[2] + l2 * b[2] + l3 * c[2];
          const k = y * w + x;
          if (d > depth[k]) {
            depth[k] = d;
            normal[k * 3] = n[0];
            normal[k * 3 + 1] = n[1];
            normal[k * 3 + 2] = n[2];
            group[k] = g;
          }
        }
      }
    }
  });
  return (p) => {
    const [x, y, d] = cam.project(p);
    const i = Math.floor(x * ss);
    const j = Math.floor(y * ss);
    if (i < 0 || j < 0 || i >= w || j >= h) return null;
    const k = j * w + i;
    if (!(depth[k] > -Infinity) || depth[k] > d) return null;
    const hit = I.add(cam.eye, I.mul(I.sub(p, cam.eye), d / depth[k]));
    return { p: hit, n: [normal[k * 3], normal[k * 3 + 1], normal[k * 3 + 2]], g: groups[group[k]].id };
  };
};

export const scene = ({ ss = 3 } = {}) => {
  const near = camAt(60);
  const mid = camAt(2500);
  const far = camAt(9000);
  const cam = mid;

  // The surfaces.
  const lake = I.face({ points: [[-30000, 8, 0], [30000, 8, 0], [30000, 30000, 0], [-30000, 30000, 0]], along: [1, 0, 0], outward: [0, 0, 1] });
  const rock = outcrop();
  const boulders = [
    boulder([-3.2, 43.4, -0.35], 1.3, 3),
    boulder([-1.0, 45.6, -0.45], 0.75, 5),
    boulder([-9.5, 40.6, -0.3], 1.0, 7),
    boulder([1.6, 42.2, -0.3], 0.45, 9),
    boulder([-14.5, 41.2, -0.5], 1.6, 15),
    boulder([-21, 42.8, -0.6], 1.9, 17),
    boulder([-28.5, 43.6, -0.5], 1.5, 19),
    boulder([-6.8, 42.4, -0.2], 0.6, 21),
  ];
  const pines = [
    pine({ base: [-24.5, 49.2, 4.0], h: 12.5, r: 2.4, tiers: 9, seed: 11 }),
    pine({ base: [-17.6, 47.9, 3.0], h: 7.2, r: 1.6, tiers: 7, seed: 13 }),
  ];
  const nearSolids = [rock, ...boulders, ...pines.flatMap((p) => [p.crown, p.trunk])];
  const ranges = Object.values(MASSIFS).flatMap((m) => m.surfaces);

  // Where the forest stands: a pick of the land as the eye sees it, then pines set on it in screen space, spaced so
  // that near trees are few and large and far ones many and small, every one cut to its own spire.
  const groundPick = pickBuffer(
    [
      { id: "lake", tris: lake.triangles() },
      ...Object.entries(MASSIFS).map(([id, m]) => ({ id, tris: I.trianglesOf(m.surfaces) })),
      { id: "near", tris: I.trianglesOf(nearSolids) },
    ],
    mid,
    1,
  );
  const rayAt = (x, y) => [EYE[0] + (x - WIDTH / 2) / F, EYE[1] + 1, EYE[2] - (y - H0) / F];
  const cards = [];
  const tr = rand(77);
  for (let y = 120; y < H0 + 6; y += 0.5) {
    for (let x = -4; x < WIDTH + 4; x += 0.5) {
      const hit = groundPick(rayAt(x, y));
      if (!hit || (hit.g !== "hills" && hit.g !== "banks")) continue;
      const p = hit.p;
      if (p[2] < 1 || p[2] > treeline(p) || hit.n[2] < 0.45) continue;
      const D = p[1];
      const h = 17 + 10 * tr();
      const hpx = (F * h) / D;
      const wpx = hpx * (0.34 + 0.08 * tr());
      const area = 0.5 * wpx * 0.36 * hpx;
      if (tr() > 0.15 / area) continue;
      cards.push(pineCard({ base: [p[0], p[1], p[2] - 0.5], h, w: (h * wpx) / hpx, tiers: Math.max(3, Math.min(9, Math.round(hpx / 3.2))), seed: cards.length + 101 }));
    }
  }

  const farSolids = [...ranges, ...cards];
  const solids = [lake, ...nearSolids, ...farSolids];
  const occN = I.occlusion([lake, ...nearSolids], near, { ss });
  const occM = I.occlusion([lake, ...nearSolids, ...HILLS.surfaces, ...BANKS.surfaces, ...cards], mid, { ss });
  const occF = I.occlusion(solids, far, { ss, halo: [...nearSolids, ...RANGE.surfaces, ...HILLS.surfaces, ...BANKS.surfaces, ...cards] });
  const occW = I.occlusion(solids, near, { ss: 2 });
  const Hn = (s, o) => I.hatch(s, near, occN.sees, o);
  const Hm = (s, o) => I.hatch(s, mid, occM.sees, o);
  const Hf = (s, o) => I.hatch(s, far, occF.sees, o);

  // The reflection: a pick buffer for a camera at the eye's mirror image below the water.
  const mirror = I.perspective({ eye: [EYE[0], EYE[1], -EYE[2]], target: [0, 2500, -EYE[2]], scale: F / 2500, offset: [WIDTH / 2, 420], width: WIDTH, height: 426 });
  const reflectPick = pickBuffer(
    [
      ...Object.entries(MASSIFS).map(([id, m]) => ({ id, tris: I.trianglesOf(m.surfaces) })),
      { id: "cards", tris: I.trianglesOf(cards) },
      { id: "rock", tris: I.trianglesOf([rock, ...boulders]) },
      { id: "pine", tris: I.trianglesOf(pines.map((p) => p.crown)) },
    ],
    mirror,
    2,
  );
  const farPick = pickBuffer([{ id: "far", tris: I.trianglesOf(FAR.surfaces) }], far, 2);

  // Atmosphere: distance thins the ink, so each range stands paler than the one before it.
  const air = (p) => 0.34 + 0.66 * Math.exp(-p[1] / 7000);

  // Materials.
  const granite = { base: 0.06, ambient: 0.34, bounce: 0.16 };
  const crag = { base: 0.4, ambient: 0.12, bounce: 0.1 };
  const snow = { base: 0, ambient: 0.22, bounce: 0.2 };
  const forest = { base: 0.5, ambient: 0.18, bounce: 0.05 };
  const needles = { base: 0.56, ambient: 0.12, bounce: 0.08 };
  const bark = { base: 0.45, ambient: 0.15, bounce: 0.1 };

  const peakOf = (p) => RANGE.peaks[RANGE.owner(p[0], p[1])];
  const rangeTone = (ctx) => {
    const r1 = I.lighting({ ...crag, ...ctx });
    const s1 = I.lighting({ ...snow, ...ctx });
    const f1 = I.lighting({ ...forest, ...ctx });
    return (s) => {
      if (s.snow === undefined) {
        s.snow = snowAt(peakOf(s.p), s.p);
        s.wood = 1 - I.smoothstep(-40, 40, s.p[2] - treeline(s.p) + 60);
        s.air = air(s.p);
        s.grain = 0.75 + 0.5 * noise(s.p[0] / 60, s.p[2] / 25);
      }
      const rockT = r1(s) * (1 - s.wood) + f1(s) * s.grain * s.wood;
      return s.air * (rockT * (1 - s.snow) + 0.75 * s1(s) * s.snow);
    };
  };
  const hillTone = (ctx) => {
    const f1 = I.lighting({ ...forest, ...ctx });
    return (s) => (s.air ??= air(s.p)) * f1(s);
  };
  const cardTone = (ctx) => {
    const n1 = I.lighting({ ...needles, ...ctx });
    return (s) => (s.air ??= air(s.p)) * n1(s);
  };
  const farTone = (ctx) => {
    const r1 = I.lighting({ ...crag, ambient: 0.3, ...ctx });
    return (s) => (s.hit ? 0.5 * r1(s.hit) * (1 - 0.5 * s.hit.snow) : 0);
  };

  const layers = [];
  // tone(ctx) gives the light on the surface; fade multiplies the ink after any negative.
  const layer = (id, set, tone, ink, { fade = null, group = "far" } = {}) => layers.push({ id, set, tone, ink, fade, group });
  const mat = (m) => (ctx) => I.lighting({ ...m, ...ctx });

  // The sky, and the far range in the same ruling. Lines are darkest at the top; a few long clouds lie across them.
  const aura = (x, y) => occF.clear(x, y);
  const sky = I.ruling(far, { clear: () => Infinity }, { rect: [0, 0, WIDTH, H0], spacing: 1.7, step: 2, halo: -1, region: (x, y) => aura(x, y) > 2.2 });
  for (const runs of sky.lines) {
    for (const run of runs) {
      for (const s of run) {
        const q = farPick(rayAt(s.x, s.y));
        if (q && q.p[2] > -10) {
          s.hit = { p: q.p, n: FAR.normal(q.p[0], q.p[1]) };
          s.hit.snow = I.smoothstep(1200, 1500, q.p[2] + 200 * (noise(q.p[0] / 900, 3) - 0.5));
        }
      }
    }
  }
  const skyShade = (x, y) => {
    const top = (1 - y / H0) ** 1.4;
    const c = fbm(x / 210, y / 34);
    const cloud = I.smoothstep(0.5, 0.72, c) * (1 - I.smoothstep(0.85, 1, y / H0));
    return 0.1 + 0.6 * top - 0.3 * cloud * (0.4 + top);
  };
  const skyTone = (ctx) => {
    const f = farTone(ctx);
    return (s) => (s.sky ??= skyShade(s.x, s.y)) * (s.hit ? 0.7 : 1) + (s.hit ? 0.12 + f(s) : 0);
  };
  layer("sky", sky, skyTone, { from: 0.06, to: 0.95, width: 0.95 });

  // The snowy range: fall lines from each summit, crossed by rings round it (near contours) in the shade.
  // Radial lines thin out toward a summit, so they come in three bands, each with as many lines as its own
  // stretch of the face needs; a band hands over to the next across a short overlap, where its lines taper out.
  const BANDS = [
    { at: 0.1, span: [0, 0.24], keep: [-1, 0, 0.17, 0.24] },
    { at: 0.3, span: [0.17, 0.46], keep: [0.17, 0.24, 0.39, 0.46] },
    { at: 0.62, span: [0.39, 1], keep: [0.39, 0.46, 2, 3] },
  ];
  const fallLines = (surface, spacing) =>
    merge(
      BANDS.map((band) => {
        let len = 0;
        let prev = null;
        for (let i = 0; i <= 120; i++) {
          const [p] = surface.point(0.18 + (0.64 * i) / 120, band.at);
          const [x] = far.project(p);
          if (prev !== null) len += Math.abs(x - prev);
          prev = x;
        }
        const set = Hf(surface, { along: "v", lines: Math.max(4, Math.round(len / spacing)), range: [0.18, 0.82], span: band.span, step: 1.3 });
        const [a, b, c, d] = band.keep;
        for (const runs of set.lines) for (const run of runs) for (const q of run) q.band = I.smoothstep(a, b, q.a) * (1 - I.smoothstep(c, d, q.a));
        return set;
      }),
    );
  const crowd = (s) => I.smoothstep(0.5, 1.1, s.sp) * (s.band ?? 1);
  layer("range", merge(RANGE.surfaces.map((s) => fallLines(s, 1.5))), rangeTone, { from: 0.14, to: 0.8, width: 0.8 }, { fade: crowd });
  layer("range-x", merge(RANGE.surfaces.map((s) => Hf(s, { spacing: 2.1, step: 1.4, range: [0.02, 0.9], span: [0.18, 0.82] }))), rangeTone, { from: 0.42, to: 0.95, width: 0.6 }, { fade: crowd });

  // The forested hills under their trees, in short upright strokes; and the trees, each hatched across.
  const leaves = (s) => 0.6 + 0.6 * noise(s.x / 1.3, s.y / 3.5);
  layer("hills", merge([...HILLS.surfaces, ...BANKS.surfaces].map((s) => Hm(s, { along: "v", spacing: 1.3, step: 1.5, range: [0.15, 0.85] }))), hillTone, { from: 0.6, to: 0.98, width: 0.7 }, { fade: leaves, group: "mid" });
  const cardSets = cards.map((c) => {
    const D = c.base[1];
    return Hm(c, { spacing: D < 1200 ? 1.3 : 1.15, step: D < 1200 ? 0.8 : 1.1 });
  });
  layer("trees", merge(cardSets), cardTone, { from: 0.18, to: 0.85, width: 0.8 }, { group: "mid" });
  const bigCards = cards.filter((c) => c.base[1] < 1200);
  layer("trees-x", merge(bigCards.map((c) => Hm(c, { along: "v", spacing: 1.6, step: 0.7, slant: 0.4 }))), cardTone, { from: 0.6, to: 0.95, width: 0.55 }, { group: "mid" });

  // The outcrop: courses along the rib, crossed in the shade, and a third set under the ledges.
  layer("rock", Hn(rock, { spacing: 2.0, step: 1.1 }), mat(granite), { from: 0.16, to: 0.72, width: 1.15 }, { group: "near" });
  layer("rock-x", Hn(rock, { along: "v", spacing: 2.7, step: 1.1, slant: 0.5 }), mat(granite), { from: 0.52, to: 0.94, width: 0.9 }, { group: "near" });
  layer("rock-xx", Hn(rock, { spacing: 2.0, step: 1.1, offset: 0.5 }), mat(granite), { from: 0.78, to: 1, width: 0.7 }, { group: "near" });
  layer("boulders", merge(boulders.map((b) => Hn(b, { spacing: 1.7, step: 0.9 }))), mat(granite), { from: 0.16, to: 0.75, width: 1 }, { group: "near" });
  layer("boulders-x", merge(boulders.map((b) => Hn(b, { spacing: 2.3, step: 0.9, slant: 0.45 }))), mat(granite), { from: 0.55, to: 0.95, width: 0.8 }, { group: "near" });

  // The two pines: rings round each whorl, crossed by helices in the shade, and the bark in rings.
  const needleGrain = (s) => 0.7 + 0.5 * noise(s.x / 1.8, s.y / 0.9);
  layer("pine", merge(pines.map((p) => Hn(p.crown, { spacing: 1.45, step: 0.8 }))), mat(needles), { from: 0.14, to: 0.8, width: 1 }, { fade: needleGrain, group: "near" });
  layer("pine-x", merge(pines.map((p) => Hn(p.crown, { spacing: 2.1, step: 0.8, slant: 0.35 }))), mat(needles), { from: 0.5, to: 0.95, width: 0.8 }, { fade: needleGrain, group: "near" });
  layer("trunk", merge(pines.map((p) => Hn(p.trunk, { spacing: 1.2, step: 0.8 }))), mat(bark), { from: 0.15, to: 0.85, width: 0.75 }, { group: "near" });

  // The lake: level lines, closer together toward the far shore, broken into long strokes. Each sample is toned
  // by what the mirrored ray meets (or the sky it sees), and crossed by short upright strokes in the dark reflections.
  const water = [];
  for (let y = H0 + 0.7, k = 0; y < HEIGHT; k++) {
    const t = (y - H0) / (HEIGHT - H0);
    const sp = 1.15 + 1.75 * t ** 1.1;
    water.push({ y, k, sp });
    y += sp;
  }
  const isWater = (x, y) => y > H0 + 0.3 && occW.sees(onWater(x, y));
  const lakeSet = I.trace(
    water.map(({ y }) => (t) => [-2 + t * (WIDTH + 4), y]),
    { on: isWater, step: 1.6 },
  );
  lakeSet.lines.forEach((runs, i) => {
    const row = water[i];
    for (const run of runs) {
      for (const s of run) {
        s.sp = row.sp;
        s.p = onWater(s.x, s.y);
        s.n = [0, 0, 1];
        s.hit = reflectPick(s.p);
        s.mirror = skyShade(s.x, 2 * H0 - s.y);
        // Long strokes, broken where the water catches the light; the shore line itself is left bright.
        const len = 30 + 70 * (1 - row.sp / 3);
        const gap = noise(s.x / len + row.k * 3.1, row.k * 0.7);
        s.brk = I.smoothstep(0.18, 0.34, gap) * (0.85 + 0.3 * noise(s.x / 9, row.k));
        s.shore = isWater(s.x, s.y - 1.4) ? 1 : 0.15;
      }
    }
  });
  const reflectTone = (ctx) => {
    const tones = {
      far: (h) => 0.4 * I.lighting({ ...crag, ambient: 0.3, ...ctx })(h),
      range: rangeTone(ctx),
      hills: hillTone(ctx),
      banks: hillTone(ctx),
      cards: (h) => 0.8 * air(h.p),
      rock: I.lighting({ ...granite, ...ctx }),
      pine: () => 0.82,
    };
    return (s) => {
      if (!s.hit) return 0.85 * s.mirror;
      // A reflection is a shade darker than what it shows, and a little greyed by the sky it lies under.
      const t = tones[s.hit.g](s.hit);
      return 0.12 + 0.82 * t;
    };
  };
  const waterFade = (s) => s.brk * s.shore;
  layer("lake", lakeSet, reflectTone, { from: 0.08, to: 0.92, width: 1.0 }, { fade: waterFade, group: "water" });

  const verticals = [];
  const vr = rand(5);
  for (let x = 1; x < WIDTH; x += 1.9 + 0.8 * vr()) verticals.push((t) => [x, H0 + 1 + t * (HEIGHT - H0)]);
  const streaks = I.trace(verticals, { on: isWater, step: 1.2, spacing: 1.9 });
  for (const runs of streaks.lines) {
    for (const run of runs) {
      for (const s of run) {
        s.p = onWater(s.x, s.y);
        s.n = [0, 0, 1];
        s.hit = reflectPick(s.p);
        s.mirror = skyShade(s.x, 2 * H0 - s.y);
        s.brk = I.smoothstep(0.45, 0.7, noise(s.x / 2.5, s.y / 14));
        s.shore = 1;
      }
    }
  }
  layer("lake-v", streaks, reflectTone, { from: 0.62, to: 0.98, width: 0.6 }, { fade: waterFade, group: "water" });

  const marks = [];

  return {
    cam,
    solids,
    shadowTris: {
      far: I.trianglesOf([...ranges]),
      near: I.trianglesOf(nearSolids),
    },
    layers,
    marks: marks.join(""),
    stats: { cards: cards.length },
  };
};

/**
 * Ink the layers for a solar time. A negative plate (pale ink on dark paper) inks the light instead of the shade.
 */
export const inkAt = (S, hours, { size = 1024, negative = false } = {}) => {
  const { light } = sunAt(hours);
  const far = I.shadowMap(null, light, { size, tris: S.shadowTris.far, soft: 1 });
  const near = I.shadowMap(null, light, { size, tris: S.shadowTris.near, soft: 1 });
  const out = {};
  for (const l of S.layers) {
    // A white-line plate cuts one system only: crossings inked in the light would print as a net.
    if (negative && /-x+$/.test(l.id)) {
      out[l.id] = "";
      continue;
    }
    const shadow = l.group === "near" ? near : far;
    const t = l.tone({ light, view: S.cam.view, shadow });
    // Dark trees would vanish on dark paper, so their shade keeps a little light to show their shape.
    const floor = /^(pine|trunk|trees)$/.test(l.id) ? 0.3 : 0;
    const tone = negative ? (s) => floor + (1 - floor) * (1 - t(s)) : t;
    out[l.id] = I.ink(l.set, l.fade ? (s) => tone(s) * (s.fade ??= l.fade(s, negative)) : tone, l.ink);
  }
  return out;
};
