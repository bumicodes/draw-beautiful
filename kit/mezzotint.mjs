// Mezzotint kit: the same lit 3D model, printed in grain instead of lines.
// A mezzotint or aquatint plate holds ink in a field of tiny pits; tone is how many of them survive. Here every cell
// of the plate knows which surface it sees, where and which way it faces (a G-buffer), the light and a height fog
// give it a tone, and a fixed grain decides whether it prints. The grain never moves, only the tone does, so the
// plate holds still while the sun crosses it. Runs in Node and the browser.

import * as I from "./intaglio.mjs";

// Noise

/** A hash of two integers and a seed to [0, 1). */
export const hash = (i, j, seed = 0) => {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Smooth value noise in [0, 1) with features about one unit across. */
export const noise = (x, y, seed = 0) => {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j, seed);
  const b = hash(i + 1, j, seed);
  const c = hash(i, j + 1, seed);
  const d = hash(i + 1, j + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

/** Fractal noise: `octaves` of value noise, each twice as fine and half as strong. */
export const fbm = (x, y, { octaves = 4, seed = 0 } = {}) => {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x, y, seed + o * 17);
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
};

// The G-buffer

/**
 * What every cell of the plate sees. The plate is `res` cells per viewBox px. Each solid is rasterised from its own
 * (u, v) grid, `mesh(solid)` cells across (a flat face needs one, a turned or curved one more), with u and v
 * interpolated perspective-correct and the surface's exact point and normal taken per cell, so creases, masks
 * (arches, windows) and silhouettes are exact. Returns { w, h, res, id, p, n }: `id` is the solid's index in
 * `solids` or -1 for sky, `p` and `n` the world point and normal (3 floats per cell).
 */
export const gbuffer = (solids, cam, { res = 1, mesh = (s) => (s.normal ? [1, 1] : [64, 32]) } = {}) => {
  const w = Math.ceil(cam.width * res);
  const h = Math.ceil(cam.height * res);
  const depth = new Float32Array(w * h).fill(-Infinity);
  const id = new Int32Array(w * h).fill(-1);
  const U = new Float32Array(w * h);
  const V = new Float32Array(w * h);
  const persp = !!cam.eye;
  solids.forEach((s, k) => {
    const [nu, nv] = mesh(s);
    const vert = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const pt = s.point(i / nu, j / nv)[0];
        const [x, y, d] = cam.project(pt);
        // A vertex behind a perspective eye has no place on the plate (a camera inside a room or under a dome).
        const behind = persp && I.dot(I.sub(pt, cam.eye), cam.view) > -1e-3;
        vert.push([x * res, y * res, d, i / nu, j / nv, behind]);
      }
    }
    const tri = (a, b, c) => {
      if (a[5] || b[5] || c[5]) return;
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-9) return;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
      const x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
      const y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = y0; y <= y1; y++) {
        const py = y + 0.5;
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const w0 = ((c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0])) / area;
          const w1 = ((a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0])) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-5 || w1 < -1e-5 || w2 < -1e-5) continue;
          const d = w0 * a[2] + w1 * b[2] + w2 * c[2];
          const i = y * w + x;
          if (d <= depth[i]) continue;
          // Depth is 1/z under a perspective camera, so weighting by it makes u and v perspective-correct.
          const q0 = persp ? w0 * a[2] : w0;
          const q1 = persp ? w1 * b[2] : w1;
          const q2 = persp ? w2 * c[2] : w2;
          const sum = q0 + q1 + q2;
          const u = (q0 * a[3] + q1 * b[3] + q2 * c[3]) / sum;
          const v = (q0 * a[4] + q1 * b[4] + q2 * c[4]) / sum;
          if (s.mask && !s.mask(u, v)) continue;
          depth[i] = d;
          id[i] = k;
          U[i] = u;
          V[i] = v;
        }
      }
    };
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = vert[j * (nu + 1) + i];
        const b = vert[j * (nu + 1) + i + 1];
        const c = vert[(j + 1) * (nu + 1) + i + 1];
        const d = vert[(j + 1) * (nu + 1) + i];
        tri(a, b, c);
        tri(a, c, d);
      }
    }
  });
  const p = new Float32Array(w * h * 3);
  const n = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    if (id[i] < 0) continue;
    const [pt, nm] = solids[id[i]].point(U[i], V[i]);
    p.set(pt, i * 3);
    n.set(nm, i * 3);
  }
  return { w, h, res, id, p, n };
};

/** The unit direction from the eye through a plate cell (x, y in cells). An orthographic camera looks along -view. */
export const ray = (cam, res, x, y) => {
  if (!cam.eye) return I.mul(cam.view, -1);
  const k = cam.scale * Math.hypot(...I.sub(cam.eye, cam.target));
  const a = (x / res - cam.offset[0]) / k;
  const b = -(y / res - cam.offset[1]) / k;
  return I.unit(I.add(I.add(I.mul(cam.right, a), I.mul(cam.up, b)), I.mul(cam.view, -1)));
};

// Fog

/**
 * Height fog, thickest on the ground and thinning upward: density k·exp(-(z - floor) / height) per world unit, plus
 * an even `haze`, in air that is clear for the first `start` units from the eye (the foreground stays dark and crisp
 * while the middle distance goes under). `through(p, patch)` is the transmittance from the eye to p (1 clear, 0 lost
 * in fog), with `patch` scaling the density along that ray (fog banks); `between(a, b, patch)` the same between any two
 * points (the leg from a water surface up to what it reflects); `sky(dir, from)` from a point (the eye by default) out
 * to infinity.
 */
export const heightFog = ({ eye, density = 0.02, height = 4, floor = 0, haze = 0, start = 0 }) => {
  const depth = (a, b, patch, skip) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const r = (b[2] - a[2]) / height;
    const shape = Math.abs(r) < 1e-4 ? 1 : (1 - Math.exp(-r)) / r;
    return (density * patch * Math.exp(-(a[2] - floor) / height) * shape + haze) * Math.max(0, L - skip);
  };
  const through = (p, patch = 1) => Math.exp(-depth(eye, p, patch, start));
  const between = (a, b, patch = 1) => Math.exp(-depth(a, b, patch, 0));
  const sky = (dir, from = eye) => (dir[2] <= 1e-4 ? 0 : Math.exp(-(density * Math.exp(-(from[2] - floor) / height) * height) / dir[2]));
  return { through, between, sky };
};

/** A surface mirrored in the level plane z = `level`: the reflection a still water surface shows, for a second `gbuffer`. */
export const mirrored = (s, level = 0) => {
  const flip = ([x, y, z]) => [x, y, 2 * level - z];
  const nflip = ([x, y, z]) => [x, y, -z];
  return {
    ...s,
    point: (u, v) => {
      const [p, n] = s.point(u, v);
      return [flip(p), nflip(n)];
    },
    ...(s.normal ? { normal: nflip(s.normal) } : {}),
  };
};

// Optics: blurs on the tone, before the grain, so the softness is in the light and the grain stays crisp on top.

const boxPass = (src, dst, w, h, r, horizontal) => {
  const n = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 1 : w;
  const k = 1 / (2 * r + 1);
  const last = n - 1;
  for (let l = 0; l < lines; l++) {
    const o = horizontal ? l * w : l;
    // A running sum along the line, the ends held at the edge value.
    let sum = src[o] * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[o + Math.min(last, i) * step];
    for (let i = 0; i < n; i++) {
      dst[o + i * step] = sum * k;
      sum += src[o + Math.min(last, i + r + 1) * step] - src[o + Math.max(0, i - r) * step];
    }
  }
};

/** A blur of a field, `rx` cells across and `ry` down (0 skips that way), three box passes each: nearly Gaussian. */
export const blur = (f, w, h, rx, ry = rx) => {
  let a = Float32Array.from(f);
  let b = new Float32Array(f.length);
  for (const [r, across] of [[Math.round(rx), true], [Math.round(ry), false]]) {
    if (r < 1) continue;
    for (let p = 0; p < 3; p++) {
      boxPass(a, b, w, h, r, across);
      [a, b] = [b, a];
    }
  }
  return a;
};

/** The field mixed with its blur cell by cell, as much as `amount` (0..1 per cell) asks: haze that softens with distance. */
export const soften = (f, w, h, amount, rx, ry = rx) => {
  const b = blur(f, w, h, rx, ry);
  const out = new Float32Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = f[i] + (b[i] - f[i]) * amount[i];
  return out;
};

/**
 * Bloom, the halation of a photograph: light (1 - tone) above `threshold` spreads `r` cells and lifts the ink around
 * it by up to `strength`, so a sun or a glint glows into the dark next to it.
 */
export const bloom = (f, w, h, { threshold = 0.8, r = 10, strength = 0.5 } = {}) => {
  const bright = new Float32Array(f.length);
  for (let i = 0; i < f.length; i++) bright[i] = Math.max(0, 1 - f[i] - threshold) / (1 - threshold);
  const halo = blur(bright, w, h, r);
  const out = new Float32Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = Math.max(0, f[i] - strength * halo[i]);
  return out;
};

/**
 * Crepuscular rays: the light of the plate (1 - tone) above `threshold` is smeared toward the light source at (x, y)
 * in cells, as sunbeams fan out through the gaps of whatever stands against the sun, and lifts the ink along them by
 * up to `strength`. Worked on a copy `scale` times smaller and laid back bilinearly, so it costs little.
 */
export const shafts = (f, w, h, { x, y, threshold = 0.7, strength = 0.5, samples = 48, reach = 0.85, decay = 0.97, scale = 4 } = {}) => {
  const lw = Math.ceil(w / scale);
  const lh = Math.ceil(h / scale);
  const bright = new Float32Array(lw * lh);
  const count = new Float32Array(lw * lh);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = Math.floor(j / scale) * lw + Math.floor(i / scale);
      bright[k] += Math.max(0, 1 - f[j * w + i] - threshold) / (1 - threshold);
      count[k]++;
    }
  }
  for (let k = 0; k < bright.length; k++) bright[k] /= count[k];
  const sx = x / scale;
  const sy = y / scale;
  const rays = new Float32Array(lw * lh);
  let norm = 0;
  for (let s = 0, wgt = 1; s < samples; s++, wgt *= decay) norm += wgt;
  for (let j = 0; j < lh; j++) {
    for (let i = 0; i < lw; i++) {
      const dx = ((sx - i) * reach) / samples;
      const dy = ((sy - j) * reach) / samples;
      let px = i;
      let py = j;
      let sum = 0;
      for (let s = 0, wgt = 1; s < samples; s++, wgt *= decay) {
        const qi = Math.round(px);
        const qj = Math.round(py);
        if (qi >= 0 && qj >= 0 && qi < lw && qj < lh) sum += bright[qj * lw + qi] * wgt;
        px += dx;
        py += dy;
      }
      rays[j * lw + i] = sum / norm;
    }
  }
  const out = new Float32Array(f.length);
  for (let j = 0; j < h; j++) {
    const fy = Math.min(lh - 1.001, Math.max(0, (j + 0.5) / scale - 0.5));
    const j0 = Math.floor(fy);
    const ty = fy - j0;
    for (let i = 0; i < w; i++) {
      const fx = Math.min(lw - 1.001, Math.max(0, (i + 0.5) / scale - 0.5));
      const i0 = Math.floor(fx);
      const tx = fx - i0;
      const a = rays[j0 * lw + i0] * (1 - tx) + rays[j0 * lw + i0 + 1] * tx;
      const b = rays[(j0 + 1) * lw + i0] * (1 - tx) + rays[(j0 + 1) * lw + i0 + 1] * tx;
      out[j * w + i] = Math.max(0, f[j * w + i] - strength * (a * (1 - ty) + b * ty));
    }
  }
  return out;
};

// Grain

/**
 * The plate's grain: a threshold per cell, spread evenly over [0, 1) so that a tone t prints about t of its cells.
 * White noise alone is the fine salt-and-pepper of a photogravure; `clump` (0..1) mixes in noise `size` cells across
 * so the pits gather like resin dust on an aquatint plate or the rocker's burr on a mezzotint. `soft` (0..1) softens
 * the noise first, for rounder, film-like grain.
 */
export const grain = (w, h, { seed = 1, clump = 0.4, size = 2.5, soft = 0 } = {}) => {
  let raw = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) raw[y * w + x] = (1 - clump) * hash(x, y, seed) + clump * noise(x / size, y / size, seed + 7);
  }
  // `soft` (0..1) mixes in the noise blurred over one cell before it is spread evenly again: the specks round off
  // into film grain. Much past 0.5 and they merge into blotches.
  if (soft > 0) {
    const b = blur(raw, w, h, 1);
    for (let i = 0; i < raw.length; i++) raw[i] += (b[i] - raw[i]) * soft;
  }
  const order = new Uint32Array(w * h).map((_, i) => i).sort((a, b) => raw[a] - raw[b]);
  const out = new Float32Array(w * h);
  order.forEach((i, rank) => (out[i] = (rank + 0.5) / order.length));
  return out;
};

/** Print a tone field through the grain as a hard dither: ink levels 0..255, every cell either 255 (ink) or 0 (paper). */
export const print = (tone, threshold) => {
  const out = new Uint8Array(tone.length);
  for (let i = 0; i < tone.length; i++) out[i] = tone[i] > threshold[i] ? 255 : 0;
  return out;
};

/**
 * Print a tone field as continuous tone with grain on top, the photogravure or film look: ink levels 0..255. The
 * grain swings the tone by up to ±`amount`/2, most in the mid-tones and least in the deepest black and the fog, so
 * gradients stay smooth and the grain sparkles where the tone turns.
 */
export const film = (tone, threshold, { amount = 0.6, floor = 0.2 } = {}) => {
  const out = new Uint8Array(tone.length);
  for (let i = 0; i < tone.length; i++) {
    const t = tone[i];
    const g = amount * (floor + (1 - floor) * 4 * t * (1 - t));
    out[i] = Math.round(255 * Math.min(1, Math.max(0, t + g * (threshold[i] - 0.5))));
  }
  return out;
};

/** RGBA pixels of ink levels, white ink on black, for a luminance mask (a canvas `ImageData` in the browser). */
export const rgba = (levels) => {
  const out = new Uint8ClampedArray(levels.length * 4);
  for (let i = 0; i < levels.length; i++) {
    const v = levels[i];
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
};
