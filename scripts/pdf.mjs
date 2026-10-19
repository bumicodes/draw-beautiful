import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function usage() {
  console.log(`Print a page to a vector PDF with headless Chrome, and check it.

  node pdf.mjs <file.html> [options]

  --out <pdf>         output path (default: the page's name with .pdf)
  --wait <ms>         virtual time to let fonts load before printing (default 5000)
  --pages <n>         the number of pages expected (default 1); more or fewer fails

Use it on a sheet from printHtml (kit/plate.mjs): its @page rule sets the paper size and orientation.
Prints the page count and each page's size in mm, and exits 1 if the count is not the one expected.`);
}

function parse(argv) {
  const options = { wait: 5000, pages: 1 };
  const rest = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === "--out") options.out = next();
    else if (arg === "--wait") options.wait = Number(next());
    else if (arg === "--pages") options.pages = Number(next());
    else if (arg === "--help" || arg === "-h") options.help = true;
    else rest.push(arg);
  }
  options.target = rest[0];
  return options;
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const playwright = join(homedir(), "Library/Caches/ms-playwright");
  if (existsSync(playwright)) {
    for (const dir of readdirSync(playwright).sort().reverse()) {
      for (const sub of ["chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
        candidates.push(join(playwright, dir, sub));
      }
    }
  }
  return candidates.find((path) => existsSync(path));
}

/** Page sizes in mm, read from each page's MediaBox (Chrome writes page objects uncompressed). */
function pagesOf(pdf) {
  const text = pdf.toString("latin1");
  const boxes = [...text.matchAll(/\/Type\s*\/Page(?!s)[\s\S]*?\/MediaBox\s*\[\s*([\d.\s-]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  return boxes.map(([x0, y0, x1, y1]) => [((x1 - x0) * 25.4) / 72, ((y1 - y0) * 25.4) / 72]);
}

const options = parse(process.argv.slice(2));
if (options.help || !options.target) {
  usage();
  process.exit(options.help ? 0 : 1);
}
const page = resolve(options.target);
const out = resolve(options.out ?? page.replace(/\.html?$/i, "") + ".pdf");
const binary = chromePath();
if (!binary) {
  console.error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.");
  process.exit(1);
}
const profile = mkdtempSync(join(tmpdir(), "intaglio-pdf-"));
const run = spawnSync(
  binary,
  ["--headless=new", "--disable-gpu", `--user-data-dir=${profile}`, "--no-first-run", "--no-pdf-header-footer", `--virtual-time-budget=${options.wait}`, `--print-to-pdf=${out}`, pathToFileURL(page).href],
  { encoding: "utf8", timeout: 120000 },
);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
if (!existsSync(out)) {
  console.error(`Chrome wrote no PDF.\n${run.stderr ?? ""}`);
  process.exit(1);
}
const pages = pagesOf(readFileSync(out));
const sizes = pages.map(([w, h]) => `${w.toFixed(0)} × ${h.toFixed(0)} mm`);
console.log(`saved ${out}`);
console.log(`${pages.length} page${pages.length === 1 ? "" : "s"} · ${[...new Set(sizes)].join(", ")}`);
if (pages.length !== options.pages) {
  console.error(`expected ${options.pages} page${options.pages === 1 ? "" : "s"}: something on the sheet overflows its @page size (margins, a page wrapper, an oversized plate)`);
  process.exit(1);
}
