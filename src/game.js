// RogueMS web client: Three.js rogue-style renderer + DOM HUD. All rules in core.js.

import * as THREE from "three";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { GLTFExporter } from "../vendor/GLTFExporter.js";
import { Core } from "./core.js";
import { RACES, CLASSES } from "./data.js";

const urlSeed = new URLSearchParams(location.search).get("seed");
const core = new Core(urlSeed ? Number(urlSeed) : (Date.now() & 0xffffff));
const TILE = 1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060c);
scene.fog = new THREE.Fog(0x05060c, 16, 30);

const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById("scene").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30261c, 0.55));
scene.add(new THREE.AmbientLight(0x9999bb, 0.35));
const torch = new THREE.PointLight(0xffc880, 60, 18, 2);
scene.add(torch);
const moon = new THREE.DirectionalLight(0x9db4ff, 0.9);
moon.position.set(-10, -14, 20);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 50;
for (const [k, v] of [["left", -14], ["right", 14], ["top", 14], ["bottom", -14]]) moon.shadow.camera[k] = v;
moon.shadow.bias = -0.001;
scene.add(moon);
const moonTarget = new THREE.Object3D();
scene.add(moonTarget);
moon.target = moonTarget;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------- atmosphere: sky dome + drifting motes ----------

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(90, 16, 12),
  new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, fog: false, depthWrite: false })
);
{
  const pos = sky.geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x4c79c2), low = new THREE.Color(0xd8e6f2);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 90 * 0.5 + 0.5);
    tmp.copy(low).lerp(top, Math.pow(t, 0.7));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  sky.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
sky.visible = false;
scene.add(sky);

const DUST_N = 110;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST_N * 3);
const dustSeed = new Float32Array(DUST_N);
for (let i = 0; i < DUST_N; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 26;
  dustPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
  dustPos[i * 3 + 2] = Math.random() * 4;
  dustSeed[i] = Math.random() * Math.PI * 2;
}
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xffcf80, size: 0.09, transparent: true, opacity: 0.65,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
}));
scene.add(dust);

// ---------- sprite texture caches (free game-icons + fallback glyphs) ----------

const texLoader = new THREE.TextureLoader();
const texCache = new Map();
function glyphTexture(glyph, color) {
  const key = "glyph:" + glyph + "|" + color;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.font = "bold 46px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(glyph, 32, 36);
  const tex = new THREE.CanvasTexture(c);
  texCache.set(key, tex);
  return tex;
}

function iconTexture(icon) {
  const key = "icon:" + icon;
  if (texCache.has(key)) return texCache.get(key);
  const tex = texLoader.load("assets/img/" + icon + ".png");
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

function sprite(entity, size = 0.9) {
  const color = entity.color || "#ffffff";
  const map = entity.icon ? iconTexture(entity.icon) : glyphTexture(entity.glyph || "?", color);
  const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false });
  if (entity.icon) mat.color = new THREE.Color(color);
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

function tileTexture(kind, theme) {
  const key = "tile:" + kind + ":" + theme;
  if (texCache.has(key)) return texCache.get(key);
  const tex = texLoader.load("assets/tex/" + kind + "-" + theme + ".png");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  texCache.set(key, tex);
  return tex;
}

// ---------- map meshes ----------

let mapGroup = null;
let loadedKey = null;
let floorMesh, wallMesh, floorIndex, wallIndex, mapDims;
let propMeshes = [];
let floorAO = null;
const explored = new Map();
let visibleSet = new Set();

function wx(x, w) { return x - w / 2; }
function wy(y, h) { return -(y - h / 2); }

function buildMapMeshes(map) {
  if (mapGroup) scene.remove(mapGroup);
  mapGroup = new THREE.Group();
  scene.add(mapGroup);
  mapDims = { w: map.w, h: map.h };

  const floors = [], walls = [], trees = [], rocks = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const ch = map.grid[y][x];
    if (ch === "#") walls.push({ x, y });
    else if (ch === "T") { trees.push({ x, y }); floors.push({ x, y }); }
    else if (ch === "r") { rocks.push({ x, y }); floors.push({ x, y }); }
    else if (ch === ".") floors.push({ x, y });
  }
  const outdoor = map.kind === "outdoor";
  sky.visible = outdoor;
  scene.fog.color.set(outdoor ? 0x7d9cc0 : 0x05060c);
  scene.background.set(outdoor ? 0x8fb0d8 : 0x05060c);
  moon.intensity = outdoor ? 1.6 : 0.5;
  floorIndex = new Map(); wallIndex = new Map();
  floors.forEach((f, i) => floorIndex.set(f.x + "," + f.y, i));
  walls.forEach((f, i) => wallIndex.set(f.x + "," + f.y, i));

  const theme = map.kind === "town" ? "town" : map.mapId;
  floorAO = new Float32Array(floors.length).fill(1);
  const isWall = (x, y) => {
    const k = x + "," + y;
    return wallIndex.has(k) || (map.grid[y] && map.grid[y][x] === "#");
  };
  const fgeo = new THREE.BoxGeometry(TILE * 0.98, TILE * 0.98, 0.12);
  const fmat = new THREE.MeshStandardMaterial({ map: tileTexture("floor", theme), roughness: 0.95 });
  floorMesh = new THREE.InstancedMesh(fgeo, fmat, Math.max(floors.length, 1));
  floorMesh.receiveShadow = true;
  floorMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(floors.length, 1) * 3), 3);
  const m = new THREE.Matrix4();
  floors.forEach((f, i) => {
    m.makeTranslation(wx(f.x, map.w), wy(f.y, map.h), 0);
    floorMesh.setMatrixAt(i, m);
    let n = 0;
    if (isWall(f.x + 1, f.y)) n++;
    if (isWall(f.x - 1, f.y)) n++;
    if (isWall(f.x, f.y + 1)) n++;
    if (isWall(f.x, f.y - 1)) n++;
    floorAO[i] = 1 - Math.min(0.42, n * 0.14);
  });
  mapGroup.add(floorMesh);

  const wgeo = new THREE.BoxGeometry(TILE * 0.98, TILE * 0.98, 1.2);
  const wmat = new THREE.MeshStandardMaterial({ map: tileTexture("wall", theme), roughness: 0.8, emissive: 0x0c0e1c, emissiveIntensity: 0.35 });
  wallMesh = new THREE.InstancedMesh(wgeo, wmat, Math.max(walls.length, 1));
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  walls.forEach((f, i) => {
    m.makeScale(0.0001, 0.0001, 0.0001);
    m.setPosition(wx(f.x, map.w), wy(f.y, map.h), 0.6);
    wallMesh.setMatrixAt(i, m);
  });
  mapGroup.add(wallMesh);

  propMeshes = [];
  const mkProp = (cells, geo, mat, z, scale = 1) => {
    if (!cells.length) return;
    const inst = new THREE.InstancedMesh(geo, mat, cells.length);
    inst.castShadow = true;
    cells.forEach((f, i) => { m.makeScale(0.0001, 0.0001, 0.0001); m.setPosition(wx(f.x, map.w), wy(f.y, map.h), z); inst.setMatrixAt(i, m); });
    inst.userData.cells = cells;
    inst.userData.z = z;
    mapGroup.add(inst);
    propMeshes.push(inst);
  };
  mkProp(trees, new THREE.BoxGeometry(0.22, 0.22, 0.7), new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 }), 0.4);
  mkProp(trees, new THREE.BoxGeometry(0.75, 0.75, 0.75), new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 1 }), 1.05);
  mkProp(rocks, new THREE.BoxGeometry(0.55, 0.55, 0.4), new THREE.MeshStandardMaterial({ color: 0x6e6e76, roughness: 1 }), 0.25);

  if (map.stairs) {
    const stairsGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb9a98c, roughness: 0.85 });
    for (const sx of [-0.72, 0.72]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.9, 1.3), stoneMat);
      side.position.set(wx(map.stairs.x, map.w) + sx, wy(map.stairs.y, map.h), 0.65);
      stairsGroup.add(side);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.36), stoneMat);
    lintel.position.set(wx(map.stairs.x, map.w), wy(map.stairs.y, map.h) - 0.85, 1.05);
    stairsGroup.add(lintel);
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 0.15), stoneMat);
      step.position.set(wx(map.stairs.x, map.w), wy(map.stairs.y, map.h) - 0.55 + i * 0.36, 0.16 + i * 0.14);
      stairsGroup.add(step);
    }
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x030409, roughness: 1 }));
    shaft.position.set(wx(map.stairs.x, map.w), wy(map.stairs.y, map.h) + 0.9, -0.6);
    stairsGroup.add(shaft);
    const glow = new THREE.PointLight(0xffb060, 5, 5);
    glow.position.set(wx(map.stairs.x, map.w), wy(map.stairs.y, map.h), 1.5);
    stairsGroup.add(glow);
    mapGroup.add(stairsGroup);
    mapGroup.userData.stairsGroup = stairsGroup;
  }
}

const floorLit = new THREE.Color(0x2c4436), floorDim = new THREE.Color(0x15201a);
const aoTmp = new THREE.Color();
function refreshFov() {
  if (!core.player || !floorMesh) return;
  const map = core.getMap(core.player.mapKey);
  const p = core.player;
  if (!explored.has(map.key)) explored.set(map.key, new Set());
  const exp = explored.get(map.key);
  visibleSet = new Set();
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
    if (dx * dx + dy * dy > 68) continue;
    if (losClear(p.x, p.y, p.x + dx, p.y + dy)) {
      const k = (p.x + dx) + "," + (p.y + dy);
      if (floorIndex.has(k) || wallIndex.has(k)) { visibleSet.add(k); exp.add(k); }
    }
  }
  const m = new THREE.Matrix4();
  for (const [k, i] of floorIndex) {
    const [x, y] = k.split(",").map(Number);
    const vis = visibleSet.has(k), dim = exp.has(k);
    aoTmp.copy(vis ? floorLit : floorDim).multiplyScalar(floorAO[i] || 1);
    floorMesh.setColorAt(i, aoTmp);
    m.makeScale(vis || dim ? 1 : 0.0001, vis || dim ? 1 : 0.0001, 1);
    m.setPosition(wx(x, mapDims.w), wy(y, mapDims.h), 0);
    floorMesh.setMatrixAt(i, m);
  }
  floorMesh.instanceMatrix.needsUpdate = true;
  if (floorMesh.instanceColor) floorMesh.instanceColor.needsUpdate = true;
  for (const [k, i] of wallIndex) {
    const [x, y] = k.split(",").map(Number);
    const dim = exp.has(k);
    m.makeScale(dim ? 1 : 0.0001, dim ? 1 : 0.0001, dim ? 1 : 0.0001);
    m.setPosition(wx(x, mapDims.w), wy(y, mapDims.h), 0.6);
    wallMesh.setMatrixAt(i, m);
  }
  wallMesh.instanceMatrix.needsUpdate = true;
  const m2 = new THREE.Matrix4();
  for (const inst of propMeshes) {
    inst.userData.cells.forEach((cell, i) => {
      const on = exp.has(cell.x + "," + cell.y);
      m2.makeScale(on ? 1 : 0.0001, on ? 1 : 0.0001, on ? 1 : 0.0001);
      m2.setPosition(wx(cell.x, mapDims.w), wy(cell.y, mapDims.h), inst.userData.z);
      inst.setMatrixAt(i, m2);
    });
    inst.instanceMatrix.needsUpdate = true;
  }
}

function losClear(x0, y0, x1, y1) {
  const map = core.getMap(core.player.mapKey);
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) return true;
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    if (map.grid[y][x] === "#") return false;
  }
  return true;
}

// ---------- entity bodies (voxel figures + icon cards, pooled) ----------

const BOX = new THREE.BoxGeometry(1, 1, 1);
function part(group, mat, w, h, d, x, y, z, rz = 0) {
  const p = new THREE.Mesh(BOX, mat);
  p.scale.set(w, h, d);
  p.position.set(x, y, z);
  p.rotation.z = rz;
  group.add(p);
  return p;
}

const eyeMats = new Map();
function eyeMat(color) {
  if (!eyeMats.has(color)) eyeMats.set(color, new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 2.2, fog: false
  }));
  return eyeMats.get(color);
}
function eyes(g, y, z, spread, size, color = 0xffdd44) {
  const m = eyeMat(color);
  for (const sx of [-spread, spread]) {
    const e = part(g, m, size, size, size * 0.6, sx, y, z);
    e.userData.noShadow = true;
  }
}
const EYE_POS = {
  quadruped: [0.51, 0.46, 0.07, 0.05], spider: [0.36, 0.3, 0.05, 0.035],
  bat: [0, 0.76, 0.06, 0.04, 0xff6666], skeleton: [0.14, 0.9, 0.08, 0.05, 0x88ddff],
  float: [0.16, 1.38, 0.1, 0.055, 0xff4060], slab: [0.25, 0.7, 0.09, 0.06, 0xffa030],
  harpy: [0.15, 1.0, 0.08, 0.05], imp: [0.11, 0.62, 0.07, 0.045, 0xff5050],
  tall: [0.16, 1.27, 0.1, 0.055, 0x9fdcff], brute: [0.17, 0.97, 0.11, 0.06],
  biped: [0.12, 0.92, 0.09, 0.05, 0xffee99]
};

const SPECIES = {
  rat: { shape: "quadruped", scale: 0.5 }, bat: { shape: "bat", scale: 0.45 },
  wolf: { shape: "quadruped", scale: 1.0 }, goblin: { shape: "biped", scale: 0.65 },
  imp: { shape: "imp", scale: 0.55 }, skeleton: { shape: "skeleton", scale: 1.0 },
  spider: { shape: "spider", scale: 0.85 }, orc: { shape: "brute", scale: 1.2 },
  harpy: { shape: "harpy", scale: 1.0 }, wraith: { shape: "float", scale: 1.0 },
  magma: { shape: "slab", scale: 1.35 }, shade: { shape: "float", scale: 0.95 },
  troll: { shape: "brute", scale: 1.45 }, wendigo: { shape: "tall", scale: 1.3 },
  greenpaw: { shape: "brute", scale: 1.7 }, hagraven: { shape: "harpy", scale: 1.5 },
  cinder: { shape: "slab", scale: 1.8 }, hero: { shape: "biped", scale: 1 }
};

function makeVoxel(speciesId, glyph, color, isBoss) {
  const byGlyph = { r: "rat", b: "bat", w: "wolf", g: "goblin", i: "imp", Z: "skeleton", x: "spider", o: "orc", h: "harpy", W: "wraith", m: "magma", U: "shade", T: "troll", Y: "wendigo", "&": "troll" };
  const known = SPECIES[speciesId] || SPECIES[byGlyph[glyph]];
  const sp = known || { shape: isBoss ? "brute" : "biped", scale: isBoss ? 1.7 : 1 };
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.6), roughness: 0.7 });
  const light = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), roughness: 0.5 });
  const head = p => { p.userData.head = true; return p; };
  switch (sp.shape) {
    case "quadruped":
      part(g, mat, 0.34, 0.6, 0.3, 0, 0, 0.33);
      head(part(g, mat, 0.26, 0.26, 0.26, 0, 0.38, 0.42));
      part(g, dark, 0.12, 0.1, 0.1, 0, 0.52, 0.46);
      part(g, dark, 0.06, 0.12, 0.06, -0.09, 0.4, 0.6);
      part(g, dark, 0.06, 0.12, 0.06, 0.09, 0.4, 0.6);
      for (const [lx, ly] of [[-0.12, -0.2], [0.12, -0.2], [-0.12, 0.2], [0.12, 0.2]])
        part(g, dark, 0.07, 0.07, 0.22, lx, ly, 0.11);
      part(g, dark, 0.05, 0.35, 0.05, 0, -0.45, 0.35, 0.6);
      break;
    case "spider":
      part(g, mat, 0.34, 0.34, 0.22, 0, 0, 0.26);
      head(part(g, mat, 0.2, 0.2, 0.16, 0, 0.3, 0.26));
      for (let leg = 0; leg < 8; leg++) {
        const side = leg % 2 ? 1 : -1, along = (leg >> 1) - 1.5;
        part(g, dark, 0.5, 0.05, 0.05, side * 0.32, along * 0.14, 0.18, side * 0.5);
      }
      break;
    case "bat":
      part(g, mat, 0.22, 0.24, 0.26, 0, 0, 0.5);
      head(part(g, mat, 0.16, 0.16, 0.16, 0, 0, 0.72));
      part(g, dark, 0.62, 0.06, 0.34, -0.38, 0, 0.58, 0.35);
      part(g, dark, 0.62, 0.06, 0.34, 0.38, 0, 0.58, -0.35);
      break;
    case "skeleton":
      part(g, mat, 0.3, 0.45, 0.2, 0, 0, 0.45);
      head(part(g, light, 0.28, 0.28, 0.26, 0, 0, 0.88));
      part(g, mat, 0.06, 0.42, 0.06, -0.24, 0, 0.44);
      part(g, mat, 0.06, 0.42, 0.06, 0.24, 0, 0.44);
      part(g, mat, 0.07, 0.4, 0.07, -0.09, 0, 0.1);
      part(g, mat, 0.07, 0.4, 0.07, 0.09, 0, 0.1);
      part(g, dark, 0.24, 0.1, 0.1, 0, 0, 0.72);
      break;
    case "float":
      part(g, mat, 0.4, 0.4, 0.7, 0, 0, 0.85);
      head(part(g, mat, 0.3, 0.3, 0.28, 0, 0, 1.35));
      part(g, dark, 0.08, 0.3, 0.08, -0.26, 0, 0.95, 0.4);
      part(g, dark, 0.08, 0.3, 0.08, 0.26, 0, 0.95, -0.4);
      part(g, dark, 0.3, 0.3, 0.4, 0, 0, 0.4);
      break;
    case "slab":
      part(g, mat, 0.85, 0.65, 0.5, 0, 0, 0.3);
      part(g, light, 0.5, 0.35, 0.18, 0, 0, 0.62);
      head(part(g, mat, 0.25, 0.25, 0.3, 0, 0.25, 0.68));
      part(g, light, 0.6, 0.1, 0.1, 0, -0.2, 0.55);
      break;
    case "harpy":
      part(g, mat, 0.34, 0.4, 0.26, 0, 0, 0.6);
      head(part(g, light, 0.28, 0.28, 0.26, 0, 0, 0.98));
      part(g, dark, 0.7, 0.08, 0.4, -0.42, 0, 0.75, 0.4);
      part(g, dark, 0.7, 0.08, 0.4, 0.42, 0, 0.75, -0.4);
      part(g, dark, 0.08, 0.3, 0.08, -0.09, 0, 0.2);
      part(g, dark, 0.08, 0.3, 0.08, 0.09, 0, 0.2);
      part(g, light, 0.14, 0.12, 0.12, 0, 0.18, 1.0);
      break;
    case "imp":
      part(g, mat, 0.24, 0.26, 0.2, 0, 0, 0.32);
      head(part(g, mat, 0.22, 0.22, 0.2, 0, 0, 0.6));
      part(g, dark, 0.06, 0.2, 0.06, 0, 0, 0.78);
      part(g, dark, 0.4, 0.05, 0.24, -0.26, 0, 0.45, 0.45);
      part(g, dark, 0.4, 0.05, 0.24, 0.26, 0, 0.45, -0.45);
      part(g, dark, 0.06, 0.22, 0.06, -0.07, 0, 0.1);
      part(g, dark, 0.06, 0.22, 0.06, 0.07, 0, 0.1);
      break;
    case "tall":
      part(g, mat, 0.36, 0.5, 0.26, 0, 0, 0.75);
      head(part(g, light, 0.3, 0.36, 0.3, 0, 0, 1.25));
      part(g, dark, 0.07, 0.32, 0.07, -0.14, 0.12, 1.5, -0.5);
      part(g, dark, 0.07, 0.32, 0.07, 0.14, 0.12, 1.5, 0.5);
      part(g, dark, 0.3, 0.1, 0.3, 0, 0, 1.05);
      part(g, mat, 0.08, 0.5, 0.08, -0.1, 0, 0.28);
      part(g, mat, 0.08, 0.5, 0.08, 0.1, 0, 0.28);
      part(g, dark, 0.07, 0.55, 0.07, -0.24, 0, 1.05, 0.3);
      part(g, dark, 0.07, 0.55, 0.07, 0.24, 0, 1.05, -0.3);
      break;
    case "brute":
      part(g, mat, 0.62, 0.5, 0.36, 0, 0, 0.5);
      head(part(g, mat, 0.34, 0.3, 0.32, 0, 0, 0.95));
      part(g, dark, 0.16, 0.14, 0.16, 0, 0.18, 1.05);
      part(g, dark, 0.1, 0.26, 0.1, -0.14, 0.1, 1.12, -0.5);
      part(g, dark, 0.1, 0.26, 0.1, 0.14, 0.1, 1.12, 0.5);
      part(g, dark, 0.16, 0.42, 0.16, -0.4, 0, 0.5);
      part(g, dark, 0.16, 0.42, 0.16, 0.4, 0, 0.5);
      part(g, dark, 0.14, 0.36, 0.14, -0.14, 0, 0.14);
      part(g, dark, 0.14, 0.36, 0.14, 0.14, 0, 0.14);
      break;
    default:
      part(g, mat, 0.42, 0.5, 0.28, 0, 0, 0.42);
      head(part(g, mat, 0.36, 0.36, 0.34, 0, 0, 0.9));
      part(g, dark, 0.09, 0.16, 0.09, -0.11, 0.1, 1.08);
      part(g, dark, 0.09, 0.16, 0.09, 0.11, 0.1, 1.08);
  }
  const ep = EYE_POS[sp.shape];
  if (ep) eyes(g, ep[0], ep[1], ep[2], ep[3], ep[4]);
  g.scale.setScalar(sp.scale);
  g.userData.voxel = true;
  g.userData.species = speciesId || sp.shape;
  g.userData.floats = sp.shape === "float";
  return g;
}

function applyShadows(g) {
  g.traverse(o => { if (o.isMesh && !o.userData.noShadow) o.castShadow = true; });
}
function addBlobShadow(g, r) {
  const blob = new THREE.Mesh(new THREE.CircleGeometry(r, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  blob.position.z = 0.02;
  blob.userData.noShadow = true;
  g.add(blob);
}

function makePlayerVoxel(classId, color) {
  const g = makeVoxel("hero", "@", color);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8d8e8, roughness: 0.4, metalness: 0.5 });
  const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.8 });
  part(g, cloth, 0.44, 0.1, 0.3, 0, 0, 0.3);
  part(g, cloth, 0.13, 0.13, 0.32, -0.1, 0, 0.15);
  part(g, cloth, 0.13, 0.13, 0.32, 0.1, 0, 0.15);
  if (classId === "fighter") {
    part(g, mat, 0.16, 0.16, 0.2, -0.29, 0, 0.62);
    part(g, mat, 0.16, 0.16, 0.2, 0.29, 0, 0.62);
    part(g, mat, 0.09, 0.09, 0.7, 0.34, 0, 0.62);
    part(g, mat, 0.16, 0.3, 0.02, -0.34, 0.16, 0.55);
    part(g, mat, 0.38, 0.1, 0.38, 0, 0, 1.12);
  } else if (classId === "mage") {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.36, 6), cloth);
    hat.position.set(0, 0, 1.32);
    g.add(hat);
    part(g, mat, 0.3, 0.3, 0.35, 0, 0, 1.62);
    part(g, mat, 0.06, 0.06, 0.8, 0.34, 0, 0.66);
  } else {
    part(g, cloth, 0.5, 0.5, 0.34, 0, 0, 0.28);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), mat);
    halo.position.set(0, 0, 1.28);
    g.add(halo);
    part(g, mat, 0.07, 0.07, 0.55, -0.32, 0, 0.58);
    part(g, mat, 0.18, 0.18, 0.1, -0.32, 0, 0.9);
  }
  addBlobShadow(g, 0.36);
  applyShadows(g);
  return g;
}

let entityGroup = null;
let playerSprite = null;
let pool = new Map();

function rebuildEntities() {
  if (!entityGroup) { entityGroup = new THREE.Group(); scene.add(entityGroup); }
  if (!core.player) return;
  const seen = new Set();
  const t = performance.now() / 1000;
  for (const e of core.entities()) {
    if (e.kind === "stairs" || e.kind === "item" || e.kind === "npc" || e.kind === "portal" || e.kind === "entrance") {
      const key = "card:" + loadedKey + ":" + e.kind + ":" + e.x + "," + e.y;
      seen.add(key);
      if (!pool.has(key) && visibleSet.has(e.x + "," + e.y)) {
        const s = sprite(e, e.kind === "stairs" ? 1.15 : 0.9);
        s.position.set(wx(e.x, mapDims.w), wy(e.y, mapDims.h), 0.7);
        entityGroup.add(s);
        pool.set(key, s);
      }
      const c = pool.get(key);
      if (c) c.visible = visibleSet.has(e.x + "," + e.y);
      continue;
    }
    if (e.kind !== "monster") continue;
    const key = "mon:" + e.x + "," + e.y + ":" + e.name;
    seen.add(key);
    const vis = visibleSet.has(e.x + "," + e.y);
    if (!pool.has(key)) {
      const g = makeVoxel(e.monsterId, e.glyph, e.color, e.isBoss);
      addBlobShadow(g, 0.4);
      applyShadows(g);
      g.userData.bar = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.07),
        new THREE.MeshBasicMaterial({ color: 0xff4040 }));
      g.userData.bar.visible = false;
      entityGroup.add(g);
      g.add(g.userData.bar);
      g.userData.bar.position.set(0, 0, 1.5);
      pool.set(key, g);
    }
    const g = pool.get(key);
    g.visible = vis;
    if (!vis) continue;
    const wobble = Math.sin(t * 5 + e.x * 3 + e.y) * 0.04;
    g.position.set(wx(e.x, mapDims.w) + wobble, wy(e.y, mapDims.h),
      g.userData.floats ? 0.35 + 0.1 * Math.sin(t * 2.2 + e.x) : 0);
    const bar = g.userData.bar;
    bar.visible = e.hp < e.maxHp;
    bar.scale.x = Math.max(0.05, e.hp / e.maxHp);
  }
  for (const [key, obj] of pool) {
    if (!seen.has(key)) { entityGroup.remove(obj); pool.delete(key); }
  }
  if (!playerSprite) {
    playerSprite = makePlayerVoxel(core.player.classId, CLASSES[core.player.classId].color);
    playerSprite.userData.voxel = true;
    scene.add(playerSprite);
  }
  playerSprite.position.set(wx(core.player.x, mapDims.w), wy(core.player.y, mapDims.h), 0);
  playerSprite.rotation.z = Math.sin(t * 3) * 0.04;
}

// ---------- HUD ----------

const el = id => document.getElementById(id);
function bar(v, max, cls) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="bar"><div class="fill ${cls}" style="width:${pct}%"></div><span>${v}/${max}</span></div>`;
}
function renderHud() {
  if (core.screen !== "play") return;
  const s = core.status();
  const p = s.player;
  el("stats").innerHTML = `
    <div class="title">${p.name} the ${RACES[p.raceId].name} ${CLASSES[p.classId].name} &mdash; Lv ${p.level}</div>
    <div>HP ${bar(p.hp, p.maxHp, "hp")}</div>
    <div>MP ${bar(p.mp, p.maxMp, "mp")}</div>
    <div>XP ${bar(p.xp, p.xpNeed, "xp")}</div>
    <div class="attrs">STR ${p.attrs.str} INT ${p.attrs.int} WIS ${p.attrs.wis} DEX ${p.attrs.dex} VIT ${p.attrs.vit} &bull; ATK ${p.atk} DEF ${p.def} &bull; ${p.gold}g</div>
    <div class="where">${s.map.name}${s.map.tier ? " &mdash; depth " + s.map.tier : ""} (${s.map.layout})</div>
    <div class="quests">${s.quests.map(q => q.turnedIn ? `<span class="qdone">${q.name}: done</span>` : `${q.name}: ${q.progress}/${q.need}`).join(" &bull; ")}</div>
    <div class="equip">W: ${p.equipment.weapon || "none"} &bull; A: ${p.equipment.armor || "none"} &bull; T: ${p.equipment.trinket || "none"}</div>`;
  el("skills").innerHTML = p.skills.map((sk, i) =>
    `<span class="sk ${sk.cd || p.mp < sk.cost ? "dim" : ""}">[${i + 1}] ${sk.name} (${sk.cost}mp${sk.cd ? ", cd " + sk.cd : ""})</span>`).join("<br>");
  renderInventory(s);
}
function renderLog() {
  el("log").innerHTML = core.log.slice(-8).map(l => `<div style="color:${l.color}">${l.text}</div>`).join("");
  el("log").scrollTop = el("log").scrollHeight;
}
function renderInventory(s) {
  const inv = el("inv");
  if (!inv.classList.contains("open")) return;
  inv.innerHTML = "<h3>Pack</h3>" + s.player.bag.map(it => {
    let btn = "";
    if (["weapon", "armor", "trinket"].includes(it.kind)) btn = `<button data-act="equip" data-uid="${it.uid}">Equip</button>`;
    if (it.kind === "potion" || it.kind === "book") btn = `<button data-act="use" data-uid="${it.uid}">Use</button>`;
    btn += ` <button data-act="drop" data-uid="${it.uid}">Drop</button>`;
    const ic = it.icon ? `<img src="assets/img/${it.icon}.png" class="ic" style="filter: invert(1);">` : it.glyph;
    return `<div class="row" style="color:${it.color}">${ic} ${it.label} ${btn}</div>`;
  }).join("") || "<div class='row'>empty</div>";
}
el("inv").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const uid = Number(b.dataset.uid);
  if (b.dataset.act === "equip") core.act({ type: "equip", uid });
  else if (b.dataset.act === "drop") core.act({ type: "drop", uid });
  else core.act({ type: "useItem", uid });
  afterAction();
});

// ---------- character creation ----------

const picks = { cls: "fighter", race: "human" };
function renderCreate() {
  el("banner").innerHTML = `<img src="assets/img/delapouite__dungeon-gate.png" alt="" class="banner">`;
  el("classPick").innerHTML = Object.entries(CLASSES).map(([id, c]) =>
    `<button data-pick="cls" data-id="${id}" class="${picks.cls === id ? "on" : ""}"><img src="assets/img/${c.icon}.png" class="ic" style="filter: hue-rotate(0deg) sepia(1) saturate(3);" /> ${c.name}</button>`).join("");
  el("racePick").innerHTML = Object.entries(RACES).map(([id, r]) =>
    `<button data-pick="race" data-id="${id}" class="${picks.race === id ? "on" : ""}"><img src="assets/img/${r.icon}.png" class="ic" /> ${r.name}</button>`).join("");
  el("blurb").textContent = CLASSES[picks.cls].blurb + "  " + RACES[picks.race].blurb;
}
el("create").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.pick) { picks[b.dataset.pick] = b.dataset.id; renderCreate(); }
  if (b.id === "begin") {
    core.start(picks.cls, picks.race, el("name").value.trim());
    el("create").style.display = "none";
    loadedKey = null;
    afterAction();
  }
});
renderCreate();

// ---------- minimap ----------

const mmCanvas = el("minimap");
const mmCtx = mmCanvas.getContext("2d");
let mapOpen = false, mmLast = 0;

function drawMinimap() {
  if (!mapOpen || !core.player || !mapDims) return;
  const map = core.getMap(core.player.mapKey);
  const exp = explored.get(map.key) || new Set();
  const s = Math.floor(176 / Math.max(map.w, map.h));
  const ox = Math.floor((180 - map.w * s) / 2), oy = Math.floor((180 - map.h * s) / 2);
  mmCtx.fillStyle = "#05060c";
  mmCtx.fillRect(0, 0, 180, 180);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (!exp.has(x + "," + y)) continue;
    const ch = map.grid[y][x];
    mmCtx.fillStyle = ch === "#" ? "#3a3f52" : ch === "T" ? "#1d4a24" : ch === "r" ? "#4a4a50" : "#22283a";
    mmCtx.fillRect(ox + x * s, oy + y * s, s, s);
  }
  const dot = (x, y, color, r = Math.max(2, s / 2)) => {
    mmCtx.fillStyle = color;
    mmCtx.beginPath();
    mmCtx.arc(ox + x * s + s / 2, oy + y * s + s / 2, r, 0, 7);
    mmCtx.fill();
  };
  if (map.stairs) dot(map.stairs.x, map.stairs.y, "#ffb040", Math.max(3, s * 0.8));
  for (const e of core.entities()) {
    if (!exp.has(e.x + "," + e.y)) continue;
    if (e.kind === "monster") dot(e.x, e.y, e.isBoss ? "#ff2060" : "#e04040");
    else if (e.kind === "item") dot(e.x, e.y, "#e8d070", Math.max(1.5, s / 3));
    else if (e.kind === "npc") dot(e.x, e.y, "#50c878");
    else if (e.kind === "entrance") dot(e.x, e.y, "#ff8030", Math.max(3, s * 0.8));
    else if (e.kind === "portal") dot(e.x, e.y, "#b060ff");
  }
  dot(core.player.x, core.player.y, "#ffffff", Math.max(2.5, s * 0.7));
}

let autoGen = 0;
const clickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const ray = new THREE.Raycaster();
const hitPt = new THREE.Vector3();

function clickTile(tx, ty) {
  const gen = ++autoGen;
  return (async () => {
    if (core.screen !== "play" || core.dead || !mapDims) return "nope";
    for (let i = 0; i < 240; i++) {
      if (gen !== autoGen || core.dead) return "cancelled";
      const map = core.getMap(core.player.mapKey);
      const p = core.player;
      const dx = tx - p.x, dy = ty - p.y;
      const cheb = Math.max(Math.abs(dx), Math.abs(dy));
      const isStairs = map.stairs && tx === map.stairs.x && ty === map.stairs.y;
      if (isStairs && cheb <= 1) { core.act({ type: "descend" }); afterAction(); return "used"; }
      const ent = core.entityAt(tx, ty);
      if (ent && ent.type === "monster" && cheb >= 1) {
        core.act({ type: "move", dx: Math.sign(dx), dy: Math.sign(dy) });
        afterAction();
        if (!core.entityAt(tx, ty)) continue;
        if (cheb === 1) return "used";
        continue;
      }
      if ((ent && (ent.type === "npc" || ent.type === "entrance")) && cheb <= 1) {
        core.act({ type: "interact" }); afterAction(); return "used";
      }
      if (cheb === 0) return "arrived";
      if (map.key !== core.player.mapKey) return "moved-maps";
      const sleepMs = 45;
      if (!core.stepTowards(tx, ty)) { afterAction(); return "stuck"; }
      afterAction();
      await new Promise(r => setTimeout(r, sleepMs));
    }
    return "timeout";
  })();
}

renderer.domElement.addEventListener("click", ev => {
  if (core.screen !== "play" || !mapDims) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1
  );
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(clickPlane, hitPt)) return;
  const gx = Math.round(hitPt.x + mapDims.w / 2 - 0.5);
  const gy = Math.round(-hitPt.y + mapDims.h / 2 - 0.5);
  if (gx < 0 || gy < 0 || gx >= mapDims.w || gy >= mapDims.h) return;
  clickTile(gx, gy);
});

// ---------- input ----------

const MOVE = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0]
};

function saveGame() {
  if (core.screen !== "play" || !core.player) return false;
  try {
    localStorage.setItem(Core.SAVE_KEY, JSON.stringify(core.toJSON()));
    const b = el("saveBtn");
    b.textContent = "Saved!";
    setTimeout(() => { b.textContent = "Save"; }, 900);
    return true;
  } catch (e) { return false; }
}

function tryContinue() {
  const raw = localStorage.getItem(Core.SAVE_KEY);
  if (!raw) return false;
  try {
    if (!core.loadFrom(JSON.parse(raw))) return false;
  } catch (e) { return false; }
  el("create").style.display = "none";
  loadedKey = null;
  afterAction();
  return true;
}
if (localStorage.getItem(Core.SAVE_KEY)) el("continue").style.display = "inline-block";
el("saveBtn").addEventListener("click", () => saveGame());
el("continue").addEventListener("click", () => tryContinue());

function afterAction() {
  if (core.screen !== "play" || !core.player) return;
  el("stats").style.display = el("skills").style.display = "block";
  const map = core.getMap(core.player.mapKey);
  if (map.key !== loadedKey) { loadedKey = map.key; buildMapMeshes(map); }
  refreshFov();
  renderHud();
  renderLog();
  el("death").style.display = core.dead ? "flex" : "none";
}

window.addEventListener("keydown", e => {
  if (core.screen !== "play") return;
  autoGen++;
  if (core.dead) { if (e.key === "Enter") { core.act({ type: "revive" }); afterAction(); } return; }
  if (MOVE[e.key]) { core.act({ type: "move", dx: MOVE[e.key][0], dy: MOVE[e.key][1] }); afterAction(); e.preventDefault(); }
  else if (e.key === "." || e.key === "5") { core.act({ type: "move", dx: 0, dy: 0 }); afterAction(); }
  else if (e.key === "e" || e.key === "E") { core.act({ type: "interact" }); afterAction(); }
  else if (e.key === ">" || e.key === ">") { core.act({ type: "descend" }); afterAction(); }
  else if (e.key === "i" || e.key === "I") { el("inv").classList.toggle("open"); renderHud(); }
  else if (e.key === "m" || e.key === "M") {
    mapOpen = !mapOpen;
    mmCanvas.style.display = mapOpen ? "block" : "none";
    drawMinimap();
  }
  else if (/^[1-6]$/.test(e.key)) { core.act({ type: "skill", slot: Number(e.key) - 1 }); afterAction(); }
});

// ---------- render loop ----------

let lastKey = null;
function loop() {
  requestAnimationFrame(loop);
  if (core.screen !== "play" || !core.player || !mapDims) return;
  const map = core.getMap(core.player.mapKey);
  if (map.key !== loadedKey) { loadedKey = map.key; buildMapMeshes(map); refreshFov(); }
  rebuildEntities();
  const px = wx(core.player.x, mapDims.w), py = wy(core.player.y, mapDims.h);
  const camTarget = new THREE.Vector3(px, py + 1.5, 0);
  const camPos = new THREE.Vector3(px, py - 8.5, 7.5);
  camera.position.lerp(camPos, 0.12);
  camera.lookAt(camTarget.clone().lerp(new THREE.Vector3(px, py, 0), 1));
  torch.position.set(px, py, 3.5);
  const tsec = performance.now() / 1000;
  torch.intensity = 55 + 7 * Math.sin(tsec * 7.3) + 5 * Math.sin(tsec * 13.1 + 2);
  moon.position.set(px - 9, py - 11, 15);
  moonTarget.position.set(px, py, 0);
  moonTarget.updateMatrixWorld();
  sky.position.set(px, py, 0);
  dust.position.set(px, py, 0);
  dust.material.color.set(map.kind === "outdoor" || map.kind === "town" ? 0xa0e8b0 : 0xffa050);
  for (let i = 0; i < DUST_N; i++) {
    let z = dustPos[i * 3 + 2] + 0.012 + 0.008 * Math.sin(dustSeed[i]);
    if (z > 4.5) z = 0.1;
    dustPos[i * 3 + 2] = z;
    dustPos[i * 3] += Math.sin(tsec * 0.8 + dustSeed[i]) * 0.004;
  }
  dustGeo.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
  const now = performance.now();
  if (mapOpen && now - mmLast > 250) { mmLast = now; drawMinimap(); }
}
loop();

// ---------- test API (used by scripts/verify.mjs and future clients) ----------

window.game = {
  ready: true,
  core,
  debugScene: () => mapGroup,
  debugAll: () => scene,
  create: (c, r, n) => { core.start(c, r, n); loadedKey = null; afterAction(); return core.status(); },
  status: () => core.status(),
  act: a => core.act(a),
  travel: (t, tier) => { core.act({ type: "travel", target: t, tier }); afterAction(); },
  descend: () => { core.act({ type: "descend" }); afterAction(); },
  interact: () => { core.act({ type: "interact" }); afterAction(); },
  stepTowards: (x, y) => { const r = core.stepTowards(x, y); afterAction(); return r; },
  monsters: () => core.monstersNear(),
  items: () => core.itemsOnMap(),
  stairs: () => core.stairsPos(),
  layoutCount: m => core.layoutCount(m),
  saveGame, tryContinue,
  debugVoxel: id => {
    const g = makeVoxel(id, "", "#ffffff");
    return { species: g.userData.species, parts: g.children.length, scale: g.scale.x };
  },
  toggleMap: () => { mapOpen = !mapOpen; mmCanvas.style.display = mapOpen ? "block" : "none"; drawMinimap(); return mapOpen; },
  clickTile,
  hasSave: () => !!localStorage.getItem(Core.SAVE_KEY),
  exportDemoGlb: () => new Promise((resolve, reject) => {
    if (!playerSprite) return reject(new Error("no hero yet"));
    new GLTFExporter().parse(playerSprite, buf => {
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      resolve(btoa(bin));
    }, reject, { binary: true });
  }),
  importGlbDemo: b64 => new Promise((resolve, reject) => {
    const bytes = atob(b64);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    new GLTFLoader().parse(buf.buffer, "", gltf => {
      let parts = 0;
      gltf.scene.traverse(o => { o.userData.fromGlb = true; if (o.isMesh) parts++; });
      gltf.scene.position.set(playerSprite.position.x + 1.5, playerSprite.position.y, 0);
      scene.add(gltf.scene);
      resolve({ ok: true, parts });
    }, reject);
  }),
  equip: uid => core.act({ type: "equip", uid }),
  useItem: uid => core.act({ type: "useItem", uid }),
  afterAction
};
