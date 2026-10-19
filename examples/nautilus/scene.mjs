import * as I from "../../kit/intaglio.mjs";

// A chambered nautilus sawn in half along its plane of coiling, engraved as a bank-note vignette.
// The shell is a logarithmic spiral that triples its radius every whorl; each whorl is a tube whose inner side is the
// last whorl's outer wall, divided into chambers by septa that bow back toward the centre. The cut face is polished
// nacre; through it you look into every chamber, its concave septum and its back wall. A lamp sweeps across the face:
// the shadows wheel inside the chambers and a pearly glint travels over the cut walls.
// World units: the cut is the plane y = 0, the shell lies behind it (y > 0), z up.

export const WIDTH = 780;
export const HEIGHT = 560;

const R = 100;
const W = 3.05;
const K = Math.log(W) / I.TAU;
const TE = 0;
const ROT = 0.06 * Math.PI;
const TW = 0.05;
const TS = 0.022;
const PER = 12;
const LIVING = I.TAU * 0.36;
const T0 = TE - 3.2 * I.TAU;
const range = (n) => Array.from({ length: n }, (_, i) => i);

/** Radius of the outer wall after a turn of th radians (th = 0 at the aperture). */
export const radius = (th) => R * Math.exp(K * (th - TE));
const P = (rho, th, y) => [rho * Math.cos(th + ROT), y, rho * Math.sin(th + ROT)];

/** The whorl's section at th: an arch from the inner edge (phi 0) over the back to the outer edge (phi 1), widest near the umbilicus. */
const section = (th, inner) => {
  const r = radius(th);
  const r0 = r / W;
  const r1 = inner ? r * (1 - TW) : r;
  const D = 0.56 * (r - r0) - (inner ? TW * r : 0);
  return { c: (r0 + r1) / 2, a: (r1 - r0) / 2, D, r };
};
const onSection = (sec, phi, s = 1) => {
  const cp = Math.cos(Math.PI * phi);
  return [sec.c - s * sec.a * cp, s * sec.D * Math.sin(Math.PI * phi) * (1 + 0.22 * cp)];
};

/** A patch whose normals point the way `want(p)` says: into a cavity, out of the shell, toward the viewer. */
const oriented = (at, want, nu, nv) => {
  const s = I.patch({ at, nu, nv });
  const [p, n] = s.point(0.5, 0.5);
  return I.dot(n, want(p)) >= 0 ? s : I.patch({ at, nu, nv, side: -1 });
};
const axisAt = (th) => P(section(th, true).c, th, 0);

/** The septa: angles where each chamber ends, from the core out to the living chamber. */
const SEPTA = (() => {
  const out = [];
  for (let th = TE - LIVING; th > T0 + I.TAU; th -= I.TAU / PER) out.unshift(th);
  return out;
})();
const bowOf = (th) => {
  const s = section(th, true);
  return (0.34 * s.a) / s.c;
};

export const scene = ({ ss = 3, coarse = 1 } = {}) => {
  const toward = [0, -1, 0];
  const cut = [];
  // The cut walls, one whorl at a time so the spiral lines keep an even spacing.
  for (let w = 0; w < 4; w++) {
    const a = Math.max(T0, TE - (w + 1) * I.TAU);
    const b = TE - w * I.TAU;
    if (b <= T0) break;
    cut.push(oriented((u, v) => {
      const th = a + (b - a) * u;
      return P(radius(th) * (1 - TW * v), th, 0);
    }, () => toward, 160, 2));
  }
  // The core: the first whorl's tiny chambers, too small to open, sawn flat.
  const core = oriented((u, v) => {
    const th = T0 + I.TAU * u;
    return P(radius(th) * (1 - TW) * v, th, 0);
  }, () => toward, 64, 6);

  // Each septum: its cut edge in the plane (a thin band), and the half-dish behind it, concave toward the aperture.
  const bands = [];
  const dishes = [];
  for (const th of SEPTA) {
    const bow = bowOf(th);
    const thick = (TS * radius(th)) / section(th, true).c;
    bands.push(oriented((u, v) => {
      const t = 2 * u - 1;
      const t2 = th - bow * (1 - t * t) - thick * v;
      const s = section(t2, true);
      return P(s.c + t * s.a, t2, 0);
    }, () => toward, 24, 1));
    dishes.push(I.sheet({
      at: (u, v) => {
        const t2 = th - bow * (1 - v * v);
        const [rho, y] = onSection(section(t2, true), u, v);
        return P(rho, t2, y);
      },
      nu: 18,
      nv: 10,
    }));
  }

  // The chambers' walls: each the inside of the tube between two septa. The living chamber runs to the aperture.
  const stops = [...SEPTA, TE];
  const chambers = range(stops.length - 1).map((j) => {
    const a = stops[j];
    const b = stops[j + 1];
    return oriented((u, v) => {
      const th = a + (b - a) * u;
      const [rho, y] = onSection(section(th, true), v);
      return P(rho, th, y);
    }, (p) => I.sub(axisAt(a + (b - a) * 0.5), p), j === stops.length - 2 ? 60 : 8, 18);
  });

  // The siphuncle: a thin tube threading the septa near the middle of the whorl, sawn in half.
  const siphon = oriented((u, v) => {
    const th = SEPTA[0] + (SEPTA[SEPTA.length - 1] - SEPTA[0]) * u;
    const s = section(th, true);
    const rs = 0.06 * s.a;
    const c = s.c - 0.08 * s.a;
    return P(c - rs * Math.cos(Math.PI * v), th - bowOf(th) * 0.98, rs * Math.sin(Math.PI * v));
  }, (p) => [0, -p[1] - 0.001, 0], 200, 6);

  // The outside of the last whorl (only a sliver shows past the cut) and the lip of the aperture.
  const shell = oriented((u, v) => {
    const th = TE - I.TAU + I.TAU * u;
    const [rho, y] = onSection(section(th, false), v);
    return P(rho, th, y);
  }, (p) => I.sub(p, axisAt(TE - I.TAU * 0.5)), 120, 16);
  const lip = oriented((u, v) => {
    const [r0, y0] = onSection(section(TE, true), u);
    const [r1, y1] = onSection(section(TE, false), u);
    return P(r0 + (r1 - r0) * v, TE, y0 + (y1 - y0) * v);
  }, () => [Math.cos(TE + ROT + Math.PI / 2), 0, Math.sin(TE + ROT + Math.PI / 2)], 24, 2);

  const solids = [...cut, core, ...bands, ...dishes.map((d) => d[0]), ...chambers, siphon, shell, lip];
  const outline = range(181).map((i) => {
    const th = TE - I.TAU + (I.TAU * i) / 180;
    return P(radius(th), th, 0);
  });
  const cam = I.fitCamera([...outline, ...outline.map((p) => I.add(p, [0, 30, 0]))], { width: WIDTH, height: HEIGHT, pad: 22, azimuth: -78, elevation: 9 });
  const occ = I.occlusion(solids, cam, { ss });
  const H = (surface, opts) => I.hatch(surface, cam, occ.sees, { ...opts, step: (opts.step ?? 1.6) * coarse });
  const merge = (sets) => ({ lines: sets.flatMap((s) => s.lines) });

  const nacre = { base: 0.02, ambient: 0.3, bounce: 0.1, gloss: 0.9, shine: 26 };
  const pearl = { base: 0.2, ambient: 0.2, bounce: 0.3, gloss: 0.5, shine: 14 };
  const porcelain = { base: 0.08, ambient: 0.2, bounce: 0.15, gloss: 0.35, shine: 20 };

  const layers = [];
  const layer = (id, set, material, ink, fade) => layers.push({ id, set, material, ink, fade });

  // The cut face: spiral lines along the walls, a glint where the lamp mirrors in the polish.
  layer("cut", merge(cut.map((c) => H(c, { spacing: 1.25, step: 1 }))), nacre, { from: 0.16, to: 0.75, width: 0.75 });
  layer("core", H(core, { spacing: 1.1, step: 0.8 }), pearl, { from: 0.1, to: 0.8, width: 0.6 });
  layer("septa", merge(bands.map((b) => H(b, { spacing: 0.9, step: 0.8 }))), nacre, { from: 0.1, to: 0.7, width: 0.55 });
  // Inside the chambers: rings across the tube, a crossing system for the shade, a third in the deepest pockets.
  const inside = (opts) => merge(chambers.map((c) => H(c, opts)));
  layer("walls", inside({ along: "v", spacing: 1.8, step: 1.4 }), pearl, { from: 0.07, to: 0.62, width: 1.05 });
  layer("walls-x", inside({ along: "v", spacing: 2.3, step: 1.5, slant: 0.7 }), pearl, { from: 0.6, to: 0.92, width: 0.8 });
  layer("walls-xx", inside({ spacing: 2.9, step: 1.5, slant: 0.25 }), pearl, { from: 0.76, to: 1, width: 0.6 });
  const dish = (opts) => merge(dishes.flatMap((d) => d.map((f) => H(f, opts))));
  layer("dish", dish({ spacing: 1.7, step: 1 }), pearl, { from: 0.14, to: 0.65, width: 0.95 });
  layer("dish-x", dish({ spacing: 2.3, step: 1, slant: 0.8 }), pearl, { from: 0.6, to: 0.94, width: 0.75 });
  layer("siphon", H(siphon, { along: "v", spacing: 1.1, step: 0.7 }), pearl, { from: 0.15, to: 0.8, width: 0.55 });
  // The outside: growth lines across the whorl, the brown flames of the living shell darkening the earlier part.
  const flames = (s) => {
    const th = Math.atan2(s.p[2], s.p[0]) - ROT;
    const u = (((th - (TE - I.TAU)) % I.TAU) + I.TAU) % I.TAU / I.TAU;
    const rho = Math.hypot(s.p[0], s.p[2]);
    const wob = Math.sin(14 * th * 1 + 4 * rho / R + 2.6 * Math.sin(rho / 9));
    return 0.45 + 0.55 * I.smoothstep(0.1, 0.5, wob) * (1 - I.smoothstep(0.45, 0.75, u));
  };
  layer("shell", H(shell, { along: "v", spacing: 1.5, step: 1 }), porcelain, { from: 0.12, to: 0.7, width: 0.85 }, flames);
  layer("shell-x", H(shell, { spacing: 2.1, step: 1, slant: 0.4 }), porcelain, { from: 0.55, to: 0.95, width: 0.7 });
  layer("lip", H(lip, { spacing: 1.2, step: 0.8 }), porcelain, { from: 0.12, to: 0.8, width: 0.6 });

  // Engraved contours: both edges of every wall and septum, the rim of the aperture.
  const marks = [];
  const S = (pts, width) => marks.push(I.stroke(pts, cam, occ.sees, { width, lift: 0.3, step: 0.9 }));
  const spiral = (f, a, b, n) => range(n + 1).map((i) => {
    const th = a + ((b - a) * i) / n;
    return P(radius(th) * f, th, 0);
  });
  S(spiral(1, TE - I.TAU, TE, 400), 0.9);
  S(spiral(1, T0, TE - I.TAU, 600), 0.5);
  S(spiral(1 - TW, T0, TE, 900), 0.45);
  for (const th of SEPTA) {
    const bow = bowOf(th);
    const thick = (TS * radius(th)) / section(th, true).c;
    for (const off of [0, thick]) {
      S(range(25).map((i) => {
        const t = (2 * i) / 24 - 1;
        const t2 = th - bow * (1 - t * t) - off;
        const s = section(t2, true);
        return P(s.c + t * s.a, t2, 0);
      }), off ? 0.32 : 0.42);
    }
  }
  for (let th = T0 + I.TAU / PER; th < T0 + I.TAU; th += I.TAU / PER) {
    const bow = bowOf(th);
    S(range(13).map((i) => {
      const t = (2 * i) / 12 - 1;
      const t2 = th - bow * (1 - t * t);
      const s = section(t2, true);
      return P(s.c + t * s.a, t2, 0);
    }), 0.3);
  }
  S(range(41).map((i) => {
    const [rho, y] = onSection(section(TE, false), i / 40);
    return P(rho, TE, y);
  }), 0.6);

  // Screen geometry for the medallion and the underprint behind the shell.
  const [cx, cy] = cam.project([0, 0, 0]);
  const box = outline.map((p) => cam.project(p));
  const xs = box.map((p) => p[0]);
  const ys = box.map((p) => p[1]);
  const mid = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const half = [(Math.max(...xs) - Math.min(...xs)) / 2, (Math.max(...ys) - Math.min(...ys)) / 2];

  return { cam, occ, solids, tris: I.trianglesOf(solids), layers, marks: marks.join(""), pole: [cx, cy], reach: cam.scale * R, mid, half };
};

/** The lamp after a sweep s in [0, 1]: from upper left round to upper right, in front of the cut and a little above. */
export const lampAt = (s) => {
  const a = (150 - 120 * s) * I.deg;
  return I.unit([Math.cos(a) * 0.8, -0.62, Math.sin(a) * 0.62]);
};

/** Shade with a lamp at a finite distance for the glint, and its direction from the shell's centre for light and shadow. */
const lamp = ({ base = 0, ambient = 0.16, bounce = 0.1, gloss = 0, shine = 30 }, { light, view, shadow }) => {
  const L = I.unit(light);
  const at = I.mul(L, 260);
  return (s) => {
    const l = I.dot(s.n, L);
    const lit = l > 0 ? shadow.lit(s.p, s.n) : 1;
    const H = I.unit(I.add(I.unit(I.sub(at, s.p)), view));
    const spec = gloss ? gloss * Math.pow(Math.max(0, I.dot(s.n, H)), shine) * lit : 0;
    const level = ambient + (1 - ambient) * Math.max(0, l) * lit + Math.max(0, -l) * bounce + spec;
    return I.clamp01(1 - level * (1 - base));
  };
};

/** Ink every layer for a lamp sweep s. A negative plate inks the light. */
export const inkAt = (S, s, { size = 1024, negative = false } = {}) => {
  const light = lampAt(s);
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris });
  const out = {};
  for (const l of S.layers) {
    const lit = lamp(l.material, { light, view: S.cam.view, shadow });
    const tone = negative ? (q) => 1 - lit(q) : lit;
    out[l.id] = I.ink(l.set, l.fade ? (q) => tone(q) * l.fade(q) : tone, l.ink);
  }
  return out;
};
