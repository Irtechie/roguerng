// Downloads free CC-BY game-icons SVGs and rasterizes them to white PNG
// silhouettes (tinted at runtime). Also paints procedural tile textures.
// Reruns are incremental. See assets/ATTRIBUTION.md for license terms.

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SVG_DIR = path.join(ROOT, "assets", "svg");
const IMG_DIR = path.join(ROOT, "assets", "img");
const TEX_DIR = path.join(ROOT, "assets", "tex");
for (const d of [SVG_DIR, IMG_DIR, TEX_DIR]) fs.mkdirSync(d, { recursive: true });

export const ICONS = [
  "delapouite/rat", "delapouite/bat", "lorc/wolf-head", "caro-asercion/goblin",
  "skoll/skeleton", "carl-olsen/spider-face", "delapouite/ogre", "lorc/harpy",
  "lorc/ghost", "delapouite/elysium-shade", "skoll/troll", "delapouite/ice-golem",
  "lorc/minotaur", "lorc/raven", "lorc/imp", "sbed/lava", "delapouite/golem-head",
  "delapouite/butterfly-knife", "delapouite/cleaver", "delapouite/ancient-sword",
  "delapouite/flanged-mace", "delapouite/sword-brandish", "lorc/battle-axe",
  "delapouite/warhammer", "delapouite/swords-power", "delapouite/wizard-face",
  "delapouite/fur-shirt", "lorc/robe", "delapouite/leather-armor", "lorc/scale-mail",
  "delapouite/chest-armor", "delapouite/diamond-ring", "delapouite/double-necklace",
  "delapouite/feather-necklace", "delapouite/jewel-crown", "delapouite/health-potion",
  "delapouite/spell-book", "delapouite/herbs-bundle", "delapouite/glowing-artifact",
  "delapouite/coal-pile", "delapouite/beer-horn", "delapouite/dwarf-face",
  "delapouite/archer", "delapouite/miner", "lorc/portal", "delapouite/exit-door",
  "delapouite/3d-stairs", "delapouite/fencer", "delapouite/prayer-beads",
  "delapouite/character", "delapouite/elf-ear", "delapouite/dungeon-gate",
  "lorc/campfire", "delapouite/torch"
];

function get(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(get(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(url + " -> " + res.statusCode)); }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

const downloaded = [];
for (const icon of ICONS) {
  const svgPath = path.join(SVG_DIR, icon.replace("/", "__") + ".svg");
  if (!fs.existsSync(svgPath)) {
    const url = "https://raw.githubusercontent.com/game-icons/icons/master/" + icon + ".svg";
    fs.writeFileSync(svgPath, await get(url));
    downloaded.push(icon);
  }
}
console.log("svg files:", ICONS.length, "(newly downloaded", downloaded.length + ")");

// Rasterize all SVGs to white 128px PNGs in one browser pass.
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
let made = 0;
for (const icon of ICONS) {
  const svgPath = path.join(SVG_DIR, icon.replace("/", "__") + ".svg");
  const pngPath = path.join(IMG_DIR, icon.replace("/", "__") + ".png");
  if (fs.existsSync(pngPath)) continue;
  let svg = fs.readFileSync(svgPath, "utf8");
  svg = svg.replace(/currentColor/g, "#ffffff").replace(/#000000/gi, "#ffffff");
  await page.setContent(`<body style="margin:0"><img id="i" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body>`);
  await page.waitForFunction(() => document.getElementById("i").complete);
  const dataUrl = await page.evaluate(() => {
    const img = document.getElementById("i");
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 128, 128);
    return c.toDataURL("image/png");
  });
  fs.writeFileSync(pngPath, Buffer.from(dataUrl.split(",")[1], "base64"));
  made++;
}
await browser.close();
console.log("pngs rendered:", made);

// Procedural tile textures (floors/walls per map theme).
function noisePng(file, seed, base, spec) {
  const S = 64;
  const png = new PNG({ width: S, height: S });
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const idx = (y * S + x) * 4;
    let r = base[0], g = base[1], b = base[2];
    const n = (rnd() - 0.5) * spec.grain;
    r += n; g += n; b += n;
    if (spec.cracks && rnd() < spec.cracks) { r *= 0.6; g *= 0.6; b *= 0.6; }
    if (spec.moss && rnd() < spec.moss) { g += 30; r -= 10; }
    if (spec.edge && ((x % 16 < 1) || (y % 16 < 1))) { r *= 0.7; g *= 0.7; b *= 0.7; }
    png.data[idx] = Math.max(0, Math.min(255, r));
    png.data[idx + 1] = Math.max(0, Math.min(255, g));
    png.data[idx + 2] = Math.max(0, Math.min(255, b));
    png.data[idx + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

const themes = {
  town:      { floor: [52, 58, 46], wall: [74, 66, 54] },
  greenhills:{ floor: [40, 56, 40], wall: [58, 66, 88] },
  darkfang:  { floor: [30, 34, 30], wall: [44, 40, 58] },
  ashfall:   { floor: [46, 36, 32], wall: [66, 42, 38] }
};
for (const [name, t] of Object.entries(themes)) {
  noisePng(path.join(TEX_DIR, `floor-${name}.png`), name.length * 7 + 3, t.floor, { grain: 26, cracks: 0.02, edge: true });
  noisePng(path.join(TEX_DIR, `wall-${name}.png`), name.length * 13 + 5, t.wall, { grain: 22, cracks: 0.04, edge: true, moss: name === "greenhills" ? 0.03 : 0 });
}
console.log("textures painted:", Object.keys(themes).length * 2);
console.log("DONE");
