import * as I from "../../kit/intaglio.mjs";

// A brass orrery on a turned drum, engraved. Time drives it: each planet goes round at its real period from its
// J2000 longitude, and each is lit from the sun at the centre, so its bright half always faces the sun.
// Earth's axis keeps its 23.4° tilt toward the same stars all year, which is what makes the seasons.
// World units: x toward the vernal equinox, z up. The brass work is lit by the room; the planets by the sun.

export const WIDTH = 640;
export const HEIGHT = 440;

/** Today, in years since J2000 (2000-01-01 12:00 UT). */
export const NOW = (Date.UTC(2026, 9, 17) - Date.UTC(2000, 0, 1, 12)) / (365.25 * 864e5);

export const OBLIQUITY = 23.44;
const ROOM = I.direction(-168, 46);

const DRUM_Z = 6;
const TOP = 28;
const PLANET_Z = 64;
const SUN = [0, 0, 68];
const SUN_R = 13;

// orbit radius, arm height, ball radius, period in years, mean longitude at J2000 in degrees
const PLANETS = [
  { id: "mercury", orbit: 30, arm: 46, r: 3.6, period: 0.2408, l0: 252.25 },
  { id: "venus", orbit: 47, arm: 41, r: 5.2, period: 0.6152, l0: 181.98 },
  { id: "earth", orbit: 68, arm: 36, r: 5.6, period: 1, l0: 100.46 },
  { id: "mars", orbit: 92, arm: 32, r: 4.6, period: 1.8809, l0: 355.45 },
];
const MOON = { orbit: 13, arm: 54, r: 2.2, period: 27.3217 / 365.25, l0: 218.32 };

const DRUM = [
  [0, 57, 1], [1.5, 59.5], [3.5, 60.5], [5.5, 59.5], [7, 57.5, 1],
  [7, 56, 1], [14, 56, 1],
  [14, 57.2, 1], [15, 57.8], [16, 57.2, 1],
  [16, 56.4, 1], [17.5, 57.4], [20.5, 59.4], [TOP - DRUM_Z, 60, 1],
];
const HUB = [
  [0, 8.5, 1], [1, 9.1], [2.5, 8.5, 1], [2.5, 5.8, 1],
  [3, 7, 1], [5, 7, 1], [5, 5.2, 1], [7, 5.2, 1],
  [7, 6.2, 1], [9, 6.2, 1], [9, 4.6, 1], [12, 4.6, 1],
  [12, 5.4, 1], [14, 5.4, 1], [14, 3.8, 1], [17, 3.8, 1],
  [17, 4.6, 1], [19, 4.6, 1], [19, 2.4, 1], [26, 2.4, 1], [26.5, 3.6], [27.5, 2.2, 1],
];

/** Heliocentric longitude of a body in degrees at time t (years since J2000). */
export const longitude = (body, t) => (((body.l0 + (360 * t) / body.period) % 360) + 360) % 360;

const flat = (deg, r, z) => [r * Math.cos(deg * I.deg), r * Math.sin(deg * I.deg), z];

/** Where everything is at time t: planet centres, the moon, and Earth's axis (fixed in space). */
export const orreryAt = (t) => {
  const planets = PLANETS.map((p) => ({ ...p, lon: longitude(p, t), center: flat(longitude(p, t), p.orbit, PLANET_Z) }));
  const earth = planets[2];
  const m = flat(longitude(MOON, t), MOON.orbit, 0);
  const moon = { ...MOON, foot: [earth.center[0], earth.center[1], MOON.arm], center: [earth.center[0] + m[0], earth.center[1] + m[1], PLANET_Z - 2] };
  return { planets, moon, axis: [0, Math.sin(OBLIQUITY * I.deg), Math.cos(OBLIQUITY * I.deg)] };
};

/**
 * A plain rod from one point to another, with exact normals and a coarse 12-sided mesh so the parts rebuilt every
 * frame stay cheap. u runs round the rod, v along it.
 */
const rod = (from, to, r) => {
  const d = I.sub(to, from);
  const { b, c } = I.frameOf(d);
  const point = (u, v) => {
    const n = I.add(I.mul(b, Math.cos(u * I.TAU)), I.mul(c, Math.sin(u * I.TAU)));
    return [I.add(I.add(from, I.mul(d, v)), I.mul(n, r)), n];
  };
  const rows = Math.max(1, Math.ceil(Math.hypot(...d) / 4));
  const triangles = () => {
    const tris = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < 12; i++) {
        const [p, q, s, t] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([x, y]) => point(x / 12, y / rows)[0]);
        tris.push([p, q, s], [p, s, t]);
      }
    }
    return tris;
  };
  return { point, triangles };
};

/** The moving parts at time t: for each planet an arm from its collar, a post and the ball. */
const movingAt = (t, tipped) => {
  const { planets, moon, axis } = orreryAt(t);
  const parts = [];
  for (const p of planets) {
    const [x, y] = p.center;
    const u = [x / p.orbit, y / p.orbit, 0];
    const foot = [x, y, p.arm];
    parts.push({ id: `${p.id}-arm`, kind: "rod", solid: rod([u[0] * 4, u[1] * 4, p.arm], I.add(foot, I.mul(u, 1.4)), 1.1) });
    parts.push({ id: `${p.id}-post`, kind: "post", solid: rod([x, y, p.arm - 1.2], [x, y, PLANET_Z - p.r * 0.8], 0.8) });
    parts.push({ id: p.id, kind: "ball", center: p.center, r: p.r, solid: I.sphere({ center: p.center, radius: p.r, axis: p.id === "earth" ? axis : tipped }) });
  }
  const [mx, my] = moon.center;
  const d = I.sub([mx, my, 0], [moon.foot[0], moon.foot[1], 0]);
  const u = I.mul(d, 1 / Math.hypot(...d));
  parts.push({ id: "moon-arm", kind: "rod", solid: rod(I.add(moon.foot, I.mul(u, 0.8)), [mx + u[0] * 0.8, my + u[1] * 0.8, moon.arm], 0.6) });
  parts.push({ id: "moon-post", kind: "post", solid: rod([mx, my, moon.arm - 0.6], [mx, my, moon.center[2] - moon.r * 0.8], 0.5) });
  parts.push({ id: "moon", kind: "ball", center: moon.center, r: moon.r, solid: I.sphere({ center: moon.center, radius: moon.r, axis: tipped }) });
  return parts;
};

export const scene = ({ ss = 3 } = {}) => {
  const drum = I.lathe({ base: [0, 0, DRUM_Z], profile: DRUM });
  const top = I.disc({ center: [0, 0, TOP], normal: [0, 0, 1], radius: 60, along: [1, 1, 0] });
  const feet = [90, 210, 330].map((a) => I.sphere({ center: flat(a, 47, 5), radius: 5.5 }));
  const hub = I.lathe({ base: [0, 0, TOP], profile: HUB });

  const reach = [...I.circle([0, 0, 0], [0, 0, 1], 64, 48), ...I.circle([0, 0, PLANET_Z + 6], [0, 0, 1], 98, 48), I.add(SUN, [0, 0, SUN_R])];
  const cam = I.fitCamera(reach, { width: WIDTH, height: HEIGHT, pad: 34, azimuth: -118, elevation: 30 });
  const tipped = I.unit(I.add(cam.up, I.mul(cam.view, 0.2)));
  const sun = I.sphere({ center: SUN, radius: SUN_R, axis: tipped });
  const subject = [drum, top, ...feet, hub, sun];
  const ground = I.face({ points: [[-250, -250, 0], [250, -250, 0], [250, 250, 0], [-250, 250, 0]], along: [cam.right[0], cam.right[1], 0], outward: [0, 0, 1] });
  const solids = [ground, ...subject];
  const occ = I.occlusion(solids, cam, { ss, halo: subject });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);

  const brass = { base: 0.1, ambient: 0.14, bounce: 0.18, gloss: 0.5, shine: 40 };
  const wood = { base: 0.3, ambient: 0.16, bounce: 0.1, gloss: 0.15, shine: 12 };
  const floor = { base: 0.18, ambient: 0.24, bounce: 0 };
  const fade = (p) => 1 - I.smoothstep(100, 230, Math.hypot(p[0] * 0.9, p[1] * 1.2));
  const rim = (p) => 1 - I.smoothstep(54, 60, Math.hypot(p[0], p[1])) * 0.5;

  const layers = [];
  const layer = (id, set, material, ink, shape) => layers.push({ id, set, material, ink, shape });
  layer("ground", H(ground, { spacing: 3, step: 3 }), floor, { from: 0.2, to: 0.85, width: 1.1 }, fade);
  layer("ground-x", H(ground, { spacing: 3.7, slant: 0.5, step: 3 }), floor, { from: 0.6, to: 0.95, width: 0.8 }, fade);
  layer("drum", H(drum, { spacing: 2.3 }), wood, { from: 0.18, to: 0.72, width: 1.15 });
  layer("drum-x", H(drum, { spacing: 3, slant: 0.3 }), wood, { from: 0.55, to: 0.95, width: 0.9 });
  layer("top", H(top, { spacing: 2.2 }), brass, { from: 0.42, to: 0.8, width: 1 }, rim);
  layer("top-x", H(top, { spacing: 2.6, slant: 0.65 }), brass, { from: 0.55, to: 0.95, width: 0.8 });
  feet.forEach((f, i) => layer(`foot-${i}`, H(f, { spacing: 1.8, step: 1.2 }), wood, { from: 0.2, to: 0.75, width: 0.9 }));

  const far = I.unit([-cam.view[0], -cam.view[1], 0]);
  const horizon = cam.project(I.mul(far, 190))[1];
  const [cx] = cam.project([0, 0, 0]);
  const sky = I.ruling(cam, occ, { spacing: 2.5, halo: 8, region: (x, y) => y < horizon - 6 });
  const skyTone = (s) => {
    const edge = 1 - I.smoothstep(0.6, 1, Math.hypot((s.x - cx) / (WIDTH * 0.52), (s.y - HEIGHT * 0.4) / (HEIGHT * 0.6)));
    return (0.2 + 0.5 * I.smoothstep(horizon, 0, s.y)) * edge;
  };

  // The ecliptic engraved on the table: a double ring with a tick every 10° and a long one at each sign.
  const marks = [];
  const S = (pts, opts) => marks.push(I.stroke(pts, cam, occ.sees, opts));
  const z = TOP + 0.05;
  S(I.circle([0, 0, z], [0, 0, 1], 57), { width: 0.5 });
  S(I.circle([0, 0, z], [0, 0, 1], 51.5), { width: 0.4 });
  S(I.circle([0, 0, z], [0, 0, 1], 50.5), { width: 0.3 });
  for (let a = 0; a < 360; a += 10) S([flat(a, a % 30 ? 54.5 : 51.5, z), flat(a, 57, z)], { width: a % 30 ? 0.35 : 0.55 });
  S([flat(0, 14, z), flat(0, 50.5, z)], { width: 0.45, taper: 12 });

  const still = I.shadowMap(solids, ROOM, { size: 1024, tris: I.trianglesOf(subject), soft: 1.2 });
  return { cam, occ, tipped, solids, still, layers, sky, skyTone, marks: marks.join(""), hub, sun, brass };
};

/**
 * Everything that changes with time: the static layers re-inked under the room light (the arms' shadows move),
 * the moving parts hatched against the static buffer plus themselves, and the paper knock-outs that lift them off
 * the lines behind. A negative plate inks the light, not the shade.
 */
export const frameAt = (S, t, { size = 512, negative = false } = {}) => {
  const { cam, occ, brass } = S;
  const moving = movingAt(t, S.tipped);
  const tris = I.trianglesOf(moving.map((m) => m.solid));
  const sees = occ.plus([{ triangles: () => tris }]);
  // The room light never moves: the fixed parts' shadows are mapped once, the moving parts' each frame.
  const moved = I.shadowMap(S.solids, ROOM, { size, tris, soft: 1.2 });
  // Hatch samples persist between frames, so each point keeps its fixed-shadow value after the first lookup.
  const shadow = { lit: (p, n) => (p.still ??= S.still.lit(p, n)) * moved.lit(p, n) };
  const neg = (f) => (negative ? (s) => 1 - f(s) : f);
  const room = I.lighting({ ...brass, light: ROOM, view: cam.view, shadow });
  const out = {};
  for (const l of S.layers) {
    const lit = neg(I.lighting({ ...l.material, light: ROOM, view: cam.view, shadow }));
    const tone = l.shape ? (s) => { const f = l.shape(s.p); return f > 0 ? lit(s) * f : 0; } : lit;
    out[l.id] = I.ink(l.set, tone, l.ink);
  }

  const H = (surface, opts) => I.hatch(surface, cam, sees, opts);
  const ink = [
    I.ink(H(S.hub, { spacing: 1.6, step: 1.2 }), neg(room), { from: 0.16, to: 0.72, width: 0.8 }),
    I.ink(H(S.hub, { spacing: 2, slant: 0.35, step: 1.2 }), neg(room), { from: 0.58, to: 0.95, width: 0.6 }),
  ];
  // The sun is the light: nearly bare, a few fine parallels at its limb and a crossing only where it turns away.
  const glow = neg((s) => 0.85 * room(s));
  ink.push(I.ink(H(S.sun, { spacing: 1.9 }), glow, { from: 0.26, to: 0.8, width: 0.85 }));
  ink.push(I.ink(H(S.sun, { spacing: 2.3, along: "v" }), glow, { from: 0.6, to: 0.95, width: 0.6 }));

  const hulls = [];
  for (const m of moving) {
    if (m.kind === "ball") {
      const L = I.unit(I.sub(SUN, m.center));
      const day = neg(I.lighting({ light: L, view: cam.view, ambient: 0.02, bounce: 0.08, base: 0.02, gloss: 0.3, shine: 24 }));
      const fine = m.r < 3 ? 1.15 : 1.35;
      ink.push(I.ink(H(m.solid, { spacing: fine, step: 1 }), day, { from: 0.42, to: 0.85, width: 0.8 }));
      ink.push(I.ink(H(m.solid, { spacing: fine * 1.3, slant: 0.5, step: 1 }), day, { from: 0.8, to: 1, width: 0.6 }));
      const [x, y] = cam.project(m.center);
      const r = m.r * cam.scale;
      hulls.push(I.hullPath(Array.from({ length: 48 }, (_, k) => [x + r * Math.cos((k / 48) * I.TAU), y + r * Math.sin((k / 48) * I.TAU)])));
    } else {
      const lines = m.kind === "rod" ? 4 : 3;
      ink.push(I.ink(H(m.solid, { along: "v", lines: lines * 2, step: 1.2 }), neg(room), { from: 0.14, to: 0.7, width: 0.7 }));
      hulls.push(I.hullPath(m.solid.triangles().flat().map((p) => cam.project(p))));
    }
  }
  out.moving = ink.join("");
  out.knock = hulls.join("");
  return out;
};
