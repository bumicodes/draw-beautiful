# Kit

`import * as I from "<skill>/kit/intaglio.mjs"`. World units with x and y on the floor and z up. Screen units are viewBox px.

## Camera

- `camera({ azimuth, elevation, scale, offset, width, height })`: orthographic. `azimuth` is degrees from +x counterclockwise toward the viewer (−60 views from the south-east when y is north), `elevation` degrees up. Returns `{ view, right, up, scale, width, height, project(p) → [x, y, depth] }`; depth grows toward the viewer.
- `perspective({ eye, target, scale, offset, width, height })`: a pinhole camera for eye-level views (an avenue, a canal, a facade from the street). `scale` is px per unit at the target's distance; depth is D²/z so the depth buffers stay exact; `toward(p)` gives the per-point direction to the eye, which `hatch` and `stroke` use for facing. Keep every solid in front of the eye, and hatch level planes with lines spaced in 1/distance so they fall evenly on screen (see `examples/taj/`).
- `fitCamera(points, { width, height, pad, azimuth, elevation })`: scale and centre so the points fill the frame. Pass `eye` and `target` instead of the angles for a perspective camera.
- `direction(azimuth, elevation)`, `sunDirection(bearing, altitude)` (bearing from north through east).

## Surfaces

Each returns `{ point(u, v) → [p, n], triangles(), mask? }`. Hatch lines run along `u` at constant `v`, or along `v` with `along: "v"`.

- `sphere({ center, radius, axis, turn })`: u is longitude, v latitude. Lines along u are parallels round `axis`.
- `lathe({ base, axis, profile, turn })`: profile is `[[s, r, corner?], ...]` from one end to the other; `s` along the axis, `r` the radius. Points between corners are smoothed with a Catmull-Rom curve and shaded smoothly; a corner (third value truthy) is a crease. u is the angle, v the arc length down the profile.
- `face({ points, along, outward })`: a flat convex polygon. `along` is the 3D direction of its lines; `outward` fixes the winding.
- `disc({ center, normal, radius, along })`: a flat round face with straight lines.
- `rings({ center, normal, radius, inner })`: a flat ring with concentric lines.
- `prism({ outline, extrude, capAlong, sideAlong })`: faces of a convex outline pushed along `extrude`. Sides are hatched along their outline edge (`sideAlong: "edge"`) or along the extrusion.
- `box({ min, max, capAlong })`: an axis-aligned block; sides hatched horizontally.
- `patch({ at, side, nu, nv, mask })`: any surface from `at(u, v) → p`; normals by finite differences, `side: -1` flips them. `mask(u, v)` cuts openings (arches, windows) out of the lines, the occlusion and the shadows. For petals, leaves, cloth, terrain, pierced walls.
- `sheet(opts)`: a thin two-sided patch, `[front, back]`. Hatch both (each draws only where it faces the viewer), occlude with one.
- `moved(surface, d)`: the surface shifted by `d`, for the parts of an exploded view.
- `roundRect({ l, w, r })`: a rounded-rectangle plan for a swept case. `edge(u)` → [[x, y], outward normal] round it; `ring(off, z, per)` → the outline offset by `off` as a convex polygon of 3D points (for `face`, or closed for `outline`); `corners`.
- `filletWall({ z0, z1, bottom, top })`: a case wall's half-section with fillets: `at(w)` → [offset, z] over 0..`length`, `to(z)` the arc length at a height (a parting line). Sweep it round a `roundRect` edge with `patch`.
- `circle(center, normal, radius, sides)`: points round a circle, for `stroke`.

## Visibility and light

- `occlusion(solids, cam, { ss, halo })`: depth buffer at `ss`× resolution. Returns `sees(p)` (nothing nearer covers p) and `clear(x, y)` (screen px to the nearest solid in `halo`, default all solids). About 0.5 s for a 640 × 460 vignette at ss 3; use ss 2 in the browser.
- `occ.plus(solids)`: a `sees` that also counts moving parts, rasterised onto a copy of the static buffer (a few ms at ss 2). Hatch moving parts with it so they hide each other and the static parts they pass behind.
- `hullPath(points)`: the convex hull of screen points as a path `d`. Fill it with class `intaglio-ground` above the static ink and under a moving part to knock out the static lines it covers. See `examples/orrery/`.
- `shadowMap(solids, light, { size, tris })`: orthographic depth from the light. `lit(p, n)` is 0–1, softened over 4 × 4 texels. Pass `tris: trianglesOf(solids)` once to reuse triangles every frame. 768–1024 for the static render, 512–640 live.
- `lighting({ light, view, shadow, ambient, bounce, gloss, shine, base })` returns `tone(sample) → 0..1`, 1 being full ink. See the material table in `craft.md`.

## Lines

- `hatch(surface, cam, sees, { along, spacing, step, slant, range, span, offset, lines })`: lays out one line system and finds the visible runs, refining every visible edge by bisection so lines stop exactly at silhouettes and at nearer objects. `spacing` and `step` are screen px. `slant` tilts lines across their neighbours (rings become helices). `range` limits the lines across, `span` the extent along. `offset` shifts the lines by a fraction of a spacing (to interleave a third layer between the primaries). Cache the result; it does not depend on the light.
- `ruling(cam, occ, { rect, spacing, halo, step, region })`: horizontal screen lines, kept `halo` px clear of the subject and inside `region(x, y)`. Samples carry `x, y` for a screen-space tone.
- `trace(curves, { on, step, spacing })`: screen-space curves (each `t → [x, y]` over 0..1) as a line set for `ink`, cut where `on(x, y)` fails with exact ends. Guilloche medallions, waved underprint, engine-turned dials, ruled arcs. Samples carry `x, y, t, k` (the curve's index).
- `ink(set, tone, { from, to, width, fill, min })`: ribbons as one path `d`. Width is `min(width, fill × gap) × clamp((tone − from) / (to − from))`; zero-crossings become exact points. Draw it with `class="intaglio-ink"` (a fill, not a stroke).
- `stroke(points, cam, sees, { width, taper, lift, step })`: a fixed engraved line through 3D points, hidden where covered. For rims, hour lines, scales, edges.
- `silhouette(surface, cam, { nu, nv, wrap })`: where a smooth surface turns from the viewer, by marching squares on exact normals, refined by bisection. Polylines of `{ p, n }`; `wrap` for surfaces closed in u. Flat faces and faces seen exactly edge on have none.
- `outline(paths, cam, sees, { step, lift, dash })`: polylines (3D points or `{ p, n }`) as a line set for `ink`, cut exactly where nearer surfaces cover them. `dash: [on, off, ...]` in screen px. Ink with a constant tone for an even line, or a tone of `s.n` for shade lines.
- `dither(tone, { from, to, soft })`: one-weight shading. Wraps a tone for `ink(set, ..., { from: 0, to: 1 })` so lines keep one width and drop out in bit-reversed order of their index as the tone falls: every line at `to`, none at `from`. Works on any `hatch` set (its samples carry the line index `k`).
- `rosette({ cx, cy, radius, amp, lobes, count, wave })` and `band({ x, y, w, h, r, inset, thick, waves, count })`: guilloche, in screen units, for `class="intaglio-hair"` strokes.

## Plate

`import { engravingSvg, plateHtml, pageHtml, printHtml, INTAGLIO_CSS } from "<skill>/kit/plate.mjs"`. Node only; the live page inlines just the engine and the scene.

- `engravingSvg({ width, height, label, body, frame, standalone })`: the SVG. `frame: { title }` grows the viewBox by 34 on each side and engraves the border round the picture: rules, a guilloche `band`, corner `rosette`s on paper discs and the title in a tablet at the bottom. `standalone: "light" | "dark"` embeds the CSS for a lone `.svg` file.
- `plateHtml({ body })`: the sheet of paper with the plate mark round `body`. Nothing else goes on the sheet.
- `pageHtml({ title, theme, body, script, width })`: a whole page, loading Cormorant Garamond for the title lettering from Google Fonts, with serif fallbacks.
- `printHtml({ title, plates, paper = "A4", landscape = false, theme = "light", margin = 16, gap = 9 })`: a printable sheet. `plates` are `engravingSvg` strings; each gets an equal share of the sheet inside `margin` mm (stacked in portrait, side by side in landscape) and is sized in mm from its viewBox, inside a hairline plate mark. `paper` is `"A4"`, `"A3"` or `"Letter"`. The `@page` rule sets the paper, so `scripts/pdf.mjs` prints it at true size. No paper grain, shadows or blend modes: Chrome's PDF output rasterises a blended layer into a hard-edged patch. Every id inside the plates (masks, gradients) must be unique on the sheet; the frame's own clip is keyed by plate size.
- Tokens: `--intaglio-page`, `--intaglio-paper`, `--intaglio-plate`, `--intaglio-mark`, `--intaglio-ink`, `--intaglio-ink-2`, `--intaglio-grain`. Dark is `data-theme="dark"` (pale ink on dark paper), and its scene must ink the negative.

## The scene module pattern

```js
import * as I from "../../kit/intaglio.mjs";

export const scene = ({ ss = 3 } = {}) => {
  const parts = [I.lathe({ base, profile }), ...I.box({ min, max })];
  const ground = I.face({ points, along: [cam.right[0], cam.right[1], 0], outward: [0, 0, 1] });
  const cam = I.fitCamera(extremes, { width, height, pad, azimuth, elevation });
  const occ = I.occlusion([ground, ...parts], cam, { ss, halo: parts });
  const layers = [
    { id: "body", set: I.hatch(parts[0], cam, occ.sees, { spacing: 2.4 }), material: stone, ink: { from: 0.16, to: 0.7, width: 1.2 } },
    { id: "body-x", set: I.hatch(parts[0], cam, occ.sees, { spacing: 3.2, slant: 0.22 }), material: stone, ink: { from: 0.6, to: 0.95, width: 0.9 } },
  ];
  return { cam, solids: [ground, ...parts], tris: I.trianglesOf([ground, ...parts]), layers };
};

export const inkAt = (S, light, { negative = false, size = 768 } = {}) => {
  const shadow = I.shadowMap(S.solids, light, { size, tris: S.tris });
  return Object.fromEntries(S.layers.map((l) => {
    const lit = I.lighting({ ...l.material, light, view: S.cam.view, shadow });
    return [l.id, I.ink(l.set, negative ? (s) => 1 - lit(s) : lit, l.ink)];
  }));
};
```

`build.mjs` renders `inkAt` once in Node into `<path class="intaglio-ink" data-layer="id" d="…">`, then inlines `wrap(intaglio.mjs, "I")` and `wrap(scene.mjs, "D")` with a small live loop that calls `D.inkAt` and sets each `d`. See `examples/sundial/build.mjs`.
