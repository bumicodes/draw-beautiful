import * as I from "../../kit/intaglio.mjs";

// The Pont du Gard, the Roman aqueduct bridge over the Gardon near Nîmes, seen from downstream at an angle, engraved.
// World units are metres in the bridge's own frame: x runs along the bridge from the left (north) bank to the right
// (south) bank, y points downstream, z is up from the water. Three tiers of arches, each centred on the axis line:
// six on the bottom (22 m high, 6.36 m thick, the river arch 24.5 m wide), eleven on the middle (19.5 m, 4.56 m)
// and thirty-five small ones on the top (7.3 m, 3.06 m) carrying the covered conduit, 275 m long and 48.8 m above
// the river. The arches of the two lower tiers share their piers and their imposts; the top tier keeps its own rhythm.
// The road bridge of 1747 built against the lower tier is left out. The sun follows the sky at 43.9° N through
// midsummer's day: the downstream faces take the morning light and fall into shade after noon, when the bridge's
// shadow and the light through its arches lie on the water in front of it.

export const WIDTH = 820;
export const HEIGHT = 520;

export const LATITUDE = 43.95;
export const DECLINATION = 23.44;

/** Compass bearings of the frame's axes: x (along the bridge, north to south) and y (downstream). */
const AXIS = 170;
const DOWNSTREAM = AXIS - 90;

const PIER = 5.1;
const MID_SPANS = [14, 14, 14, 14, 15.75, 19.2, 21.5, 24.52, 19.6, 15.75, 14.5];
const BOTTOM_OF = [4, 9];
const MID_X0 = -121;
const MID_LEN = 242;
const TOP_LEN = 275;
const TOP_BAYS = 35;
const TOP_SPAN = 4.8;

const BOT = { z1: 22, impost: 7.7, t: 6.36, ring: 1.45 };
const MID = { z1: 41.5, impost: 27.4, t: 4.56, ring: 1.2 };
const TOP = { z1: 48.2, impost: 43, t: 3.06, ring: 0.45, slab: 48.8 };

const EYE = [178, 262, 7];
const TARGET = [-48, 0, 22];

const MATERIALS = {
  stone: { base: 0.07, ambient: 0.2, bounce: 0.14 },
  soffit: { base: 0.12, ambient: 0.18, bounce: 0.16 },
  rock: { base: 0.12, ambient: 0.22, bounce: 0.06 },
  scrub: { base: 0.34, ambient: 0.22, bounce: 0.04 },
  leaves: { base: 0.42, ambient: 0.18, bounce: 0.05 },
};

const range = (n) => Array.from({ length: n }, (_, i) => i);
const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });
const lerp = (a, b, t) => a + (b - a) * t;

/** The sun at a solar time in hours: altitude, bearing and its direction in the bridge's frame. */
export const sunAt = (hours) => {
  const phi = LATITUDE * I.deg;
  const dec = DECLINATION * I.deg;
  const ha = (hours - 12) * 15 * I.deg;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const cosA = (Math.sin(dec) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
  const az = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const bearing = (ha > 0 ? I.TAU - az : az) / I.deg;
  const [e, n, z] = I.sunDirection(bearing, Math.max(2, alt / I.deg));
  const ax = [Math.sin(AXIS * I.deg), Math.cos(AXIS * I.deg)];
  const dn = [Math.sin(DOWNSTREAM * I.deg), Math.cos(DOWNSTREAM * I.deg)];
  return { altitude: alt / I.deg, bearing, light: [e * ax[0] + n * ax[1], e * dn[0] + n * dn[1], z] };
};

// Deterministic noise.
const hash = (i, j = 0) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (x, y = 0) => {
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
const fbm = (x, y) => 0.5 * noise(x, y) + 0.3 * noise(x * 2.1 + 5.2, y * 2.1 + 1.3) + 0.2 * noise(x * 4.3 + 9.1, y * 4.3 + 7.7);
const rand = (seed) => {
  let k = seed;
  return () => hash(k++, seed * 0.37);
};

/** A monotone cubic through [x, y] knots (Fritsch–Carlson), flat beyond the ends. */
const monotone = (knots) => {
  const n = knots.length;
  const xs = knots.map((k) => k[0]);
  const ys = knots.map((k) => k[1]);
  const d = range(n - 1).map((i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = range(n).map((i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (xs[i + 1] < x) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
};

// The valley: its section at the bridge, bent toward the south below it as the Gardon turns for Remoulins.
const SECTION = monotone([
  [-420, 84], [-280, 74], [-190, 62], [-148, 50], [-128, 36], [-112, 27], [-82, 18], [-56, 10], [-44, 5],
  [-34, 1.2], [-26, -1.6], [0, -2.6], [45, -3], [82, -2.6], [90, -0.6], [96, 3.6], [104, 12], [113, 24], [122, 35],
  [140, 47], [176, 57], [270, 68], [420, 78],
]);
const bend = (y) => 0.42 * y * I.smoothstep(-40, 140, y);
const OUTCROP = { x: 120, y: 158, r: 16, h: 7 };

/** Height of the ground (rock, banks and hills) at x, y. */
export const groundAt = (x, y) => {
  const s = x - bend(y);
  const base = SECTION(s);
  const hill = I.smoothstep(4, 30, base);
  const lumps = 9 * (fbm(x / 70, y / 70) - 0.5) * hill * I.smoothstep(15, 60, Math.abs(y));
  const rock = (2.2 * (fbm(x / 9, y / 9) - 0.5) + 1.2 * Math.abs(noise(x / 4.2, y / 4.2) - 0.5)) * I.smoothstep(-1.5, 3, base);
  const boulders = 6 * Math.max(0, fbm(x / 13 + 3, y / 13) - 0.6) * (1 - I.smoothstep(-1, 3, base)) * I.smoothstep(5, 25, Math.abs(y));
  const crag = OUTCROP.h * Math.max(0, 1 - Math.hypot(x - OUTCROP.x, (y - OUTCROP.y) * 1.3) / OUTCROP.r) ** 1.4 * (0.75 + 0.5 * fbm(x / 5, y / 5));
  return base + lumps + rock + boulders + crag;
};
const normalAt = (x, y) => {
  const e = 0.35;
  const dx = groundAt(x + e, y) - groundAt(x - e, y);
  const dy = groundAt(x, y + e) - groundAt(x, y - e);
  return I.unit([-dx, -dy, 2 * e]);
};

/** The arches of each tier: centre x, radius, sill and springing. */
const layout = () => {
  const end = (MID_LEN - MID_SPANS.reduce((a, b) => a + b, 0) - (MID_SPANS.length - 1) * PIER) / 2;
  let x = MID_X0 + end;
  const mid = MID_SPANS.map((span, i) => {
    const a = { cx: x + span / 2, r: span / 2, i };
    x += span + PIER;
    return a;
  });
  const bottom = mid.slice(BOTTOM_OF[0], BOTTOM_OF[1] + 1);
  const bx0 = bottom[0].cx - bottom[0].r - PIER / 2;
  const bx1 = bottom.at(-1).cx + bottom.at(-1).r + PIER / 2;
  const bay = TOP_LEN / TOP_BAYS;
  const top = range(TOP_BAYS).map((k) => ({ cx: -TOP_LEN / 2 + (k + 0.5) * bay, r: TOP_SPAN / 2 }));
  const over = (x) => x > bx0 && x < bx1;
  return {
    bottom: { x0: bx0, x1: bx1, arches: bottom.map((a) => ({ ...a, sill: -3, spring: BOT.impost })) },
    middle: { x0: MID_X0, x1: MID_X0 + MID_LEN, arches: mid.map((a) => ({ ...a, sill: over(a.cx) ? BOT.z1 : 4, spring: MID.impost })) },
    top: { x0: -TOP_LEN / 2, x1: TOP_LEN / 2, arches: top.map((a) => ({ ...a, sill: Math.abs(a.cx) < MID_LEN / 2 ? MID.z1 : 26, spring: TOP.impost })) },
  };
};

const inArch = (a, x, z) => {
  const t = x - a.cx;
  return Math.abs(t) < a.r && z > a.sill && (z < a.spring || t * t + (z - a.spring) ** 2 < a.r * a.r);
};

/** One piece of a tier's downstream face from x0 to x1 and z0 to z1, pierced by the tier's arches. */
const wallPiece = ({ x0, x1, z0, z1, y, arches, density }) =>
  I.patch({
    at: (u, v) => [lerp(x0, x1, u), y, lerp(z0, z1, v)],
    side: -1,
    mask: (u, v) => {
      const x = lerp(x0, x1, u);
      const z = lerp(z0, z1, v);
      return !arches.some((a) => inArch(a, x, z));
    },
    nu: Math.ceil((x1 - x0) * density),
    nv: Math.ceil((z1 - z0) * density),
  });

/** The jambs and soffit of an arch, from the downstream face back through the tier to the upstream face. */
const reveal = (a, t) => {
  const jamb = a.spring - a.sill;
  const total = 2 * jamb + Math.PI * a.r;
  const outline = (u) => {
    const l = u * total;
    if (l < jamb) return [-a.r, a.sill + l];
    if (l > total - jamb) return [a.r, a.sill + (total - l)];
    const th = Math.PI * (1 - (l - jamb) / (Math.PI * a.r));
    return [a.r * Math.cos(th), a.spring + a.r * Math.sin(th)];
  };
  return I.patch({
    at: (u, v) => {
      const [x, z] = outline(u);
      return [a.cx + x, lerp(t / 2, -t / 2, v), z];
    },
    nu: Math.max(24, Math.ceil(total * 1.2)),
    nv: 2,
  });
};

/** A tier: its downstream face in pieces, the reveals of its arches, its top, its ends and its cornice. */
const tier = ({ x0, x1, arches }, { z1, t }, pieces, density) => {
  const y = t / 2;
  const faces = pieces.map((p) => wallPiece({ ...p, y, arches, density }));
  const reveals = arches.map((a) => reveal(a, t));
  const zLow = Math.min(...pieces.map((p) => p.z0));
  const top = I.face({ points: [[x0, -y, z1], [x1, -y, z1], [x1, y, z1], [x0, y, z1]], along: [1, 0, 0], outward: [0, 0, 1] });
  const ends = [x0, x1].map((x, k) => I.face({ points: [[x, -y, zLow], [x, y, zLow], [x, y, z1], [x, -y, z1]], along: [0, 1, 0], outward: [k ? 1 : -1, 0, 0] }));
  return { faces, reveals, top, ends };
};

/**
 * A pick buffer: triangles rasterised from a perspective camera keeping the nearest one's depth, normal and group per
 * pixel. `at(x, y)` is the surface seen at a screen point; `beyond(p)` follows the ray from the eye through p past it.
 */
const pickBuffer = (groups, cam, ss = 2) => {
  const w = Math.ceil(cam.width * ss);
  const h = Math.ceil(cam.height * ss);
  const depth = new Float32Array(w * h).fill(-Infinity);
  const normal = new Float32Array(w * h * 3);
  const id = new Uint8Array(w * h);
  groups.forEach((tris, g) => {
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
            id[k] = g;
          }
        }
      }
    }
  });
  const D = Math.hypot(...I.sub(cam.eye, cam.target));
  const read = (x, y) => {
    const i = Math.floor(x * ss);
    const j = Math.floor(y * ss);
    if (i < 0 || j < 0 || i >= w || j >= h) return -1;
    const k = j * w + i;
    return depth[k] > -Infinity ? k : -1;
  };
  const ray = (x, y, z) => {
    const a = ((x - cam.offset[0]) * z) / (cam.scale * D);
    const b = (-(y - cam.offset[1]) * z) / (cam.scale * D);
    return I.add(cam.eye, I.add(I.mul(cam.view, -z), I.add(I.mul(cam.right, a), I.mul(cam.up, b))));
  };
  const hitAt = (x, y, k) => ({ p: ray(x, y, (D * D) / depth[k]), n: [normal[k * 3], normal[k * 3 + 1], normal[k * 3 + 2]], id: id[k] });
  return {
    at: (x, y) => {
      const k = read(x, y);
      return k < 0 ? null : hitAt(x, y, k);
    },
    beyond: (p) => {
      const [x, y, d] = cam.project(p);
      const k = read(x, y);
      if (k < 0 || depth[k] > d) return null;
      return hitAt(x, y, k);
    },
    ray,
  };
};

/**
 * A surface laid out in screen space: lines run along screen rows across `rect`, each sample landing on whatever
 * `hit(x, y)` finds there ({ p, n } or null). For ground and water seen from a low eye, whose lines an engraver
 * rules level and evenly spaced on the plate however the ground falls away.
 */
const screenSurface = (cam, [x0, y0, x1, y1], hit, far) => {
  const xy = (u, v) => [lerp(x0, x1, u), lerp(y0, y1, v)];
  return {
    point: (u, v) => {
      const [x, y] = xy(u, v);
      const h = hit(x, y);
      return h ? [h.p, h.n] : [far(x, y), cam.view];
    },
    mask: (u, v) => !!hit(...xy(u, v)),
    triangles: () => [],
  };
};

/** A holm oak's crown: a lumpy dome. */
const clump = (center, R, seed) => {
  const r = rand(seed * 13 + 1);
  const bumps = range(12).map(() => {
    const z = 2 * r() - 1;
    const a = r() * I.TAU;
    const s = Math.sqrt(1 - z * z);
    return { d: [s * Math.cos(a), s * Math.sin(a), z], k: 0.12 + 0.16 * r() };
  });
  const at = (u, v) => {
    const lon = u * I.TAU;
    const lat = (v - 0.5) * Math.PI * 0.98;
    const d = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    let k = 0.84 - 0.18 * Math.max(0, -d[2]);
    for (const b of bumps) {
      const c = d[0] * b.d[0] + d[1] * b.d[1] + d[2] * b.d[2];
      if (c > 0) k += b.k * c ** 9;
    }
    return I.add(center, [d[0] * R * k, d[1] * R * k, d[2] * R * k * 0.82]);
  };
  return { center, R, surface: I.patch({ at, nu: 16, nv: 10 }) };
};

export const scene = ({ ss = 3 } = {}) => {
  const L = layout();

  // The three tiers. The middle and top tiers come down to the slopes beyond the tier below them.
  const bottom = tier(L.bottom, BOT, [{ x0: L.bottom.x0, x1: L.bottom.x1, z0: -3, z1: BOT.z1 }], 1.7);
  const middle = tier(L.middle, MID, [
    { x0: L.middle.x0, x1: L.middle.x1, z0: BOT.z1, z1: MID.z1 },
    { x0: L.middle.x0, x1: L.bottom.x0, z0: 4, z1: BOT.z1 },
    { x0: L.bottom.x1, x1: L.middle.x1, z0: 4, z1: BOT.z1 },
  ], 1.7);
  const top = tier(L.top, TOP, [
    { x0: L.top.x0, x1: L.top.x1, z0: MID.z1, z1: TOP.z1 },
    { x0: L.top.x0, x1: L.middle.x0, z0: 26, z1: MID.z1 },
    { x0: L.middle.x1, x1: L.top.x1, z0: 26, z1: MID.z1 },
  ], 3);
  const ledge = (x0, x1, z, t, out, h) => I.box({ min: [x0, -t / 2 - out, z - h], max: [x1, t / 2 + out, z], capAlong: [1, 0, 0] });
  const cornices = [
    ...ledge(L.bottom.x0, L.bottom.x1, BOT.z1, BOT.t, 0.3, 0.55),
    ...ledge(L.middle.x0, L.middle.x1, MID.z1, MID.t, 0.28, 0.5),
    ...ledge(L.top.x0, L.top.x1, TOP.slab, TOP.t, 0.3, TOP.slab - TOP.z1),
  ];
  const tiers = [bottom, middle, top];
  const faces = tiers.flatMap((t) => t.faces);
  const reveals = tiers.flatMap((t) => t.reveals);
  const caps = tiers.flatMap((t) => [t.top, ...t.ends]);
  const bridge = [...faces, ...reveals, ...caps, ...cornices];

  const cam = I.fitCamera([[L.top.x0, 0, TOP.slab], [L.top.x1, TOP.t / 2, TOP.slab], [L.top.x1, 0, 30], [L.top.x0, 0, 40], [40, 3, -27], [L.top.x0, 0, -20], [-185, 0, 58]], {
    width: WIDTH,
    height: HEIGHT,
    pad: 40,
    eye: EYE,
    target: TARGET,
  });
  const D = Math.hypot(...I.sub(EYE, TARGET));

  // The ground: a fan of terrain from just in front of the eye to the far hills, finest near the eye.
  const fwd = I.unit([cam.view[0] * -1, cam.view[1] * -1, 0]);
  const side = [fwd[1], -fwd[0], 0];
  const halfW = (Math.max(cam.offset[0], WIDTH - cam.offset[0]) + 40) / (cam.scale * D);
  const D0 = 6;
  const D1 = 1400;
  const fan = (u, v) => {
    const d = D0 + (D1 - D0) * v * v;
    const w = (2 * u - 1) * d * halfW * 1.15;
    return [EYE[0] + fwd[0] * d + side[0] * w, EYE[1] + fwd[1] * d + side[1] * w];
  };
  const terrain = I.patch({
    at: (u, v) => {
      const [x, y] = fan(u, v);
      return [x, y, groundAt(x, y)];
    },
    nu: 300,
    nv: 340,
  });
  const terrainTris = terrain.triangles();
  const water = I.face({
    points: [fan(0, 0.02), fan(1, 0.02), fan(1, 1), fan(0, 1)].map(([x, y]) => [x, y, 0]),
    along: [side[0], side[1], 0],
    outward: [0, 0, 1],
  });

  // Holm oaks and box on the banks and the slopes at the bridge's ends.
  const tr = rand(17);
  const trees = [];
  const plant = (n, region) => {
    let tries = 0;
    while (n > 0 && tries++ < 4000) {
      const [x, y] = region(tr(), tr());
      // Keep every crown well in front of the eye and inside the view: one beside or behind it would blow up.
      const ahead = (x - EYE[0]) * fwd[0] + (y - EYE[1]) * fwd[1];
      const across = (x - EYE[0]) * side[0] + (y - EYE[1]) * side[1];
      if (Math.abs(y) < 7 + TOP.t || ahead < 110 || Math.abs(across) > ahead * halfW * 1.1) continue;
      const g = groundAt(x, y);
      if (g < 1.5 || g > 66) continue;
      const slope = normalAt(x, y)[2];
      if (slope < 0.6) continue;
      const R = 2.4 + 2.2 * tr();
      const k = 2 + Math.floor(tr() * 3);
      const seed = trees.length;
      for (let c = 0; c < k; c++) {
        const a = tr() * I.TAU;
        const off = c === 0 ? 0 : R * (0.5 + 0.4 * tr());
        const cx = x + Math.cos(a) * off;
        const cy = y + Math.sin(a) * off;
        trees.push(clump([cx, cy, groundAt(cx, cy) + R * (0.75 + 0.35 * tr())], R * (0.75 + 0.3 * tr()), seed * 7 + c));
      }
      n--;
    }
  };
  // South bank below the bridge, the eye's side; the slopes at both ends; the north bank downstream.
  plant(26, (a, b) => [bend(lerp(20, 190, b)) + lerp(100, 150, a), lerp(20, 190, b)]);
  plant(30, (a, b) => [lerp(110, 210, a), lerp(-90, 60, b)]);
  plant(38, (a, b) => [lerp(-220, -70, a), lerp(-110, 70, b)]);
  plant(18, (a, b) => [bend(lerp(25, 200, b)) + lerp(-70, -36, a), lerp(25, 200, b)]);
  const crowns = trees.map((t) => t.surface);

  const solids = [terrain, water, ...bridge, ...crowns];
  const occ = I.occlusion(solids, cam, { ss, halo: [...bridge, ...crowns] });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const all = (list, opts) => merge(list.filter((s) => !s.normal || I.dot(s.normal, cam.toward(s.point(0.5, 0.5)[0])) > 0.01).map((s) => H(s, opts)));

  const { stone, soffit, leaves } = MATERIALS;

  const layers = [];
  const layer = (id, set, material, ink, shape) => layers.push({ id, set, material, ink, shape });

  // Screen rows over the ground and the water, toned by what each sample lands on.
  const [, horizon] = cam.project(I.add(EYE, I.mul(fwd, 1e5)));
  const ground = pickBuffer([terrainTris], cam, 2);
  const far = (x, y) => ground.ray(x, y, 5000);
  const landHit = (x, y) => {
    const h = ground.at(x, y);
    if (!h) return null;
    h.n = normalAt(h.p[0], h.p[1]);
    return h;
  };
  const waterHit = (x, y) => {
    if (y < horizon + 0.5) return null;
    const p = ground.ray(x, y, 1);
    const dz = p[2] - EYE[2];
    if (dz >= 0) return null;
    const t = -EYE[2] / dz;
    if (t > 3000) return null;
    return { p: I.add(EYE, I.mul(I.sub(p, EYE), t)), n: [0, 0, 1] };
  };
  const rows = (hit, top = horizon - 140) => {
    const rect = [-6, top, WIDTH + 6, HEIGHT + 2];
    return screenSurface(cam, rect, hit, far);
  };
  const distance = (p) => Math.hypot(p[0] - EYE[0], p[1] - EYE[1]);
  const span = HEIGHT + 6;
  const landRows = rows(landHit, -4);
  const land = H(landRows, { lines: Math.round(span / 2.3), step: 1.3 });
  const landX = H(landRows, { lines: Math.round(span / 3), step: 1.4, slant: 0.35 });
  // Scrub on the hills in dark patches, rock pale and broken, everything paler with distance.
  const texture = (s) => {
    const [x, y, z] = s.p;
    const g = SECTION(x - bend(y));
    const bush = I.smoothstep(0.5, 0.68, fbm(x / 8, y / 8)) * I.smoothstep(4, 20, g);
    const crack = 0.75 + 0.4 * noise(x / 3, y / 3 + z / 2);
    const air = 1 - 0.3 * I.smoothstep(260, 1100, distance(s.p));
    return { bush, air, crack };
  };
  for (const set of [land, landX]) for (const runs of set.lines) for (const run of runs) for (const s of run) s.tex = texture(s);
  layers.push({ id: "land", set: land, land: true, ink: { from: 0.07, to: 0.82, width: 0.95 } });
  layers.push({ id: "land-x", set: landX, land: true, cross: true, ink: { from: 0.55, to: 0.95, width: 0.7 } });

  // The water: level rows, each sample toned by what the mirrored ray meets, broken by ripples, shaded where the
  // bridge's shadow lies on it.
  const mirrorEye = [EYE[0], EYE[1], -EYE[2]];
  const lift = (tris) => tris.filter((t) => t[0][2] > 0.05 || t[1][2] > 0.05 || t[2][2] > 0.05);
  const mirrorPts = [[L.top.x0, 0, TOP.slab], [L.top.x1, 0, TOP.slab], [L.top.x0, 0, 0], [L.top.x1, 0, 0], ...range(5).map((k) => [...fan(k / 4, 0.03), 0]), ...range(5).map((k) => [...fan(k / 4, 0.6), 80])];
  const mirror = I.fitCamera(mirrorPts, { width: 900, height: 700, pad: 4, eye: mirrorEye, target: [TARGET[0], TARGET[1], -TARGET[2]] });
  const reflect = pickBuffer([lift(I.trianglesOf(bridge)), lift(terrainTris), I.trianglesOf(crowns)], mirror, 2);
  const waterRows = rows(waterHit, horizon - 2);
  const pool = H(waterRows, { lines: Math.round((HEIGHT + 4 - horizon) / 1.55), step: 2 });
  for (const runs of pool.lines) {
    for (const run of runs) {
      for (const s of run) {
        const h = reflect.beyond(s.p);
        if (h && h.id === 1) h.n = normalAt(h.p[0], h.p[1]);
        s.hit = h;
        const near = I.smoothstep(horizon, HEIGHT, s.y);
        s.k = (0.7 + 0.45 * noise(s.x / (3 + 9 * near), s.y * 0.8)) * vignetteOf(s);
        s.sky = 0.14 + 0.34 * near;
      }
    }
  }
  layers.push({ id: "water", set: pool, reflect: true, ink: { from: 0.12, to: 0.9, width: 0.8 } });

  // The bridge: courses along each face, lines into the depth on the jambs and round under the vaults.
  layer("faces", all(faces, { spacing: 1.7, step: 1 }), stone, { from: 0.2, to: 0.75, width: 0.9 });
  layer("faces-x", all(faces, { spacing: 2.2, slant: 0.55, step: 1 }), stone, { from: 0.56, to: 0.95, width: 0.7 });
  layer("reveals", all(reveals, { along: "v", spacing: 1.35, step: 0.8 }), soffit, { from: 0.18, to: 0.8, width: 0.8 });
  layer("reveals-x", all(reveals, { spacing: 1.9, step: 0.8 }), soffit, { from: 0.6, to: 0.96, width: 0.65 });
  layer("caps", all([...caps, ...cornices], { spacing: 1.2, step: 0.8 }), stone, { from: 0.2, to: 0.8, width: 0.7 });

  // The oaks: short level strokes over each crown, and leafy flicks lit by the point they sit on.
  const leafy = (s) => 0.55 + 0.7 * noise(s.x / 1.7, s.y / 1.3);
  layer("crowns", all(crowns, { spacing: 1.3, step: 1.5, slant: 0.25 }), leaves, { from: 0.25, to: 0.9, width: 0.75 }, leafy);
  const flicks = { lines: [] };
  const fr = rand(41);
  for (const c of trees) {
    const [cx, cy] = cam.project(c.center);
    const [ex] = cam.project(I.add(c.center, I.mul(side, c.R)));
    const px = Math.abs(ex - cx);
    const count = Math.min(500, Math.round(px * px * 0.5));
    for (let k = 0; k < count; k++) {
      const [p, n] = c.surface.point(fr(), 0.15 + 0.8 * fr());
      if (I.dot(n, cam.toward(p)) < 0.05 || !occ.sees(I.add(p, I.mul(cam.toward(p), 0.6)))) continue;
      const [x, y] = cam.project(p);
      const rad = 0.9 + 0.9 * fr();
      const rot = (fr() - 0.5) * 1.4;
      const run = range(4).map((i) => {
        const a = rot + Math.PI * (0.15 + (0.7 * i) / 3);
        return { x: x + rad * Math.cos(a), y: y + rad * (Math.sin(a) - 0.5), p, n, sp: 2.2, w: Math.sin((Math.PI * (0.5 + i)) / 4) };
      });
      flicks.lines.push([run]);
    }
  }
  layer("flicks", flicks, leaves, { from: 0.3, to: 0.9, width: 0.8 }, (s) => s.w);

  // The sky: ruled above the hills, darkest at the top, fading at its sides and down toward the horizon.
  const [cx0] = cam.project([0, 0, 0]);
  const [, yTop] = cam.project([L.top.x1, 0, TOP.slab]);
  const sky = I.ruling(cam, occ, { spacing: 2.45, halo: 7, region: (x, y) => y < horizon - 2 && !landHit(x, y) && !landHit(x, y + 4) && !landHit(x, y + 2) });
  const skyTone = (s) => {
    const edge = 1 - I.smoothstep(0.7, 1, Math.hypot((s.x - WIDTH / 2) / (WIDTH * 0.52), (s.y - HEIGHT * 0.42) / (HEIGHT * 0.58)));
    return (0.14 + 0.5 * I.smoothstep(horizon, yTop - 40, s.y)) * edge;
  };

  // Engraved marks: arch rings and their voussoir joints, the impost blocks, the cornice lines, the conduit's course.
  const marks = [];
  const S = (pts, width = 0.35) => marks.push(I.stroke(pts, cam, occ.sees, { width, lift: 0.25 }));
  const ring = (a, r, y, n = 28) => range(n + 1).map((k) => [a.cx - r * Math.cos((Math.PI * k) / n), y, a.spring + r * Math.sin((Math.PI * k) / n)]);
  for (const [T, spec] of [[L.bottom, BOT], [L.middle, MID], [L.top, TOP]]) {
    const y = spec.t / 2 + 0.03;
    for (const a of T.arches) {
      S(ring(a, a.r + spec.ring, y), spec === TOP ? 0.3 : 0.42);
      if (spec !== TOP) {
        const n = Math.round((Math.PI * (a.r + spec.ring / 2)) / 1.15);
        for (let k = 1; k < n; k++) {
          const th = (Math.PI * k) / n;
          const c = Math.cos(th);
          const sn = Math.sin(th);
          S([[a.cx - a.r * c, y, a.spring + a.r * sn], [a.cx - (a.r + spec.ring) * c, y, a.spring + (a.r + spec.ring) * sn]], 0.26);
        }
      }
    }
    // The impost course across each pier, a block deep.
    const imp = spec === TOP ? 0.35 : 0.7;
    for (let k = 0; k < T.arches.length - 1; k++) {
      const a = T.arches[k];
      const b = T.arches[k + 1];
      for (const z of [a.spring, a.spring - imp]) S([[a.cx + a.r, y, z], [b.cx - b.r, y, z]], 0.38);
    }
  }
  S([[L.top.x0, TOP.t / 2 + 0.03, 45.9], [L.top.x1, TOP.t / 2 + 0.03, 45.9]], 0.3);

  const casters = [...bridge, ...crowns];
  const near = terrainTris.filter((t) => {
    const [x, y] = t[0];
    return x > -260 && x < 260 && y > -140 && y < 230;
  });
  return { cam, solids, tris: [...near, ...I.trianglesOf(casters)], layers, sky, skyTone, marks: marks.join("") };
};

/** Ink every layer for a solar time. A negative plate (pale ink on dark paper) inks the light, not the shade. */
export const inkAt = (S, hours, { size = 1024, negative = false } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(null, light, { size, tris: S.tris, soft: 1.1 });
  const view = S.cam.view;
  const L = (m) => I.lighting({ ...m, light, view, shadow });
  const lit = Object.fromEntries(["stone", "rock", "scrub", "leaves"].map((k) => [k, L(MATERIALS[k])]));
  const out = {};
  for (const l of S.layers) {
    if (l.reflect) {
      const byId = [lit.stone, lit.rock, lit.leaves];
      const tone = (s) => {
        if (s.k < 0.02) return 0;
        const r = s.hit ? 0.06 + 0.8 * byId[s.hit.id](s.hit) : s.sky;
        const shade = 1 - shadow.lit(s.p, [0, 0, 1]);
        const t = 1 - (1 - r) * (1 - 0.32 * shade);
        // On the negative the water carries the light, held back so the bridge stays the brightest thing.
        return (negative ? 0.8 * (1 - t) : t) * s.k;
      };
      out[l.id] = I.ink(l.set, tone, l.ink);
      continue;
    }
    if (l.land) {
      const tone = (s) => {
        const { bush, air, crack } = s.tex;
        // A light tint of lines over every slope so the hills hold their form even in full sun.
        const v = 0.15 + 0.85 * (lit.rock(s) * (1 - bush) + lit.scrub(s) * bush);
        const t = negative ? 1 - v : v;
        return t * air * crack;
      };
      out[l.id] = I.ink(l.set, (s) => {
        if (s.vig === undefined) s.vig = vignetteOf(s);
        return s.vig > 0.01 ? tone(s) * s.vig : 0;
      }, l.ink);
      continue;
    }
    const m = I.lighting({ ...l.material, light, view, shadow });
    const tone = negative ? (s) => 1 - m(s) : m;
    out[l.id] = I.ink(l.set, l.shape ? (s) => tone(s) * (s.fade ??= l.shape(s) * vignetteOf(s)) : tone, l.ink);
  }
  return out;
};

const vignetteOf = (s) => {
  const sideFade = 1 - I.smoothstep(0.86, 1, Math.abs(s.x - WIDTH / 2) / (WIDTH / 2));
  const bottom = 1 - I.smoothstep(HEIGHT - 60, HEIGHT - 10, s.y + 14 * noise(s.x / 24, 3.3));
  return sideFade * bottom;
};
