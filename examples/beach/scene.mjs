import * as I from "../../kit/intaglio.mjs";

// A beach at the tideline, engraved in two inks: sand and shells in sepia, the sea and sky in teal.
// Dry sand rippled by the wind holds a whelk, a scallop, a cowrie, a cockle, a sand dollar and a starfish;
// behind them the wet sand slopes to a breaking wave and the open sea under a low afternoon sun.
// Wave after wave rolls in, breaks and runs up the wet sand as swash; only the sea under the wave and the wet zone are re-inked.
// World units are centimetres: x along the shore, y out to sea, z up.

export const WIDTH = 760;
export const HEIGHT = 500;

const ELEVATION = 24;
const SCALE = 5.4;
const HORIZON_Y = 150;
const SHORE = 60;
const HORIZ = SHORE + 48;
const FRONT = -72;
const WET = 22;
const RUN = 21;

const sin = Math.sin(ELEVATION * I.deg);

/** The sun: low in the west, over the left shoulder of the view and a little behind the beach. */
export const LIGHT = I.unit([-0.74, 0.12, 0.56]);

const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });
const hash = (i, j) => {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const noise = (x, y) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * sx;
  const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * sx;
  return a + (b - a) * sy;
};
const smin = (a, b, k) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));

// The beach: a berm of dry sand with wind ripples, falling to a steeper smooth foreshore that runs under the sea.
export const sandZ = (x, y) => {
  const t = SHORE - y;
  const dry = 1 - I.smoothstep(WET - 10, WET, y);
  const swell = 0.8 * Math.sin(0.05 * x + 0.4) * Math.sin(0.07 * y + 1.1) * dry;
  // Wind ripples run slantwise up the beach, square to the low sun, so it rakes them.
  const crest = 0.8 * x + 0.6 * y + 2.4 * Math.sin(0.09 * y + 0.03 * x) + 1.4 * Math.sin(0.05 * x - 0.03 * y) + 5 * noise(x * 0.07 + 9, y * 0.09);
  const ripple = 0.17 * Math.sin((I.TAU * crest) / 3.4) * dry * I.smoothstep(0.2, 0.75, noise(x * 0.05, y * 0.06));
  return 0.03 * t + 0.1 * smin(t, 38, 6) + swell + ripple;
};

// The sea. Crests run along the shore and crowd toward the horizon, standing in for the perspective an
// orthographic camera does not have. Its rows of lines crowd the same way: row v lies at seaY(v).
const crowd = (d) => d * (1 + 1.1 * I.smoothstep(0, HORIZ - SHORE, d));
const SEA_FAR = HORIZ - SHORE + 4;
const seaY = (v) => SHORE - 4 + SEA_FAR * (v * 1.6 - 0.6 * v * v);
const seaV = (y) => (1.6 - Math.sqrt(Math.max(0, 2.56 - 2.4 * ((y - SHORE + 4) / SEA_FAR)))) / 1.2;
export const seaZ = (x, y) => {
  const d = y - SHORE;
  const calm = 1 - 0.75 * I.smoothstep(16, HORIZ - SHORE, d);
  const q = crowd(d);
  const swell = 0.35 * Math.sin((I.TAU * q) / 6.5 + 0.5 * Math.sin(0.04 * x)) * I.smoothstep(14, 24, d);
  const chop = 0.16 * Math.sin(0.3 * x + 0.6 * q) + 0.13 * Math.sin(-0.24 * x + 0.8 * q + 2) + 0.08 * Math.sin(0.55 * x - 0.4 * q);
  return (swell + chop) * calm;
};

// The wave. Each cycle (phase p in [0, 1)) a swell rises far out, steepens as it runs in, breaks into a white crest,
// and runs in as a bore of foam that lands on the shore at p = LANDS and becomes the swash.
const OUT = 40;
export const LANDS = 0.74;
const SURF = 16;
const FACE = [-2.6, 0.15];
export const waveAt = (p) => {
  const k = Math.min(1, p / LANDS);
  const dw = OUT * (1 - k) ** 1.15;
  const grow = I.smoothstep(OUT, 14, dw);
  const broken = I.smoothstep(14, 10.5, dw);
  const height = (0.45 + 2.35 * grow) * (1 - 0.6 * broken * I.smoothstep(10, 1, dw)) * I.smoothstep(0, 0.08, p) * I.smoothstep(0, 2, dw);
  return { p, dw, height, broken, front: 1.25 + 2.6 * (1 - grow), active: p < LANDS };
};
const crestAlong = (x) => 0.7 + 0.3 * Math.sin(0.024 * x + 0.9);
const skew = (x) => 1.6 * Math.sin(0.03 * x + 0.5);
const waveZ = (w, x, y) => {
  const b = y - SHORE - w.dw - skew(x);
  return w.height * crestAlong(x) * (b < 0 ? Math.exp(-((b / w.front) ** 2)) : Math.exp(-((b / 5.5) ** 1.4)));
};

// Shells, each a function (u, v) → point in its own frame (x side, y forward, z up), placed on the sand by `place`.

/**
 * A gastropod: a tube coiled round its axis on a logarithmic spiral, from the apex (u = 0) to the aperture (u = 1),
 * v round the tube. Spaced so equal steps of u are equal lengths of coil.
 */
export const coil = ({ size, turns, growth, spire, girth, elong = 1, knobs = 0, knobCount = 9, cords = 0, canal = 0, lip = 0 }) => {
  const T = turns * I.TAU;
  const k = Math.log(growth) / I.TAU;
  const E = Math.exp(k * T);
  return (u, v) => {
    const th = Math.log(1 + u * (E - 1)) / k;
    const g = Math.exp(k * (th - T));
    const phi = v * I.TAU;
    const shoulder = Math.max(0, Math.cos(phi - 0.9)) ** 5;
    const body = I.smoothstep(1 - 1 / turns, 1, th / T);
    let rho = girth * g * (1 + knobs * shoulder * (0.5 + 0.5 * Math.cos(knobCount * th)) + cords * Math.sin(22 * phi));
    rho *= 1 + lip * I.smoothstep(0.965, 1, u) * Math.max(0, Math.cos(phi + 0.3));
    const rr = g + rho * Math.cos(phi);
    const down = canal * body * g * Math.max(0, -Math.sin(phi)) ** 3;
    const along = -spire * g + rho * elong * Math.sin(phi) - down;
    return [rr * Math.cos(th) * size, rr * Math.sin(th) * size, along * size];
  };
};

/** A bivalve: a ribbed fan from the umbo (v = 0) to the margin (v = 1), u across the fan; `dome` < 0 is a dish. */
export const valve = ({ size, spread, dome, ribs, rib, round = 0.36 }) => (u, v) => {
  const al = (u - 0.5) * 2 * spread;
  const r = size * v * (1 - round + round * Math.cos(al * 1.15));
  const ridge = Math.abs(Math.cos(Math.PI * u * ribs)) ** 0.7;
  const h = dome * (1 - v * v) ** 0.7 * (1 - 0.3 * (al / spread) ** 2) + rib * size * v ** 0.8 * ridge * Math.sign(dome || 1);
  return [r * Math.sin(al), r * Math.cos(al), h];
};

/** A starfish: five domed arms, v from the disc's centre to the arm's edge. */
export const star = ({ size, height }) => (u, v) => {
  const al = u * I.TAU;
  const arm = (0.5 + 0.5 * Math.cos(5 * al)) ** 2.2;
  const r = v * size * (0.3 + 0.7 * arm);
  const across = Math.max(0, 1 - v ** 3) ** 0.6;
  const h = (0.35 + height * (1 - 0.55 * (r / size) ** 1.4)) * across;
  return [r * Math.cos(al), r * Math.sin(al), h];
};

/** A cowrie: a glossy egg, humped on its back, its toothed slit hidden underneath. u round its long axis, v along it. */
export const cowrie = ({ length, width, height }) => (u, v) => {
  const lon = u * I.TAU;
  const lat = (v - 0.5) * Math.PI;
  const c = Math.cos(lat);
  const s = Math.sin(lat);
  const up = Math.sin(lon);
  const hump = up > 0 ? height * (1 + 0.12 * (1 - s * s)) : height * 0.45;
  return [width * c * Math.cos(lon), length * s * (1 + 0.04 * up), hump * c * up];
};

/** Orient a local surface (x side, y forward, z up) by yaw, pitch and roll, centre it on (x, y) and settle it `sink` into the sand. */
export const place = (at, { x, y, yaw = 0, pitch = 0, roll = 0, sink = 0.4 }) => {
  const [cy, sy] = [Math.cos(yaw * I.deg), Math.sin(yaw * I.deg)];
  const [cp, sp] = [Math.cos(pitch * I.deg), Math.sin(pitch * I.deg)];
  const [cr, sr] = [Math.cos(roll * I.deg), Math.sin(roll * I.deg)];
  const rot = ([a, b, c]) => {
    const b1 = b * cp - c * sp;
    const c1 = b * sp + c * cp;
    const a2 = a * cr + c1 * sr;
    const c2 = -a * sr + c1 * cr;
    return [a2 * cy - b1 * sy, a2 * sy + b1 * cy, c2];
  };
  const pts = [];
  for (let i = 0; i <= 32; i++) for (let j = 0; j <= 32; j++) pts.push(rot(at(i / 32, j / 32)));
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  // Rest it on the sand under its own footprint, so the swell and ripples never swallow a part of it.
  const clear = Math.min(...pts.map((p) => p[2] - sandZ(p[0] - mx + x, p[1] - my + y)));
  const z = -sink - clear;
  return (u, v) => {
    const p = rot(at(u, v));
    return [p[0] - mx + x, p[1] - my + y, p[2] + z];
  };
};

const camera = () => {
  const oy = HORIZON_Y + SCALE * HORIZ * sin;
  return I.camera({ azimuth: -90, elevation: ELEVATION, scale: SCALE, offset: [WIDTH / 2, oy], width: WIDTH, height: HEIGHT });
};

/** The vignette: everything fades into the paper toward a soft superellipse inside the plate. */
const vignette = (x, y) => {
  const dx = Math.abs(x - WIDTH / 2) / (WIDTH * 0.5);
  const dy = Math.abs(y - HEIGHT * 0.5) / (HEIGHT * 0.52);
  return 1 - I.smoothstep(0.8, 1, (dx ** 3.4 + dy ** 3.4) ** (1 / 3.4));
};

/** The swash front at phase t in [0, 1): it rushes up fast, slows to its reach, and drains back. */
export const reachAt = (t) => {
  const up = 0.36;
  if (t < up) return RUN * (1 - (1 - t / up) ** 2.4);
  return RUN * (1 - I.smoothstep(up, 0.97, t));
};
const lobe = (x) => 1 + 0.24 * Math.sin(0.055 * x + 1.1) + 0.1 * Math.sin(0.14 * x + 2.3);
const frontAt = (x, t) => SHORE + 1 - reachAt(t) * lobe(x);

export const scene = ({ ss = 3, live = false } = {}) => {
  const cam = camera();

  const sand = I.patch({ at: (u, v) => { const x = -110 + 220 * u; const y = FRONT - 16 + (SHORE + 12 - FRONT + 16) * v; return [x, y, sandZ(x, y)]; }, nu: 150, nv: 160 });
  const seaAt = (w) => (u, v) => {
    const x = -120 + 240 * u;
    const y = seaY(v);
    return [x, y, seaZ(x, y) + (w ? waveZ(w, x, y) : 0)];
  };
  const sea = I.patch({ at: seaAt(null), nu: 160, nv: 200 });
  const swashSurface = I.patch({
    at: (u, v) => {
      const x = -110 + 220 * u;
      const y = WET - 4 + (SHORE + 2 - WET + 4) * v;
      return [x, y, sandZ(x, y) + 0.12 + 0.07 * Math.sin(0.5 * x + 0.9 * y) * Math.sin(0.21 * x - 0.3 * y)];
    },
    nu: 60,
    nv: 24,
  });

  const whelkAt = place(coil({ size: 7.6, turns: 6, growth: 1.8, spire: 1.9, girth: 0.58, elong: 1.5, knobs: 0.2, cords: 0.012, canal: 0.9, lip: 0.2 }), { x: -8, y: -26, yaw: -100, pitch: 85, roll: 30, sink: 0.9 });
  const scallopAt = place(valve({ size: 18, spread: 56 * I.deg, dome: 3.4, ribs: 17, rib: 0.05 }), { x: 30, y: -40, yaw: 200, pitch: -3, sink: 0.2 });
  const cockleAt = place(valve({ size: 10.5, spread: 70 * I.deg, dome: -3.4, ribs: 22, rib: 0.035, round: 0.18 }), { x: 47, y: -8, yaw: 172, pitch: -22, sink: 0.4 });
  const cowrieAt = place(cowrie({ length: 5.2, width: 3.6, height: 3.1 }), { x: 16, y: -12, yaw: 62, sink: 0.3 });
  const starAt = place(star({ size: 14, height: 1.7 }), { x: -44, y: -42, yaw: 8, sink: 0.2 });
  const DOLLAR = [-42, 0];
  const dollar = I.lathe({ base: [DOLLAR[0], DOLLAR[1], sandZ(...DOLLAR) - 0.1], profile: [[0, 8.6, 1], [0.45, 9], [0.9, 8.9], [1.25, 8.2], [1.5, 6.8], [1.7, 4.3], [1.8, 1.5], [1.81, 0, 1]] });

  const whelk = I.sheet({ at: whelkAt, nu: 200, nv: 40 });
  const scallop = I.patch({ at: scallopAt, nu: 68, nv: 36 });
  const cockle = I.sheet({ at: cockleAt, nu: 60, nv: 30 });
  const cowrieShell = I.patch({ at: cowrieAt, nu: 48, nv: 32, side: -1 });
  const starfish = I.patch({ at: starAt, nu: 200, nv: 28, side: -1 });

  // The scallop's ears: flat wings either side of the umbo, along the hinge line.
  const hingeDir = [Math.cos(200 * I.deg), Math.sin(200 * I.deg), 0];
  const ear = (side) => I.patch({
    at: (u, v) => {
      const umbo = scallopAt(0.5, 0);
      const flank = scallopAt(side < 0 ? 0 : 1, 0.22);
      const hinge = I.add(umbo, I.add(I.mul(hingeDir, side * 4.6), [0, 0, -0.5]));
      const a = I.add(umbo, I.mul(I.sub(hinge, umbo), u));
      const b = I.add(umbo, I.mul(I.sub(flank, umbo), 0.25 + 0.75 * u));
      return I.add(I.add(a, I.mul(I.sub(b, a), v)), [0, 0, 0.3 * Math.sin(Math.PI * v) * (1 - u * 0.5)]);
    },
    nu: 10,
    nv: 8,
  });
  const ears = [ear(-1), ear(1)];

  const shells = [whelk[0], scallop, ...ears, cockle[0], cowrieShell, starfish, dollar];
  const solids = [sand, sea, ...shells];
  const occ = I.occlusion(solids, cam, { ss, halo: [sea] });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);
  const both = (pair, opts) => merge(pair.map((s) => H(s, opts)));
  // A coiled shell's growth lines are counted along its outer edge, where the tube is widest.
  const growthLines = (at, spacing) => {
    let len = 0;
    let prev = null;
    for (let i = 0; i <= 400; i++) {
      const q = cam.project(at(i / 400, 0));
      if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      prev = q;
    }
    return Math.round(len / spacing);
  };

  const shell = { base: 0.04, ambient: 0.26, bounce: 0.22, gloss: 0.25, shine: 24 };
  const pearl = { base: 0.18, ambient: 0.2, bounce: 0.1, gloss: 0.7, shine: 30 };
  const porcelain = { base: 0.12, ambient: 0.24, bounce: 0.2, gloss: 0.9, shine: 40 };
  const starMat = { base: 0.34, ambient: 0.22, bounce: 0.16 };
  const drySand = { base: 0.1, ambient: 0.3, bounce: 0 };
  const wetSand = { base: 0.2, ambient: 0.3, bounce: 0, gloss: 0.35, shine: 10 };

  const sun = (() => {
    const [x0, y0] = cam.project([0, 0, 0]);
    const dx = I.dot(LIGHT, cam.right);
    const dy = -I.dot(LIGHT, cam.up);
    const y = HORIZON_Y * 0.42;
    return [Math.max(235, x0 + (dx * (y - y0)) / dy), y];
  })();

  // Layers: static ones are inked once with the cast shadows; the wet zone is re-inked as the swash moves.
  const layers = [];
  const layer = (id, make, material, ink, extra = {}) => {
    if (live && !extra.live) return;
    layers.push({ id, set: make(), material, ink, cls: "intaglio-ink", ...extra });
  };
  const teal = { cls: "intaglio-ink-2" };

  const sandLines = H(sand, { spacing: 2.6, step: 1.5 });
  const grain = (s) => 0.8 + 0.4 * noise(s.x * 0.9, s.y * 2.3);
  const fadeSand = (s) => vignette(s.x, s.y) * grain(s);
  layer("sand", () => ({ lines: sandLines.lines.filter((l) => l[0][0].p[1] < WET - 6) }), drySand, { from: 0.27, to: 0.78, width: 1.1 }, { shape: fadeSand });
  layer("sand-x", () => H(sand, { spacing: 3.3, slant: 0.5, step: 1.5, range: [0, 0.55] }), drySand, { from: 0.6, to: 0.95, width: 0.85 }, { shape: fadeSand });

  // Spiral colour bands round the whelk, spots on the cowrie, a darker disc on the starfish.
  const bands = (s) => 0.26 * I.smoothstep(0.35, 0.9, Math.sin(5 * I.TAU * s.a + 1));
  const spots = (s) => 0.5 * I.smoothstep(0.62, 0.72, noise(s.p[0] * 1.6, s.p[1] * 1.6));
  layer("whelk", () => H(whelk[0], { along: "v", lines: growthLines(whelkAt, 1.7), step: 1 }), shell, { from: 0.18, to: 0.72, width: 1 }, { pattern: bands });
  layer("whelk-x", () => H(whelk[0], { spacing: 2.3, slant: 0.25, step: 1 }), shell, { from: 0.58, to: 0.95, width: 0.8 });
  layer("whelk-in", () => H(whelk[1], { along: "v", lines: growthLines(whelkAt, 2), step: 1 }), pearl, { from: 0.25, to: 0.85, width: 0.9 });
  layer("scallop", () => H(scallop, { along: "v", spacing: 1.45, step: 1 }), shell, { from: 0.17, to: 0.72, width: 0.95 }, {
    pattern: (s) => 0.2 * I.smoothstep(0.2, 0.9, Math.sin(I.TAU * s.a * 4.5)),
  });
  layer("scallop-x", () => H(scallop, { spacing: 2.2, step: 1 }), shell, { from: 0.55, to: 0.95, width: 0.75 });
  layer("ears", () => merge(ears.map((e) => H(e, { spacing: 1.5, step: 1 }))), shell, { from: 0.2, to: 0.75, width: 0.85 });
  layer("cockle", () => both(cockle, { along: "v", spacing: 1.5, step: 1 }), shell, { from: 0.18, to: 0.72, width: 0.9 });
  layer("cockle-x", () => both(cockle, { spacing: 2.1, step: 1 }), shell, { from: 0.58, to: 0.95, width: 0.7 });
  layer("cowrie", () => H(cowrieShell, { spacing: 1.4, step: 0.9 }), porcelain, { from: 0.16, to: 0.75, width: 0.85 }, { pattern: spots });
  layer("cowrie-x", () => H(cowrieShell, { along: "v", spacing: 1.9, step: 0.9 }), porcelain, { from: 0.6, to: 0.95, width: 0.7 });
  // The starfish is ruled across its arms and pricked with the knobs of its skin.
  const knobs = (s) => 0.45 * I.smoothstep(0.6, 0.78, noise(s.p[0] * 2.6, s.p[1] * 2.6)) - 0.25 * I.smoothstep(0.55, 0.8, noise(s.p[0] * 2.6 + 40, s.p[1] * 2.6));
  layer("star", () => H(starfish, { spacing: 1.45, step: 0.8 }), starMat, { from: 0.22, to: 0.78, width: 0.9 }, { pattern: knobs });
  layer("star-x", () => H(starfish, { along: "v", spacing: 2.4, step: 1 }), starMat, { from: 0.62, to: 0.95, width: 0.7 });
  layer("dollar", () => H(dollar, { spacing: 1.6, step: 1 }), { ...shell, base: 0.1 }, { from: 0.2, to: 0.75, width: 0.9 });

  // The sea, in teal: lines that ride the swell, a sheen under the sun, lacy whitewater inside the surf.
  // Its rows are counted so the moving wave can re-rule exactly the rows it passes over.
  const water = (s) => {
    const d = s.p[1] - SHORE;
    let t = (0.64 - 0.42 * I.dot(s.n, LIGHT)) * (0.78 + 0.36 * I.smoothstep(14, 46, d));
    t *= 0.5 + 0.5 * I.smoothstep(0, 2.5, HORIZ - s.p[1]);
    const sheen = Math.exp(-(((s.x - sun[0]) / 150) ** 2)) * I.smoothstep(0.45, 0.8, noise(s.x * 0.16, s.y * 0.8));
    return t * (1 - 0.75 * sheen);
  };
  const surf = (s, w) => {
    const d = s.p[1] - SHORE;
    const x = s.p[0];
    const past = d - w.dw - skew(x);
    const lace = I.smoothstep(0.38, 0.62, noise(x * 0.22, d * 0.7 + w.p * 2));
    const fresh = w.active ? w.broken * I.smoothstep(-0.5, 1, past) * (1 - I.smoothstep(2, 13, past)) : 0;
    const froth = 0.45 * (1 - I.smoothstep(6, 14, d)) * I.smoothstep(-1, 2, d);
    const white = Math.max(fresh, froth);
    return water(s) * (1 - white) + white * 0.42 * lace * I.smoothstep(0, 3, d);
  };
  const waveTone = (s, w) => {
    const x = s.p[0];
    const b = s.p[1] - SHORE - w.dw - skew(x);
    let t = s.p[1] - SHORE < SURF ? surf(s, w) : water(s);
    const steep = I.smoothstep(0.6, 2.4, w.height * crestAlong(x));
    const face = I.smoothstep(-2.3 * w.front, -0.5 * w.front, b) * (1 - I.smoothstep(-0.35, 0.1, b));
    t += (0.86 - t) * face * steep;
    // Once it breaks, foam spills from the lip down the face until the whole front is a white bore.
    const spill = w.broken * (0.3 + 0.7 * I.smoothstep(11, 3, w.dw)) * (0.8 + 0.2 * noise(x * 0.06, 5));
    const foam = I.smoothstep(-spill * 2.4 * w.front - 0.35, -spill * 2.4 * w.front + 0.1, b) * (1 - I.smoothstep(0.4, 1.6, b)) * w.broken;
    const lace = I.smoothstep(0.42, 0.68, noise(x * 0.35, b * 1.3 + w.p * 8));
    t = t * (1 - foam) + foam * 0.34 * lace;
    const trail = w.broken * I.smoothstep(0.5, 0.72, noise(x * 0.14, b * 0.45 - w.p * 3)) * I.smoothstep(0.5, 2, b) * (1 - I.smoothstep(5, 11, b));
    return t * (1 - 0.8 * trail);
  };
  const seaN = Math.round((cam.project([0, SHORE - 4, 0])[1] - cam.project([0, HORIZ, 0])[1]) / 1.9);
  const seaRows = H(sea, { lines: seaN, step: 1.2 }).lines.map((line) => {
    const y = line[0][0].p[1];
    return { line, y, k: Math.floor(seaV(y) * seaN) };
  });

  // The wet zone: shining sand where the swash has drained, a teal film where it covers.
  // Wet sand holds the sky in long streaks of sheen.
  const sheen = (s) => 1 - 0.6 * I.smoothstep(0.5, 0.78, noise(s.p[0] * 0.045, s.p[1] * 0.7));
  layer("wet", () => ({ lines: sandLines.lines.filter((l) => l[0][0].p[1] >= WET - 6) }), wetSand, { from: 0.3, to: 0.9, width: 1 }, {
    live: true,
    shape: (s) => fadeSand(s) * sheen(s),
  });
  layer("swash", () => H(swashSurface, { spacing: 2.2, step: 1.4 }), null, { from: 0.06, to: 0.7, width: 0.9 }, { ...teal, live: true });

  // The sky: ruled, darkest overhead, a glow round the sun and a bank of cloud on the horizon.
  const sky = live ? null : I.ruling(cam, occ, { spacing: 2.5, halo: 3, region: (x, y) => y < HORIZON_Y - 5 && vignette(x, y) > 0 && Math.hypot(x - sun[0], y - sun[1]) > 11 });
  // The sun's disc, ruled only on the negative plate, where the light itself is what carries the ink.
  const disc = live ? null : I.ruling(cam, occ, { spacing: 1.6, halo: 0, region: (x, y) => Math.hypot(x - sun[0], y - sun[1]) < 8.6 });
  const blobs = [[520, HORIZON_Y - 16, 30], [562, HORIZON_Y - 30, 30], [604, HORIZON_Y - 20, 26], [474, HORIZON_Y - 11, 20], [640, HORIZON_Y - 11, 18], [590, HORIZON_Y - 46, 18], [545, HORIZON_Y - 44, 15]];
  const cloud = (x, y) => {
    let c = 0;
    for (const [bx, by, r] of blobs) c = Math.max(c, 1 - Math.hypot((x - bx) / 1.3, y - by) / r);
    return c;
  };
  const skyTone = (s) => {
    const up = I.smoothstep(HORIZON_Y, 0, s.y);
    let t = 0.14 + 0.4 * up;
    const r = Math.hypot(s.x - sun[0], s.y - sun[1]);
    t *= 0.12 + 0.88 * I.smoothstep(12, 110, r);
    const c = cloud(s.x, s.y);
    if (c > 0) {
      const lit = I.smoothstep(HORIZON_Y - 60, HORIZON_Y - 8, s.y) * 0.75 + 0.25 * I.smoothstep(500, 650, s.x);
      t = t * (1 - I.smoothstep(0, 0.1, c)) + (0.12 + 0.4 * lit) * I.smoothstep(0.02, 0.3, c) * (1 - 0.6 * I.smoothstep(0.3, 0.9, c) * (1 - lit));
    }
    const streak = I.smoothstep(0.62, 0.9, noise(s.x * 0.01, s.y * 0.12)) * (1 - up * 0.5) * 0.6;
    return t * (1 - streak);
  };

  // Fixed engraved marks: the sand dollar's five petals, wrack along the last high-water line, gulls far out.
  let marks = "";
  let birds = "";
  if (!live) {
    const S = (pts, opts) => (marks += I.stroke(pts, cam, occ.sees, opts));
    const top = (r) => sandZ(...DOLLAR) - 0.1 + 1.81 - 0.31 * (r / 6.8) ** 2.2;
    for (let k = 0; k < 5; k++) {
      const a0 = (k * 72 + 18) * I.deg;
      for (const side of [-1, 1]) {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const r = 1.1 + (4.4 * i) / 24;
          const w = 1.05 * Math.sin((Math.PI * (r - 1.1)) / 4.4) ** 0.8;
          const a = a0 + (side * w) / r;
          pts.push([DOLLAR[0] + r * Math.cos(a), DOLLAR[1] + r * Math.sin(a), top(r)]);
        }
        S(pts, { width: 0.42, taper: 4 });
      }
    }
    for (let i = 0; i < 70; i++) {
      const x = -64 + 128 * hash(i, 7) + 3 * hash(i, 8);
      const y = 12 + 3.5 * Math.sin(0.06 * x + 1) + 2.4 * (hash(i, 9) - 0.5);
      const ang = hash(i, 10) * Math.PI;
      const len = 0.8 + 2.4 * hash(i, 11) ** 2;
      const bend = (hash(i, 12) - 0.5) * 1.2;
      const pts = [];
      for (let j = 0; j <= 6; j++) {
        const t = j / 6 - 0.5;
        const px = x + Math.cos(ang) * len * t - Math.sin(ang) * bend * (t * t - 0.25);
        const py = y + Math.sin(ang) * len * t + Math.cos(ang) * bend * (t * t - 0.25);
        pts.push([px, py, sandZ(px, py) + 0.05]);
      }
      const [sx, sy] = cam.project(pts[3]);
      if (vignette(sx, sy) > 0.3) S(pts, { width: 0.35 + 0.35 * hash(i, 13), taper: 2 });
    }
    for (const [bx, by, w] of [[468, 62, 9], [492, 74, 6.5], [446, 82, 5], [640, 104, 4]]) {
      const pts = [];
      for (let j = 0; j <= 20; j++) {
        const t = j / 20 - 0.5;
        const y = by - w * 0.32 * Math.sin(Math.PI * Math.abs(t) * 2) * (1 - Math.abs(t)) + w * 0.18 * Math.abs(t);
        pts.push({ x: bx + w * t * 2, y, sp: 3, t });
      }
      birds += I.ink({ lines: [[pts]] }, (s) => 1 - Math.abs(s.t) * 1.6 + 0.2 * (Math.abs(s.t) < 0.06 ? 1 : 0), { from: 0, to: 1, width: 0.5 + w * 0.06 });
    }
  }

  return {
    cam, occ, solids, shadowSolids: [sand, ...shells], layers, sky, skyTone, sun, disc, marks, birds,
    seaN, seaRows, water, surf, waveTone,
    waveSurface: (w) => I.patch({ at: seaAt(w), nu: 2, nv: 2 }),
    // The face, from its foot to just over the crest, parametrised along the crest so its lines follow the wave.
    faceSurface: (w) => I.patch({
      at: (u, v) => {
        const x = -120 + 240 * u;
        const y = SHORE + w.dw + skew(x) + FACE[0] * w.front + (FACE[1] - FACE[0] * w.front) * v;
        return [x, y, seaZ(x, y) + waveZ(w, x, y)];
      },
      nu: 2,
      nv: 2,
    }),
  };
};

const toneOf = (S, l, shadow, negative) => {
  const lit = l.tone ?? I.lighting({ ...l.material, light: LIGHT, view: S.cam.view, shadow });
  const base = l.pattern ? (s) => { const t = lit(s); return I.clamp01(t + (1 - t) * l.pattern(s)); } : lit;
  // A tone below zero means the layer is absent there, on either plate.
  const signed = negative ? (s) => { const t = base(s); return t < 0 ? 0 : 1 - t; } : base;
  return l.shape ? (s) => signed(s) * l.shape(s) : (s) => signed(s) * vignette(s.x, s.y);
};

/** Ink the static layers once, with the cast shadows of the shells. Returns { [layer id]: path d }. */
export const inkStatic = (S, { negative = false, size = 1800 } = {}) => {
  const shadow = I.shadowMap(S.shadowSolids, LIGHT, { size });
  const out = {};
  for (const l of S.layers) if (!l.live) out[l.id] = I.ink(l.set, toneOf(S, l, shadow, negative), l.ink);
  out.marks = S.marks;
  out.disc = negative ? I.ink(S.disc, () => 0.85, { from: 0, to: 1, width: 0.9 }) : "";
  out.birds = S.birds;
  out.sky = I.ink(S.sky, (s) => (negative ? 0.62 - 0.8 * S.skyTone(s) : S.skyTone(s)) * vignette(s.x, s.y), { from: 0.05, to: 0.9, width: 0.85 });
  return out;
};

const SEA_INK = { from: 0.16, to: 0.85, width: 1 };

/**
 * Ink everything the tide moves at phase p in [0, 1): the wave's rows of sea, the surf, and the swash it becomes.
 * Rows the wave is not on come from a cache inked once, so a frame re-rules only a narrow band of sea.
 */
export const inkTide = (S, p, { negative = false } = {}) => {
  const w = waveAt(p);
  const out = inkSwash(S, (p - LANDS + 1) % 1, { negative });
  const tone = (f) => (s) => {
    const t = f(s);
    return (t < 0 ? 0 : negative ? 1 - t : t) * vignette(s.x, s.y);
  };
  const row = (y) => Math.floor(seaV(y) * S.seaN);
  const lo = w.active ? Math.max(0, row(SHORE + w.dw - 1.8 - 2.6 * w.front)) : -1;
  const hi = w.active ? Math.min(S.seaN, row(SHORE + w.dw + 1.8 + 11) + 1) : -1;
  S.seaCache ??= {};
  const cache = (S.seaCache[negative] ??= S.seaRows.map((r) => (r.y - SHORE > SURF ? I.ink({ lines: [r.line] }, tone(S.water), SEA_INK) : null)));
  out.sea = S.seaRows.map((r, i) => (r.k >= lo && r.k < hi ? "" : cache[i] ?? I.ink({ lines: [r.line] }, tone((s) => S.surf(s, w)), SEA_INK))).join("");
  out.wave = "";
  out["wave-fine"] = "";
  if (w.active && hi > lo) {
    const surface = S.waveSurface(w);
    const rule = (opts) => I.hatch(surface, S.cam, S.occ.sees, { step: 1.2, ...opts });
    const onFace = (s) => {
      const b = s.p[1] - SHORE - w.dw - skew(s.p[0]);
      return b > FACE[0] * w.front && b < FACE[1];
    };
    out.wave = I.ink(rule({ lines: hi - lo, range: [lo / S.seaN, hi / S.seaN] }), tone((s) => (onFace(s) ? -1 : S.waveTone(s, w))), SEA_INK);
    const face = I.hatch(S.faceSurface(w), S.cam, S.occ.sees, { spacing: 1.45, step: 1 });
    out["wave-fine"] = I.ink(face, tone((s) => S.waveTone(s, w)), { from: 0.14, to: 0.88, width: 0.85 });
  }
  return out;
};

/** Ink the wet zone for a swash phase t in [0, 1): the film covers the sand behind its front, foam lace rides the front. */
const inkSwash = (S, t, { negative = false } = {}) => {
  const out = {};
  const depthAt = (p) => p[1] - frontAt(p[0], t);
  for (const l of S.layers) {
    if (!l.live) continue;
    if (l.id === "wet") {
      const tone = toneOf(S, l, null, negative);
      out.wet = I.ink(l.set, (s) => (depthAt(s.p) > 0 ? 0 : tone(s)), l.ink);
    } else {
      const film = (s) => {
        const depth = depthAt(s.p);
        if (depth <= 0 || s.p[1] > SHORE - 1) return 0;
        const body = (0.16 + 0.26 * I.smoothstep(0, 14, depth)) * (1 - 0.55 * I.smoothstep(0.55, 0.8, noise(s.p[0] * 0.08, s.p[1] * 0.9)));
        const lace = I.smoothstep(0.5, 2.8, depth) * (1 - 0.85 * I.smoothstep(0.5, 0.72, noise(s.p[0] * 0.32, depth * 0.55 + t * 5)) * (1 - I.smoothstep(3, 8, depth)));
        const k = body * lace;
        return (negative ? 0.55 - k : k) * vignette(s.x, s.y);
      };
      out.swash = I.ink(l.set, film, l.ink);
    }
  }
  const edge = [];
  const rushing = 1 - I.smoothstep(0.3, 0.8, t);
  for (let x = -80; x <= 80; x += 0.6) {
    const y = frontAt(x, t);
    if (y > SHORE - 1.5) continue;
    const [sx, sy] = S.cam.project([x, y, sandZ(x, y) + 0.1]);
    edge.push({ x: sx, y: sy, p: [x, y, 0], sp: 3, on: true });
  }
  const foam = (s) => (0.3 + 0.5 * rushing) * vignette(s.x, s.y) * I.smoothstep(0.22, 0.5, noise(s.p[0] * 0.45, t * 3));
  out.foam = I.ink({ lines: [[edge]] }, foam, { from: 0.1, to: 0.8, width: 0.9 });
  return out;
};
