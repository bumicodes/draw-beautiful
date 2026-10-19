# Verify

The owner zooms in. Zoom in first, and read every PNG you make.

## Commands

```sh
S=~/.claude/skills/draw-beautiful
node $S/scripts/capture.mjs page.html --out shots/full.png --width 900 --reduced
node $S/scripts/capture.mjs page.html --out shots/phone.png --width 390 --reduced
node $S/scripts/capture.mjs page.html --out shots/close.png --width 900 --reduced --zoom 250,80,220,180 --zoom-scale 3
node $S/scripts/drive.mjs page.html --actions steps.json --width 900
node $S/scripts/pdf.mjs page-print.html --out plate.pdf
qlmanage -t -s 1400 -o shots plate.pdf      # macOS preview; elsewhere pdftoppm -png -r 100 plate.pdf shots/plate
```

`--zoom` is in CSS px inside `.intaglio-figure` (the paper sheet). If a zoom capture fails while the live script is busy, retry with `--zoom-scale 3`.

Measure live redraws with a `drive.mjs` actions file (eval strings belong in a file, not inline JSON):

```json
[["wait", 1500],
 ["eval", "new Promise(done=>{const p=document.querySelector('[data-layer]');let n=0;const o=new MutationObserver(()=>n++);o.observe(p,{attributes:true});setTimeout(()=>{o.disconnect();done(n/3)},3000)})"],
 ["move", null, 0.8, 0.5], ["wait", 1500], ["shot", "shots/moved.png"]]
```

## Checklist

At 1×:
- It reads as an engraving: form from line alone, mostly paper, crisp darks, a clear light direction.
- The thing that explains (a shadow, a position) is in view and matches the model at two or three values.
- Sky aura and vignette fade evenly; nothing runs into the plate mark by accident.
- Both themes; the dark one is a negative plate (lit faces carry the lines).
- Phone width still reads; the corners don't collide.

At 3–4×:
- **Silhouettes:** lines stop exactly on the outline, no overshoot, no gap, no ragged edge.
- **Occlusion:** where one part passes in front of another, the farther lines stop on the nearer outline.
- **Shadow edges:** crisp but not stair-stepped. Stair-steps mean the shadow map is too coarse for that area; raise `size` or shrink the ground the map has to cover.
- **Darks:** paper shows between every pair of lines.
- **Lights:** lines taper to points; no blunt ends on a lit face.
- **Crossings:** no grid, rope or moiré. Change the crossing spacing or angle.
- **Caps and seams:** no fans of lines on a cap, no doubled lines where two surfaces meet.

## Common faults

| Seen | Cause | Fix |
|---|---|---|
| Whole figure grey | primary `from` too low, material `base` too high | raise `from` to 0.15–0.2, lower `base` |
| Lit face has no lines but shadow is missing too | spacing measured too dense, gap cap thins everything | check `s.sp` of samples; spacing is screen px across the middle of the span |
| Radial fan on a disc | lathe profile includes its cap | drop the cap points, cover with a `disc` |
| Lines show through a part | part not in `occlusion` solids | add it |
| Speckle on a flat lit face | shadow acne | the kit offsets along the normal by 1.5 texels; raise `size` if it persists |
| Live redraws under 12/s | too many samples or a big shadow map | live `size` 512, `step` 2, fewer layers, `ss: 2` |
| PDF has two pages | something outside the sheet adds height (a page wrapper's margins, `pageHtml` instead of `printHtml`) | build the sheet with `printHtml`; `pdf.mjs` fails on any page count but the one expected |
| PDF shows empty plate marks | the SVG was sized `width: auto` and has no intrinsic size | `printHtml` sizes each plate in mm from its viewBox; don't override `.intaglio-svg` width in print CSS |
| A glow or tint prints as a hard-edged disc | a `mix-blend-mode` layer, rasterised by Chrome's PDF output | no blend modes in print; plain alpha over white |
