import * as I from "../../kit/intaglio.mjs";

// An ammonite in a block of limestone, engraved. The fossil is an evolute logarithmic spiral, each whorl a rounded tube
// a little over twice the size of the one inside it, ribbed across, the ribs swelling toward the outer edge and leaning
// forward as they go. It stands proud of the block's face in a hollow chipped out of the rough matrix. A low light rakes
// across the face and slowly circles round it, left, over the top, to the right: the ribs throw their shadows each way
// in turn, and the block's long shadow swings over the ground.
// World units: the face is the plane y = 0 looking toward -y, x right, z up; the ground is z = 0.

export const WIDTH = 760;
export const HEIGHT = 560;

const range = (n) => Array.from({ length: n }, (_, i) => i);
const S = I.smoothstep;
const hash = (i, j = 0) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (x, y = 0) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const f = (t) => t * t * (3 - 2 * t);
  const fx = f(x - i);
  const fy = f(y - j);
  const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * fx;
  const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * fx;
  return a + (b - a) * fy;
};
const fbm = (x, y) => noise(x, y) * 0.5 + noise(x * 2.03 + 5, y * 2.03) * 0.3 + noise(x * 4.1, y * 4.1 + 9) * 0.2;

const BLOCK = { x0: -160, x1: 160, z0: 0, z1: 250, depth: 110 };
const C = [0, 128];
const W = 1.72;
const B = Math.log(W) / I.TAU;
const R_END = 104;
const PHI_END = 0;
const RIBS = 30;
const TURNS = 5.4;
const r = (phi) => R_END * Math.exp(B * (phi - PHI_END));

/** The fossil at a point of the face: which whorl, where across it (0 inner edge, 1 outer), and its angle along the spiral. */
const whorlAt = (x, z) => {
  const dx = x - C[0];
  const dz = z - C[1];
  const rho = Math.hypot(dx, dz);
  if (rho < 1e-3) return null;
  const th = Math.atan2(dz, dx);
  // The smallest spiral angle at this bearing whose radius reaches past the point.
  let phi = th + I.TAU * Math.ceil((Math.log(rho / R_END) / B + PHI_END - th) / I.TAU);
  if (phi > PHI_END) return null;
  if (phi < PHI_END - TURNS * I.TAU) return null;
  const outer = r(phi);
  const inner = r(phi - I.TAU);
  return { phi, t: (rho - inner) / (outer - inner), size: outer - inner };
};

/** The fossil's height above the face at spiral angle phi, t across the whorl. */
const shellHeight = (phi, t, size) => {
  const round = Math.sin(Math.PI * I.clamp01(t)) ** 0.55;
  const lean = 1.1 * t;
  const rib = (0.5 + 0.5 * Math.cos(RIBS * phi + lean * 2)) ** 3;
  const ribH = rib * (0.08 + 0.2 * t) * S(PHI_END - TURNS * I.TAU, PHI_END - TURNS * I.TAU + 4, phi);
  const groove = 0.05 * S(0.85, 1, t);
  return size * (0.3 * round + ribH * round - groove);
};

/** The matrix: rough limestone, chipped down into a hollow round the fossil, with a few cracks. */
const matrixHeight = (x, z) => {
  const d = Math.hypot(x - C[0], z - C[1]);
  const hollow = -9 * S(R_END * 1.45, R_END * 0.95, d);
  const rough = 2.2 * (fbm(x / 26, z / 26) - 0.5) + 0.5 * (noise(x / 5, z / 5) - 0.5);
  const crack = -3 * Math.exp(-(((z - 30 - 0.35 * x - 12 * Math.sin(x / 40)) / 1.6) ** 2)) * S(-150, -60, x);
  return hollow + rough + crack;
};
const reliefAt = (x, z) => {
  const w = whorlAt(x, z);
  const base = matrixHeight(x, z);
  if (!w) return base;
  return Math.max(base, -5 + shellHeight(w.phi, w.t, w.size));
};
const inFossil = (x, z) => !!whorlAt(x, z);

export const scene = ({ ss = 3, coarse = 1 } = {}) => {
  const { x0, x1, z0, z1, depth } = BLOCK;
  const facePoint = (x, z) => [x, -reliefAt(x, z), z];
  // The face's rock, with the fossil cut out of it; edges fade to the block's arrises.
  const rock = I.patch({
    at: (u, v) => facePoint(x0 + (x1 - x0) * u, z0 + (z1 - z0) * v),
    nu: 200,
    nv: 160,
    mask: (u, v) => !inFossil(x0 + (x1 - x0) * u, z0 + (z1 - z0) * v),
  });
  // Each whorl its own patch, so its lines run across it with the ribs and its spacing stays even.
  const whorls = [];
  for (let k = 0; k < Math.ceil(TURNS); k++) {
    const a = PHI_END - (k + 1) * I.TAU;
    const b = PHI_END - k * I.TAU;
    const lo = Math.max(a, PHI_END - TURNS * I.TAU);
    if (lo >= b) break;
    const opts = {
      at: (u, v) => {
        const phi = lo + (b - lo) * u;
        const inner = r(phi - I.TAU);
        const rho = inner + (r(phi) - inner) * (0.002 + 0.996 * v);
        const x = C[0] + rho * Math.cos(phi);
        const z = C[1] + rho * Math.sin(phi);
        return facePoint(x, z);
      },
      nu: Math.round(240 * (b - lo) / I.TAU),
      nv: 14,
    };
    const w = I.patch(opts);
    whorls.push(w.point(0.5, 0.5)[1][1] < 0 ? w : I.patch({ ...opts, side: -1 }));
  }
  const top = I.face({ points: [[x0, 0, z1], [x1, 0, z1], [x1, depth, z1], [x0, depth, z1]], along: [1, 0, 0], outward: [0, 0, 1] });
  const right = I.face({ points: [[x1, 0, z0], [x1, depth, z0], [x1, depth, z1], [x1, 0, z1]], along: [0, 0, 1], outward: [1, 0, 0] });
  const left = I.face({ points: [[x0, 0, z0], [x0, depth, z0], [x0, depth, z1], [x0, 0, z1]], along: [0, 0, 1], outward: [-1, 0, 0] });
  const ground = I.face({ points: [[-700, -500, 0], [700, -500, 0], [700, 600, 0], [-700, 600, 0]], along: [1, 0, 0], outward: [0, 0, 1] });
  const block = [rock, ...whorls, top, right, left];
  const cam = I.fitCamera(
    [[x0, 0, 0], [x1, 0, 0], [x0, 0, z1], [x1, depth, z1], [x0, depth, z1], [x1, depth, 0], [x1 + 60, 30, 0], [x0 - 20, -40, 0]],
    { width: WIDTH, height: HEIGHT, pad: 26, azimuth: -74, elevation: 14 },
  );
  const solids = [ground, ...block];
  const occ = I.occlusion(solids, cam, { ss, halo: block });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, { ...opts, step: (opts.step ?? 1.6) * coarse });
  const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });
  const facing = (f) => I.dot(f.normal, cam.view) > 0;

  const limestone = { base: 0.12, ambient: 0.1, bounce: 0.06 };
  const shell = { base: 0.18, ambient: 0.08, bounce: 0.1, gloss: 0.25, shine: 14 };
  const earth = { base: 0.2, ambient: 0.16, bounce: 0 };

  const fade = (s) => 1 - S(160, 420, Math.hypot((s.p[0] - 40) * 0.8, s.p[1] * 1.6));
  const grain = (s) => 0.85 + 0.3 * fbm(s.p[0] / 9, s.p[2] / 9);

  const layers = [];
  const layer = (id, set, material, ink, shape, map = "near") => layers.push({ id, set, material, ink, shape, map });
  layer("ground", H(ground, { spacing: 2.6, step: 1.8 }), earth, { from: 0.15, to: 0.85, width: 1 }, fade, "far");
  layer("ground-x", H(ground, { spacing: 3.2, slant: 0.5, step: 1.8 }), earth, { from: 0.55, to: 0.95, width: 0.8 }, fade, "far");
  layer("rock", H(rock, { spacing: 1.7, slant: 0.15, step: 1.2 }), limestone, { from: 0.12, to: 0.72, width: 1 }, grain);
  layer("rock-x", H(rock, { along: "v", spacing: 2.2, slant: 0.55, step: 1.3 }), limestone, { from: 0.52, to: 0.92, width: 0.8 }, grain);
  layer("rock-xx", H(rock, { spacing: 2.8, slant: -0.8, step: 1.4 }), limestone, { from: 0.8, to: 1, width: 0.6 });
  layer("whorls", merge(whorls.map((w) => H(w, { along: "v", spacing: 1.35, step: 0.9 }))), shell, { from: 0.08, to: 0.7, width: 0.85 });
  layer("whorls-x", merge(whorls.map((w) => H(w, { spacing: 1.9, slant: 0.4, step: 1 }))), shell, { from: 0.52, to: 0.92, width: 0.7 });
  layer("whorls-xx", merge(whorls.map((w) => H(w, { along: "v", spacing: 2.3, slant: 0.7, step: 1 }))), shell, { from: 0.8, to: 1, width: 0.55 });
  const sides = [top, right, left].filter(facing);
  layer("sides", merge(sides.map((f) => H(f, { spacing: 2, step: 1.3 }))), limestone, { from: 0.12, to: 0.75, width: 1 }, grain);
  layer("sides-x", merge(sides.map((f) => H(f, { spacing: 2.6, slant: 0.6, step: 1.3 }))), limestone, { from: 0.55, to: 0.95, width: 0.8 }, grain);

  // Engraved arrises round the block's face and the spiral's sutures between whorls.
  const marks = [];
  const M = (pts, width) => marks.push(I.stroke(pts, cam, occ.sees, { width, lift: 1.2, step: 1 }));
  M([[x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0]], 0.6);
  M([[x1, 0, z1], [x1, depth, z1], [x0, depth, z1], [x0, 0, z1]], 0.5);
  M([[x1, depth, z1], [x1, depth, z0]], 0.5);
  const suture = range(900).map((i) => {
    const phi = PHI_END - TURNS * I.TAU + I.TAU + ((TURNS - 1) * I.TAU * i) / 899;
    const rho = r(phi - I.TAU) * 1.004;
    const x = C[0] + rho * Math.cos(phi);
    const z = C[1] + rho * Math.sin(phi);
    return facePoint(x, z);
  });
  M(suture, 0.45);

  return {
    cam, solids, layers, marks: marks.join(""),
    near: I.trianglesOf(block), far: I.trianglesOf(solids),
  };
};

/** The raking light at a turn s in [0, 1]: from the left, low over the top, to the right, always grazing the face. */
export const lightAt = (s) => {
  const a = (165 - 150 * s) * I.deg;
  return I.unit([Math.cos(a), -0.36, Math.sin(a) * 0.75 + 0.12]);
};

/** Ink every layer for a turn of the light. The face's own shadows come from a fine map of the block alone. */
export const inkAt = (S, s, { size = 1280, negative = false } = {}) => {
  const light = lightAt(s);
  const maps = { near: I.shadowMap(null, light, { size, tris: S.near }), far: I.shadowMap(null, light, { size: Math.round(size * 0.6), tris: S.far }) };
  const out = {};
  for (const l of S.layers) {
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow: maps[l.map] });
    const tone = negative ? (q) => 1 - lit(q) : lit;
    out[l.id] = I.ink(l.set, l.shape ? (q) => tone(q) * l.shape(q) : tone, l.ink);
  }
  return out;
};
