import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// A black hole and its accretion disk, printed as a mezzotint: the light burnished out of a black plate.
// Units are the hole's mass (G = c = M = 1): the horizon is at r = 2, the photon sphere at 3, the innermost stable
// orbit at 6. Every cell of the plate is a photon traced back from the eye along its true path round a Schwarzschild
// hole, u'' + u = 3u² with u = 1/r, so the far side of the disk shows bent over the top of the shadow and under it,
// and thin rings of light hug the shadow where photons wound round it once or twice. The gas on the disk circles at
// its Keplerian rate, Ω = r^-3/2, and what we see of it is boosted by g = √(1 − 3/r) / (1 − Ωλ): bright where it
// comes toward us, dim where it goes away, redder near the hole. Its turbulence turns with it, the inner disk
// shearing past the outer, so the one value that drives the plate is time.
// After Jean-Pierre Luminet's 1979 image of a black hole (Astronomy & Astrophysics 75, 228), the first one
// computed: the same Schwarzschild hole and thin disk seen nearly edge-on, the same lensed far side and the same
// Doppler-bright near side, which he plotted on an IBM 7040 and then laid down by hand as ink dots on negative paper.
// A print made of grain is that picture's own medium. Interstellar's Gargantua spins and leaves the Doppler out.

export const WIDTH = 720;
export const HEIGHT = 440;
export const RES = 2;

const D = 40;
const INCLINATION = 83 * I.deg;
const ROLL = -7 * I.deg;
const FOV = 0.53;
const R_IN = 6;
const R_OUT = 20;
const SKY = 0.93;

// The table of photon paths: u(φ) for each impact parameter b, from the eye (φ = 0) round to 4π.
const B_MAX = 26;
const NB = 5200;
const PHI_MAX = 4 * Math.PI;
const DPHI = 0.02;
const NPHI = Math.ceil(PHI_MAX / DPHI) + 1;
const CAPTURED = 1;
const ESCAPED = -0.02;

/**
 * Every photon from the eye, by impact parameter: integrate u'' = 3u² − u with RK4 from u = 1/D, falling inward,
 * until it crosses the horizon (u > 1/2) or climbs back out to infinity (u < 0). Returns u on a grid of φ, and the
 * angle each escaping photon leaves at.
 */
const photonTable = () => {
  const u = new Float32Array(NB * NPHI);
  const out = new Float32Array(NB).fill(NaN);
  const u0 = 1 / D;
  const h = DPHI / 8;
  const f = (y) => 3 * y * y - y;
  for (let k = 0; k < NB; k++) {
    const b = Math.max(0.02, (k / (NB - 1)) * B_MAX);
    let y = u0;
    let v = Math.sqrt(Math.max(0, 1 / (b * b) - u0 * u0 * (1 - 2 * u0)));
    let phi = 0;
    let state = 0;
    u[k * NPHI] = y;
    for (let j = 1; j < NPHI; j++) {
      if (state === 0) {
        for (let s = 0; s < 8; s++) {
          const k1y = v;
          const k1v = f(y);
          const k2y = v + (h / 2) * k1v;
          const k2v = f(y + (h / 2) * k1y);
          const k3y = v + (h / 2) * k2v;
          const k3v = f(y + (h / 2) * k2y);
          const k4y = v + h * k3v;
          const k4v = f(y + h * k3y);
          const ny = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
          v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
          if (ny < 0) {
            out[k] = phi + (h * y) / (y - ny);
            state = 2;
            break;
          }
          y = ny;
          phi += h;
          if (y > 0.5) {
            state = 1;
            break;
          }
        }
      }
      u[k * NPHI + j] = state === 0 ? y : state === 1 ? CAPTURED : ESCAPED;
    }
  }
  return { u, out };
};

/** u at impact parameter b and angle φ, bilinear in the table. */
const lookup = (T, b, phi) => {
  const fb = Math.min(NB - 1.001, (b / B_MAX) * (NB - 1));
  const fp = Math.min(NPHI - 1.001, phi / DPHI);
  const i = Math.floor(fb);
  const j = Math.floor(fp);
  const tb = fb - i;
  const tp = fp - j;
  const a = T.u[i * NPHI + j] * (1 - tp) + T.u[i * NPHI + j + 1] * tp;
  const c = T.u[(i + 1) * NPHI + j] * (1 - tp) + T.u[(i + 1) * NPHI + j + 1] * tp;
  return a * (1 - tb) + c * tb;
};

const escapeAngle = (T, b) => {
  const fb = Math.min(NB - 1.001, (b / B_MAX) * (NB - 1));
  const i = Math.floor(fb);
  const a = T.out[i];
  const c = T.out[i + 1];
  if (Number.isNaN(a)) return c;
  if (Number.isNaN(c)) return a;
  return a + (c - a) * (fb - i);
};

/** Value noise that wraps round in its second coordinate every `period` cells, for patterns round the disk. */
const ring = (x, y, period, seed) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (q) => ((q % period) + period) % period;
  const h = (a, c) => M.hash(a, w(c), seed);
  const top = h(i, j) + (h(i + 1, j) - h(i, j)) * sx;
  const bottom = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * sx;
  return top + (bottom - top) * sy;
};

/** The disk's own glow at radius r: a thin disk's emission, zero at the innermost orbit, peaking near r = 8. */
const glow = (r) => (1 - Math.sqrt(R_IN / r)) / (r * r * r);
const GLOW_MAX = glow(8.17);

/** The gas's turbulence at a radius and an angle on the disk, `age` M after it was laid down. */
const swirl = (r, angle, age, seed) => {
  const a = (angle - Math.pow(r, -1.5) * age) / I.TAU;
  const streaks = ring(r * 2, a * 16, 16, seed);
  const fine = ring(r * 5, a * 44, 44, seed + 3);
  const t = 0.6 * streaks + 0.4 * fine;
  return t * t;
};

export const scene = () => {
  const T = photonTable();
  const w = WIDTH * RES;
  const h = HEIGHT * RES;
  const N = w * h;
  const f = w / 2 / Math.tan(FOV);

  const eye = [0, -Math.sin(INCLINATION), Math.cos(INCLINATION)];
  const forward = I.mul(eye, -1);
  const r0 = [1, 0, 0];
  const u0 = I.cross(r0, forward);
  const right = I.add(I.mul(r0, Math.cos(ROLL)), I.mul(u0, Math.sin(ROLL)));
  const up = I.add(I.mul(u0, Math.cos(ROLL)), I.mul(r0, -Math.sin(ROLL)));
  const lens = 1 / Math.sqrt(1 - 2 / D);

  // What every cell sees, once: the hole, the open sky (and its stars, lensed), or a point on the disk with its
  // radius, its angle round the disk and how bright its gas shows.
  const kind = new Uint8Array(N);
  const radius = new Float32Array(N);
  const angle = new Float32Array(N);
  const boost = new Float32Array(N);
  const fixed = new Float32Array(N);
  const disk = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const sx = (x + 0.5 - w / 2) / f;
      const sy = -(y + 0.5 - h * 0.5) / f;
      const d = I.unit(I.add(forward, I.add(I.mul(right, sx), I.mul(up, sy))));
      const along = I.dot(d, eye);
      const t = I.sub(d, I.mul(eye, along));
      const st = Math.hypot(...t);
      const e2 = st > 1e-9 ? I.mul(t, 1 / st) : right;
      const b = D * st * lens;
      const normal = I.cross(eye, e2);
      // The disk plane z = 0 cuts the photon's plane along a line; the photon crosses it every π from φ0.
      let phi0 = Math.atan2(-eye[2], e2[2]);
      while (phi0 <= 1e-4) phi0 += Math.PI;
      let hit = false;
      let gone = false;
      for (let k = 0; k < 4 && !hit && !gone; k++) {
        const phi = phi0 + k * Math.PI;
        if (phi >= PHI_MAX) break;
        const u = lookup(T, b, phi);
        if (u >= 0.5 || u < 0) {
          gone = true;
          break;
        }
        const r = 1 / u;
        if (r < R_IN || r > R_OUT) continue;
        const p = I.add(I.mul(eye, Math.cos(phi)), I.mul(e2, Math.sin(phi)));
        const omega = Math.pow(r, -1.5);
        const lambda = -b * normal[2];
        kind[i] = 2;
        radius[i] = r;
        angle[i] = Math.atan2(p[1], p[0]);
        const g = Math.sqrt(1 - 3 / r) / (1 - omega * lambda);
        // What we see of the gas here before its turbulence: its glow, boosted by g⁴, fading at the disk's rim.
        boost[i] = (glow(r) / GLOW_MAX) * g ** 4 * (1 - I.smoothstep(9, R_OUT - 1, r));
        disk.push(i);
        hit = true;
      }
      if (hit) continue;
      if (lookup(T, b, PHI_MAX - 1e-3) >= 0.5) {
        kind[i] = 1;
        fixed[i] = 0.985;
        continue;
      }
      // Open sky: where the photon came from, bent by the hole, and the stars there.
      const out = escapeAngle(T, b);
      const s = I.add(I.mul(eye, Math.cos(out)), I.mul(e2, Math.sin(out)));
      fixed[i] = SKY - 0.9 * stars(s);
    }
  }
  return { w, h, kind, radius, angle, boost, fixed, disk: Uint32Array.from(disk), threshold: M.grain(w, h, { seed: 9, clump: 0.25, size: 2, soft: 0.3 }) };
};

/** The stars in a direction: points scattered on the sky, a few bright, many faint, each a small round spot. */
const stars = (s) => {
  const lon = Math.atan2(s[1], s[0]);
  const lat = Math.asin(Math.max(-1, Math.min(1, s[2])));
  let light = 0;
  for (const [cell, chance, peak, size, seed] of [[0.012, 0.88, 0.5, 0.0007, 2], [0.03, 0.84, 1, 0.001, 5]]) {
    const gx = lon / cell;
    const gy = lat / cell;
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gy);
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      for (let i = i0 - 1; i <= i0 + 1; i++) {
        if (M.hash(i, j, seed) < chance) continue;
        const cx = (i + M.hash(i, j, seed + 1)) * cell;
        const cy = (j + M.hash(i, j, seed + 2)) * cell;
        const dist = Math.hypot((lon - cx) * Math.cos(lat), lat - cy);
        const bright = peak * (0.3 + 0.7 * M.hash(i, j, seed + 3) ** 3);
        light = Math.max(light, bright * Math.exp(-((dist / size) ** 2)));
      }
    }
  }
  return light;
};

/** The plate at a time (in M): the disk's light, its glow into the dark, printed through the grain. */
export const inkAt = (S, time, { negative = false } = {}) => {
  const tone = S.fixed.slice();
  // The turbulence lives about 160 M before it is sheared away; two generations, half a life apart, cross-fade.
  const LIFE = 160;
  const a = ((time % LIFE) + LIFE) % LIFE;
  const b = (((time + LIFE / 2) % LIFE) + LIFE) % LIFE;
  const wa = 1 - Math.abs(2 * a / LIFE - 1);
  const gen = Math.floor(time / LIFE);
  const genB = Math.floor((time + LIFE / 2) / LIFE);
  for (const i of S.disk) {
    const r = S.radius[i];
    const ang = S.angle[i];
    const turbulence = wa * swirl(r, ang, a, 11 + gen * 17) + (1 - wa) * swirl(r, ang, b, 31 + genB * 17);
    const light = S.boost[i] * (0.18 + 2.2 * turbulence);
    tone[i] = SKY * Math.exp(-1.7 * light);
  }
  const glowing = M.bloom(tone, S.w, S.h, { threshold: 0.45, r: 14 * RES, strength: 0.35 });
  if (negative) for (let i = 0; i < glowing.length; i++) glowing[i] = 1 - glowing[i];
  return M.film(glowing, S.threshold, { amount: 0.75 });
};
