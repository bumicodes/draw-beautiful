---
name: draw-beautiful
description: Draw beautiful intaglio artwork as SVG, the look of a bank-note vignette, a copperplate engraving or an etching, where every tone is made of swelling burin lines, contour hatching that follows the form, cross-hatching in the darks, ruled skies and guilloche. Builds a real object in 3D, lights it, casts true shadows and engraves it into filled line ribbons, framed as an engraved plate (guilloche border, a lettered title tablet, plate mark), with calm motion (a moving sun, a turning part). Use whenever someone wants an engraved, etched, intaglio, steel-plate, bank-note, currency, stamp, woodcut-like, line-art "money style" or "old book plate" illustration, an engraved hero image or explanatory figure, or asks for the /anatomy kind of figure drawn as an engraving instead of flat isometric shading. Framework-free (Node build that writes SVG and HTML), drops into React or any site.
---

# Draw beautiful

This skill makes engravings. Nothing is filled with grey: every tone is ink lines on paper. A line is thick where the surface is dark, thins as it turns toward the light and tapers to a point where the light wins. Lines follow the form: rings round a turned column, parallels round a sphere, straight courses across a flat stone. A second set crosses the first in the darks, a third in the deepest shadow. The sky is ruled with fine horizontal lines that stop short of the subject, leaving a white aura. That is the whole look, and the kit does it from geometry, so the shading is true.

It is the sibling of `/anatomy`. The rules of what to draw are the same (a real, recognisable object, rich in purposeful parts, true to its model, calm motion). Only the rendering differs: anatomy shades flat isometric solids in four tones, this skill engraves lit 3D surfaces. Read anatomy's "The one idea that matters" when the drawing has to explain something.

Four complete examples ship. `examples/orrery/` is a machine that explains itself as it moves: a brass orrery on a turned drum, Mercury, Venus, Earth with its Moon, and Mars going round at their real periods from their J2000 longitudes (it opens on the build date's sky), each lit from the sun so its bright half always faces it, Earth's axis holding its 23.4° tilt toward the same stars all year. Moving parts are re-hatched per frame with `occ.plus` and knocked out of the static lines with `hullPath` (`node examples/orrery/build.mjs`). `examples/pisa/` is architecture: the Leaning Tower at its real proportions and 3.97° lean, six arcaded galleries of 30 columns with arched openings cut by `patch({ mask })`, the belfry, and the tower's shadow sweeping the lawn as the sun crosses Pisa's sky (`node examples/pisa/build.mjs`). `examples/hibiscus/` is an organic vignette in two inks: five ruffled petals and two serrated leaves built as `sheet` surfaces, the staminal column with 24 anthers and 5 stigma pads, every part casting on the others as the light swings round (`node examples/hibiscus/build.mjs`). `examples/sundial/` is an explanatory figure. A garden sundial on a turned stone pedestal: the sun moves through the day, the gnomon's cast shadow (from a real shadow map) turns across the dial and lands on the hour lines drawn from tan θ = sin φ · tan H. Build it with `node examples/sundial/build.mjs` (add `--dark` for the dark plate) and open `sundial.html`. Read `scene.mjs` before you start: it is about 160 lines and shows every part of the kit.

## The one idea that matters

**Light the object, then engrave the light.** Don't draw lines and hope they shade. Build the thing as surfaces in 3D, light it with one sun, let the kit measure how dark every point is (facing, cast shadow, bounce, gloss), and let line width carry that tone. Three things then come for free and are what make it read as a real engraving:

- **Contour hatching.** Each surface's lines run along its own parameter, so they curve with the form. Choose the direction like an engraver would: rings round anything turned, courses along the long edge of a stone, parallels round a ball, the grain of wood along its length.
- **Swelling lines.** Width follows tone, is capped at a share of the gap to the next line (darks never close up into a blob, and lines that crowd at a limb thin by themselves), and ramps to a point where the tone fades. No line ends blunt in the middle of a lit surface.
- **True shadows.** A cast shadow is hatched with the same lines as the surface it falls on, only thicker and crossed. It is where the explanation usually lives (the sundial's whole point is its shadow).

## Workflow

1. **Size it.** Decide which size it is before any work; it sets the order you build in.
   - **Vignette** (one object on a plinth or ground, 5–15 surfaces, one sun). Build it.
   - **Scene** (several objects, architecture, a landscape). Get the main object right on its ground first, then add the rest one at a time.
   - **Sheet** (a bank-note layout: a vignette set among engine-turned ornament, in two inks). Build the vignette first as above, then lay the sheet round it: the vignette in an oval or arched window, guilloche medallions from `rosette`, a waved underprint from `trace` in the second ink (`intaglio-ink-2`), borders from `band`. A sheet is the one place for words beyond the title (a denomination, a motto), lettered in tablets like the title's (`tablet` in `kit/plate.mjs`). The kit has no head or figure, so if a portrait is asked for, say so and offer an object or building in its place.
   Have a page that opens in the browser as soon as the first object is drawn.
2. **Truth first.** If the figure explains something, write the model as small pure functions in the scene module (the sundial's `sunAt` and `hourAngle`) and drive the drawing from it.
3. **Invent the object and its world.** Pick the real thing, a ground for it to stand on, and where the sun is. Write one sentence on what moves and what that means.
4. **Parts and surfaces.** List the parts and which kit surface each one is: `lathe` for anything turned (columns, vases, knobs, bells, wheels), `sphere`, `box` and `prism` for blocks and plates, `face` and `disc` for flat faces, `rings` for engine-turned discs, `patch` for any free-form surface and `sheet` for thin two-sided ones (petals, leaves, cloth). Every part rests on another. Write the lathe profiles as half-sections with real mouldings: a torus, a fillet, a scotia, an astragal, an echinus. Mark creases with a third value (`[s, r, 1]`); everything between creases is smooth.
5. **Camera and light.** `fitCamera(points, { width, height, pad, azimuth, elevation })`, elevation 20–30° for objects on the ground. Put the sun to one side and above (the classic engraving light is upper left, but use the model's sun when there is one) so every form has a lit side, a turning edge and a shadow side.
6. **Moving parts.** A part that moves is rebuilt and re-hatched each frame: `occ.plus([parts])` adds it to the static depth buffer so it hides and is hidden correctly, and a paper fill of `hullPath(points)` (class `intaglio-ground`) above the static ink knocks out the lines it now covers. Keep moving parts light (coarse meshes, exact normals) and make sure nothing static ever passes in front of them; when the light is fixed, map the fixed parts' shadows once and only the moving parts' per frame. See `examples/orrery/scene.mjs`.
7. **Hatch once, ink per light.** `occlusion(solids, cam)` builds the depth buffer (so nearer things hide farther lines exactly) and the aura field. `hatch(surface, cam, occ.sees, { spacing, along, slant })` lays out each line system and caches it. `ink(set, tone, { from, to, width })` turns tones into ribbons. Only `ink` and `shadowMap` run again when the light moves.
8. **Layer the tones** like an engraver: a primary system from about 0.15 to 0.7, a crossing system (`slant` 0.2–0.7 or `along: "v"`) from about 0.55 to 0.95, and a third only for the deepest blacks. Tune `from` up until the lit side is nearly bare paper; an engraving is mostly paper.
9. **Ground, sky, aura.** A ground plane hatched with screen-horizontal lines (`along` the camera's right vector, flattened) faded by distance into the paper, its own cast shadows crossed. A ruled sky with `ruling(cam, occ, { halo })`, darkest at the top, fading at its edges. Fixed engraved marks (hour lines, rims, scales) with `stroke`.
10. **Frame it as a plate.** The artboard holds three things only: the art, the frame and the title. `engravingSvg({ frame: { title } })` sets the picture inside an engraved border in the same ink (a heavy and a fine rule, a guilloche band, rosettes in the corners) with the title lettered in a tablet at the bottom in spaced small caps. `plateHtml` prints it on a sheet of cream paper inside a plate mark. No caption, description, hint, readout or figure number: the picture explains itself.
11. **Make it live, calmly.** One quantity drives everything (the hour, a lamp angle, a turn). Ease toward the target, run an idle tour, follow the pointer and arrow keys, stop when offscreen, and draw once under reduced motion. Re-ink only when the value has moved enough to show.
12. **Verify by looking.** See "Verify" below. Read every PNG.
13. **Print it, when asked.** A printed plate can't move, so it explains with still frames of the driving quantity: the circuit open and closed, the sundial at 9 and at 15. Give `build.mjs` a `--print` flag that inks each state once (`size: 1024`) and lays the framed plates on a sheet with `printHtml({ title, plates, paper, landscape })` (A4 by default; portrait stacks them, landscape sets them side by side), each with its own title naming its state. Then `node scripts/pdf.mjs page.html --out plate.pdf` prints a vector PDF and fails unless it is exactly one page. Print is ink on white: light theme, no paper grain, no shadows and no blend modes. Every id inside a plate body (masks, gradients) must be unique on the sheet, so key them by state. Then look at it (see "Verify").

## From a reference image

When the person gives a photograph, drawing or postcard of the thing, build the model *from it*: the photo fixes the camera, the proportions, the parts and the light. It does not replace the 3D model (the engraving still comes from lit geometry, so the sun can still move). `examples/madras/` is the worked case: Madras Central station from a photograph of about 1880.

1. **Keep the image** in the example folder as `reference.png` and name what it shows. Say which parts are hidden (trees, crowds, the photo's edge) and whether you will invent them or leave them out.
2. **Measure it.** `node scripts/measure.mjs reference.png --out shots/grid.svg --crop x,y,w,h` then `node scripts/capture.mjs shots/grid.svg --out shots/grid.png --select svg --scale 1`, and read the PNG: every line is numbered in photo px. Take 15–30 landmarks: corners at a cornice, the middle of a roof platform, and points along long edges (eaves, sills, string courses) whose ends are hidden. Count bays, arches and windows per stretch of wall.
3. **Read the camera.** Lines along one wall converge to a vanishing point; two walls at right angles give two, both on the horizon. Architectural photographs are nearly always level (a view camera with a shifted lens), so verticals stay vertical and the horizon is wherever those vanishing points sit, often far below the middle of the frame.
4. **Fit it.** Write `landmarks.mjs` (model points and lines as functions of a few named dimensions, each with the photo px where it shows) and run `node scripts/fit-camera.mjs landmarks.mjs`. A photo can't tell a big far building from a small near one, so the `prior` must pin the eye height (about 1.6 m) and one true dimension (a tower's known height). Aim for an rms of 5 px or less on a 640 px photo. Fit only the dimensions that set the big masses, and read the small ones (arch heights, bands, windows) off the grid as fractions of a fitted height.
5. **Model with the fit.** Put the fitted eye, yaw and focal length in a `LENS` constant and set the photo on the plate with `PHOTO = { scale, x, y }`. Then `perspective({ eye, target: eye + yaw direction at the same height, scale: f·PHOTO.scale / D, offset: principal point on the plate })` puts every model point where it sits in the photo. The plate can be larger than the photo, to leave room for sky.
6. **Overlay and iterate.** Give `build.mjs` an `--overlay` flag that draws the photo at half strength under the art (an `<image>` at `PHOTO`'s place) and skips the live script. Capture it and fix whatever doesn't lie on its photo edge, starting with the masses, then the openings. Keep going until the silhouettes, eaves and openings agree to a few px.
7. **Take the light from the photo.** Find which faces are lit and where the shadows fall, orient the model's compass to match, and pick the start hour that reproduces it. The tour then moves the sun away from the photo's moment and back.
8. **Engrave, don't trace.** Never copy the photo's tones into the ink. Lit faces stay nearly bare even where the photo shows texture, dark material is a `base` on the material, and what the photo hides (behind trees, out of frame) is either built plainly or faded into the paper.

## Setup

| File | Use it for |
|---|---|
| `kit/intaglio.mjs` | The engine, isomorphic (Node and browser): vectors, camera, surfaces (`patch`, `sheet`, `sphere`, `lathe`, `face`, `disc`, `rings`, `prism`, `box`), `occlusion` (with `plus` for moving parts), `hullPath`, `shadowMap`, `lighting`, `hatch`, `ruling`, `ink`, `stroke`, `circle`, `silhouette`, `outline` and `dither`, guilloche `rosette` and `band`. API in `references/kit.md`. |
| `kit/plate.mjs` | The artboard: `engravingSvg` (with an engraved guilloche frame and lettered tablets), `plateHtml` (paper sheet and plate mark), `pageHtml`, `printHtml` (one or more plates on an A4, A3 or Letter sheet for print), `INTAGLIO_CSS`, and the light and dark themes. |
| `scripts/live.mjs` | `liveScript({ kit, scene, start, min, max, idle, ... })`: the live loop for a plate driven by one value. A worker builds the scene and answers `inkAt(S, v)`; the page eases, tours, follows pointer and keys, and swaps `[data-layer]` paths. `wrapAround` for angles; `quantize: n` caches frames when the geometry itself is rebuilt each frame. |
| `scripts/inline.mjs` | `wrap(path, name)` inlines a module as `const name = (() => {...})()` for a standalone page. Modules that import the kit must use `import * as I`. |
| `scripts/capture.mjs` | Headless Chrome screenshots and close-ups (`--zoom x,y,w,h`, `--reduced`, `--width 390`). |
| `scripts/drive.mjs` | Scripted runs: move, key, wait, eval, shots, contact sheets. |
| `scripts/pdf.mjs` | A `printHtml` sheet to a vector PDF with headless Chrome; prints the page count and size in mm and exits 1 unless it is one page (`--pages n` to expect more). |
| `scripts/measure.mjs` | A reference photo under a numbered pixel grid (`--crop`, `--step`), as an SVG to capture and read off landmarks. |
| `scripts/fit-camera.mjs` | Least-squares fit of a level camera and the model's main dimensions to landmarks measured on a photo. |

Paths: a standalone page is a `build.mjs` that imports `scene.mjs`, renders the first frame in Node (so the page paints at once), and inlines `intaglio.mjs` + `scene.mjs` for the live part. For React, keep the scene module as is, render the static `d` strings in a server component and re-ink in a client component that sets `d` on refs (never re-render per frame).

## Craft rules (short form)

`references/craft.md` has the reasons and the recipes.

- **Only lines.** No grey fills, gradients, blur or opacity tricks for tone. Paper is the only white, ink the only dark. A second ink (`intaglio-ink-2`) only when colour is the subject.
- **Lines follow the form.** Choose each surface's `along` deliberately. Straight lines on a curved body or rings on a flat face read as wallpaper.
- **Mostly paper.** The lit side is nearly bare. If the whole figure is grey at arm's length, raise `from` on the primary layers before anything else.
- **Darks never close.** Keep `fill` at 0.6–0.75 so even the blackest shadow shows paper between lines. A solid black patch is a printing fault.
- **Crossing lines cross at an angle.** 30–60° reads as hatching; 90° at equal spacing reads as a grid or brickwork, and the same spacing at a shallow angle makes rope or moiré. Give the crossing set a different spacing from the primary.
- **Every line ends on purpose:** tapered into light, at a silhouette, at a nearer object's edge, or at the aura. The kit does the first three; never cut a line by hand.
- **One spacing family.** 2.2–3.2 px for surfaces, finer (1.5–2) for small precise parts and metal, 2.4–2.6 for the sky, wider for the ground. Spacing is in screen px, so it stays even however the surface foreshortens.
- **Aura and vignette.** The sky stops 6–10 px short of the subject; ground and sky fade into the paper at their edges. Nothing runs to the plate mark except a deliberate full-bleed sky.
- **Negative plate for dark.** Pale ink on dark paper must ink the light, not the shade (`1 - tone`), like a white-line engraving. Inverting the colours alone prints a photographic negative.
- **The object still explains.** Same as anatomy: a real, built thing with parts that sit on parts, true to its model, no words but the title.

## Verify

- Build both themes. Capture desktop, phone (`--width 390`) and `--reduced`.
- Close-ups at 3–4× (`--zoom`) of: every silhouette (lines must stop exactly on it, no overshoot, no gap), every place one object hides another, every cast-shadow edge, the deepest dark (paper must show between lines), the aura, and the lit side (should be nearly bare).
- Check the explanation: at two or three values of the driving quantity, does the drawing show what the model says (the sundial's shadow on the right hour line)?
- Measure live redraws: count `d` updates per second with `drive.mjs` (`references/verify.md`). The sundial re-inks about 20 times a second in headless Chrome; below about 12, lower the live shadow-map size or the number of layers.
- A PDF: render a preview (`qlmanage -t -s 1400 -o shots plate.pdf` on macOS, `pdftoppm -png -r 100` elsewhere) and read it. `pdf.mjs` only proves the page count and size; a plate that collapsed to an empty box still prints as one page.
- Ask of the PNG: does it read as an engraving at arm's length (form from line alone, mostly paper, crisp darks), and at 4× (clean swelling lines, tapers, no blobs, no moiré)? Iterate until yes. Full checklist in `references/verify.md`.

## References

- `references/craft.md`: the engraver's vocabulary (line systems per form, the tone ladder, crossing angles, flicks and tapers, skies, grounds, water, foliage, architecture, guilloche frames), the anti-patterns, and per-material settings.
- `references/kit.md`: every function with its options and the scene module pattern.
- `references/verify.md`: capture and drive commands, the close-up checklist and common faults with their fixes.
