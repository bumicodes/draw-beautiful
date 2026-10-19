import * as I from "../../kit/intaglio.mjs";

// A horizontal garden sundial on a turned stone pedestal, engraved.
// The sun moves through the day; the gnomon's cast shadow falls on the hour line the model says it should.
// World units: x east, y north, z up.

export const WIDTH = 640;
export const HEIGHT = 460;

export const LATITUDE = 51.5;
export const DECLINATION = 15;

const STEP_LO = { min: [-62, -62, 0], max: [62, 62, 12] };
const STEP_HI = { min: [-47, -47, 12], max: [47, 47, 24] };
const PEDESTAL_Z = 24;
const DIAL_Z = 150;
const DIAL_R = 54;
const DIAL_T = 4.5;
const TOP = DIAL_Z + DIAL_T;
const RING_R = 47;
const ROOT_Y = -22;
const FOOT_Y = 34;
const GNOMON_T = 3.2;

const PROFILE = [
  [0, 0, 1], [0, 31, 1], [6, 31, 1],
  [6, 28.5, 1], [7.5, 29.6], [10, 30.2], [12.5, 29.6], [14.5, 27.6, 1],
  [14.5, 24.5, 1], [17, 24.5, 1],
  [17, 23, 1], [19, 20.6], [22, 19.2], [25.5, 18.6, 1],
  [45, 18.3], [70, 17.6], [95, 16.6], [103, 16.2, 1],
  [103, 17.6, 1], [104.6, 18.4], [106.2, 17.6, 1],
  [106.2, 16.4, 1], [111, 16.4, 1],
  [111, 17.2, 1], [114, 19.4], [117, 22.6], [119.5, 26, 1],
  [119.5, 27.2, 1], [126, 27.2, 1], [126, 0, 1],
];

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

/** The hour line for a solar hour on a horizontal dial: tan θ = sin φ · tan H, measured from north. */
export const hourAngle = (hours) => Math.atan(Math.sin(LATITUDE * I.deg) * Math.tan((hours - 12) * 15 * I.deg));

const hourLine = (h) => {
  const th = h === 6 ? -Math.PI / 2 : h === 18 ? Math.PI / 2 : hourAngle(h);
  const x0 = h < 12 ? -GNOMON_T / 2 : h > 12 ? GNOMON_T / 2 : 0;
  const d = [Math.sin(th), Math.cos(th)];
  const ox = x0;
  const oy = ROOT_Y;
  const b = ox * d[0] + oy * d[1];
  const t = -b + Math.sqrt(b * b - (ox * ox + oy * oy - RING_R * RING_R));
  return { from: [x0, ROOT_Y, TOP], to: [ox + d[0] * t, oy + d[1] * t, TOP], d };
};

export const scene = ({ ss = 3 } = {}) => {
  const steps = [...I.box({ ...STEP_LO, capAlong: [1, 1, 0] }), ...I.box({ ...STEP_HI, capAlong: [1, 1, 0] })];
  const pedestal = I.lathe({ base: [0, 0, PEDESTAL_Z], profile: PROFILE });
  const rim = I.lathe({ base: [0, 0, DIAL_Z], profile: [[0, DIAL_R, 1], [0.6, DIAL_R + 0.3], [DIAL_T - 0.6, DIAL_R + 0.3], [DIAL_T, DIAL_R, 1]] });
  const face = I.disc({ center: [0, 0, TOP], normal: [0, 0, 1], radius: DIAL_R, along: [1, 0, 0] });
  const rise = (FOOT_Y - ROOT_Y) * Math.tan(LATITUDE * I.deg);
  const gnomon = I.prism({
    outline: [[-GNOMON_T / 2, ROOT_Y, TOP], [-GNOMON_T / 2, FOOT_Y, TOP], [-GNOMON_T / 2, FOOT_Y, TOP + rise]],
    extrude: [GNOMON_T, 0, 0],
    capAlong: [0, 1, Math.tan(LATITUDE * I.deg)],
  });
  const subject = [...steps, pedestal, rim, face, ...gnomon];
  const cam = I.fitCamera(
    [...I.circle([0, 0, TOP], [0, 0, 1], DIAL_R), [0, FOOT_Y, TOP + rise], [-62, -62, 0], [62, 62, 0], [62, -62, 0], [-62, 62, 0], [-120, -40, 0], [120, 40, 0]],
    { width: WIDTH, height: HEIGHT, pad: 54, azimuth: -62, elevation: 26 },
  );
  const groundAlong = [cam.right[0], cam.right[1], 0];
  const ground = I.face({ points: [[-260, -260, 0], [260, -260, 0], [260, 260, 0], [-260, 260, 0]], along: groundAlong, outward: [0, 0, 1] });
  const solids = [ground, ...subject];
  const occ = I.occlusion(solids, cam, { ss, halo: subject });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, opts);

  const stone = { base: 0.05, ambient: 0.2, bounce: 0.14 };
  const bronze = { base: 0.1, ambient: 0.14, bounce: 0.18, gloss: 0.55, shine: 40 };
  const turf = { base: 0.2, ambient: 0.24, bounce: 0 };

  const [hx] = cam.project([0, 0, 0]);
  const horizon = cam.project([0, 260, 0])[1];
  const fade = (p) => 1 - I.smoothstep(70, 230, Math.hypot(p[0] * 1.15, p[1] * 0.95));

  const layers = [];
  const layer = (id, set, material, ink, shape) => layers.push({ id, set, material, ink, shape });

  layer("ground", H(ground, { spacing: 3 }), turf, { from: 0.18, to: 0.85, width: 1.1 }, fade);
  layer("ground-x", H(ground, { spacing: 3.6, slant: 0.5 }), turf, { from: 0.62, to: 0.95, width: 0.8 }, fade);

  for (const [i, f] of steps.entries()) {
    layer(`step-${i}`, H(f, { spacing: 2.6 }), stone, { from: 0.2, to: 0.7, width: 1.2 });
    layer(`step-${i}-x`, H(f, { spacing: 2.9, slant: 0.6 }), stone, { from: 0.6, to: 0.95, width: 0.9 });
  }
  layer("pedestal", H(pedestal, { spacing: 2.4 }), stone, { from: 0.16, to: 0.7, width: 1.25 });
  layer("pedestal-x", H(pedestal, { spacing: 3.2, slant: 0.22 }), stone, { from: 0.6, to: 0.95, width: 0.9 });
  layer("rim", H(rim, { spacing: 1.6, along: "v", step: 1 }), bronze, { from: 0.14, to: 0.7, width: 0.7 });
  layer("face", H(face, { spacing: 2.2 }), bronze, { from: 0.32, to: 0.7, width: 1.1 });
  layer("face-x", H(face, { spacing: 2.4, slant: 0.7 }), bronze, { from: 0.55, to: 0.95, width: 0.8 });
  for (const [i, f] of gnomon.entries()) {
    layer(`gnomon-${i}`, H(f, { spacing: 1.7 }), bronze, { from: 0.14, to: 0.7, width: 1 });
    layer(`gnomon-${i}-x`, H(f, { spacing: 1.9, slant: 0.6 }), bronze, { from: 0.5, to: 0.9, width: 0.75 });
  }

  const sky = I.ruling(cam, occ, {
    spacing: 2.5,
    halo: 9,
    rect: [0, 0, WIDTH, HEIGHT],
    region: (x, y) => y < horizon,
  });
  const skyTone = (s) => {
    const dx = (s.x - hx) / (WIDTH * 0.52);
    const dy = (s.y - horizon) / (HEIGHT * 0.9);
    const edge = 1 - I.smoothstep(0.55, 1, Math.hypot(dx, dy * 1.1));
    return (0.25 + 0.5 * I.smoothstep(0, -0.9, dy)) * edge;
  };

  const marks = [];
  const S = (pts, opts) => marks.push(I.stroke(pts, cam, occ.sees, opts));
  S(I.circle([0, 0, TOP], [0, 0, 1], RING_R), { width: 0.55 });
  S(I.circle([0, 0, TOP], [0, 0, 1], RING_R - 3.2), { width: 0.4 });
  S(I.circle([0, 0, TOP], [0, 0, 1], DIAL_R - 1.2), { width: 0.35 });
  for (let h = 6; h <= 18; h++) {
    const { from, to } = hourLine(h);
    S([from, to], { width: h % 3 === 0 ? 0.7 : 0.45 });
    for (const q of [0.25, 0.5, 0.75]) {
      if (h === 18) break;
      const a = hourLine(h);
      const b = hourLine(h + 1);
      const th0 = Math.atan2(a.d[0], a.d[1]);
      const th1 = Math.atan2(b.d[0], b.d[1]);
      const th = th0 + (th1 - th0) * q;
      const sin = Math.sin(th);
      const cos = Math.cos(th);
      const p = (r) => [sin * r, ROOT_Y + cos * r, TOP];
      const r0 = Math.hypot(...hourLine(h).to.slice(0, 2).map((v, k) => v - [0, ROOT_Y][k]));
      S([p(r0 - (q === 0.5 ? 2.6 : 1.6)), p(r0)], { width: 0.35 });
    }
  }

  return { cam, occ, solids, subject, tris: I.trianglesOf(solids), layers, sky, skyTone, marks: marks.join("") };
};

/** Ink every lit layer for a solar time. Returns { [layer id]: path d }. A negative plate (pale ink on dark paper) inks the light, not the shade. */
export const inkAt = (S, hours, { size = 768, negative = false } = {}) => {
  const { light } = sunAt(hours);
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris });
  const out = {};
  for (const l of S.layers) {
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    const tone = negative ? (s) => 1 - lit(s) : lit;
    out[l.id] = I.ink(l.set, l.shape ? (s) => tone(s) * l.shape(s.p) : tone, l.ink);
  }
  return out;
};
