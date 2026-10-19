import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

/**
 * A reference photograph under a labelled pixel grid, as an SVG to capture and read when measuring landmarks.
 *
 *   node measure.mjs photo.png --out grid.svg [--step 10] [--crop x,y,w,h] [--scale 4]
 *   node capture.mjs grid.svg --out grid.png --select svg
 *
 * Every 5th line is darker and every line is numbered in photo px, so a point read off the capture is already in the
 * photo's own coordinates. Crop to the part being measured and scale it up to read single pixels.
 */
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const src = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
if (!src) {
  console.log("node measure.mjs photo.png --out grid.svg [--step 10] [--crop x,y,w,h] [--scale 4]");
  process.exit(1);
}
const data = readFileSync(src);
const type = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp" }[extname(src).toLowerCase()] ?? "png";

// The image's size from its header (PNG and JPEG), so the grid covers it exactly.
const size = () => {
  if (data.readUInt32BE(0) === 0x89504e47) return [data.readUInt32BE(16), data.readUInt32BE(20)];
  for (let i = 2; i < data.length; ) {
    const marker = data[i + 1];
    const len = data.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  throw new Error("pass --size w,h for this image type");
};
const [W, H] = opt("size") ? opt("size").split(",").map(Number) : size();
const [cx, cy, cw, ch] = opt("crop") ? opt("crop").split(",").map(Number) : [0, 0, W, H];
const step = Number(opt("step", 10));
// Fit the capture viewport (1440 × 1000 by default) so the browser draws it at full size.
const k = Number(opt("scale", Math.max(1, Math.min(1400 / cw, 960 / ch))));

const lines = [];
for (let x = Math.ceil(cx / step) * step; x <= cx + cw; x += step) {
  const major = x % (step * 5) === 0;
  lines.push(`<line x1="${x}" y1="${cy}" x2="${x}" y2="${cy + ch}" stroke="${major ? "#e00" : "#f99"}" stroke-width="${major ? 1 / k + 0.15 : 1 / k}"/>`);
  lines.push(`<text x="${x + 1.5 / k}" y="${cy + 9 / k}" font-size="${9 / k}" fill="#e00">${x}</text>`);
}
for (let y = Math.ceil(cy / step) * step; y <= cy + ch; y += step) {
  const major = y % (step * 5) === 0;
  lines.push(`<line x1="${cx}" y1="${y}" x2="${cx + cw}" y2="${y}" stroke="${major ? "#00e" : "#99f"}" stroke-width="${major ? 1 / k + 0.15 : 1 / k}"/>`);
  lines.push(`<text x="${cx + 1.5 / k}" y="${y - 1.5 / k}" font-size="${9 / k}" fill="#00e">${y}</text>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw * k}" height="${ch * k}" viewBox="${cx} ${cy} ${cw} ${ch}" font-family="monospace">
<image href="data:image/${type};base64,${data.toString("base64")}" x="0" y="0" width="${W}" height="${H}"/>
${lines.join("\n")}
</svg>`;
const out = opt("out", "grid.svg");
writeFileSync(out, svg);
console.log(`${out}: ${W}x${H} photo, crop ${cx},${cy} ${cw}x${ch} at ${+k.toFixed(2)}x, grid every ${step} px`);
