// The artboard as an engraved plate: the picture inside a guilloche border with corner rosettes and a lettered
// title tablet, inked like the picture, printed on a sheet of cream paper inside a plate mark. Nothing else.

import { band, rosette } from "./intaglio.mjs";

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const PAPER = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".04 .7" numOctaves="3" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .4  0 0 0 0 .3  0 0 0 .5 0"/></filter><rect width="100%" height="100%" filter="url(#f)"/></svg>`,
)}")`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&display=swap">`;

export const INTAGLIO_CSS = `
.intaglio{
  --intaglio-page:#d9d2c3;--intaglio-paper:#f4eddc;--intaglio-plate:#efe7d3;--intaglio-mark:#cfc4ab;--intaglio-mark-hi:#fffaee;
  --intaglio-ink:#1c2a27;--intaglio-ink-2:#7d2a1f;
  --intaglio-grain:.22;--intaglio-serif:"Cormorant Garamond","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
}
.intaglio[data-theme="dark"]{
  --intaglio-page:#0b0a08;--intaglio-paper:#17150f;--intaglio-plate:#1b1913;--intaglio-mark:#2b271e;--intaglio-mark-hi:#000;
  --intaglio-ink:#e4d8b8;--intaglio-ink-2:#d98b6b;--intaglio-grain:.08;
}
.intaglio-figure{margin:0}
.intaglio-sheet{position:relative;isolation:isolate;padding:40px;border-radius:2px;background:var(--intaglio-paper);box-shadow:0 1px 1px #00000014,0 10px 30px -14px #0000004d,0 30px 60px -30px #00000040}
.intaglio-sheet::before{content:"";position:absolute;inset:0;z-index:-1;background:${PAPER};opacity:var(--intaglio-grain);mix-blend-mode:multiply;pointer-events:none}
.intaglio[data-theme="dark"] .intaglio-sheet::before{mix-blend-mode:screen}
.intaglio-mark{padding:16px;border-radius:3px;background:var(--intaglio-plate);box-shadow:0 0 0 1px var(--intaglio-mark),0 1px 0 1px var(--intaglio-mark-hi),inset 0 1px 3px #0000000f}
.intaglio-svg{display:block;width:100%;height:auto;touch-action:pan-y}
.intaglio-svg:focus-visible{outline:1px solid var(--intaglio-ink);outline-offset:6px}
.intaglio-ink{fill:var(--intaglio-ink)}
.intaglio-ink-2{fill:var(--intaglio-ink-2)}
.intaglio-hair{fill:none;stroke:var(--intaglio-ink);stroke-width:.32;stroke-linejoin:round}
.intaglio-rule{fill:none;stroke:var(--intaglio-ink)}
.intaglio-ground{fill:var(--intaglio-plate)}
.intaglio-letter{fill:var(--intaglio-ink);font-family:var(--intaglio-serif);font-weight:600;text-anchor:middle;dominant-baseline:central;letter-spacing:.32em}
@media (max-width:520px){.intaglio-sheet{padding:14px}.intaglio-mark{padding:6px}}
`;

const num = (v) => String(Math.round(v * 100) / 100);

/** A small tablet on the frame: paper ground, a double rule, and its lettering. */
const tablet = (cx, cy, text, size) => {
  const w = text.length * size * 0.92 + size * 3;
  const h = size * 2.3;
  const box = (o) => `x="${num(cx - w / 2 - o)}" y="${num(cy - h / 2 - o)}" width="${num(w + 2 * o)}" height="${num(h + 2 * o)}" rx="${num(h / 2 + o)}"`;
  return `<rect class="intaglio-ground" ${box(3)}/><rect class="intaglio-rule" stroke-width=".8" ${box(0)}/><rect class="intaglio-rule" stroke-width=".35" ${box(-2)}/><text class="intaglio-letter" x="${num(cx + size * 0.16)}" y="${num(cy)}" font-size="${size}">${escape(text.toUpperCase())}</text>`;
};

/**
 * The frame round the picture: a heavy and a fine rule, a guilloche band between them, rosettes in the corners
 * and the title in a tablet at the bottom. All in the plate's ink.
 */
const frameSvg = (W, H, { title }) => {
  const r = 8;
  const corners = [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]];
  return [
    `<rect class="intaglio-rule" x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${r + 2}" stroke-width="1.4"/>`,
    `<rect class="intaglio-rule" x="5" y="5" width="${W - 10}" height="${H - 10}" rx="${r}" stroke-width=".4"/>`,
    `<path class="intaglio-hair" d="${band({ x: 5, y: 5, w: W - 10, h: H - 10, r, inset: 11, thick: 10, waves: Math.round((2 * (W + H)) / 7.5), count: 5 })}"/>`,
    `<rect class="intaglio-rule" x="22" y="22" width="${W - 44}" height="${H - 44}" rx="3" stroke-width=".4"/>`,
    `<rect class="intaglio-rule" x="25" y="25" width="${W - 50}" height="${H - 50}" rx="2" stroke-width=".9"/>`,
    ...corners.map(([x, y]) => `<circle class="intaglio-ground" cx="${x}" cy="${y}" r="11.5"/><circle class="intaglio-rule" cx="${x}" cy="${y}" r="11" stroke-width=".7"/><path class="intaglio-hair" d="${rosette({ cx: x, cy: y, radius: 6.2, amp: 2.8, lobes: 6, count: 6, samples: 240 })}"/>`),
    title ? tablet(W / 2, H - 16, title, 11) : "",
  ].join("");
};

/**
 * The engraving. `body` is the ink: paths with class intaglio-ink or intaglio-ink-2 (filled ribbons) or intaglio-hair.
 * With `frame: { title }` the picture is set inside an engraved border and the viewBox grows to hold it.
 */
export const engravingSvg = ({ width, height, label, body, frame, standalone }) => {
  const m = frame ? 34 : 0;
  const W = width + 2 * m;
  const H = height + 2 * m;
  const style = standalone ? `<style>${INTAGLIO_CSS}</style><rect width="100%" height="100%" fill="var(--intaglio-plate)"/>` : "";
  // Keyed by size, so several plates on one printed sheet never clip each other's art with the wrong rectangle.
  const clip = `intaglio-art-${num(width)}x${num(height)}`;
  const art = frame ? `<clipPath id="${clip}"><rect width="${width}" height="${height}"/></clipPath><g transform="translate(${m} ${m})" clip-path="url(#${clip})">${body}</g>${frameSvg(W, H, frame)}` : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="intaglio-svg${standalone ? " intaglio" : ""}"${standalone ? ` data-theme="${standalone}"` : ""} viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(label)}"${standalone ? "" : ' tabindex="0"'}>${style}${art}</svg>`;
};

/** The sheet: the plate printed inside its plate mark. */
export const plateHtml = ({ body }) =>
  `<figure class="intaglio-figure"><div class="intaglio-sheet"><div class="intaglio-mark">${body}</div></div></figure>`;

export const pageHtml = ({ title, theme = "light", body, script = "", width = 760 }) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>${FONTS}<style>${INTAGLIO_CSS}
*{box-sizing:border-box}html{color-scheme:${theme}}body{margin:0;background:var(--intaglio-page);-webkit-font-smoothing:antialiased}
.intaglio-page{width:min(${width}px,100% - 32px);margin:56px auto 88px}</style></head><body class="intaglio" data-theme="${theme}"><main class="intaglio-page">${body}</main>${script ? `<script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}</script>` : ""}</body></html>`;

const PAPER_SIZES = { A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4] };

/**
 * A printable sheet: one or more framed plates (`engravingSvg` output) laid out on A4, A3 or Letter, for
 * `scripts/pdf.mjs`. Portrait stacks the plates, landscape sets them side by side; each one gets an equal share of
 * the sheet inside `margin` mm and keeps its own proportions. Print is ink on white: no paper grain, no shadows and
 * no blend modes (Chrome's PDF output rasterises a blend into a hard-edged patch), only a hairline plate mark.
 * A still frame per state is how a print explains what the live plate shows by moving: the circuit open and closed,
 * the sundial at 9 and at 15. Every id inside a plate's body (masks, gradients) must be unique on the sheet.
 */
export const printHtml = ({ title, plates, paper = "A4", landscape = false, theme = "light", margin = 16, gap = 9 }) => {
  const [short, long] = PAPER_SIZES[paper] ?? PAPER_SIZES.A4;
  const [w, h] = landscape ? [long, short] : [short, long];
  const n = plates.length;
  const pad = 4;
  const across = landscape ? (w - 2 * margin - gap * (n - 1)) / n : w - 2 * margin;
  const down = landscape ? h - 2 * margin : (h - 2 * margin - gap * (n - 1)) / n;
  const css = `
@page{size:${num(w)}mm ${num(h)}mm;margin:0}
*{box-sizing:border-box}html,body{margin:0;background:#fff}
.intaglio-print{width:${num(w)}mm;height:${num(h)}mm;overflow:hidden;padding:${margin}mm;display:flex;flex-direction:${landscape ? "row" : "column"};align-items:center;justify-content:center;gap:${gap}mm;background:var(--intaglio-paper)}
.intaglio[data-theme="light"] .intaglio-print{background:#fff}
.intaglio-print .intaglio-mark{flex:none;padding:${pad}mm;background:none;box-shadow:0 0 0 .25mm var(--intaglio-mark)}
.intaglio[data-theme="light"] .intaglio-print .intaglio-ground{fill:#fff}
@media screen{body{background:#888}.intaglio-print{margin:24px auto;box-shadow:0 10px 40px #0005}}`;
  // An SVG has no size of its own, so each plate is given its width in mm: as wide as its share allows, or as wide as
  // its viewBox's proportions let it be within the share's height.
  const sized = plates.map((svg) => {
    const [, , vw, vh] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 4 3").split(/\s+/).map(Number);
    const width = Math.min(across - 2 * pad, ((down - 2 * pad) * vw) / vh);
    return `<div class="intaglio-mark" style="width:${num(width + 2 * pad)}mm">${svg}</div>`;
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>${FONTS}<style>${INTAGLIO_CSS}${css}</style></head><body class="intaglio" data-theme="${theme}"><main class="intaglio-print">${sized.join("")}</main></body></html>`;
};
