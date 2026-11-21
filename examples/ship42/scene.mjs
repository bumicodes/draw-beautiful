import * as I from "../../kit/intaglio.mjs";
import * as M from "../../kit/mezzotint.mjs";

// The nose of Ship 42 under an overcast sky, close up, printed as a mezzotint and built from reference.png
// (1366 × 2048 px). World units are metres along the ship: z is height above its base, x points at the camera, y to
// its right; hull angles θ run from +x toward +y. Everything was measured on the photograph under a numbered grid
// (scripts/measure.mjs): the nose's profile from its silhouette, the camera from how much the rings round the nose
// sag at the sides (it sits about 10° below, 60 m off), and every outline (the folded forward flap, the hinge
// fairing below it, the black block, the steel, the dark band, the port) traced in photo px. Each traced point is cast
// back along its camera ray onto the hull, so the shapes sit on the 3D nose exactly where the photo shows them, and
// the light can still move. The lettering on the steel is left out: the plate carries only its title.

export const PHOTO = { w: 1366, h: 2048 };
export const WIDTH = 560;
export const HEIGHT = 840;
export const RES = 2;
const k = WIDTH / PHOTO.w;

const deg = I.deg;
const SQ3 = Math.sqrt(3);
const HEX = 0.15;

// The camera: level, 60 m off, its eye 35.6 m up the ship; 125.6 photo px per metre at the axis; the axis at x 640.
const D = 60;
const EYE_Z = 35.6;
const PX_PER_M = 125.6;
const AXIS_X = 640;
const TIP_Y = 5;
const EYE = [D, 0, EYE_Z];
const TARGET = [0, 0, EYE_Z];

// The nose's radius. Its silhouette was read every 250 px down the photo (s = 52 - (y - 5) / 125.6):
//   s  36.12 40.10 42.09 44.08 46.07 48.06 50.05 51.04
//   r   4.50  4.36  4.18  3.82  3.30  2.72  1.79  1.06
// and fitted, to within 5 cm everywhere, by a curve that is convex all the way up and closes in a round, blunt tip:
// r = R (1 - t^2.34)^0.7, t running from 0 where the nose leaves the barrel at 35.8 m to 1 at the tip.
const TIP = 52;
const NOSE = 35.8;
export const radius = (s) => {
  if (s <= NOSE) return 4.5;
  const t = Math.min(1, (s - NOSE) / (TIP - NOSE));
  return 4.5 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.34)), 0.7);
};

// Arc length down the meridian, so tile rows keep their size where the nose turns in.
const TABLE = (() => {
  const out = [0];
  for (let j = 1; j <= 2400; j++) {
    const a = 28 + (j - 1) * 0.01;
    out.push(out[j - 1] + Math.hypot(0.01, radius(a + 0.01) - radius(a)));
  }
  return out;
})();
const meridian = (s) => {
  const f = Math.min(2399.99, Math.max(0, (s - 28) / 0.01));
  const j = Math.floor(f);
  return TABLE[j] + (TABLE[j + 1] - TABLE[j]) * (f - j);
};

// The tiles are laid in rings round the nose, as on the ship: bands 0.9 m tall down the meridian from the tip, each
// with a whole number of tiles round it so the tiles keep their size as the nose narrows (a little larger near the
// tip), and a pale seam between bands.
const BAND = 0.9;
const TIP_M = meridian(TIP);
const BANDS = Array.from({ length: 30 }, (_, j) => {
  const d = (j + 0.5) * BAND;
  let lo = 28;
  let hi = TIP;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (TIP_M - meridian(m) > d) lo = m;
    else hi = m;
  }
  const rb = Math.max(0.12, radius(lo));
  const want = HEX * (1 + 0.8 * Math.exp(-d / 2.2));
  const n = Math.max(3, Math.round((2 * Math.PI * rb) / (SQ3 * want)));
  return { rb, h: (2 * Math.PI * rb) / (n * SQ3) };
});
/** The tile at angle th and meridian distance y: its lattice reading, and how close it is to a band seam. */
const tileAt = (th, y) => {
  const d = Math.max(0, TIP_M - y);
  const j = Math.min(BANDS.length - 1, Math.floor(d / BAND));
  const b = BANDS[j];
  const t = hex(th * b.rb, d - j * BAND - BAND / 2, b.h);
  return { ...t, q: t.q + 1000 * j, ring: Math.min(d - j * BAND, (j + 1) * BAND - d) };
};

const onHull = (th, s, lift = 0) => [(radius(s) + lift) * Math.cos(th), (radius(s) + lift) * Math.sin(th), s];

/** A pointy-top hexagonal lattice of circumradius h: which tile, how far to its edge and to its nearest corner. */
const hex = (x, y, h = HEX) => {
  const cx = ((SQ3 / 3) * x - y / 3) / h;
  const cz = ((2 / 3) * y) / h;
  const cy = -cx - cz;
  let rx = Math.round(cx);
  let ry = Math.round(cy);
  let rz = Math.round(cz);
  const dx = Math.abs(rx - cx);
  const dy = Math.abs(ry - cy);
  const dz = Math.abs(rz - cz);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  const ux = x - h * SQ3 * (rx + rz / 2);
  const uy = y - h * 1.5 * rz;
  const edge = (SQ3 / 2) * h - Math.max(Math.abs(ux), Math.abs(0.5 * ux + (SQ3 / 2) * uy), Math.abs(-0.5 * ux + (SQ3 / 2) * uy));
  let corner = Infinity;
  for (let j = 0; j < 6; j++) {
    const t = (30 + 60 * j) * deg;
    corner = Math.min(corner, Math.hypot(ux - h * Math.cos(t), uy - h * Math.sin(t)));
  }
  return { q: rx, r: rz, edge, corner };
};

// Outlines traced on the photo, in photo px.
const TRACE = {
  // The dark band across the leeward side above the steel, from the limb to the flap.
  band: [[60, 548], [300, 528], [350, 518], [410, 508], [480, 496], [480, 703], [415, 705], [400, 712], [300, 730], [225, 755], [60, 800]],
  // The vent grille in it.
  grille: [[355, 556], [396, 552], [396, 690], [355, 696]],
  // Bare steel: under the band, left of the flap, round the fairing and the black block, down to the photo's edge.
  steel: [[0, 700], [225, 755], [300, 730], [400, 712], [520, 700], [520, 1136], [345, 1140], [240, 1205], [222, 1215], [222, 1705], [300, 1720], [390, 1820], [390, 2100], [0, 2100]],
  // The hinge fairing: its outer edge drops at x 222, its top is a sloped shoulder, it steps down onto the block.
  fairing: [[222, 1215], [240, 1205], [345, 1140], [560, 1132], [760, 1132], [760, 1565], [470, 1565], [410, 1460], [222, 1460]],
  // The black block below it, cut away diagonally into the steel at the bottom left.
  block: [[222, 1460], [410, 1460], [470, 1565], [760, 1565], [760, 2100], [390, 2100], [390, 1820], [300, 1720], [222, 1705]],
  // The square port among the tiles, and the small hatch on the steel.
  port: [[690, 1350], [790, 1350], [790, 1455], [690, 1455]],
  hatch: [[125, 1385], [180, 1385], [180, 1490], [125, 1490]],
  // The flap's rounded outer edge, top to bottom; its hinge ridge runs straight down x 545 from y 370.
  bead: [[505, 400], [500, 420], [475, 480], [450, 580], [430, 670], [408, 770], [385, 870], [365, 950], [355, 1050], [350, 1140]],
};
const HINGE_X = 545;
const FLAP_Y = [400, 1140];

const inside = ([x, y], poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const segment = ([x, y], [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
/** Distance from a point to a polygon's edges, those from index a up to b (all by default). */
const edgeDistance = (p, poly, a = 0, b = poly.length) => {
  let d = Infinity;
  for (let i = a; i < b; i++) d = Math.min(d, segment(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
};
const along = (pts, y) => {
  if (y <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) if (pts[i][1] >= y) return pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * (y - pts[i - 1][1])) / (pts[i][1] - pts[i - 1][1]);
  return pts[pts.length - 1][0];
};

export const scene = ({ res = RES } = {}) => {
  const cam = I.perspective({
    eye: EYE,
    target: TARGET,
    scale: PX_PER_M * k,
    offset: [AXIS_X * k, (TIP_Y + PX_PER_M * (TIP - EYE_Z)) * k],
    width: WIDTH,
    height: HEIGHT,
  });
  /** Where a world point lands on the photograph, in photo px. */
  const photo = (p) => {
    const [x, y] = cam.project(p);
    return [x / k, y / k];
  };
  /** The point on the hull (lifted by `off`) that the photo shows at photo px (x, y): cast along the camera ray. */
  const hit = (x, y, off = 0) => {
    const dir = M.ray(cam, 1, x * k, y * k);
    const gap = (t) => {
      const p = I.add(EYE, I.mul(dir, t));
      return Math.hypot(p[0], p[1]) - radius(p[2]) - off;
    };
    let a = 40;
    let b = 40;
    while (b < 90 && gap(b) > 0) {
      a = b;
      b += 0.05;
    }
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (gap(m) > 0) a = m;
      else b = m;
    }
    return I.add(EYE, I.mul(dir, b));
  };

  const hull = I.patch({ at: (u, v) => onHull((u * 2 - 1) * Math.PI, 33 + (51.995 - 33) * v), nu: 240, nv: 180 });

  // The fairing and the block stand proud of the hull. Their lift is read from where the bare hull point falls on the
  // photo: the fairing rises over its traced outline and fades out to the right across the crease the photo shows
  // running down from the flap; the block is a lower, flat step; a small tent-shaped cover sits on the block's top.
  const crease = (y) => 470 + (90 * (y - 1150)) / 310;
  const liftAt = (X) => {
    let h = 0;
    if (inside(X, TRACE.fairing)) {
      const edge = Math.min(edgeDistance(X, TRACE.fairing, 0, 3), edgeDistance(X, TRACE.fairing, 5, 9));
      h = 0.3 * I.smoothstep(0, 45, edge) * (1 - I.smoothstep(0, 170, X[0] - crease(X[1])));
    }
    if (inside(X, TRACE.block)) h = Math.max(h, 0.15 * I.smoothstep(0, 16, edgeDistance(X, TRACE.block)));
    // The port is a raised square frame round a recessed middle.
    if (inside(X, TRACE.port)) {
      const e = edgeDistance(X, TRACE.port);
      h = Math.max(h, 0.1 * I.smoothstep(0, 6, e) * (1 - I.smoothstep(18, 26, e)) + 0.02);
    }
    return h + 0.32 * Math.exp(-((X[0] - 585) ** 2 + (X[1] - 1515) ** 2) / (30 * 30));
  };
  const T0 = -80;
  const T1 = 40;
  const proud = I.patch({
    at: (u, v) => {
      const th = (T0 + (T1 - T0) * u) * deg;
      const s = 33 + 10.6 * v;
      return onHull(th, s, liftAt(photo(onHull(th, s))));
    },
    mask: (u, v) => {
      const th = (T0 + (T1 - T0) * u) * deg;
      const s = 33 + 10.6 * v;
      return liftAt(photo(onHull(th, s))) > 0.004;
    },
    nu: 240,
    nv: 200,
  });

  // The forward flap, folded against the hull: a plate from its hinge ridge to its rounded outer edge, both found by
  // casting the traced lines onto the hull. The outer edge stands a little off the hull, more toward the bottom.
  const SAMPLES = 64;
  const rows = Array.from({ length: SAMPLES }, (_, i) => {
    const y = FLAP_Y[0] + ((FLAP_Y[1] - FLAP_Y[0]) * i) / (SAMPLES - 1);
    const t = i / (SAMPLES - 1);
    // Each end kept as (angle, height, stand-off), so the plate between them can follow the hull round.
    const polar = (q) => ({ th: Math.atan2(q[1], q[0]), z: q[2], off: Math.hypot(q[0], q[1]) - radius(q[2]) });
    return { root: polar(hit(HINGE_X, y, 0.16)), edge: polar(hit(along(TRACE.bead, y) + 14, y, 0.2 + 0.32 * t)) };
  });
  const across = (a, b, v) => {
    const th = a.th + (b.th - a.th) * v;
    const z = a.z + (b.z - a.z) * v;
    return onHull(th, z, a.off + (b.off - a.off) * v + 0.05 * Math.sin(Math.PI * v));
  };
  const row = (u) => {
    const f = Math.min(SAMPLES - 1.0001, Math.max(0, u * (SAMPLES - 1)));
    const i = Math.floor(f);
    const t = f - i;
    const lerp = (a, b) => ({ th: a.th + (b.th - a.th) * t, z: a.z + (b.z - a.z) * t, off: a.off + (b.off - a.off) * t });
    const root = lerp(rows[i].root, rows[i + 1].root);
    const edge = lerp(rows[i].edge, rows[i + 1].edge);
    return { root: across(root, edge, 0), edge: across(root, edge, 1), at: (v) => across(root, edge, v) };
  };
  const plate = I.patch({
    at: (u, v) => row(u).at(v),
    nu: 63,
    nv: 12,
  });
  // A rounded bead along a curve of the flap: the hinge ridge and the outer edge.
  const bead = (key, rad) =>
    I.patch({
      at: (u, v) => {
        const c = row(u)[key];
        const T = I.unit(I.sub(row(Math.min(1, u + 0.01))[key], row(Math.max(0, u - 0.01))[key]));
        const out = I.unit([c[0], c[1], 0]);
        const a = I.unit(I.sub(out, I.mul(T, I.dot(out, T))));
        const b = I.cross(T, a);
        const phi = v * I.TAU;
        return I.add(c, I.add(I.mul(a, rad * Math.cos(phi)), I.mul(b, rad * Math.sin(phi))));
      },
      nu: 63,
      nv: 12,
    });
  const ridge = bead("root", 0.17);
  const lip = bead("edge", 0.13);
  // Make the plate face the camera.
  const [mid, nm] = plate.point(0.5, 0.5);
  const front = I.dot(nm, I.sub(EYE, mid)) > 0 ? plate : I.patch({ at: (u, v) => plate.point(u, v)[0], side: -1, nu: 63, nv: 12 });
  const flap = [front, ridge, lip];

  const solids = [hull, proud, ...flap];
  const kinds = {
    tiles: { base: 0.95, ambient: 0.16, bounce: 0.05, gloss: 0.3, shine: 14 },
    panel: { base: 0.96, ambient: 0.16, bounce: 0.03, gloss: 0.14, shine: 8 },
    steel: { base: 0.1, ambient: 0.5, bounce: 0.16, gloss: 0.5, shine: 6 },
    // The flap's beads catch the light along their curve.
    bead: { base: 0.9, ambient: 0.22, bounce: 0.08, gloss: 0.6, shine: 14 },
  };
  // How much of the sky each material mirrors.
  const GLAZE = [0.5, 0.32, 0.12, 0.55];
  const names = Object.keys(kinds);
  const K = Object.fromEntries(names.map((n, i) => [n, i]));

  const G = M.gbuffer(solids, cam, { res, mesh: (s) => (s === hull ? [360, 240] : s === proud ? [240, 200] : [63, 12]) });

  const N = G.w * G.h;
  const cells = [];
  const fixed = new Float32Array(N);
  const tileShade = (q, r, X) => {
    // Each tile a slightly different black; high on the windward side a patch has weathered grey.
    const weather = Math.exp(-((X[0] - 900) ** 2 / (170 * 170) + (X[1] - 520) ** 2 / (140 * 140)));
    return 0.07 * (M.hash(q, r, 9) - 0.5) - (M.hash(q, r, 6) > 0.97 ? 0.12 : 0) - 0.3 * weather * M.hash(q, r, 4);
  };
  // Pale joints between the tiles, and here and there a bright fleck where three corners meet.
  // Most joints vanish into the black; what shows is a bright fleck at most corners, and full pale outlines only in
  // patches (the big ring tiles over the tip, fresh tiles round the port and the small cover, and a few elsewhere).
  const outlined = (X) =>
    I.smoothstep(0.6, 0.66, M.fbm(X[0] / 240, X[1] / 240, { octaves: 2, seed: 41 })) +
    Math.exp(-((X[0] - 740) ** 2 + (X[1] - 1400) ** 2) / (120 * 120)) +
    Math.exp(-((X[0] - 585) ** 2 + (X[1] - 1510) ** 2) / (110 * 110)) +
    // The big tiles laid in rings over the tip all show their outlines.
    I.smoothstep(520, 300, X[1]);
  const seams = (hx, X) => {
    if (hx.corner < 0.017 && M.hash(hx.q * 7 + 1, hx.r * 3, 8) > 0.3) return -0.6;
    return hx.edge < 0.007 ? -0.06 - 0.32 * Math.min(1, outlined(X)) : 0;
  };
  const RINGS = [49.5, 43.4];
  const WELDS = [43.4, 38.6, 41.9];
  for (let i = 0; i < N; i++) {
    const id = G.id[i];
    if (id < 0) {
      const x = i % G.w;
      const y = (i - x) / G.w;
      const dir = M.ray(cam, G.res, x + 0.5, y + 0.5);
      // A bright overcast, a touch greyer overhead, with soft banks in it.
      const cloud = M.fbm(dir[1] * 4, dir[2] * 6, { octaves: 4, seed: 31 });
      fixed[i] = 0.05 + 0.08 * I.smoothstep(0, 0.2, dir[2]) + 0.07 * (cloud - 0.5);
      continue;
    }
    const s = solids[id];
    const p = [G.p[i * 3], G.p[i * 3 + 1], G.p[i * 3 + 2]];
    const n = [G.n[i * 3], G.n[i * 3 + 1], G.n[i * 3 + 2]];
    const th = Math.atan2(p[1], p[0]);
    const z = p[2];
    const ax = th * 4.5;
    const ay = meridian(z);
    let kind = K.tiles;
    let grit = 0;
    let facet = null;
    if (s === hull || s === proud) {
      // Which part of the photo this bit of hull is: test the bare hull point's place there against the tracings.
      const X = photo(onHull(th, z));
      const hx = tileAt(th, ay);
      const ring = (list, w) => list.some((h) => Math.abs(meridian(h) - ay) < w);
      if (inside(X, TRACE.port)) {
        const e = edgeDistance(X, TRACE.port);
        kind = K.panel;
        grit = e < 10 ? -0.4 : e < 20 ? 0.04 : -0.03;
      } else if (inside(X, TRACE.band)) {
        kind = K.panel;
        const slat = inside(X, TRACE.grille);
        grit = slat ? (Math.abs(((X[1] / 9) % 1) - 0.5) < 0.18 ? -0.45 : -0.15) : 0.03 * (M.hash(Math.floor(X[0] / 60), 0, 2) - 0.5) - (Math.abs(((X[0] - 300) / 62) % 1) < 0.04 ? 0.08 : 0);
      } else if (inside(X, TRACE.block)) {
        // Black block in big square tiles with faint joints.
        kind = K.panel;
        const gx = ((X[0] - 222) / 92) % 1;
        const gy = ((X[1] - 1460) / 92) % 1;
        grit = gx < 0.03 || gy < 0.03 ? -0.1 : 0.04 * (M.hash(Math.floor(X[0] / 92), Math.floor(X[1] / 92), 2) - 0.5);
      } else if (inside(X, TRACE.fairing) && Math.min(edgeDistance(X, TRACE.fairing, 0, 3), edgeDistance(X, TRACE.fairing, 7, 9)) < 34) {
        // The fairing's outer rim is black trim; inside it, tiles like the rest.
        kind = K.panel;
        grit = 0.02;
      } else if (inside(X, TRACE.steel)) {
        kind = K.steel;
        if (inside(X, TRACE.hatch)) {
          const e = edgeDistance(X, TRACE.hatch);
          kind = K.panel;
          grit = e < 6 ? -0.3 : 0;
        } else {
          // Bare stainless: brushed streaks, weld lines, and rows of studs where tiles will be pinned.
          const weld = ring(WELDS, 0.012) ? 0.22 : 0;
          const stud = hx.corner < 0.022 && M.hash(hx.q, hx.r, 3) > 0.62 ? 0.5 : 0;
          grit = weld + stud + 0.1 * (M.fbm(ax * 0.4, ay * 3, { octaves: 3, seed: 13 }) - 0.5);
        }
      } else {
        facet = hx;
        grit = tileShade(hx.q, hx.r, X) + seams(hx, X) + (hx.ring < 0.01 ? -0.14 : 0);
      }
    } else {
      // The flap's face is a deeper black than the hull, its joints fainter; its beads are paler, in smaller hexes.
      if (s === front) {
        const hx = hex(ax * 1.3, ay);
        kind = K.panel;
        grit = 0.1 + 0.4 * (tileShade(hx.q, hx.r + 999, [0, 0]) + seams(hx, [0, 0]));
        facet = hx;
      } else {
        const hx = hex(ax * 2, ay * 1.4, 0.1);
        kind = K.bead;
        grit = -0.1 + tileShade(hx.q, hx.r + 999, [0, 0]) + seams(hx, [0, 0]);
        facet = hx;
      }
    }
    // Each tile sits at a slightly different angle, so neighbours catch the sky differently.
    let nn = n;
    if (facet) {
      const a = (M.hash(facet.q, facet.r, 21) - 0.5) * 0.14;
      const b = (M.hash(facet.q, facet.r, 22) - 0.5) * 0.14;
      const e1 = I.unit(I.cross([0, 0, 1], n));
      const e2 = I.cross(n, e1);
      nn = I.unit(I.add(n, I.add(I.mul(e1, a), I.mul(e2, b))));
    }
    // The overcast mirrored in the glaze: the sky is bright overhead and greyer toward the horizon, and a glossy
    // surface shows more of it the more obliquely it is seen (Fresnel), which lights the limbs and the turned faces.
    const v = I.unit(I.sub(EYE, p));
    const nv = Math.max(0, I.dot(nn, v));
    const r = I.sub(I.mul(nn, 2 * nv), v);
    const sky = 0.35 + 0.65 * I.smoothstep(-0.15, 0.75, r[2]);
    const fresnel = 0.06 + 0.94 * Math.pow(1 - nv, 4);
    grit -= GLAZE[kind] * sky * (0.35 + 0.65 * fresnel);
    cells.push({ i, p, n: nn, kind, grit });
  }
  return { cam, G, cells, fixed, kinds: names.map((n) => kinds[n]), tris: I.trianglesOf(solids), threshold: M.grain(G.w, G.h, { seed: 4, clump: 0.22, size: 2 }) };
};

/** The light's bearing round the nose in degrees (0 behind the camera, positive from its right). */
export const lightAt = (v) => I.direction(v, 30);

/** The tone of every cell with the light at bearing v, printed through the grain. A negative plate inks the light. */
export const inkAt = (S, v, { size = 1536, negative = false, grain = "film" } = {}) => {
  const light = lightAt(v);
  const shadow = I.shadowMap(null, light, { size, tris: S.tris, soft: 1.5 });
  const lit = S.kinds.map((m) => I.lighting({ ...m, light, view: S.cam.view, shadow }));
  const tone = S.fixed.slice();
  for (const c of S.cells) tone[c.i] = Math.min(1, Math.max(0, lit[c.kind](c) + c.grit));
  if (negative) for (let i = 0; i < tone.length; i++) tone[i] = 1 - tone[i];
  return grain === "film" ? M.film(tone, S.threshold, { amount: 0.7 }) : M.print(tone, S.threshold);
};
