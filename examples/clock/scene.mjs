import * as I from "../../kit/intaglio.mjs";

// An astronomical clock face after the Prague orloj, engraved: a turned bezel, a 24-hour ring of Roman numerals, a dial
// engine-turned light above the horizon and dark below it, and over it the rete (an eccentric zodiac ring and a star
// map on filigree arms) with the gilt sun and moon hands. Time drives everything: the rete turns once a sidereal day,
// the sun rides the ecliptic a degree a day and its hand points to it, the moon gains thirteen degrees a day on the
// stars and its ball shows the phase, the angle between the two.
// Seen square on, every turning part turns in the picture plane, so each is hatched once and its samples are turned.
// World units: the dial is the plane y = 0 facing -y (toward us), x right, z up.

export const WIDTH = 660;
export const HEIGHT = 660;

const range = (n) => Array.from({ length: n }, (_, i) => i);
const S = I.smoothstep;
const R_BEZEL = 296;
const R_HOURS = [244, 284];
const R_DIAL = 244;
const R_CAP = 236;
const R_EQ = 166;
const R_CAN = 116;
const ECL = { r: (R_CAP + R_CAN) / 2, d: (R_CAP - R_CAN) / 2, w: 15 };
const HORIZON = { c: -360, r: 300 };
const LIGHT = I.unit([-0.55, -0.75, 0.6]);
export const EPOCH = 0;

// Time: t in days. The rete turns with the stars, the sun and moon move along the ecliptic.
const SIDEREAL = 1.00273791;
/** Where everything points at time t: the rete's turn, and the sun's and moon's ecliptic longitudes, in radians. */
export const skyAt = (t) => ({
  rete: -I.TAU * SIDEREAL * t,
  sun: 1.2 + (I.TAU * t) / 365.2422,
  moon: 3.9 + (I.TAU * t) / 27.3217,
});

const turnP = (p, a) => [p[0] * Math.cos(a) - p[2] * Math.sin(a), p[1], p[0] * Math.sin(a) + p[2] * Math.cos(a)];
/** A point on the ecliptic ring at longitude lam, in the rete's own frame (its centre is offset toward the top). */
const eclipticAt = (lam, r = ECL.r) => [r * Math.cos(lam), 0, ECL.d + r * Math.sin(lam)];

/** A raised flat ring (or disc) with rounded edges, facing the viewer: a lathe about the -y axis. */
const ringSolid = ({ center = [0, 0, 0], r0, r1, h, round = 0.5 }) => {
  const e = (r1 - r0) * 0.5 * round;
  const profile = r0 > 0
    ? [[0, r0, 1], [h * 0.6, r0 + e * 0.1], [h, r0 + e, 1], [h, r1 - e, 1], [h * 0.6, r1 - e * 0.1], [0, r1, 1]]
    : [[h, 0.01, 1], [h, r1 - e, 1], [h * 0.6, r1 - e * 0.1], [0, r1, 1]];
  return I.lathe({ base: center, axis: [0, -1, 0], profile: profile.reverse() });
};

/** A hand: a long lozenge with a ridge down its middle, pointing up (+z) from the centre, in the hand's own frame. */
const handSolid = ({ length, width, tail = 0.18, ridge = 2.4, y = -6 }) => {
  const opts = {
    at: (u, v) => {
      const s = -tail + (1 + tail) * u;
      const w = width * (s < 0 ? 0.7 * (1 + s / tail) ** 0.6 + 0.3 : (1 - s) ** 0.8 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, s * 4 + 0.5))));
      const c = 2 * v - 1;
      return [c * w, y - ridge * (1 - Math.abs(c)) * Math.max(0.2, w / width), s * length];
    },
    nu: 60,
    nv: 2,
  };
  const p = I.patch(opts);
  return p.point(0.5, 0.25)[1][1] < 0 ? p : I.patch({ ...opts, side: -1 });
};

// Roman numerals as engraved strokes: thick downstrokes, hairline upstrokes, a serif at each end.
const GLYPHS = {
  I: [[[0, 0], [0, 1], 1]],
  V: [[[-0.32, 1], [0, 0], 1], [[0, 0], [0.32, 1], 0.4]],
  X: [[[-0.3, 1], [0.3, 0], 1], [[0.3, 1], [-0.3, 0], 0.4]],
};
const ROMAN = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];

export const scene = ({ ss = 3, coarse = 1 } = {}) => {
  const cam = I.camera({ azimuth: -90, elevation: 0, scale: 1, offset: [WIDTH / 2, HEIGHT / 2], width: WIDTH, height: HEIGHT });
  const bezel = I.lathe({
    base: [0, 0, 0],
    axis: [0, -1, 0],
    profile: [[0, R_HOURS[1], 1], [3, R_HOURS[1] + 0.5], [5, R_HOURS[1] + 3], [7.5, R_HOURS[1] + 7], [8, R_HOURS[1] + 9], [6.5, R_BEZEL - 3], [3, R_BEZEL - 0.5], [0, R_BEZEL, 1]].reverse(),
  });
  const hours = ringSolid({ r0: R_HOURS[0], r1: R_HOURS[1], h: 2, round: 0.2 });
  const boss = I.lathe({ base: [0, 0, 0], axis: [0, -1, 0], profile: [[12, 0.01, 1], [11.6, 3], [10.4, 6], [8, 9], [7, 10, 1], [0, 10, 1]].reverse() });
  const statics = [bezel, hours];
  const occ = I.occlusion(statics, cam, { ss });
  const H = (surface, opts, sees = occ.sees) => I.hatch(surface, cam, sees, { ...opts, step: (opts.step ?? 1.6) * coarse });
  const always = () => true;

  const brass = { base: 0.12, ambient: 0.16, bounce: 0.2, gloss: 0.6, shine: 30 };
  const steel = { base: 0.2, ambient: 0.14, bounce: 0.22, gloss: 0.8, shine: 50 };
  const enamel = { base: 0.08, ambient: 0.4, bounce: 0.1 };

  // Static layers: the bezel in rings and helices, the hour ring as a band of engine-turned circles.
  const layers = [];
  const layer = (id, set, material, ink, shape, cls = "ink") => layers.push({ id, set, material, ink, shape, cls });
  layer("bezel", H(bezel, { spacing: 1.5, step: 1.2 }), brass, { from: 0.1, to: 0.75, width: 0.95 }, null, "ink-2");
  layer("bezel-x", H(bezel, { spacing: 2, slant: 0.6, step: 1.2 }), brass, { from: 0.55, to: 0.95, width: 0.7 }, null, "ink-2");
  layer("bezel-k", H(bezel, { along: "v", spacing: 1.6, step: 0.6, range: [0.42, 0.62] }), brass, { from: 0.2, to: 0.8, width: 0.6 }, null, "ink-2");
  layer("hours", H(hours, { spacing: 1.3, step: 1.2 }), enamel, { from: 0.05, to: 0.9, width: 0.6 }, () => 0.35);

  // The dial: engine-turned rings with a fine wave, inked by the sky they stand for: light above the horizon,
  // a twilight band, dark below. A second set with the wave reversed crosses the first in the night.
  const below = (x, z) => Math.hypot(x, z - HORIZON.c) < HORIZON.r;
  const twilight = (x, z) => S(HORIZON.r + 46, HORIZON.r - 2, Math.hypot(x, z - HORIZON.c));
  const ringCurves = (sign) => range(Math.floor(R_DIAL / 1.55)).map((k) => (t) => {
    const r = 3 + k * 1.55;
    const th = t * I.TAU;
    const rr = r + 0.9 * Math.sin(48 * th + sign * k * 0.22);
    return [WIDTH / 2 + rr * Math.cos(th), HEIGHT / 2 - rr * Math.sin(th)];
  });
  const inDial = (x, y) => Math.hypot(x - WIDTH / 2, y - HEIGHT / 2) < R_DIAL - 1;
  const dial = I.trace(ringCurves(1), { on: inDial, spacing: 1.55, step: 1.4 });
  // Log spirals cross the rings at 45 degrees in the night: a true cross-hatch, never a moiré.
  const spirals = range(320).map((k) => (t) => {
    const r = 18 + (R_DIAL - 18) * t;
    const th = (k / 320) * I.TAU + Math.log(r / 18);
    return [WIDTH / 2 + r * Math.cos(th), HEIGHT / 2 - r * Math.sin(th)];
  });
  const dialX = I.trace(spirals, { on: (x, y) => inDial(x, y) && twilight(x - WIDTH / 2, HEIGHT / 2 - y) > 0.3, spacing: 2.2, step: 1.4 });
  const sky = (s) => {
    const x = s.x - WIDTH / 2;
    const z = HEIGHT / 2 - s.y;
    const tw = twilight(x, z);
    const r = Math.hypot(x, z);
    return 0.2 + 0.68 * tw + 0.1 * S(R_DIAL - 30, R_DIAL, r);
  };

  // Engraved marks on the dial: the tropics and equator, the horizon, the twilight line, the twelve unequal hours.
  const marks = [];
  const M = (pts, width, opts = {}) => marks.push(I.stroke(pts, cam, always, { width, lift: 0, ...opts }));
  const C = (r, z = 0, y = -0.5) => I.circle([0, y, z], [0, -1, 0], r, 240);
  for (const r of [R_CAP, R_EQ, R_CAN]) M(C(r), 0.55);
  M(C(R_DIAL - 4), 0.4);
  const clip = (pts) => pts.filter((p) => Math.hypot(p[0], p[2]) < R_DIAL - 4);
  M(clip(C(HORIZON.r, HORIZON.c)), 0.9);
  M(clip(C(HORIZON.r + 46, HORIZON.c)), 0.45);
  // The hour ring: two rounds of I to XII, upright to the centre, with a tick and a pearl between.
  const rc = (R_HOURS[0] + R_HOURS[1]) / 2;
  for (let h = 0; h < 24; h++) {
    const th = (h / 24) * I.TAU;
    const out = [Math.sin(th), 0, Math.cos(th)];
    const tan = [Math.cos(th), 0, -Math.sin(th)];
    const word = ROMAN[h % 12];
    const size = 17;
    const advance = (g) => (g === "I" ? 0.32 : 0.78);
    const total = [...word].reduce((a, g) => a + advance(g), 0) - 0.2;
    let x = -total / 2;
    for (const g of word) {
      const w = advance(g);
      const cx = x + (g === "I" ? 0.06 : w / 2 - 0.1);
      for (const [[u0, v0], [u1, v1], weight] of GLYPHS[g]) {
        const at = (u, v) => I.add(I.add(I.mul(tan, (cx + u * 0.9) * size * 0.62), I.mul(out, rc - size / 2 + v * size)), [0, -2.6, 0]);
        M([at(u0, v0), at(u1, v1)], weight > 0.5 ? 1.7 : 0.55);
        if (weight > 0.5) for (const [u, v] of [[u0, v0], [u1, v1]]) M([at(u - 0.16, v), at(u + 0.16, v)], 0.5);
      }
      x += w;
    }
    const mid = (h + 0.5) / 24 * I.TAU;
    M([[Math.sin(mid) * (R_HOURS[0] + 3), -2.6, Math.cos(mid) * (R_HOURS[0] + 3)], [Math.sin(mid) * (R_HOURS[0] + 9), -2.6, Math.cos(mid) * (R_HOURS[0] + 9)]], 0.6);
    M(I.circle([Math.sin(mid) * (R_HOURS[1] - 6), -2.6, Math.cos(mid) * (R_HOURS[1] - 6)], [0, -1, 0], 1.6, 16), 0.5);
  }
  M(C(R_HOURS[0], 0, -2.2), 0.8);
  M(C(R_HOURS[1], 0, -2.2), 0.8);
  M(C(R_HOURS[0] + 12, 0, -2.2), 0.35);

  // The moving parts, hatched once in their own frames.
  // The rete: the eccentric zodiac ring (twelve signs, degree ticks) and the star pointers on their arms.
  const ecl = ringSolid({ center: [0, -1, ECL.d], r0: ECL.r - ECL.w, r1: ECL.r + ECL.w, h: 4, round: 0.4 });
  const rete = {
    ring: H(ecl, { spacing: 1.25, step: 1.1 }, always),
    ringX: H(ecl, { spacing: 1.7, slant: 0.5, step: 1.2 }, always),
    marks: [],
  };
  const R = (pts, width) => rete.marks.push({ pts, width });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * I.TAU;
    R([eclipticAt(a, ECL.r - ECL.w + 1), eclipticAt(a, ECL.r + ECL.w - 1)].map((p) => I.add(p, [0, -5.2, 0])), 0.8);
    for (let d = 1; d < 30; d++) {
      const b = a + (d / 30) * (I.TAU / 12);
      const long = d % 10 === 0 ? 7 : d % 5 === 0 ? 5 : 3;
      R([eclipticAt(b, ECL.r + ECL.w - 1), eclipticAt(b, ECL.r + ECL.w - 1 - long)].map((p) => I.add(p, [0, -5.2, 0])), 0.35);
    }
    // A little six-lobed rosette in the middle of each sign, for its glyph.
    const m = eclipticAt(a + I.TAU / 24, ECL.r - 4);
    R(range(73).map((i) => {
      const th = (i / 72) * I.TAU;
      const r = 3.6 + 1.6 * Math.cos(6 * th);
      return [m[0] + r * Math.cos(th), -5.2, m[2] + r * Math.sin(th)];
    }), 0.4);
  }
  for (const r of [ECL.r - ECL.w + 1.5, ECL.r + ECL.w - 1.5, ECL.r - 9]) R(range(241).map((i) => I.add(eclipticAt((i / 240) * I.TAU, r), [0, -5.2, 0])), 0.45);
  // Star pointers: bright stars at their places on the projection, each a small eight-pointed star on a curling arm.
  const stars = [[0.3, 200], [1.1, 132], [1.7, 214], [2.4, 92], [2.9, 176], [3.6, 222], [4.2, 140], [4.9, 196], [5.5, 104], [6.0, 228], [0.8, 66], [3.3, 60]];
  const reteSolids = [ecl];
  for (const [a, r] of stars) {
    const p = [r * Math.cos(a), -4, r * Math.sin(a)];
    const pts = range(17).map((i) => {
      const th = (i / 16) * I.TAU;
      const rr = i % 2 ? 2.2 : 6.5;
      return [p[0] + rr * Math.cos(th + 0.2), -4.6, p[2] + rr * Math.sin(th + 0.2)];
    });
    R(pts, 0.55);
    R([p, I.add(p, [0, -0.6, 0])], 0.1);
    // The arm runs from the star to the nearest point of the ring, bowed like filigree.
    const lam = Math.atan2(p[2] - ECL.d, p[0]);
    const q = eclipticAt(lam, ECL.r + (Math.hypot(p[0], p[2] - ECL.d) > ECL.r ? ECL.w : -ECL.w));
    const mid = I.add(I.mul(I.add(p, q), 0.5), [(q[2] - p[2]) * 0.18, 0, -(q[0] - p[0]) * 0.18]);
    R(range(21).map((i) => {
      const t = i / 20;
      return [0, 1, 2].map((k) => (1 - t) ** 2 * p[k] + 2 * (1 - t) * t * mid[k] + t * t * q[k]).map((v, k) => (k === 1 ? -4.2 : v));
    }), 0.9);
  }

  // The hands: the sun hand long, the moon hand shorter; a gilt sun with rays and a moon ball ride on them.
  const sunHand = handSolid({ length: 262, width: 10, y: -8 });
  const moonHand = handSolid({ length: 214, width: 8.5, y: -11, ridge: 2 });
  const hands = {
    sun: { solid: sunHand, set: H(sunHand, { spacing: 1.15, step: 1 }, always) },
    moon: { solid: moonHand, set: H(moonHand, { spacing: 1.15, step: 1 }, always) },
  };
  const sunDisc = I.lathe({ base: [0, -9, 0], axis: [0, -1, 0], profile: [[0, 13, 1], [1.5, 12.6], [3, 11], [4.4, 8], [5.2, 4], [5.5, 0.01, 1]] });
  const moonBall = I.sphere({ center: [0, -14, 0], radius: 11, axis: [0, -1, 0] });
  const bodies = {
    sun: H(sunDisc, { spacing: 1.05, step: 0.8 }, always),
    moon: H(moonBall, { spacing: 1, step: 0.7 }, always),
    moonX: H(moonBall, { along: "v", spacing: 1.2, step: 0.7 }, always),
  };
  const bossSet = H(boss, { spacing: 1, step: 0.8 }, always);

  // Spandrels: in each corner of the square plate outside the bezel, a guilloche rosette over a waved ground.
  const outside = (x, y) => Math.hypot(x - WIDTH / 2, y - HEIGHT / 2) > R_BEZEL + 6;
  const corners = [[0, 0], [WIDTH, 0], [0, HEIGHT], [WIDTH, HEIGHT]];
  const ground = I.trace(range(Math.ceil(HEIGHT / 2.2)).map((j) => (t) => {
    const x = WIDTH * t;
    const y = 1.1 + j * 2.2;
    return [x, y + 1.3 * Math.sin(x / 9 + j * 0.45)];
  }), { on: outside, spacing: 2.2, step: 1.5 });
  const rosettes = corners.flatMap(([cx, cy]) => {
    const ox = cx ? cx - 62 : 62;
    const oy = cy ? cy - 62 : 62;
    return range(28).map((k) => (t) => {
      const th = t * I.TAU;
      const r = 34 + 12 * Math.sin(14 * th + (k / 28) * I.TAU) + 4 * Math.sin(7 * th - (k / 28) * I.TAU * 2);
      return [ox + r * Math.cos(th), oy + r * Math.sin(th)];
    });
  });
  const rose = I.trace(rosettes, { on: (x, y) => outside(x, y), spacing: 1.2, step: 1 });
  const nearRose = (s) => Math.min(...corners.map(([cx, cy]) => Math.hypot(s.x - (cx ? cx - 62 : 62), s.y - (cy ? cy - 62 : 62))));

  return {
    cam, occ, layers, dial, dialX, sky, marks: marks.join(""), rete, reteSolids, hands, bodies, bossSet, ground, rose, nearRose,
    materials: { brass, steel, enamel },
  };
};

// Turning hatched samples: positions and normals turn about the dial's axis, screen points follow.
const turnSet = (set, a, cam, offset = [0, 0, 0]) => ({
  lines: set.lines.map((runs) => runs.map((run) => run.map((s) => {
    const p = I.add(turnP(s.p, a), offset);
    const [x, y] = cam.project(p);
    return { x, y, p, n: turnP(s.n, a), sp: s.sp, a: s.a };
  }))),
});
const turnPts = (pts, a, offset = [0, 0, 0]) => pts.map((p) => I.add(turnP(p, a), offset));
const polar = (p) => Math.atan2(p[2], p[0]);

/** The plate at time t (days): the turning parts' ink, their paper knock-outs, and the moon's phase. */
export const inkAt = (S, t, { negative = false } = {}) => {
  const { rete, sun, moon } = skyAt(t);
  const cam = S.cam;
  const lit = (m) => {
    const f = I.lighting({ ...m, light: LIGHT, view: cam.view });
    return negative ? (s) => 1 - f(s) : f;
  };
  const brass = lit(S.materials.brass);
  const steel = lit(S.materials.steel);
  const out = {};
  out.rete = I.ink(turnSet(S.rete.ring, rete, cam), brass, { from: 0.1, to: 0.75, width: 0.8 });
  out["rete-x"] = I.ink(turnSet(S.rete.ringX, rete, cam), brass, { from: 0.55, to: 0.95, width: 0.6 });
  out["rete-marks"] = S.rete.marks.map(({ pts, width }) => I.stroke(turnPts(pts, rete), cam, () => true, { width, lift: 0 })).join("");
  // Knock out the dial under the ring.
  const c = turnP([0, 0, ECL.d], rete);
  const [cx, cy] = cam.project(c);
  const circ = (r) => `M${(cx + r).toFixed(1)} ${cy.toFixed(1)}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;
  out["rete-knock"] = circ(ECL.r + ECL.w + 1) + circ(ECL.r - ECL.w - 1);

  // The sun and the moon on the ecliptic, carried round by the rete; each hand points at its body.
  const place = (lam) => turnP(eclipticAt(lam), rete);
  const sunAt = place(sun);
  const moonAt = place(moon);
  const hand = (name, body) => {
    const a = polar(body) - Math.PI / 2;
    const h = S.hands[name];
    const tris = h.solid.triangles().map((tri) => tri.map((p) => cam.project(turnP(p, a))));
    return {
      ink: I.ink(turnSet(h.set, a, cam), steel, { from: 0.08, to: 0.8, width: 0.6 }),
      knock: tris.map((tr) => `M${tr.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}Z`).join(""),
    };
  };
  const sh = hand("sun", sunAt);
  const mh = hand("moon", moonAt);
  out.sun = sh.ink;
  out["sun-knock"] = sh.knock;
  out.moon = mh.ink;
  out["moon-knock"] = mh.knock;
  const [sx, sy] = cam.project(sunAt);
  const [mx, my] = cam.project(moonAt);
  out["sun-disc"] = I.ink(turnSet(S.bodies.sun, 0, cam, [sunAt[0], 0, sunAt[2]]), brass, { from: 0.05, to: 0.8, width: 0.55 });
  out["sun-rays"] = range(16).map((k) => {
    const a = (k / 16) * I.TAU;
    const r1 = k % 2 ? 19 : 24;
    return I.stroke([[sunAt[0] + 14 * Math.cos(a), -9, sunAt[2] + 14 * Math.sin(a)], [sunAt[0] + r1 * Math.cos(a), -9, sunAt[2] + r1 * Math.sin(a)]], cam, () => true, { width: k % 2 ? 0.8 : 1.4, taper: 4, lift: 0 });
  }).join("");
  out["sun-knock2"] = `M${sx + 25} ${sy}a25 25 0 1 0 -50 0a25 25 0 1 0 50 0Z`;
  // The moon ball: lit from the direction of the sun along the ecliptic, so its bright part is the phase.
  const elong = moon - sun;
  const L = I.unit([-Math.sin(elong) * 0.9, Math.cos(elong), 0.25]);
  const phaseLit = (s) => {
    const l = I.dot(s.n, L);
    const v = 1 - I.clamp01(0.08 + 0.95 * I.smoothstep(-0.08, 0.12, l));
    return negative ? 1 - v * 0.9 : v * 0.9 + 0.05;
  };
  out["moon-ball"] = I.ink(turnSet(S.bodies.moon, 0, cam, [moonAt[0], 0, moonAt[2]]), phaseLit, { from: 0.05, to: 0.85, width: 0.6 });
  out["moon-ball-x"] = I.ink(turnSet(S.bodies.moonX, 0, cam, [moonAt[0], 0, moonAt[2]]), phaseLit, { from: 0.55, to: 0.95, width: 0.5 });
  out["moon-knock2"] = `M${mx + 12} ${my}a12 12 0 1 0 -24 0a12 12 0 1 0 24 0Z`;
  return out;
};

/** The static plate, inked once. */
export const inkStatic = (S, { negative = false } = {}) => {
  const out = {};
  for (const l of S.layers) {
    const f = I.lighting({ ...l.material, light: LIGHT, view: S.cam.view });
    const tone = l.shape ? (s) => l.shape(s) : f;
    out[l.id] = I.ink(l.set, negative ? (s) => 1 - tone(s) : tone, l.ink);
  }
  const neg = (f) => (negative ? (s) => 1 - f(s) : f);
  out.dial = I.ink(S.dial, neg(S.sky), { from: 0.05, to: 0.95, width: 0.95 });
  out["dial-x"] = I.ink(S.dialX, neg((s) => S.sky(s)), { from: 0.6, to: 1, width: 0.8 });
  out.boss = I.ink(S.bossSet, neg(I.lighting({ ...S.materials.brass, light: LIGHT, view: S.cam.view })), { from: 0.05, to: 0.8, width: 0.55 });
  out.ground = I.ink(S.ground, () => 0.45, { from: 0, to: 1, width: 0.7 });
  out.rose = I.ink(S.rose, (s) => 0.5 + 0.4 * I.smoothstep(46, 20, S.nearRose(s)), { from: 0, to: 1, width: 0.55 });
  return out;
};
