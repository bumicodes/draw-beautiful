# Craft

How an engraving reads as an engraving and not as a filter over a render.

## 1. What a burin does

A line engraver cuts a V-groove into copper or steel. Pushed deeper, the groove is wider and holds more ink; lifted, it thins to nothing. So:

- **Width is tone.** One line can go from a hairline to its full width and back. The kit's `ink` maps tone to width, linearly between `from` and `to`.
- **Lines start and end in points.** The burin enters and leaves the metal at an angle. A line that fades into light tapers to a point; the kit inserts the exact zero-width point where tone crosses `from`.
- **Lines never touch their neighbours.** Ink between two grooves that meet floods the plate. Width is capped at `fill` × the local gap (0.6–0.75), which also thins lines automatically where a hatch crowds at a limb.
- **The plate is mostly bare.** Paper is the light. Most of a good engraving is very fine lines or nothing.

## 2. Line systems: which way the lines run

Choose a system per surface. The lines describe the form before they describe the tone.

| Form | Primary lines | Crossing lines |
|---|---|---|
| Turned part (column, vase, knob, bell, wheel rim) | rings: `lathe`, `along: "u"` | helices: same surface, `slant: 0.2–0.4`, wider spacing |
| Narrow band or knurled edge | across the band: `along: "v"`, fine spacing | none |
| Sphere, dome, head | parallels round a tilted axis: `sphere({ axis })` | meridians (`along: "v"`) or parallels round a second axis |
| Stone block, plinth, wall | horizontal courses on the sides, diagonal on the top: `box({ capAlong: [1, 1, 0] })` | `slant: 0.5–0.7` |
| Metal plate, blade, gnomon | along its long edge: `prism({ capAlong })` | `slant: 0.5–0.6`, finer spacing |
| Flat dial or table top | straight along one axis: `disc({ along })` | `slant: 0.6–0.8` |
| Engine-turned disc, watch face, coin | concentric circles: `rings` | none, or a `rosette` |
| Ground | horizontal on screen: `face({ along: [cam.right[0], cam.right[1], 0] })` | `slant: 0.5`, wider spacing, only in cast shadow |
| Sky | `ruling`: horizontal, darkest at the top | none |
| Water | horizontal ruling broken into short waved strokes, darker reflections under objects | none |
| Petal | radial, along its veins: `sheet`, `along: "v"` | across, `slant: 0.3–0.4`, only in the deepest folds; a dark eye by deepening the tone near the centre |
| Leaf | each half from the midrib to the edge, forward: two half-`sheet`s with `slant` of opposite sign (chevron veins) | the opposite slant; never `along: "v"`, which follows the serrated edge and zigzags |
| Foliage | short curved strokes and flicks in clumps, dark undersides | none |

When unsure, ask how the object was made: lines follow the lathe, the grain, the courses, the hammer.

## 3. The tone ladder

Each layer is one more tone step. Typical settings:

| Layer | from → to | width px | purpose |
|---|---|---|---|
| Primary | 0.15–0.2 → 0.7 | 1.0–1.25 | describes the form; absent in full light |
| Crossing | 0.55–0.6 → 0.95 | 0.75–0.9 | turning edge and shadow side |
| Third (optional) | 0.8 → 1 | 0.6 | deepest blacks only: under ledges, inside openings |
| Sky | 0.05 → 0.9 | 0.9 | a quiet ground for the subject |

Materials go through `lighting`:

| Material | base | ambient | bounce | gloss / shine |
|---|---|---|---|---|
| Pale stone, plaster | 0.05 | 0.2 | 0.14 | 0 |
| Bronze, brass | 0.1 | 0.14 | 0.18 | 0.5 / 40 |
| Polished steel | 0.15 | 0.1 | 0.25 | 0.9 / 80 |
| Dark wood | 0.35 | 0.15 | 0.1 | 0.15 / 12 |
| Turf, earth | 0.2 | 0.24 | 0 | 0 |
| Cloth | 0.15 | 0.2 | 0.08 | 0 |

`base` is the material's own darkness, `bounce` the reflected light that keeps the shadow side from going dead (an engraver always leaves a lighter rim inside the shadow), `gloss` a highlight that burns through to bare paper.

## 4. Composition

- **Vignette.** The subject on a patch of ground under a patch of sky, both fading into the paper, the whole inside a plate mark. The fade is part of the tone: multiply the tone by a smooth falloff (`smoothstep` on distance), so lines taper out rather than stop.
- **Aura.** The ruled sky stops 6–10 px short of the subject (`ruling({ halo })`). Pass only the subject's solids as the halo set (not the ground) so the aura follows the object.
- **Horizon.** Keep the sky above the far edge of the ground and let the two never meet in a hard line; a band of bare paper between them is classic.
- **Fill.** The subject fills 55–65% of the plate height. Leave air for the sky.
- **Frame.** The artboard is part of the print and holds only the art, the frame and the title: `engravingSvg({ frame: { title } })` on a sheet of paper with its plate mark. No caption, description, hint, readout or figure number, and never a modern card or a site's own chrome. Keep extra ornament (a big medallion, a second band) for a bank-note plate; it competes with the subject.

## 5. Anti-patterns

- **Grey everywhere.** Primary `from` too low; the lit side fills with thin lines and the figure loses its light. Raise `from` until the lit faces are nearly bare.
- **Photographic negative.** Pale ink on dark paper inking the shade. Use the negative plate (`1 - tone`).
- **Wallpaper.** One straight hatch direction across curved and flat parts alike. Every surface gets its own system.
- **Grid or brickwork.** Crossing set at 90° with the same spacing. Slant it and widen its spacing.
- **Rope and moiré.** Crossing set at a shallow angle with the same spacing as the primary, or two fine systems at nearly the same angle. Change the spacing by 15–30% and the angle.
- **Blobs.** `fill` near 1, so darks close into solid black. Keep 0.6–0.75.
- **Caps drawn as fans.** A lathe profile that ends by running into the axis makes a cap, and `along: "v"` on it draws a radial fan. Leave caps out of the profile when a separate face covers them.
- **Hidden lines showing.** A surface left out of `occlusion` draws its lines through things in front. Every drawn surface goes in the solids list.
- **The explanation hidden.** A cast shadow behind the object from the chosen camera. Move the camera, the start value or the sun so the thing that matters faces the viewer.
- **Holes where parts meet.** Free-form sheets that narrow to a point (petal claws) leave paper showing at the centre. Close it with the real part that is there (a receptacle, a throat disc).
- **Beads.** Tiny spheres hatched at normal spacing turn into striped beads. Use finer spacing (1–1.1 px), thinner lines and a higher `from`.
- **Negative plate with a fade.** Invert the light first, then multiply by the fade (`(1 - lit) · fade`). Fading first and inverting after (`1 - lit · fade`) inks the whole faded plane and can triple the file size.
- **Fire on bare paper.** A flame drawn on paper reads as a pale sock. Cut it out of a ruled ground (sky behind, knocked out by its hull), stream its lines along the flow, darken the edges and keep the core and shock cells bare, and print it in the second ink.
- **Words beyond the title.** A caption explaining the physics, a hint or a readout under the plate. The only words are the title in its tablet (a bank-note sheet may add a denomination or motto in tablets of its own).
