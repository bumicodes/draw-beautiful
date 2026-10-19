import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as I from "../../kit/intaglio.mjs";
import { engravingSvg, pageHtml, plateHtml } from "../../kit/plate.mjs";
import { kitPath, liveScript } from "../../scripts/live.mjs";
import { HEIGHT, WIDTH, inkAt, scene } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const negative = theme === "dark";
const AT = process.argv.indexOf("--at");
const START = AT > 0 ? Number(process.argv[AT + 1]) : 0.3;

// A bank-note pair: the shell in a deep blue-black, the medallion and underprint in a faded sepia.
const INKS = `<style>
.intaglio{--intaglio-ink:#17263a;--intaglio-ink-2:#9a6a4a;--intaglio-paper:#f1ead8;--intaglio-plate:#ede4cf}
.intaglio[data-theme="dark"]{--intaglio-ink:#e6dcc2;--intaglio-ink-2:#b98a68}
</style>`;

const t0 = performance.now();
const S = scene();
const t1 = performance.now();
const lit = inkAt(S, START, { size: 1280, negative });
const t2 = performance.now();

// The medallion: an engine-turned oval behind the shell, a rope band round it, the field inside rayed like a
// bank-note portrait ground; outside it a waved underprint fills the plate. All kept clear of the shell by its aura.
const [mx, my] = S.pole;
const ax = S.reach * 0.74;
const ay = ax;
const oval = (x, y) => Math.hypot((x - mx) / ax, (y - my) / ay);
const clear = (x, y, d) => S.occ.clear(x, y) > d;
const ring = (k, n, amp, lobes, phase = 0) => (t) => {
  const th = t * I.TAU;
  const f = k + amp * Math.sin(lobes * th + phase);
  return [mx + ax * f * Math.cos(th), my + ay * f * Math.sin(th)];
};
const curves = (n, make) => Array.from({ length: n }, (_, i) => make(i));
const rope = I.trace(curves(10, (i) => ring(1.075, 10, 0.032, 72, (i / 10) * I.TAU)), { on: (x, y) => clear(x, y, 5), spacing: 1.6, step: 1.2 });
const lace = I.trace(curves(8, (i) => ring(1.0, 8, 0.022, 30, (i / 8) * I.TAU + 0.3 * Math.sin(i))), { on: (x, y) => clear(x, y, 5), spacing: 1.4, step: 1.2 });
const rules = I.trace([ring(1.13, 1, 0, 0), ring(1.142, 1, 0, 0), ring(1.02, 1, 0, 0), ring(0.965, 1, 0, 0)], { on: (x, y) => clear(x, y, 5), step: 1.2, spacing: 3 });
const rays = I.trace(
  curves(540, (i) => (t) => {
    const th = (i / 540) * I.TAU;
    const f = 0.25 + 0.7 * t;
    return [mx + ax * f * Math.cos(th), my + ay * f * Math.sin(th)];
  }),
  { on: (x, y) => clear(x, y, 6), spacing: 1.6, step: 1.4 },
);
const under = I.trace(
  curves(Math.ceil(HEIGHT / 2.3), (j) => (t) => {
    const x = -4 + (WIDTH + 8) * t;
    const y = 1.2 + j * 2.3;
    return [x, y + 1.5 * Math.sin(x / 11 + j * 0.37) * Math.sin(x / 97 + y / 61)];
  }),
  { on: (x, y) => oval(x, y) > 1.18 && clear(x, y, 8), spacing: 2.3, step: 1.6 },
);
const flat = (v) => () => v;
const swell = (s) => 0.55 + 0.4 * Math.sin((s.x - mx) / 23) * Math.sin((s.y - my) / 19);
const rayTone = (s) => 0.35 + 0.45 * I.smoothstep(0.25, 0.95, oval(s.x, s.y));
const underTone = (s) => {
  const d = oval(s.x, s.y);
  return (0.25 + 0.4 * I.smoothstep(1.2, 1.9, d)) * (0.75 + 0.25 * Math.sin(s.x / 31 + s.y / 17));
};
const n = (tone) => (negative ? (s) => tone(s) : tone);
const ground = [
  `<path class="intaglio-ink-2" d="${I.ink(under, n(underTone), { from: 0.05, to: 0.9, width: 0.8 })}"/>`,
  `<path class="intaglio-ink-2" d="${I.ink(rays, n(rayTone), { from: 0.05, to: 0.9, width: 0.55 })}"/>`,
  `<path class="intaglio-ink-2" d="${I.ink(rope, n(swell), { from: 0, to: 1, width: 0.7 })}"/>`,
  `<path class="intaglio-ink-2" d="${I.ink(lace, n(flat(0.7)), { from: 0, to: 1, width: 0.5 })}"/>`,
  `<path class="intaglio-ink" d="${I.ink(rules, flat(1), { from: 0, to: 1, width: 0.55 })}"/>`,
].join("");

const body = [
  ground,
  ...S.layers.map((l) => `<path class="intaglio-ink" data-layer="${l.id}" d="${lit[l.id]}"/>`),
  `<path class="intaglio-ink" d="${S.marks}"/>`,
].join("");

const live = liveScript({
  kit: kitPath(HERE),
  scene: join(HERE, "scene.mjs"),
  start: START,
  min: 0,
  max: 1,
  idle: "0.5 - 0.5 * Math.cos(t / 3.2)",
  sceneArgs: "{ ss: 2, coarse: 1.6 }",
  ink: `{ size: 512, negative: ${negative} }`,
});

const html = pageHtml({
  title: "The Chambered Nautilus",
  theme,
  width: 900,
  body:
    INKS +
    plateHtml({
      body: engravingSvg({
        width: WIDTH,
        height: HEIGHT,
        frame: { title: "Nautilus pompilius" },
        label: "An engraved nautilus shell sawn in half, its spiral of pearly chambers lit by a lamp sweeping across the cut, on a guilloche medallion",
        body,
      }),
    }),
  script: live,
});
const name = AT > 0 ? `nautilus-at-${START}.html` : negative ? "nautilus-dark.html" : "nautilus.html";
writeFileSync(join(HERE, name), html);
console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB, scene ${(t1 - t0).toFixed(0)} ms, ink ${(t2 - t1).toFixed(0)} ms`);
