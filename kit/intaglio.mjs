// Intaglio kit: turns surfaces into engraved line work.
// Every tone is made of lines. A line swells where the surface is dark and
// tapers to a point where it turns into light. Runs in Node and the browser.

export const TAU = Math.PI * 2;
export const deg = Math.PI / 180;

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** A unit vector from an azimuth (degrees from +x, counterclockwise) and an elevation (degrees up). */
export const direction = (azimuth, elevation) => {
  const a = azimuth * deg;
  const e = elevation * deg;
  return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
};

/** The sun's direction from its compass bearing (degrees from north through east) and altitude; x is east, y north. */
export const sunDirection = (bearing, altitude) => {
  const a = bearing * deg;
  const e = altitude * deg;
  return [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)];
};

const basis = (view) => {
  const flat = cross([0, 0, 1], view);
  const right = Math.hypot(...flat) < 1e-6 ? [0, 1, 0] : unit(flat);
  return { right, up: cross(view, right) };
};

export const frameOf = (axis, turn = 0) => {
  const a = unit(axis);
  const helper = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const b0 = unit(cross(helper, a));
  const c0 = cross(a, b0);
  const ct = Math.cos(turn * deg);
  const st = Math.sin(turn * deg);
  return { a, b: add(mul(b0, ct), mul(c0, st)), c: add(mul(c0, ct), mul(b0, -st)) };
};

// Camera

/** An orthographic camera. x and y are the floor, z is up; project returns [screenX, screenY, depth], depth growing toward the viewer. */
export const camera = ({ azimuth = -60, elevation = 24, scale = 1, offset = [0, 0], width = 640, height = 440 } = {}) => {
  const view = direction(azimuth, elevation);
  const { right, up } = basis(view);
  const project = (p) => [offset[0] + scale * dot(p, right), offset[1] - scale * dot(p, up), dot(p, view)];
  return { azimuth, elevation, scale, offset, width, height, view, right, up, project };
};

/**
 * A perspective camera at `eye` looking at `target`. `scale` is px per world unit at the target's distance.
 * `view` points from the target to the eye; `toward(p)` is the unit direction from p to the eye, for facing tests.
 * Depth is D²/z (z the distance along the line of sight), so it grows toward the viewer, is near world units at the
 * target, and stays affine across a triangle on screen for the depth buffers.
 */
export const perspective = ({ eye, target, scale = 1, offset = [0, 0], width = 640, height = 440 } = {}) => {
  const back = sub(eye, target);
  const D = Math.hypot(...back);
  const view = unit(back);
  const { right, up } = basis(view);
  const project = (p) => {
    const q = sub(p, eye);
    const z = Math.max(1e-6, -dot(q, view));
    return [offset[0] + (scale * D * dot(q, right)) / z, offset[1] - (scale * D * dot(q, up)) / z, (D * D) / z];
  };
  const toward = (p) => unit(sub(eye, p));
  return { eye, target, scale, offset, width, height, view, right, up, project, toward };
};

/** Fit a camera so the points fill the frame inside the padding. With `eye` and `target` the camera is a perspective one. */
export const fitCamera = (points, { width, height, pad = 28, azimuth, elevation, eye, target }) => {
  const make = (opts) => (eye ? perspective({ eye, target, ...opts }) : camera({ azimuth, elevation, ...opts }));
  const probe = make({});
  const xs = points.map((p) => probe.project(p));
  const [x0, x1] = [Math.min(...xs.map((p) => p[0])), Math.max(...xs.map((p) => p[0]))];
  const [y0, y1] = [Math.min(...xs.map((p) => p[1])), Math.max(...xs.map((p) => p[1]))];
  const scale = Math.min((width - 2 * pad) / (x1 - x0), (height - 2 * pad) / (y1 - y0));
  const offset = [width / 2 - (scale * (x0 + x1)) / 2, height / 2 - (scale * (y0 + y1)) / 2];
  return make({ scale, offset, width, height });
};

// Surfaces: point(u, v) -> [p, n] over u, v in [0, 1], triangles() for occlusion and shadows.
// Lines of a hatch run along u at constant v, or along v with { along: "v" }.

const grid = (point, us, vs, mask) => () => {
  const tris = [];
  for (let j = 0; j < vs.length - 1; j++) {
    for (let i = 0; i < us.length - 1; i++) {
      if (mask && !mask((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2)) continue;
      const a = point(us[i], vs[j])[0];
      const b = point(us[i + 1], vs[j])[0];
      const c = point(us[i + 1], vs[j + 1])[0];
      const d = point(us[i], vs[j + 1])[0];
      tris.push([a, b, c], [a, c, d]);
    }
  }
  return tris;
};

const steps = (n) => Array.from({ length: n + 1 }, (_, i) => i / n);

/**
 * Any smooth surface from a function at(u, v) → p. Normals come from finite differences;
 * `side` -1 flips them. `mask(u, v)` cuts openings (arches, windows): masked cells leave occlusion and shadows too,
 * so make nu and nv fine enough to follow the opening. Use it for petals, leaves, cloth, terrain, pierced walls.
 */
export const patch = ({ at, side = 1, nu = 32, nv = 32, mask }) => {
  const e = 1e-3;
  const point = (u, v) => {
    const u0 = Math.max(0, u - e);
    const u1 = Math.min(1, u + e);
    const v0 = Math.max(0, v - e);
    const v1 = Math.min(1, v + e);
    const n = unit(cross(sub(at(u1, v), at(u0, v)), sub(at(u, v1), at(u, v0))));
    return [at(u, v), side < 0 ? mul(n, -1) : n];
  };
  return { point, mask, triangles: grid(point, steps(nu), steps(nv), mask) };
};

/** A thin sheet seen from both sides: [front, back]. Hatch both; each is drawn only where it faces the viewer. Put only one in the occluders. */
export const sheet = (opts) => [patch(opts), patch({ ...opts, side: -1 })];

/** A sphere. Lines along u are its parallels round the axis, lines along v its meridians. */
export const sphere = ({ center, radius, axis = [0, 0, 1], turn = 0 }) => {
  const { a, b, c } = frameOf(axis, turn);
  const point = (u, v) => {
    const lon = u * TAU;
    const lat = (v - 0.5) * Math.PI;
    const cl = Math.cos(lat);
    const n = add(add(mul(b, cl * Math.cos(lon)), mul(c, cl * Math.sin(lon))), mul(a, Math.sin(lat)));
    return [add(center, mul(n, radius)), n];
  };
  return { point, triangles: grid(point, steps(72), steps(36)) };
};

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return [0, 1].map(
    (k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3),
  );
};

/**
 * Smooth a half-section [[s, r, corner?], ...] into vertices with arc length and normals.
 * A point marked corner (third value truthy) is a crease: the curve breaks there and the normal jumps.
 */
const profileOf = (profile, per = 12) => {
  const spans = [];
  let span = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    span.push(profile[i]);
    if (profile[i][2] && i < profile.length - 1) {
      spans.push(span);
      span = [profile[i]];
    }
  }
  spans.push(span);
  const verts = [];
  for (const q of spans) {
    const pts = [];
    for (let i = 0; i < q.length - 1; i++) {
      const n = q.length === 2 ? 1 : per;
      for (let k = 0; k < n; k++) pts.push(catmull(q[i - 1] ?? q[i], q[i], q[i + 1], q[i + 2] ?? q[i + 1], k / n));
    }
    pts.push([q[q.length - 1][0], q[q.length - 1][1]]);
    pts.forEach((p, i) => {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const ds = next[0] - prev[0];
      const dr = next[1] - prev[1];
      const l = Math.hypot(ds, dr) || 1;
      verts.push({ s: p[0], r: p[1], ns: -dr / l, nr: ds / l });
    });
  }
  let total = 0;
  verts.forEach((v, i) => {
    if (i) total += Math.hypot(v.s - verts[i - 1].s, v.r - verts[i - 1].r);
    v.at = total;
  });
  return { verts, total };
};

/** A turned part: profile [[s, r, corner?], ...] along the axis from base. Lines along u are rings, along v run down the profile. */
export const lathe = ({ base, axis = [0, 0, 1], profile, turn = 0 }) => {
  const { a, b, c } = frameOf(axis, turn);
  const { verts, total } = profileOf(profile);
  const find = (v) => {
    const target = v * total;
    let lo = 0;
    let hi = verts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (verts[mid].at <= target) lo = mid;
      else hi = mid;
    }
    const p = verts[lo];
    const q = verts[hi];
    const t = q.at > p.at ? clamp01((target - p.at) / (q.at - p.at)) : 1;
    const ns = p.ns + (q.ns - p.ns) * t;
    const nr = p.nr + (q.nr - p.nr) * t;
    const l = Math.hypot(ns, nr) || 1;
    return { s: p.s + (q.s - p.s) * t, r: p.r + (q.r - p.r) * t, ns: ns / l, nr: nr / l };
  };
  const point = (u, v) => {
    const th = u * TAU;
    const radial = add(mul(b, Math.cos(th)), mul(c, Math.sin(th)));
    const f = find(v);
    return [add(base, add(mul(a, f.s), mul(radial, f.r))), unit(add(mul(a, f.ns), mul(radial, f.nr)))];
  };
  return { point, triangles: grid(point, steps(96), verts.map((x) => x.at / total)) };
};

const inside = (pt, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

/**
 * A flat convex face from coplanar points. Lines run straight across it along `along`.
 * Pass `outward` (any vector pointing out of the solid) and the winding is fixed for you.
 */
export const face = ({ points, along, outward }) => {
  let pts = points;
  let n = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (outward && dot(n, outward) < 0) {
    pts = [...pts].reverse();
    n = mul(n, -1);
  }
  const eu = unit(sub(along, mul(n, dot(along, n))));
  const ev = cross(n, eu);
  const o = pts[0];
  const uv = pts.map((p) => [dot(sub(p, o), eu), dot(sub(p, o), ev)]);
  const [u0, u1] = [Math.min(...uv.map((p) => p[0])), Math.max(...uv.map((p) => p[0]))];
  const [v0, v1] = [Math.min(...uv.map((p) => p[1])), Math.max(...uv.map((p) => p[1]))];
  const local = (u, v) => [u0 + u * (u1 - u0), v0 + v * (v1 - v0)];
  const point = (u, v) => {
    const [x, y] = local(u, v);
    return [add(o, add(mul(eu, x), mul(ev, y))), n];
  };
  const mask = (u, v) => inside(local(u, v), uv);
  const triangles = () => pts.slice(1, -1).map((p, i) => [pts[0], p, pts[i + 2]]);
  return { point, mask, triangles, normal: n };
};

/** A flat round face, hatched straight across along `along`. */
export const disc = ({ center, normal, radius, along, sides = 120 }) => {
  const { b, c } = frameOf(normal);
  const points = steps(sides).slice(0, -1).map((t) => add(center, add(mul(b, radius * Math.cos(t * TAU)), mul(c, radius * Math.sin(t * TAU)))));
  return face({ points, along, outward: normal });
};

/** A flat ring face with concentric lines (engine turning): lines along u are circles, v runs from inner to outer radius. */
export const rings = ({ center, normal, radius, inner = 0 }) => {
  const { a, b, c } = frameOf(normal);
  const point = (u, v) => {
    const th = u * TAU;
    const r = inner + (radius - inner) * v;
    return [add(center, add(mul(b, r * Math.cos(th)), mul(c, r * Math.sin(th)))), a];
  };
  return { point, triangles: grid(point, steps(96), steps(4)) };
};

/** A surface shifted by `d`: an exploded view's parts, lifted off along one axis. Polylines move with `add`. */
export const moved = (surface, d) => ({
  ...surface,
  point: (u, v) => {
    const [p, n] = surface.point(u, v);
    return [add(p, d), n];
  },
  triangles: () => surface.triangles().map((t) => t.map((p) => add(p, d))),
});

/**
 * A rounded rectangle in the floor plane, l along x and w along y, corners of radius r: the plan of a swept case (a
 * phone, a charger, a small computer). `edge(u)` is [[x, y], outward normal] at u ∈ [0, 1] counterclockwise from the
 * middle of the +x side. `ring(off, z)` is the outline offset by `off` (negative inward) as a convex polygon of 3D
 * points at height z, starting on a corner arc, so it serves `face` as well as `outline` (close it for a loop).
 */
export const roundRect = ({ l, w, r }) => {
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy], k) => ({ c: [sx * (l / 2 - r), sy * (w / 2 - r)], a: 90 * k }));
  const arc = (k) => [(Math.PI * r) / 2, (t) => {
    const a = (corners[k].a * Math.PI) / 180 + t / r;
    const n = [Math.cos(a), Math.sin(a)];
    return [[corners[k].c[0] + r * n[0], corners[k].c[1] + r * n[1]], n];
  }];
  const sx = l - 2 * r;
  const sy = w - 2 * r;
  const legs = [
    [sy / 2, (t) => [[l / 2, t], [1, 0]]], arc(0),
    [sx, (t) => [[l / 2 - r - t, w / 2], [0, 1]]], arc(1),
    [sy, (t) => [[-l / 2, w / 2 - r - t], [-1, 0]]], arc(2),
    [sx, (t) => [[-l / 2 + r + t, -w / 2], [0, -1]]], arc(3),
    [sy / 2, (t) => [[l / 2, -w / 2 + r + t], [1, 0]]],
  ];
  const total = legs.reduce((s, [len]) => s + len, 0);
  const edge = (u) => {
    let d = u * total;
    for (const [len, f] of legs) {
      if (d <= len) return f(d);
      d -= len;
    }
    return legs[legs.length - 1][1](legs[legs.length - 1][0]);
  };
  const ring = (off, z, per = 24) =>
    corners.flatMap(({ c, a }) =>
      Array.from({ length: per + 1 }, (_, i) => {
        const t = ((a + (90 * i) / per) * Math.PI) / 180;
        return [c[0] + (r + off) * Math.cos(t), c[1] + (r + off) * Math.sin(t), z];
      }),
    );
  return { edge, ring, corners };
};

/**
 * The half-section of a case's side wall from z0 to z1 with fillets of radius `bottom` and `top`: `at(w)` is
 * [offset outward, z] at arc length w up the wall, over 0..length, and `to(z)` the arc length where the straight
 * part reaches z. Sweep it round a `roundRect` with `patch`.
 */
export const filletWall = ({ z0, z1, bottom = 0, top = 0 }) => {
  const b = (Math.PI * bottom) / 2;
  const straight = z1 - z0 - bottom - top;
  const at = (w) => {
    if (w < b) {
      const a = -Math.PI / 2 + w / bottom;
      return [-bottom + bottom * Math.cos(a), z0 + bottom + bottom * Math.sin(a)];
    }
    if (w < b + straight || !top) return [0, Math.min(z1, z0 + bottom + w - b)];
    const a = Math.min(Math.PI / 2, (w - b - straight) / top);
    return [-top + top * Math.cos(a), z1 - top + top * Math.sin(a)];
  };
  return { at, length: b + straight + (Math.PI * top) / 2, to: (z) => b + z - z0 - bottom };
};

/**
 * A prism: a convex outline (3D points) pushed along `extrude`. Returns its faces.
 * Caps are hatched along `capAlong`; sides along their outline edge, or along the extrusion with sideAlong: "extrude".
 */
export const prism = ({ outline, extrude, capAlong, sideAlong = "edge" }) => {
  const top = outline.map((p) => add(p, extrude));
  const mid = mul(add(outline.reduce(add), top.reduce(add)), 1 / (2 * outline.length));
  const centre = (pts) => mul(pts.reduce(add), 1 / pts.length);
  const faceOf = (points, along) => face({ points, along, outward: sub(centre(points), mid) });
  const capDir = capAlong ?? sub(outline[1], outline[0]);
  const sides = outline.map((p, i) => {
    const q = outline[(i + 1) % outline.length];
    return faceOf([p, q, add(q, extrude), add(p, extrude)], sideAlong === "edge" ? sub(q, p) : extrude);
  });
  return [faceOf(outline, capDir), faceOf(top, capDir), ...sides];
};

/** An axis-aligned block from min to max corners. Sides are hatched horizontally, the top along `capAlong`. */
export const box = ({ min, max, capAlong = [1, 0, 0] }) =>
  prism({
    outline: [min, [max[0], min[1], min[2]], [max[0], max[1], min[2]], [min[0], max[1], min[2]]],
    extrude: [0, 0, max[2] - min[2]],
    capAlong,
  });

const num = (v) => String(Math.round(v * 100) / 100);

// Rasterising: one depth buffer for what the viewer sees, one from the light for cast shadows.

const raster = (tris, view, w, h, buf = new Float32Array(w * h).fill(-Infinity)) => {
  for (const tri of tris) {
    const [a, b, c] = tri.map(view);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    // Overlap seams by 1% of each altitude, but never by more than 0.6 px: huge triangles (a ground plane in
    // perspective) would otherwise spill far past their edges.
    const slack = (p, q) => Math.min(0.01, (0.6 * Math.hypot(q[0] - p[0], q[1] - p[1])) / Math.abs(area));
    const t0 = slack(b, c);
    const t1 = slack(c, a);
    const t2 = slack(a, b);
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const w0 = ((c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0])) / area;
        const w1 = ((a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0])) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -t0 || w1 < -t1 || w2 < -t2) continue;
        const d = w0 * a[2] + w1 * b[2] + w2 * c[2];
        const i = y * w + x;
        if (d > buf[i]) buf[i] = d;
      }
    }
  }
  return buf;
};

const edt1 = (f, n) => {
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
  return d;
};

/** Exact Euclidean distance (in buffer pixels) from every pixel to the nearest covered one. */
const distanceField = (covered, w, h) => {
  const big = 1e12;
  const out = new Float32Array(w * h);
  const col = new Float64Array(h);
  const tmp = new Float64Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = covered[y * w + x] ? 0 : big;
    const d = edt1(col, h);
    for (let y = 0; y < h; y++) tmp[y * w + x] = d[y];
  }
  const row = new Float64Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row[x] = tmp[y * w + x];
    const d = edt1(row, w);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
};

/**
 * What the viewer sees. `sees(p)` is true when nothing nearer covers p.
 * `plus(solids)` returns a `sees` that also counts moving parts, rasterised onto a copy of the static buffer each frame.
 * `clear(x, y)` is the screen distance in px from (x, y) to the nearest drawn solid, for the white aura round a vignette.
 */
export const occlusion = (solids, cam, { ss = 3, halo = solids } = {}) => {
  const w = Math.ceil(cam.width * ss);
  const h = Math.ceil(cam.height * ss);
  const view = (p) => {
    const [x, y, d] = cam.project(p);
    return [x * ss, y * ss, d];
  };
  const buf = raster(solids.flatMap((s) => s.triangles()), view, w, h);
  const tol = 1.5 / cam.scale;
  const seer = (depth) => (p) => {
    const [x, y, d] = view(p);
    const i = Math.floor(x);
    const j = Math.floor(y);
    if (i < 1 || j < 1 || i >= w - 1 || j >= h - 1) return true;
    let lo = Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) lo = Math.min(lo, depth[(j + dj) * w + i + di]);
    return d >= lo - tol;
  };
  const sees = seer(buf);
  const plus = (extra) => seer(raster(extra.flatMap((s) => s.triangles()), view, w, h, buf.slice()));
  const cover = halo === solids ? buf : raster(halo.flatMap((s) => s.triangles()), view, w, h);
  const dist = distanceField(cover.map((d) => (d > -Infinity ? 1 : 0)), w, h);
  const clear = (x, y) => {
    const fx = Math.min(w - 1.001, Math.max(0, x * ss - 0.5));
    const fy = Math.min(h - 1.001, Math.max(0, y * ss - 0.5));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const at = (a, b) => dist[b * w + a];
    const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const bottom = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return (top * (1 - ty) + bottom * ty) / ss;
  };
  return { sees, clear, plus };
};

/** The convex hull of screen points as a closed path d. Fill it with paper (class intaglio-ground) under a moving part to knock out the static lines it covers. */
export const hullPath = (points) => {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  return hull.length ? `M${hull.map((p) => `${num(p[0])} ${num(p[1])}`).join("L")}Z` : "";
};

/** A shadow map from a directional light. `lit(p, n)` is 0 in full shadow and 1 in full light, softened over 4 × 4 samples spaced `soft` texels apart. */
export const shadowMap = (solids, light, { size = 768, tris = solids.flatMap((s) => s.triangles()), soft = 1 } = {}) => {
  const L = unit(light);
  const { right, up } = basis(L);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const tri of tris) {
    for (const p of tri) {
      const x = dot(p, right);
      const y = -dot(p, up);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const k = (size - 4) / Math.max(x1 - x0, y1 - y0);
  const view = (p) => [(dot(p, right) - x0) * k + 2, (-dot(p, up) - y0) * k + 2, dot(p, L)];
  const buf = raster(tris, view, size, size);
  const texel = 1 / k;
  const lit = (p, n) => {
    const q = add(p, mul(n, texel * 1.5));
    const [x, y, d] = view(q);
    let sum = 0;
    let count = 0;
    for (let dj = -1.5; dj <= 1.5; dj += 1) {
      for (let di = -1.5; di <= 1.5; di += 1) {
        const i = Math.floor(x + di * soft);
        const j = Math.floor(y + dj * soft);
        count++;
        if (i < 0 || j < 0 || i >= size || j >= size || d >= buf[j * size + i] - texel * 2) sum++;
      }
    }
    return sum / count;
  };
  return { lit };
};

/** Triangles of many solids, flattened once so a live shadow map can reuse them every frame. */
export const trianglesOf = (solids) => solids.flatMap((s) => s.triangles());

// Light

/**
 * How dark each sample is, 0 (paper) to 1 (full ink).
 * base is the material's own darkness, ambient its light in shadow, bounce the reflected light on the turned-away side,
 * gloss a specular highlight that burns through to paper.
 */
export const lighting = ({ light, view, shadow, ambient = 0.16, bounce = 0.1, gloss = 0, shine = 30, base = 0 }) => {
  const L = unit(light);
  const H = unit(add(L, view));
  return (s) => {
    const n = s.n;
    const l = dot(n, L);
    const lit = shadow && l > 0 ? shadow.lit(s.p, n) : 1;
    const diffuse = Math.max(0, l) * lit;
    const spec = gloss ? gloss * Math.pow(Math.max(0, dot(n, H)), shine) * lit : 0;
    const level = ambient + (1 - ambient) * diffuse + Math.max(0, -l) * bounce + spec;
    return clamp01(1 - level * (1 - base));
  };
};

// Hatching: geometry first (light-free, cached), ink second (cheap, per light).

const crossLength = (at, range, mid, cam) => {
  let len = 0;
  let prev = cam.project(at(mid, range[0])[0]);
  for (let i = 1; i <= 32; i++) {
    const p = cam.project(at(mid, range[0] + ((range[1] - range[0]) * i) / 32)[0]);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return len;
};

/**
 * Lay out one system of parallel lines on a surface and find where each is visible.
 * spacing and step are in screen px, measured across the middle of the span.
 * slant tilts every line across the others: b grows by slant · lines-worth per full span, so rings on a lathe become helices. The result holds runs of samples ready for `ink`.
 */
export const hatch = (surface, cam, sees, { along = "u", spacing = 2.6, lines, range = [0, 1], span = [0, 1], offset = 0, step = 1.6, slant = 0 } = {}) => {
  const at = along === "u" ? (a, b) => surface.point(a, b) : (a, b) => surface.point(b, a);
  const mask = surface.mask && (along === "u" ? surface.mask : (a, b) => surface.mask(b, a));
  const mid = (span[0] + span[1]) / 2;
  const count = lines ?? Math.max(1, Math.round(crossLength(at, range, mid, cam) / spacing));
  const db = (range[1] - range[0]) / count;
  const tilt = (a) => slant * db * count * (a - span[0]) / (span[1] - span[0]);
  const visible = (a, b, p, n) => b >= range[0] && b <= range[1] && dot(n, cam.toward ? cam.toward(p) : cam.view) > 0 && (!mask || mask(a, b)) && sees(p);
  const sample = (a, b0) => {
    const b = b0 + tilt(a);
    const bc = Math.min(range[1], Math.max(range[0], b));
    const [p, n] = at(a, bc);
    const [x, y] = cam.project(p);
    const [qx, qy] = cam.project(at(a, Math.min(range[1], bc + db))[0]);
    return { a, x, y, p, n, qx, qy, on: visible(a, b, p, n) };
  };
  const edge = (lo, hi, b) => {
    let inn = lo.on ? lo : hi;
    let out = lo.on ? hi : lo;
    for (let k = 0; k < 10; k++) {
      const s = sample((inn.a + out.a) / 2, b);
      if (s.on) inn = s;
      else out = s;
    }
    return inn;
  };
  const out = [];
  const reach = Math.ceil(Math.abs(slant) * count);
  for (let k = slant > 0 ? -reach : 0; k < count + (slant < 0 ? reach : 0); k++) {
    const b = range[0] + (k + 0.5 + offset) * db;
    if (!slant && (b < range[0] || b > range[1])) continue;
    const clampB = (a) => Math.min(range[1], Math.max(range[0], b + tilt(a)));
    let len = 0;
    let prev = cam.project(at(span[0], clampB(span[0]))[0]);
    for (let i = 1; i <= 48; i++) {
      const a = span[0] + ((span[1] - span[0]) * i) / 48;
      const q = cam.project(at(a, clampB(a))[0]);
      len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      prev = q;
    }
    const n = Math.min(4000, Math.max(8, Math.ceil(len / step)));
    const runs = [];
    let run = null;
    let last = null;
    for (let i = 0; i <= n; i++) {
      const s = sample(span[0] + ((span[1] - span[0]) * i) / n, b);
      if (last && s.on !== last.on) {
        const e = edge(last, s, b);
        if (s.on) run = [e];
        else {
          run.push(e);
          runs.push(run);
          run = null;
        }
      }
      if (s.on) {
        run ??= [];
        run.push(s);
      }
      last = s;
    }
    if (run) runs.push(run);
    for (const r of runs) {
      r.forEach((s, i) => {
        s.k = k;
        const p0 = r[Math.max(0, i - 1)];
        const p1 = r[Math.min(r.length - 1, i + 1)];
        const tx = p1.x - p0.x;
        const ty = p1.y - p0.y;
        const tl = Math.hypot(tx, ty) || 1;
        s.sp = Math.abs(((s.qx - s.x) * ty - (s.qy - s.y) * tx) / tl);
      });
    }
    if (runs.length) out.push(runs);
  }
  return { lines: out };
};

/** Horizontal sky ruling in screen space, kept `halo` px clear of the subject and inside `region(x, y)`. */
export const ruling = (cam, occ, { rect = [0, 0, cam.width, cam.height], spacing = 2.4, halo = 8, step = 2, region = () => true } = {}) => {
  const [rx, ry, rw, rh] = rect;
  const on = (x, y) => region(x, y) && occ.clear(x, y) > halo;
  const out = [];
  for (let y = ry + spacing / 2; y < ry + rh; y += spacing) {
    const n = Math.ceil(rw / step);
    const runs = [];
    let run = null;
    let last = null;
    for (let i = 0; i <= n; i++) {
      const x = rx + (rw * i) / n;
      const s = { x, y, sp: spacing, on: on(x, y) };
      if (last && s.on !== last.on) {
        let inn = last.on ? last.x : x;
        let off = last.on ? x : last.x;
        for (let k = 0; k < 10; k++) {
          const m = (inn + off) / 2;
          if (on(m, y)) inn = m;
          else off = m;
        }
        const e = { x: inn, y, sp: spacing, on: true };
        if (s.on) run = [e];
        else {
          run.push(e);
          runs.push(run);
          run = null;
        }
      }
      if (s.on) {
        run ??= [];
        run.push(s);
      }
      last = s;
    }
    if (run) runs.push(run);
    if (runs.length) out.push(runs);
  }
  return { lines: out };
};

/**
 * Screen-space curves as line sets for `ink`: guilloche, waved underprint, ruled arcs. Each curve is t → [x, y] over
 * t in [0, 1], kept where `on(x, y)` holds, its ends found by bisection. `spacing` is the gap to the neighbouring curve
 * (the width cap). Samples carry x, y, t and k, the curve's index, for a tone in screen space.
 */
export const trace = (curves, { on = () => true, step = 1.6, spacing = 2 } = {}) => {
  const out = [];
  curves.forEach((at, k) => {
    let len = 0;
    let prev = at(0);
    for (let i = 1; i <= 64; i++) {
      const q = at(i / 64);
      len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      prev = q;
    }
    const n = Math.max(8, Math.ceil(len / step));
    const pt = (t) => {
      const [x, y] = at(t);
      return { x, y, t, k, sp: spacing, on: on(x, y) };
    };
    const runs = [];
    let run = null;
    let last = null;
    for (let i = 0; i <= n; i++) {
      const s = pt(i / n);
      if (last && s.on !== last.on) {
        let inn = last.on ? last.t : s.t;
        let off = last.on ? s.t : last.t;
        for (let j = 0; j < 10; j++) {
          const m = (inn + off) / 2;
          const [x, y] = at(m);
          if (on(x, y)) inn = m;
          else off = m;
        }
        const e = pt(inn);
        e.on = true;
        if (s.on) run = [e];
        else {
          run.push(e);
          runs.push(run);
          run = null;
        }
      }
      if (s.on) (run ??= []).push(s);
      last = s;
    }
    if (run) runs.push(run);
    if (runs.length) out.push(runs);
  });
  return { lines: out };
};

const ribbon = (pts) => {
  const n = pts.length;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const h = pts[i][2] / 2;
    left.push(`${num(pts[i][0] - (dy / l) * h)} ${num(pts[i][1] + (dx / l) * h)}`);
    right.push(`${num(pts[i][0] + (dy / l) * h)} ${num(pts[i][1] - (dx / l) * h)}`);
  }
  return `M${left.join("L")}L${right.reverse().join("L")}Z`;
};

/**
 * Ink one hatch for a tone function. A line is absent below `from`, swells to `width` px at `to`,
 * never wider than `fill` of the gap to its neighbour (so dark areas never close up), and tapers to a point
 * where it fades. `min` drops slivers too thin to print.
 */
export const ink = (set, tone, { from = 0.06, to = 0.6, width = 1.2, fill = 0.7, min = 0.1 } = {}) => {
  const parts = [];
  for (const runs of set.lines) {
    for (const run of runs) {
      let piece = [];
      let prev = null;
      const flush = () => {
        if (piece.length > 1 && piece.some((p) => p[2] >= min)) parts.push(ribbon(piece));
        piece = [];
      };
      for (const s of run) {
        const f = clamp01((tone(s) - from) / (to - from));
        const w = Math.min(width, fill * s.sp) * f;
        const cur = [s.x, s.y, w];
        if (prev && (prev[2] > 0) !== (w > 0)) {
          const t = prev[2] / (prev[2] - w || 1);
          const z = [prev[0] + (s.x - prev[0]) * t, prev[1] + (s.y - prev[1]) * t, 0];
          piece.push(z);
          if (w <= 0) flush();
        }
        if (w > 0) piece.push(cur);
        prev = cur;
      }
      flush();
    }
  }
  return parts.join("");
};

/** A fixed engraved line through 3D points (a rim, an hour line, an edge), hidden where something nearer covers it. */
export const stroke = (points, cam, sees, { width = 0.7, taper = 0, lift = 0.4, step = 1.2 } = {}) => {
  const dense = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const [ax, ay] = cam.project(a);
    const [bx, by] = cam.project(b);
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) dense.push(add(a, mul(sub(b, a), k / n)));
  }
  dense.push(points[points.length - 1]);
  const toward = mul(cam.view, lift);
  const total = dense.length - 1;
  const parts = [];
  let piece = [];
  dense.forEach((p, i) => {
    if (sees(add(p, cam.toward ? mul(cam.toward(p), lift) : toward))) {
      const [x, y] = cam.project(p);
      const end = taper ? Math.min(1, Math.min(i, total - i) / taper) : 1;
      piece.push([x, y, width * end]);
    } else if (piece.length) {
      if (piece.length > 1) parts.push(ribbon(piece));
      piece = [];
    }
  });
  if (piece.length > 1) parts.push(ribbon(piece));
  return parts.join("");
};

// Outlines: the drawn contour of a technical figure. Silhouettes and edges become line sets for
// `ink`, hidden where nearer surfaces cover them, so their weight can follow the light like a shade line.

// A face seen exactly edge-on (an end view) counts as turned away, so it never makes a silhouette of rounding noise.
const EDGE_ON = 1e-9;

/**
 * The silhouette of a smooth surface, where it turns from facing the viewer to facing away: marching squares over an
 * nu × nv grid of exact normals, each crossing refined by bisection. Returns polylines of { p, n } for `outline`.
 * `wrap` joins u = 1 back to u = 0 on closed surfaces (lathes, spheres, swept tubes). Flat faces have none.
 */
export const silhouette = (surface, cam, { nu = 128, nv = 48, wrap = false } = {}) => {
  const facing = (u, v) => {
    const [p, n] = surface.point(u, v);
    return dot(n, cam.toward ? cam.toward(p) : cam.view);
  };
  const W = nu + 1;
  const f = new Float64Array(W * (nv + 1));
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) f[j * W + i] = facing(i / nu, j / nv);
  const F = (i, j) => f[j * W + i];
  const at = new Map();
  // An edge is h (from (i, j) to (i + 1, j)) or v (from (i, j) to (i, j + 1)); its key names the crossing on it.
  const cross0 = (i, j, d) => {
    const key = `${wrap ? i % nu : i},${j},${d}`;
    if (!at.has(key)) {
      const [i1, j1] = d === "h" ? [i + 1, j] : [i, j + 1];
      const [u0, v0, u1, v1] = [i / nu, j / nv, i1 / nu, j1 / nv];
      const sign = F(i, j) > EDGE_ON;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 14; k++) {
        const m = (lo + hi) / 2;
        if (facing(u0 + (u1 - u0) * m, v0 + (v1 - v0) * m) > EDGE_ON === sign) lo = m;
        else hi = m;
      }
      const t = (lo + hi) / 2;
      const [p, n] = surface.point(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t);
      at.set(key, { p, n });
    }
    return key;
  };
  const segs = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (surface.mask && !surface.mask((i + 0.5) / nu, (j + 0.5) / nv)) continue;
      const a = F(i, j) > EDGE_ON;
      const b = F(i + 1, j) > EDGE_ON;
      const c = F(i + 1, j + 1) > EDGE_ON;
      const d = F(i, j + 1) > EDGE_ON;
      const bottom = a !== b && cross0(i, j, "h");
      const right = b !== c && cross0(i + 1, j, "v");
      const top = d !== c && cross0(i, j + 1, "h");
      const left = a !== d && cross0(i, j, "v");
      const hit = [bottom, right, top, left].filter(Boolean);
      if (hit.length === 2) segs.push(hit);
      else if (hit.length === 4) {
        const centre = F(i, j) + F(i + 1, j) + F(i + 1, j + 1) + F(i, j + 1) > EDGE_ON;
        if (centre === a) segs.push([bottom, right], [top, left]);
        else segs.push([left, bottom], [right, top]);
      }
    }
  }
  const ends = new Map();
  segs.forEach(([x, y], s) => {
    for (const key of [x, y]) {
      if (!ends.has(key)) ends.set(key, []);
      ends.get(key).push(s);
    }
  });
  const used = new Uint8Array(segs.length);
  const walk = (key, from) => {
    const keys = [];
    let k = key;
    let s = from;
    for (;;) {
      const next = (ends.get(k) ?? []).find((t) => !used[t] && t !== s);
      if (next === undefined) return keys;
      used[next] = 1;
      k = segs[next][0] === k ? segs[next][1] : segs[next][0];
      keys.push(k);
      s = next;
      if (k === key) return keys;
    }
  };
  const out = [];
  segs.forEach(([x, y], s) => {
    if (used[s]) return;
    used[s] = 1;
    const forward = walk(y, s);
    const closed = forward[forward.length - 1] === x;
    const back = closed ? [] : walk(x, s);
    out.push([...back.reverse(), x, y, ...forward].map((k) => at.get(k)));
  });
  return out;
};

/**
 * Polylines (3D points or { p, n }) as a line set for `ink`, kept where `sees` holds a little in front of them
 * (`lift` world units toward the eye), each cut found by bisection. `dash: [on, off, ...]` in screen px breaks the
 * visible runs into dashes, for centre lines and the chain lines of an exploded view. Samples carry p and n (when
 * given), so a tone can thicken the edges turned from the light.
 */
export const outline = (paths, cam, sees, { step = 1, lift = 0.4, dash } = {}) => {
  const toward = (p) => (cam.toward ? cam.toward(p) : cam.view);
  const sample = (a, b, t) => {
    const p = add(a.p, mul(sub(b.p, a.p), t));
    const [x, y] = cam.project(p);
    return { p, n: t < 0.5 ? a.n : b.n, x, y, t, sp: 1e9, on: sees(add(p, mul(toward(p), lift))) };
  };
  const out = [];
  for (const raw of paths) {
    const pts = raw.map((q) => (Array.isArray(q) ? { p: q } : q));
    const runs = [];
    let run = null;
    let last = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const [ax, ay] = cam.project(a.p);
      const [bx, by] = cam.project(b.p);
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let k = i ? 1 : 0; k <= n; k++) {
        const s = sample(a, b, k / n);
        if (last && s.on !== last.on) {
          let inn = last.on ? (k === 1 ? 0 : last.t) : s.t;
          let off = last.on ? s.t : k === 1 ? 0 : last.t;
          for (let j = 0; j < 10; j++) {
            const m = (inn + off) / 2;
            if (sample(a, b, m).on) inn = m;
            else off = m;
          }
          const e = { ...sample(a, b, inn), on: true };
          if (s.on) run = [e];
          else {
            run.push(e);
            runs.push(run);
            run = null;
          }
        }
        if (s.on) (run ??= []).push(s);
        last = s;
      }
    }
    if (run) runs.push(run);
    const kept = dash ? runs.flatMap((r) => dashes(r, dash)) : runs;
    if (kept.length) out.push(kept.filter((r) => r.length > 1));
  }
  return { lines: out };
};

// Samples are about a step apart, so a dash starts and ends on the nearest one.
const dashes = (run, pattern) => {
  const period = pattern.reduce((a, b) => a + b, 0);
  const on = (len) => {
    let x = len % period;
    for (let i = 0; i < pattern.length; i++) {
      if (x < pattern[i]) return i % 2 === 0;
      x -= pattern[i];
    }
    return false;
  };
  const out = [];
  let piece = null;
  let len = 0;
  run.forEach((s, i) => {
    if (i) len += Math.hypot(s.x - run[i - 1].x, s.y - run[i - 1].y);
    if (on(len)) (piece ??= []).push(s);
    else if (piece) {
      out.push(piece);
      piece = null;
    }
  });
  if (piece) out.push(piece);
  return out;
};

const radical = (k) => {
  let n = k + 1048576;
  let r = 0;
  let f = 0.5;
  while (n > 0) {
    r += f * (n & 1);
    n >>= 1;
    f /= 2;
  }
  return r;
};

/**
 * One-weight shading: the lines of one hatch keep an even weight and drop out one by one as the surface turns to the
 * light, in bit-reversed order, so tone becomes spacing instead of width. Wraps a tone (0 paper to 1 ink) for `ink`
 * with { from: 0, to: 1 }: every line is drawn at the darkest tone `to`, none at `from` or lighter. `soft` is how
 * gently a dropped line tapers out.
 */
export const dither = (tone, { from = 0.3, to = 0.9, soft = 0.035 } = {}) => (s) =>
  smoothstep(-soft, soft, tone(s) - (from + (to - from) * radical(s.k ?? 0)));

/** Points round a circle in 3D. */
export const circle = (center, normal, radius, sides = 160) => {
  const { b, c } = frameOf(normal);
  return steps(sides).map((t) => add(center, add(mul(b, radius * Math.cos(t * TAU)), mul(c, radius * Math.sin(t * TAU)))));
};

// Guilloche: the turned rosettes and bands of a bank-note border.

/** A rosette of `count` closed curves, r(θ) = radius + amp·sin(lobes·θ + phase), each turned a little. Returns one path d for a hairline stroke. */
export const rosette = ({ cx, cy, radius, amp, lobes = 12, count = 24, wave = 0, samples = 720 }) => {
  const parts = [];
  for (let k = 0; k < count; k++) {
    const phase = (k / count) * TAU;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const th = (i / samples) * TAU;
      const r = radius + amp * Math.sin(lobes * th + phase) + wave * Math.sin((lobes * 2 + 1) * th - phase);
      pts.push(`${num(cx + r * Math.cos(th))} ${num(cy + r * Math.sin(th))}`);
    }
    parts.push(`M${pts.join("L")}Z`);
  }
  return parts.join("");
};

/** A guilloche band round a rounded rectangle: `count` sine strands, phase-shifted, weaving across the band. Returns one path d. */
export const band = ({ x, y, w, h, r = 10, inset = 0, thick = 6, waves = 120, count = 6, samples = 2400 }) => {
  const rx = x + inset;
  const ry = y + inset;
  const rw = w - 2 * inset;
  const rh = h - 2 * inset;
  const straight = [rw - 2 * r, rh - 2 * r];
  const perim = 2 * straight[0] + 2 * straight[1] + TAU * r;
  const at = (s) => {
    let d = ((s % perim) + perim) % perim;
    const legs = [
      [straight[0], (t) => [[rx + r + t, ry], [0, -1]]],
      [(Math.PI / 2) * r, (t) => { const a = -Math.PI / 2 + t / r; return [[rx + rw - r + r * Math.cos(a), ry + r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; }],
      [straight[1], (t) => [[rx + rw, ry + r + t], [1, 0]]],
      [(Math.PI / 2) * r, (t) => { const a = t / r; return [[rx + rw - r + r * Math.cos(a), ry + rh - r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; }],
      [straight[0], (t) => [[rx + rw - r - t, ry + rh], [0, 1]]],
      [(Math.PI / 2) * r, (t) => { const a = Math.PI / 2 + t / r; return [[rx + r + r * Math.cos(a), ry + rh - r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; }],
      [straight[1], (t) => [[rx, ry + rh - r - t], [-1, 0]]],
      [(Math.PI / 2) * r, (t) => { const a = Math.PI + t / r; return [[rx + r + r * Math.cos(a), ry + r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; }],
    ];
    for (const [len, f] of legs) {
      if (d <= len) return f(d);
      d -= len;
    }
    return legs[0][1](0);
  };
  const parts = [];
  for (let k = 0; k < count; k++) {
    const phase = (k / count) * TAU;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const s = (i / samples) * perim;
      const [[px, py], [nx, ny]] = at(s);
      const o = (thick / 2) * Math.sin((s / perim) * waves * TAU + phase);
      pts.push(`${num(px + nx * o)} ${num(py + ny * o)}`);
    }
    parts.push(`M${pts.join("L")}Z`);
  }
  return parts.join("");
};
