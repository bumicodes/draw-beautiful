<h1 align="center">Draw beautiful</h1>

<p align="center">
  <a href="https://code.claude.com/docs/en/skills"><img src="https://img.shields.io/badge/Claude_Code-skill-1b1b19?style=flat-square&logo=claude&logoColor=white" alt="Claude Code skill"></a>
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/Agent_Skills-compatible-1b1b19?style=flat-square" alt="Agent Skills compatible"></a>
  <a href="#requirements"><img src="https://img.shields.io/badge/dependencies-0-1b1b19?style=flat-square" alt="No dependencies"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#gallery">Gallery</a> ·
  <a href="#what-it-makes">What it makes</a> ·
  <a href="#install">Install</a> ·
  <a href="#examples">Examples</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#requirements">Requirements</a> ·
  <a href="#license">License</a>
</p>

---

Ask Claude for an engraving and Draw beautiful builds the subject as real surfaces in 3D, lights it with one sun, casts true shadows, and engraves the result as swelling burin lines: contour hatching that follows the form, cross-hatching in the darks, a ruled sky that stops short of the subject. It frames the picture as a bank-note plate with a guilloche border and a lettered title tablet, then makes it move calmly. The sun crosses the sky, or a part turns.

Nothing is filled with grey. The kit measures how dark each point is and turns that into line width, so the shading is true to the light.

It is the sibling of [`/anatomy`](https://github.com/wheresryan22/anatomy): the same rules for what to draw, rendered as an engraving instead of flat isometric shading.

## Quick start

```sh
npx skills add bumicodes/draw-beautiful -g -a claude-code
```

Then, in Claude Code:

```text
/draw-beautiful an engraved lighthouse on a rocky point, the beam sweeping at dusk
```

No API keys and nothing to `npm install`. The kit uses only Node's built-in modules.

### Prompts to try

Describe the thing, where it stands and what moves. The skill picks the size, the light and the line systems.

```text
/draw-beautiful a brass pocket watch lying open on a velvet cloth, the second hand ticking
/draw-beautiful a stone well in a village square, its shadow turning through the afternoon
/draw-beautiful a nautilus shell cut in half to show its chambers, lit from the upper left
/draw-beautiful the Eiffel Tower from the Champ de Mars, the sun crossing a summer sky
/draw-beautiful a steam locomotive on a viaduct, its wheels turning, as a bank-note vignette
/draw-beautiful a ruined abbey in morning fog as a mezzotint
```

Say "engraved" or "mezzotint" (or aquatint, grain, foggy) to pick the style. If you name neither, the skill asks which one you want.

### From a reference image

Give it a photograph, drawing or postcard and it fits the camera and the proportions to it, then engraves the model. The sun can still move. Pass the image path or paste the image into the prompt.

```text
/draw-beautiful engrave this photo of my grandparents' house ~/Pictures/house.jpg
/draw-beautiful ./refs/bridge-1905.png the old bridge as an engraving, keep the photo's camera and light
/draw-beautiful this postcard of Madras Central ./madras.png, invent what the trees hide and let the clocks keep time
```

It saves the image as `reference.png` beside the scene and adds an `--overlay` flag to the build, which draws the photo under the art so you can check that they line up (see [`madras`](examples/madras)).

## Gallery

### Mezzotint

The same lit 3D model printed in grain instead of lines: tone is the density of the grain, height fog swallows the ground, and the light moves while the grain holds still. These are shown without the plate's frame.

<table>
  <tr>
    <td width="50%"><img src=".github/assets/temple.webp" alt="A mezzotint of a Doric temple on a stony plain: the colonnade rises pale out of a bank of ground fog under a grey sky, its steps lost in the mist, a lone figure standing in the dark field below, everything made of fine grain."></td>
    <td width="50%"><img src=".github/assets/torii.webp" alt="A mezzotint of a torii standing in a still bay at dawn: mist lies on the water, the gate's reflection fades into the haze below it, and the sun rises over misty ridges with a glitter path on the water."></td>
  </tr>
  <tr>
    <td><sub><b>temple</b>: an 8 × 17 Doric temple whose base sinks into height fog over dark, gritty ground, as the sun crosses Athens' sky.</sub></td>
    <td><sub><b>torii</b>: the water is a true mirror, a second G-buffer seen from below, and the reflection fades through the mist twice. The sun comes up behind the ridges and lays a glitter path across the bay.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/bridge.webp" alt="A two-colour mezzotint of the Golden Gate Bridge from the Marin headlands: the orange towers and cables stand clear while the deck runs into a sea of fog, a dark headland in the foreground."></td>
    <td><img src=".github/assets/moai.webp" alt="A mezzotint of the fifteen moai of Ahu Tongariki in a row on their platform, silhouetted against the rising sun, which breaks between two of the statues."></td>
  </tr>
  <tr>
    <td><sub><b>bridge</b>: the Golden Gate at its real size in two inks, its deck running into a billowed sea of summer fog while the towers stand clear. The light swings from a morning silhouette to an evening glow.</sub></td>
    <td><sub><b>moai</b>: Ahu Tongariki at the solstice sunrise. The sun breaks between the statues, and crepuscular rays and long shadows reach across the grass.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/nave.webp" alt="A mezzotint of the nave of a Gothic cathedral from the west end: dark piers recede into haze toward the far windows, shafts of sunlight slant across the air from the clerestory, and patches of sun lie on the floor."></td>
    <td><img src=".github/assets/pantheon.webp" alt="A mezzotint of the Pantheon's rotunda seen from the floor: rings of coffers rise into the dark round the bright oculus, and one beam of sunlight falls through the haze onto the wall."></td>
  </tr>
  <tr>
    <td><sub><b>nave</b>: a High Gothic nave at Chartres' latitude in late October. The beams through the haze are shaped by every window's tracery, wall depth and stained-glass panes, and slide over the floor and up the piers as the sun moves.</sub></td>
    <td><sub><b>pantheon</b>: the rotunda on 21 April, five rings of coffers rising into the dark round the oculus. One beam of sun crosses the haze, and its disc travels over the dome through the day.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/mont.webp" alt="A mezzotint of Mont-Saint-Michel at high tide across the bay: the island's village, ramparts and abbey with its spire, mirrored in still water, mist lying on the water at the ramparts' feet."></td>
    <td><img src=".github/assets/abbey.webp" alt="A mezzotint of the ruined west front of an abbey in fog, one tall pointed window open to the sky, the wall's shadow and the beam through the window standing in the mist over a grassy meadow."></td>
  </tr>
  <tr>
    <td><sub><b>mont</b>: Mont-Saint-Michel at a spring high tide, mirrored in the bay. Mist on the water swallows the ramparts' feet while the spire stands clear.</sub></td>
    <td><sub><b>abbey</b>: a Cistercian west front after Tintern on a midsummer morning. Its shadow and the beam through its empty window stand in the fog, and a pointed patch of sun walks across the meadow.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/blackhole.webp" alt="A mezzotint of a black hole: the dark shadow ringed by its accretion disk, the far side of the disk bent up over and under the shadow by gravity, one side brighter than the other."></td>
    <td><img src=".github/assets/ranges.webp" alt="A mezzotint of the Alps, range behind range with fog in the valleys between them, the snowy summits catching the last of the evening sun under a dark sky."></td>
  </tr>
  <tr>
    <td><sub><b>blackhole</b>: a Schwarzschild black hole, every cell a photon traced along its true bent path. The far side of the disk is lensed over and under the shadow, and the gas is Doppler-boosted and shears as it orbits. After Jean-Pierre Luminet's hand-dotted 1979 image, the first picture of a black hole.</sub></td>
    <td><sub><b>ranges</b>: the Alps one range behind another, grown from ridged multifractal noise, with fog in the valleys between them. As the evening sun sinks the shadows climb the faces until only the summits keep the light.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/whaleshark.webp" alt="A mezzotint of a whale shark seen from above in dark water, its pale spots standing clear on the head and shoulders while the tail fades down into the dark."></td>
    <td><img src=".github/assets/ship42.webp" alt="A mezzotint of the nose of Starship's Ship 42 close up under an overcast sky: black hexagonal heat-shield tiles, a strip of bare stainless steel down one side, the forward flap folded along the hull."></td>
  </tr>
  <tr>
    <td><sub><b>whaleshark</b>: a 10.5 m whale shark seen from above, drawn to the proportions of a reference photo. Sunlight comes down through the surface in a net of caustics that drifts over its back, and the water swallows it with depth.</sub></td>
    <td><sub><b>ship42</b>: the nose of Starship's Ship 42, every tile edge, flap and port traced off a photo and cast back onto the 3D hull. The light swings round the nose, so the tiles, the steel and the flap trade light and shade.</sub></td>
  </tr>
</table>

### Engraving

<table>
  <tr>
    <td width="50%"><img src=".github/assets/sundial.webp" alt="An engraved garden sundial on a turned stone pedestal standing on two square steps, the gnomon's shadow falling across the hour lines of the dial."></td>
    <td width="50%"><img src=".github/assets/pisa.webp" alt="An engraving of the Leaning Tower of Pisa: six arcaded galleries of columns and the belfry, leaning to the right, with a ruled sky behind it."></td>
  </tr>
  <tr>
    <td><sub><b>sundial</b>: the sun moves through the day and the gnomon's shadow, from a real shadow map, lands on hour lines drawn from tan θ = sin φ · tan H.</sub></td>
    <td><sub><b>pisa</b>: the tower at its real proportions and 3.97° lean, 30 columns per gallery with arched openings cut through the surface. Its shadow sweeps the lawn as the sun crosses Pisa's sky.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/hibiscus.webp" alt="An engraved hibiscus in two inks: five ruffled red petals around a long staminal column, and two serrated green leaves on the stem."></td>
    <td><img src=".github/assets/colosseum.webp" alt="An engraving of the Colosseum seen from the west and above: the outer ring of arches standing on the north side and stepping down at its broken ends, the open, ruined second ring to the south, and the cavea and hypogeum inside."></td>
  </tr>
  <tr>
    <td><sub><b>hibiscus</b>: an organic vignette in two inks. Petals and leaves are thin two-sided sheets, and every part casts on the others as the light swings round.</sub></td>
    <td><sub><b>colosseum</b>: the amphitheatre as it stands, 188 × 156 m with 80 bays, seen on 21 April, Rome's birthday. The outer ring survives only to the north, and the hypogeum shows where the arena floor is gone.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/madras.webp" alt="An engraving of Madras Central station: the clock tower over the arcaded west wing and the turreted central pavilion, with the long south wing running away to the right."></td>
    <td><img src=".github/assets/taj.webp" alt="An engraving of the Taj Mahal seen in perspective from the end of its long canal: the onion dome, four chhatris and four minarets on the marble plinth, and the whole tomb mirrored upside down in the water below, which fades into the paper."></td>
  </tr>
  <tr>
    <td><sub><b>madras</b>: the station built from a photograph of about 1880. The camera is fitted to landmarks measured on the photo, and the sun follows Madras's sky through a day in mid-October.</sub></td>
    <td><sub><b>taj</b>: the tomb at its real proportions, seen from the canal's end through a perspective camera. The reflection is ray-cast through the mirrored eye, and the iwans' shadows turn as the sun crosses Agra's sky.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/lighthouse.webp" alt="An engraved night plate: a lighthouse and a keeper's cottage on a crag in the sea, a low crescent moon on the right, its glitter breaking the ruled water, and stars in a ruled sky."></td>
    <td><img src=".github/assets/satellite.webp" alt="An engraved geostationary communications satellite with two long solar wings, over the curved limb of the Earth in a ruled, starry sky."></td>
  </tr>
  <tr>
    <td><sub><b>lighthouse</b>: a night plate rimmed by a low moon. The lamp turns two beams, and every line seen through a beam is thinned, so each beam cuts a bright wedge through sky, sea and rock.</sub></td>
    <td><sub><b>satellite</b>: a geostationary satellite over the Earth's limb. Its wings turn 15° an hour to face the sun while the bus, the reflectors and the Earth below pass from day into night.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/nautilus.webp" alt="An engraved chambered nautilus sawn in half along its coil, the chambers and bowed septa showing through the polished cut face, on an engine-turned sepia medallion."></td>
    <td><img src=".github/assets/ammonite.webp" alt="An engraved ammonite standing proud of a hollow chipped into a block of limestone, its ribbed whorls lit by a low raking light, the block's long shadow falling across the ground."></td>
  </tr>
  <tr>
    <td><sub><b>nautilus</b>: a logarithmic spiral that triples its radius every whorl, sawn through so you look into every chamber. A lamp sweeps the face, the shadows wheel inside the chambers and a glint travels over the nacre.</sub></td>
    <td><sub><b>ammonite</b>: an evolute spiral fossil in a block of limestone, in sepia. A low light circles the face, so the ribs throw their shadows each way in turn and the block's shadow swings over the ground.</sub></td>
  </tr>
  <tr>
    <td><img src=".github/assets/kukulcan.webp" alt="An engraving of El Castillo at Chichén Itzá seen from the north-west: nine stepped terraces, the north stair with serpent heads at its foot, and the temple on the platform, in late-afternoon equinox light."></td>
    <td><img src=".github/assets/chandbaori.webp" alt="An engraving looking down into the Chand Baori stepwell: zigzag flights of steps on the side walls falling to green water, a pavilion of arched galleries and domed balconies at the back, and the rim's shadow across the terraces."></td>
  </tr>
  <tr>
    <td><sub><b>kukulcan</b>: El Castillo on the spring equinox, turned 17° off the compass as it stands. Late in the afternoon the terrace corners cast a sawtooth of light down the north stair's balustrade, the serpent coming down to its carved head, straight from the shadow map.</sub></td>
    <td><sub><b>chandbaori</b>: the Abhaneri stepwell from its rim, 13 storeys of zigzag steps built down to every tread, falling 20 m to the water. The rim's shadow and each step's own shadow sweep the terraces through a day at 27° N.</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src=".github/assets/pontdugard.webp" alt="An engraving of the Pont du Gard seen from downstream: three tiers of Roman arches receding over the Gardon, wooded banks on either side, and the arches mirrored in the still river below."></td>
  </tr>
  <tr>
    <td colspan="2"><sub><b>pontdugard</b>: the aqueduct at its real dimensions, 6, 11 and 35 arches in three tiers, 49 m over the Gardon. The sun crosses a summer sky at 43.9° N, each arch's shadow turns and the arches are mirrored in the river.</sub></td>
  </tr>
</table>

Every screenshot is the light plate of a page in [`examples/`](examples), captured with the skill's own [`scripts/capture.mjs`](scripts/capture.mjs). Build any example (below) and open its `.html` to see it move.

## What it makes

| Size | What it is | Example |
|---|---|---|
| **Vignette** | One object on a plinth or a patch of ground, 5–15 surfaces, one sun. | `sundial`, `hibiscus`, `ammonite` |
| **Scene** | Several objects, architecture, a landscape or a mechanism that moves. | `pisa`, `colosseum`, `taj` |
| **Plate** | A full bank-note composition: portrait, lettering, guilloche frame, several inks. The skill builds the vignette at its heart first, then lists what the full plate adds. | none yet |

Each figure ships in a light plate (dark ink on cream paper) and a dark one, a true white-line negative that inks the light instead of inverting the colours. Pages are standalone HTML with the first frame rendered at build time, so they paint at once. The scene module also drops into React.

## Install

Draw beautiful is a standard [Agent Skill](https://code.claude.com/docs/en/skills): a folder with a `SKILL.md` at its root. This repository is that folder.

| Method | Command | Installs to |
|---|---|---|
| **skills CLI** | `npx skills add bumicodes/draw-beautiful -g -a claude-code` | `~/.claude/skills/draw-beautiful` |
| **git**, for you | `git clone https://github.com/bumicodes/draw-beautiful.git ~/.claude/skills/draw-beautiful` | `~/.claude/skills/draw-beautiful` |
| **git**, for one project | `git clone https://github.com/bumicodes/draw-beautiful.git .claude/skills/draw-beautiful` | `.claude/skills/draw-beautiful` |

## Examples

Each example is a `scene.mjs` (the model and the surfaces) and a `build.mjs` that writes standalone pages next to itself. Add `--dark` for the dark plate.

| Example | What it shows | Build |
|---|---|---|
| [`sundial`](examples/sundial) | A garden sundial on a turned stone pedestal. The smallest example: read its `scene.mjs` first, it uses every part of the kit. | `node examples/sundial/build.mjs` |
| [`pisa`](examples/pisa) | The Leaning Tower with six arcaded galleries and its shadow on the lawn. The reference for architecture and masked openings. | `node examples/pisa/build.mjs` |
| [`hibiscus`](examples/hibiscus) | A flower in two inks, built from ruffled sheet surfaces. The reference for organic forms. | `node examples/hibiscus/build.mjs` |
| [`taj`](examples/taj) | The Taj Mahal from the end of its canal, its reflection ray-cast in the water. The reference for the perspective camera and recessed arched openings. | `node examples/taj/build.mjs` |
| [`madras`](examples/madras) | Madras Central station built from a photograph of about 1880 (`reference.png`): camera and masses fitted to landmarks on the photo, checked against it with `--overlay`, its clocks keeping the hour as the sun crosses. The reference for drawing from an image. | `node examples/madras/build.mjs` |
| [`colosseum`](examples/colosseum) | The Colosseum as it stands, its broken rings and open hypogeum, under Rome's sky on 21 April. The reference for ruins and for building in metres from real dimensions. | `node examples/colosseum/build.mjs` |
| [`lighthouse`](examples/lighthouse) | A lighthouse on a rock at night, its two beams thinning every line they pass in front of. The reference for night plates and light in the air. | `node examples/lighthouse/build.mjs` |
| [`nautilus`](examples/nautilus) | A chambered nautilus sawn in half on a bank-note medallion, a lamp sweeping its cut face. The reference for cavities and a second ink for the ground. | `node examples/nautilus/build.mjs` |
| [`ammonite`](examples/ammonite) | An ammonite in a limestone block under a low light circling round it. The reference for relief on a face and raking light. | `node examples/ammonite/build.mjs` |
| [`temple`](examples/temple) | A Doric temple in ground fog on a stony plain, printed as a mezzotint: grain instead of lines, height fog, the sun crossing Athens' sky. The reference for the mezzotint mode. | `node examples/temple/build.mjs` |
| [`bridge`](examples/bridge) | The Golden Gate Bridge at its real size seen from the Marin headlands, its deck running into a billowed sea of summer fog while the towers stand clear; a mezzotint whose light swings from morning silhouette to evening glow. | `node examples/bridge/build.mjs` |
| [`torii`](examples/torii) | A torii standing in a still bay at dawn, mezzotint: the water a true mirror (a second, reflected G-buffer), the reflection fading through the mist twice, a glitter path, bloom. | `node examples/torii/build.mjs` |
| [`moai`](examples/moai) | The fifteen moai of Ahu Tongariki at the solstice sunrise, mezzotint: the sun breaking between the statues, crepuscular rays and long shadows across the grass. | `node examples/moai/build.mjs` |
| [`nave`](examples/nave) | The nave of a High Gothic cathedral at Chartres' latitude in late October, mezzotint: sunbeams marched through drifting haze, shaped by every window's tracery, wall depth and stained-glass panes, crossing the nave and sliding over the floor and up the piers as the sun moves. | `node examples/nave/build.mjs` |
| [`abbey`](examples/abbey) | The ruined west front of a Cistercian abbey after Tintern, mezzotint: the wall in shade against a midsummer morning, its shadow and the beam through its empty window standing in the fog while a pointed patch of sun walks across the meadow. | `node examples/abbey/build.mjs` |
| [`pantheon`](examples/pantheon) | The rotunda of the Pantheon seen from the floor on 21 April, mezzotint: five rings of coffers rising into the dark round the oculus, one beam of sun through the haze, its disc crossing the dome through the day. | `node examples/pantheon/build.mjs` |
| [`mont`](examples/mont) | Mont-Saint-Michel at a spring high tide seen across the bay, mezzotint: village, ramparts and abbey mirrored in still water, mist on the water swallowing the ramparts' feet while the spire stands clear. | `node examples/mont/build.mjs` |
| [`blackhole`](examples/blackhole) | A Schwarzschild black hole and its accretion disk, mezzotint: every cell a photon traced along its true bent path, the far side of the disk lensed over and under the shadow, the gas Doppler-boosted and shearing as it orbits, after Jean-Pierre Luminet's 1979 image. | `node examples/blackhole/build.mjs` |
| [`ranges`](examples/ranges) | Range behind range of the Alps from a ridged-multifractal heightfield, mezzotint: snowfields above the snowline, fog in the valleys, the evening sun sinking until only the summits keep the light. The reference for landscape from noise. | `node examples/ranges/build.mjs` |
| [`whaleshark`](examples/whaleshark) | A whale shark seen from above in dark water, fitted to a reference photo (kept local, not in the repo), mezzotint: caustics drifting over its back, the water swallowing it with depth. `--bare` drops the frame. | `node examples/whaleshark/build.mjs` |
| [`ship42`](examples/ship42) | The nose of Starship's Ship 42 close up, fitted to a reference photo (kept local, not in the repo), mezzotint: heat-shield tiles, bare steel and the folded flap cast onto the 3D hull, the light swinging round it. | `node examples/ship42/build.mjs` |
| [`satellite`](examples/satellite) | A geostationary satellite whose wings track the sun through a day over the Earth's limb. The reference for moving parts on a lit body and night-side shading. | `node examples/satellite/build.mjs` |
| [`kukulcan`](examples/kukulcan) | El Castillo at Chichén Itzá on the spring equinox: nine terraces, four stairs of 91 steps, turned 17° off the compass. Late in the afternoon the terrace corners cast a sawtooth on the north stair's balustrade, and the triangles of light form the serpent coming down to its carved head. The reference for an effect that comes from the shadow map alone. | `node examples/kukulcan/build.mjs` |
| [`chandbaori`](examples/chandbaori) | The Chand Baori stepwell at Abhaneri seen from its rim: 13 storeys of zigzag steps, built procedurally down to every tread, falling 20 m to green water below a pavilion of galleries and balconies. The rim's shadow and each step's own shadow sweep the terraces through a day at 27° N. The reference for repetitive geometry and exact small shadows. | `node examples/chandbaori/build.mjs` |
| [`pontdugard`](examples/pontdugard) | The Pont du Gard at its real dimensions, three tiers of 6, 11 and 35 arches receding over the Gardon, mirrored in the river as the sun crosses a summer day at 43.9° N. The reference for a long receding structure, terrain and reflections in water. | `node examples/pontdugard/build.mjs` |

## How it works

**Light the object, then engrave the light.** Each part is a kit surface (`lathe` for anything turned, `sphere`, `box`, `prism`, `patch`, `sheet` for petals and cloth). A depth buffer hides farther lines exactly, a shadow map casts true shadows, and `hatch` lays line systems along each surface's own parameter so they curve with the form. `ink` turns tone into ribbons whose width swells in the dark, is capped so darks never close up, and tapers to a point where the light wins. When the sun moves, only `ink` and the shadow map run again.

```
draw-beautiful/
├── SKILL.md            the instructions Claude follows
├── kit/
│   ├── intaglio.mjs    the engine: camera, surfaces, occlusion, shadows, hatching, ink, guilloche
│   ├── mezzotint.mjs   grain instead of lines: G-buffer, height fog, film grain
│   └── plate.mjs       the artboard: guilloche frame, title tablet, paper and plate mark, themes
├── references/         craft.md (the engraver's vocabulary), kit.md (API), verify.md (checks)
├── scripts/            capture.mjs, drive.mjs, pdf.mjs (headless Chrome), inline.mjs (standalone pages)
└── examples/           thirty-two complete plates
```

## Requirements

| Needs | For | Notes |
|---|---|---|
| **[Claude Code](https://code.claude.com/docs/en/overview)** | everything | The skill is written for it. |
| **Node.js 20.10+** | builds, kit, scripts | Built-in modules only. |
| **Chrome** | `scripts/capture.mjs`, `scripts/drive.mjs`, `scripts/pdf.mjs` | Only for screenshots, verification and printing to PDF. |

## License

[MIT](LICENSE)
