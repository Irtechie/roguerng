// RogueMS web client: Three.js rogue-style renderer + DOM HUD. All rules in core.js.

import * as THREE from "three";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { clone as cloneSkeleton } from "../vendor/SkeletonUtils.js";
import { GLTFExporter } from "../vendor/GLTFExporter.js";
import { EffectComposer } from "../vendor/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/examples/jsm/postprocessing/OutputPass.js";
import { Core } from "./core.js";
import { RACES, CLASSES, SHOP, VENDORS } from "./data.js";

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

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.82);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
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
let flames = [];
const explored = new Map();
let visibleSet = new Set();

function wx(x, w) { return x - w / 2; }
function wy(y, h) { return -(y - h / 2); }

function buildMapMeshes(map) {
  if (mapGroup) scene.remove(mapGroup);
  flames = [];
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
  const skipProp = new Set((map.stalls || []).map(s => s.x + "," + s.y));
  if (map.fountain) skipProp.add(map.fountain.x + "," + map.fountain.y);
  const rockCells = rocks.filter(r => !skipProp.has(r.x + "," + r.y));
  const outdoor = map.kind === "outdoor" || map.kind === "town";
  sky.visible = outdoor;
  scene.fog.color.set(outdoor ? 0x7d9cc0 : 0x05060c);
  scene.background.set(outdoor ? 0x8fb0d8 : 0x05060c);
  moon.intensity = outdoor ? 1.7 : 0.5;
  floorIndex = new Map(); wallIndex = new Map();
  floors.forEach((f, i) => floorIndex.set(f.x + "," + f.y, i));
  walls.forEach((f, i) => wallIndex.set(f.x + "," + f.y, i));

  const theme = map.kind === "town" ? "town" : map.mapId;
  floorLit.set(map.kind === "town" ? 0x46603c : map.kind === "outdoor"
    ? (map.mapId === "ashfall" ? 0x4c4232 : map.mapId === "darkfang" ? 0x2e4436 : 0x38522e)
    : 0x2c4436);
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
  mkProp(trees, new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 0.9 }), 1.1);
  mkProp(rockCells, new THREE.SphereGeometry(0.32, 6, 5), new THREE.MeshStandardMaterial({ color: 0x6e6e76, roughness: 1 }), 0.2);

  const scatter = (n, geo, mat, z, seedTag) => {
    const cells = [];
    if (!floors.length) return;
    for (let i = 0; i < n; i++) cells.push(floors[Math.floor(Math.random() * floors.length)]);
    mkProp(cells, geo, mat, z);
  };
  if (outdoor) {
    const green = map.mapId === "darkfang" ? 0x3a5a48 : map.mapId === "ashfall" ? 0x6a5a4a : 0x4a8a3e;
    scatter(110, new THREE.ConeGeometry(0.07, 0.26, 4), new THREE.MeshStandardMaterial({ color: green, roughness: 1 }), 0.16);
    scatter(40, new THREE.SphereGeometry(0.07, 5, 4), new THREE.MeshStandardMaterial({ color: 0x77777f, roughness: 1 }), 0.07);
    if (map.kind === "town")
      scatter(26, new THREE.SphereGeometry(0.06, 5, 4), new THREE.MeshStandardMaterial({ color: 0xe8d060, emissive: 0x604000, roughness: 0.8 }), 0.14);
  }

  if (map.kind === "dungeon") {
    const glow = { greenhills: 0xffd0a0, darkfang: 0xc0a0ff, ashfall: 0xff8050 }[map.mapId] || 0xffb060;
    const sconceMat = new THREE.MeshStandardMaterial({ color: 0x40301c, roughness: 1 });
    const flameMat = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 2.4, fog: false });
    for (let w = 0; w < walls.length && wallIndex.size > 0; w++) {
      const wall = walls[w];
      if ((wall.x * 7 + wall.y * 13) % 23 !== 0) continue;
      let adj = null;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (floorIndex.has((wall.x + ox) + "," + (wall.y + oy))) { adj = [ox, oy]; break; }
      }
      if (!adj) continue;
      const bx = wx(wall.x, map.w), by = wy(wall.y, map.h);
      const fx = bx + adj[0] * 0.45, fy = by + adj[1] * 0.45;
      const torchModel = GLB.torch_lit ? modelInstance("torch_lit", 0.62) : null;
      if (torchModel) {
        torchModel.position.set(fx, fy, 0.68);
        applyShadows(torchModel);
        mapGroup.add(torchModel);
      } else {
        const sconce = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), sconceMat);
        sconce.position.set(fx, fy, 1);
        mapGroup.add(sconce);
      }
      const fz = torchModel ? 1.38 : 1.22;
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), flameMat);
      flame.position.set(fx, fy, fz);
      flame.userData.flame = true;
      flames.push(flame);
      mapGroup.add(flame);
      const lit = new THREE.PointLight(glow, 10, 6.5, 2);
      lit.position.set(bx + adj[0] * 0.6, by + adj[1] * 0.6, fz - 0.05);
      lit.userData.flame = true;
      flames.push(lit);
      mapGroup.add(lit);
    }
  }

  if (map.buildings) {
    const matCache = new Map();
    const paint = hex => {
      if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.95, flatShading: true }));
      return matCache.get(hex);
    };
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 });
    const winMat = new THREE.MeshStandardMaterial({ color: 0xffd8a0, emissive: 0xffa040, emissiveIntensity: 1.8, roughness: 0.3 });
    for (const b of map.buildings) {
      const cx = wx((b.x0 + b.x1) / 2, map.w), cy = wy((b.y0 + b.y1) / 2, map.h);
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      const bodyH = 1.9;
      const body = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.12, bh + 0.12, bodyH), paint(b.wall || "#c8b088"));
      body.position.set(cx, cy, bodyH / 2 + 0.03);
      body.castShadow = true;
      body.receiveShadow = true;
      mapGroup.add(body);
      const rgeo = new THREE.ConeGeometry(1, 1.35, 4);
      rgeo.rotateZ(Math.PI / 4);
      rgeo.rotateX(Math.PI / 2);
      const roof = new THREE.Mesh(rgeo, paint(b.roof));
      const rw = bw + 0.9, rd = bh + 0.9;
      roof.scale.set(rw / 1.414, rd / 1.414, 1);
      roof.position.set(cx, cy, bodyH + 0.7);
      roof.castShadow = true;
      roof.userData.roof = true;
      mapGroup.add(roof);
      const chin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 1.1), paint("#555050"));
      chin.position.set(wx(b.x1 - 1, map.w), wy(b.y0 + 1, map.h), bodyH + 0.7);
      chin.castShadow = true;
      chin.userData.roof = true;
      mapGroup.add(chin);
      // doorway face: [dx, dy] outward + tile coords
      const [dxT, dyT] = b.door;
      const out = b.door[1] === b.y1 ? [0, 1] : b.door[1] === b.y0 ? [0, -1] : b.door[0] === b.x1 ? [1, 0] : [-1, 0];
      const px = wx(dxT, map.w), py = wy(dyT, map.h);
      const along = out[0] !== 0;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.08 : 0.72, along ? 0.72 : 0.08, 1.5), woodMat);
      panel.position.set(px + out[0] * 0.44, py + out[1] * 0.44, 0.78);
      panel.castShadow = true;
      mapGroup.add(panel);
      for (const side of [-1, 1]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.06 : 0.34, along ? 0.34 : 0.06, 0.34), winMat);
        const off = (along ? bh : bw) / 3;
        win.position.set(px + (along ? 0 : out[0] * 0.52) + (along ? side * off : 0),
          py + (along ? out[1] * 0.52 : 0) + (along ? 0 : side * off), 1.28);
        mapGroup.add(win);
      }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 2.4, fog: false }));
      lamp.position.set(px + out[0] * 0.6 + (along ? 0 : 0.5), py + out[1] * 0.6 + (along ? 0.5 : 0), 1.7);
      mapGroup.add(lamp);
      const glow = new THREE.PointLight(0xffb060, 6, 5, 2);
      glow.position.set(px + out[0] * 0.8, py + out[1] * 0.8, 1.6);
      mapGroup.add(glow);
    }
  }
  if (map.stalls) {
    for (const s of map.stalls) {
      const sx = wx(s.x, map.w), sy = wy(s.y, map.h);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.1),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(s.roof), roughness: 0.9 }));
      canopy.position.set(sx, sy, 1.9);
      canopy.castShadow = true;
      mapGroup.add(canopy);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 1 }));
      stripe.position.set(sx, sy + 0.35, 1.83);
      mapGroup.add(stripe);
      for (const [ox, oy] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.9),
          new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 }));
        pole.position.set(sx + ox, sy + oy, 0.95);
        mapGroup.add(pole);
      }
      const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 }));
      table.position.set(sx, sy, 0.62);
      table.castShadow = true;
      mapGroup.add(table);
    }
  }
  if (map.fountain) {
    const fx = wx(map.fountain.x, map.w), fy = wy(map.fountain.y, map.h);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.9 }));
    rim.position.set(fx, fy, 0.28);
    mapGroup.add(rim);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0x4090d0, emissive: 0x103050, emissiveIntensity: 1, roughness: 0.2, metalness: 0.3 }));
    water.rotation.x = Math.PI / 2;
    water.position.set(fx, fy, 0.32);
    water.userData.water = true;
    mapGroup.add(water);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.8 }));
    column.rotation.x = Math.PI / 2;
    column.position.set(fx, fy, 0.5);
    mapGroup.add(column);
  }

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
const SPH = new THREE.SphereGeometry(0.5, 10, 8);
const CAP = new THREE.CapsuleGeometry(0.5, 1, 4, 10);
function part(group, mat, w, h, d, x, y, z, rz = 0) {
  const p = new THREE.Mesh(BOX, mat);
  p.scale.set(w, h, d);
  p.position.set(x, y, z);
  p.rotation.z = rz;
  group.add(p);
  return p;
}
function partS(group, mat, s, x, y, z, sz) {
  const p = new THREE.Mesh(SPH, mat);
  p.scale.set(s, s, sz || s);
  p.position.set(x, y, z);
  group.add(p);
  return p;
}
function partC(group, mat, r, len, x, y, z, axis = "y") {
  const p = new THREE.Mesh(CAP, mat);
  p.scale.set(r / 0.5, (len + 2 * r) / 2, r / 0.5);
  p.position.set(x, y, z);
  if (axis === "z") p.rotation.x = Math.PI / 2;
  if (axis === "x") p.rotation.z = Math.PI / 2;
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
  quadruped: [0.55, 0.44, 0.07, 0.05], spider: [0.4, 0.28, 0.05, 0.035],
  bat: [0.06, 0.74, 0.055, 0.04, 0xff6666], skeleton: [0.13, 0.92, 0.08, 0.05, 0x88ddff],
  float: [0.13, 1.32, 0.1, 0.055, 0xff4060], slab: [0.3, 0.6, 0.08, 0.055, 0xffa030],
  harpy: [0.14, 1.02, 0.08, 0.05], imp: [0.1, 0.64, 0.06, 0.045, 0xff5050],
  tall: [0.14, 1.3, 0.1, 0.055, 0x9fdcff], brute: [0.18, 1.02, 0.11, 0.06],
  biped: [0.15, 0.94, 0.09, 0.05, 0xffee99]
};

// ---------- real GLB models (KayKit packs, CC0 — assets/models/LICENSE-KayKit.txt) ----------
const GLB = {};
const GLB_FILES = {
  Knight: "assets/models/Knight.glb",
  Mage: "assets/models/Mage.glb",
  Rogue: "assets/models/Rogue.glb",
  Barbarian: "assets/models/Barbarian.glb",
  Skeleton_Warrior: "assets/models/Skeleton_Warrior.glb",
  Skeleton_Mage: "assets/models/Skeleton_Mage.glb",
  chest: "assets/models/chest.glb",
  chest_gold: "assets/models/chest_gold.glb",
  torch_lit: "assets/models/torch_lit.glb"
};
const modelStatus = { loaded: {}, failed: [], count: 0, total: Object.keys(GLB_FILES).length, ready: false };
const MODEL_YAW = Math.PI;
function onModelsSettled() {
  if (modelStatus.count < modelStatus.total) return;
  modelStatus.ready = modelStatus.count === modelStatus.total;
  for (const obj of pool.values()) if (obj.parent) obj.parent.remove(obj);
  pool.clear();
  if (playerSprite) { scene.remove(playerSprite); playerSprite = null; }
  loadedKey = null;
}
for (const [name, url] of Object.entries(GLB_FILES)) {
  new GLTFLoader().load(url,
    gltf => { GLB[name] = { scene: gltf.scene, animations: gltf.animations }; modelStatus.loaded[name] = true; modelStatus.count++; onModelsSettled(); },
    undefined,
    () => { modelStatus.failed.push(name); modelStatus.count++; onModelsSettled(); });
}

const pickClip = (anims, patterns) => {
  for (const re of patterns) { const c = anims.find(a => re.test(a.name)); if (c) return c; }
  return anims[0];
};

function modelInstance(name, height, faced) {
  const src = GLB[name];
  if (!src) return null;
  const inner = cloneSkeleton(src.scene);
  if (faced) inner.rotation.y = MODEL_YAW;
  const mats = [];
  inner.traverse(o => {
    if (o.isMesh && o.material) { o.material = o.material.clone(); mats.push(o.material); }
  });
  const rotator = new THREE.Group();
  rotator.rotation.x = Math.PI / 2;
  rotator.add(inner);
  const g = new THREE.Group();
  g.add(rotator);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const s = height / Math.max(0.001, box.max.z - box.min.z);
  g.scale.setScalar(s);
  g.updateMatrixWorld(true);
  rotator.position.z = -new THREE.Box3().setFromObject(g).min.z / s;
  g.userData.model = name;
  g.userData.mats = mats;
  if (faced) g.userData.modelRoot = inner;
  if (src.animations.length) {
    const mixer = new THREE.AnimationMixer(inner);
    const idleClip = pickClip(src.animations, [/^Idle(_B|_C)?$/, /Idle/]);
    const walkClip = pickClip(src.animations, [/^Walking_A$/, /Walking/, /Walk/]);
    const idle = mixer.clipAction(idleClip);
    idle.play();
    const walk = mixer.clipAction(walkClip);
    let moving = false;
    g.userData.setMoving = want => {
      if (!!want === moving) return;
      moving = !!want;
      if (moving) { walk.reset(); walk.play(); walk.crossFadeFrom(idle, 0.18, false); }
      else { idle.reset(); idle.play(); idle.crossFadeFrom(walk, 0.25, false); }
    };
    g.userData.mixer = mixer;
  }
  return g;
}

const MONSTER_MODELS = {
  skeleton: "Skeleton_Warrior", zombie: "Skeleton_Warrior", wendigo: "Skeleton_Warrior",
  wraith: "Skeleton_Mage", banshee: "Skeleton_Mage",
  bandit: "Rogue", goblin: "Barbarian", orc: "Barbarian"
};
const CLASS_MODELS = {
  fighter: "Knight", paladin: "Knight", mage: "Mage", cleric: "Mage",
  thief: "Rogue", ranger: "Barbarian"
};

const SPECIES = {
  rat: { shape: "quadruped", scale: 0.5 }, bat: { shape: "bat", scale: 0.45 },
  wolf: { shape: "quadruped", scale: 1.0 }, goblin: { shape: "biped", scale: 0.65 },
  imp: { shape: "imp", scale: 0.55 }, skeleton: { shape: "skeleton", scale: 1.0 },
  spider: { shape: "spider", scale: 0.85 }, orc: { shape: "brute", scale: 1.2 },
  harpy: { shape: "harpy", scale: 1.0 }, wraith: { shape: "float", scale: 1.0 },
  magma: { shape: "slab", scale: 1.35 }, shade: { shape: "float", scale: 0.95 },
  troll: { shape: "brute", scale: 1.45 }, wendigo: { shape: "tall", scale: 1.3 },
  slime: { shape: "slab", scale: 0.8 }, bandit: { shape: "biped", scale: 0.95 },
  zombie: { shape: "biped", scale: 1.02 }, beetle: { shape: "spider", scale: 0.7 },
  banshee: { shape: "float", scale: 1.05 }, drake: { shape: "quadruped", scale: 1.15 },
  greenpaw: { shape: "brute", scale: 1.7 }, hagraven: { shape: "harpy", scale: 1.5 },
  cinder: { shape: "slab", scale: 1.8 }, hero: { shape: "biped", scale: 1 }
};

function makeVoxel(speciesId, glyph, color, isBoss, proceduralOnly) {
  const byGlyph = { r: "rat", b: "bat", w: "wolf", g: "goblin", i: "imp", Z: "skeleton", x: "spider", o: "orc", h: "harpy", W: "wraith", m: "magma", U: "shade", T: "troll", Y: "wendigo", s: "slime", B: "bandit", z: "zombie", c: "beetle", N: "banshee", D: "drake", "&": "troll" };
  const known = SPECIES[speciesId] || SPECIES[byGlyph[glyph]];
  const modelName = proceduralOnly ? null : (MONSTER_MODELS[speciesId] || MONSTER_MODELS[byGlyph[glyph]]);
  if (modelName && GLB[modelName]) {
    const m = modelInstance(modelName, (known ? known.scale : 1) * (isBoss ? 1.25 : 1) * 1.25, true);
    if (m) {
      if (known && known.shape === "float") m.userData.floats = true;
      applyShadows(m);
      return m;
    }
  }
  const sp = known || { shape: isBoss ? "brute" : "biped", scale: isBoss ? 1.7 : 1 };
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.6), roughness: 0.7 });
  const light = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), roughness: 0.5 });
  const head = p => { p.userData.head = true; return p; };
  switch (sp.shape) {
    case "quadruped":
      partC(g, mat, 0.17, 0.3, 0, 0, 0.35);
      head(partS(g, mat, 0.3, 0, 0.42, 0.42));
      part(g, dark, 0.12, 0.1, 0.1, 0, 0.55, 0.5);
      part(g, dark, 0.06, 0.12, 0.06, -0.09, 0.44, 0.58);
      part(g, dark, 0.06, 0.12, 0.06, 0.09, 0.44, 0.58);
      for (const [lx, ly] of [[-0.12, -0.16], [0.12, -0.16], [-0.12, 0.18], [0.12, 0.18]])
        partC(g, dark, 0.045, 0.14, lx, ly, 0.12, "z");
      part(g, dark, 0.05, 0.35, 0.05, 0, -0.42, 0.35, 0.5);
      break;
    case "spider":
      partS(g, mat, 0.38, 0, 0, 0.26, 0.26);
      head(partS(g, mat, 0.22, 0, 0.3, 0.26));
      for (let leg = 0; leg < 8; leg++) {
        const side = leg % 2 ? 1 : -1, along = (leg >> 1) - 1.5;
        part(g, dark, 0.5, 0.05, 0.05, side * 0.32, along * 0.14, 0.18, side * 0.5);
      }
      break;
    case "bat":
      partS(g, mat, 0.24, 0, 0, 0.5);
      head(partS(g, mat, 0.16, 0, 0, 0.72));
      part(g, dark, 0.62, 0.06, 0.34, -0.38, 0, 0.58, 0.35);
      part(g, dark, 0.62, 0.06, 0.34, 0.38, 0, 0.58, -0.35);
      break;
    case "skeleton":
      partC(g, mat, 0.11, 0.3, 0, 0, 0.46);
      head(partS(g, light, 0.3, 0, 0, 0.9));
      part(g, mat, 0.34, 0.05, 0.16, 0, 0, 0.55);
      part(g, mat, 0.3, 0.05, 0.14, 0, 0, 0.68);
      partC(g, mat, 0.04, 0.36, -0.24, 0, 0.45, "z");
      partC(g, mat, 0.04, 0.36, 0.24, 0, 0.45, "z");
      partC(g, mat, 0.045, 0.34, -0.09, 0, 0.1, "z");
      partC(g, mat, 0.045, 0.34, 0.09, 0, 0.1, "z");
      part(g, dark, 0.24, 0.1, 0.1, 0, 0, 0.74);
      break;
    case "float": {
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 10), mat);
      robe.rotation.x = Math.PI / 2;
      robe.position.set(0, 0, 0.68);
      g.add(robe);
      head(partS(g, mat, 0.28, 0, 0, 1.3));
      partC(g, dark, 0.05, 0.24, -0.26, 0, 0.95, "z").rotation.y = 0.5;
      partC(g, dark, 0.05, 0.24, 0.26, 0, 0.95, "z").rotation.y = -0.5;
      break;
    }
    case "slab":
      partS(g, mat, 0.85, 0, 0, 0.28, 0.32);
      part(g, light, 0.6, 0.35, 0.1, 0, 0, 0.5);
      head(partS(g, mat, 0.24, 0, 0.25, 0.6));
      part(g, light, 0.7, 0.1, 0.1, 0, -0.25, 0.32);
      break;
    case "harpy":
      partC(g, mat, 0.14, 0.24, 0, 0, 0.62, "z");
      head(partS(g, light, 0.28, 0, 0, 1));
      part(g, dark, 0.7, 0.08, 0.4, -0.42, 0, 0.75, 0.4);
      part(g, dark, 0.7, 0.08, 0.4, 0.42, 0, 0.75, -0.4);
      partC(g, dark, 0.04, 0.26, -0.08, 0, 0.2, "z");
      partC(g, dark, 0.04, 0.26, 0.08, 0, 0.2, "z");
      part(g, light, 0.14, 0.12, 0.12, 0, 0.18, 1.05);
      break;
    case "imp":
      partS(g, mat, 0.22, 0, 0, 0.34);
      head(partS(g, mat, 0.2, 0, 0, 0.62));
      part(g, dark, 0.06, 0.2, 0.06, 0, 0, 0.8);
      part(g, dark, 0.4, 0.05, 0.24, -0.26, 0, 0.45, 0.45);
      part(g, dark, 0.4, 0.05, 0.24, 0.26, 0, 0.45, -0.45);
      partC(g, dark, 0.035, 0.18, -0.07, 0, 0.1, "z");
      partC(g, dark, 0.035, 0.18, 0.07, 0, 0.1, "z");
      break;
    case "tall":
      partC(g, mat, 0.14, 0.42, 0, 0, 0.78, "z");
      head(partS(g, light, 0.3, 0, 0, 1.28));
      {
        const lh = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.34, 6), dark);
        lh.rotation.z = 1.1; lh.position.set(-0.14, 0, 1.46); g.add(lh);
        const rh = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.34, 6), dark);
        rh.rotation.z = -1.1; rh.position.set(0.14, 0, 1.46); g.add(rh);
      }
      part(g, dark, 0.3, 0.1, 0.3, 0, 0, 1.08);
      partC(g, mat, 0.04, 0.44, -0.1, 0, 0.28, "z");
      partC(g, mat, 0.04, 0.44, 0.1, 0, 0.28, "z");
      partC(g, dark, 0.04, 0.5, -0.22, 0, 1.0, "z").rotation.y = 0.3;
      partC(g, dark, 0.04, 0.5, 0.22, 0, 1.0, "z").rotation.y = -0.3;
      break;
    case "brute":
      partC(g, mat, 0.24, 0.24, 0, 0, 0.52, "z");
      head(partS(g, mat, 0.34, 0, 0, 1));
      part(g, dark, 0.16, 0.14, 0.16, 0, 0.2, 1.1);
      partS(g, dark, 0.2, -0.32, 0, 0.64);
      partS(g, dark, 0.2, 0.32, 0, 0.64);
      partC(g, dark, 0.09, 0.28, -0.42, 0, 0.48, "z");
      partC(g, dark, 0.09, 0.28, 0.42, 0, 0.48, "z");
      partC(g, dark, 0.1, 0.2, -0.13, 0, 0.18, "z");
      partC(g, dark, 0.1, 0.2, 0.13, 0, 0.18, "z");
      break;
    default:
      partC(g, mat, 0.16, 0.24, 0, 0, 0.46, "z");
      head(partS(g, mat, 0.36, 0, 0, 0.92));
      part(g, dark, 0.09, 0.16, 0.09, -0.11, 0.1, 1.1);
      part(g, dark, 0.09, 0.16, 0.09, 0.11, 0.1, 1.1);
      partC(g, dark, 0.055, 0.2, -0.1, 0, 0.14, "z");
      partC(g, dark, 0.055, 0.2, 0.1, 0, 0.14, "z");
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
  const mats = new Set();
  g.traverse(o => {
    if (o.isMesh && !o.userData.noShadow) {
      o.castShadow = true;
      if (o.material && !o.material.emissiveIntensity) mats.add(o.material);
    }
  });
  g.userData.mats = [...mats];
}
function addBlobShadow(g, r) {
  const blob = new THREE.Mesh(new THREE.CircleGeometry(r, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  blob.position.z = 0.02;
  blob.userData.noShadow = true;
  g.add(blob);
}

function makeProp(e, dims) {
  const g = new THREE.Group();
  const chestModel = e.locked ? "chest_gold" : "chest";
  if (e.kind === "chest" && GLB[chestModel]) {
    const m = modelInstance(chestModel, 0.52);
    if (m) { addBlobShadow(m, 0.42); applyShadows(m); return m; }
  }
  if (e.kind === "chest") {
    const wood = new THREE.MeshStandardMaterial({ color: e.locked ? 0x6a4326 : 0x7a5230, roughness: 0.9, flatShading: true });
    const band = new THREE.MeshStandardMaterial({ color: e.locked ? 0xc0502a : 0xd8b040, metalness: 0.6, roughness: 0.4 });
    part(g, wood, 0.78, 0.52, 0.44, 0, 0, 0.26);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.76, 8, 1, false, 0, Math.PI), wood);
    lid.rotation.z = Math.PI / 2;
    lid.position.set(0, 0, 0.5);
    g.add(lid);
    part(g, band, 0.12, 0.56, 0.5, 0, 0, 0.3);
    if (e.locked) part(g, band, 0.14, 0.16, 0.12, 0, 0.3, 0.36);
  } else {
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.95, flatShading: true });
    const iron = new THREE.MeshStandardMaterial({ color: e.locked ? 0xc05028 : 0x808890, metalness: 0.7, roughness: 0.4 });
    part(g, wood, 0.2, 0.86, 1.5, 0, 0, 0.8);
    part(g, iron, 0.24, 0.94, 0.12, 0, 0, 0.28);
    part(g, iron, 0.24, 0.94, 0.12, 0, 0, 1.32);
    part(g, iron, 0.24, 0.12, 1.5, 0, -0.42, 0.8);
    part(g, iron, 0.24, 0.12, 1.5, 0, 0.42, 0.8);
    if (e.locked) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 12), iron);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(0.16, 0, 0.78);
      g.add(ring);
    }
  }
  addBlobShadow(g, 0.42);
  applyShadows(g);
  return g;
}

function makePlayerVoxel(classId, color) {
  const modelName = CLASS_MODELS[classId];
  if (modelName && GLB[modelName]) {
    const m = modelInstance(modelName, 1.4, true);
    if (m) { addBlobShadow(m, 0.36); applyShadows(m); return m; }
  }
  const g = makeVoxel("hero", "@", color);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8d8e8, roughness: 0.4, metalness: 0.5 });
  const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.8 });
  part(g, cloth, 0.44, 0.1, 0.3, 0, 0, 0.3);
  part(g, cloth, 0.13, 0.13, 0.32, -0.1, 0, 0.15);
  part(g, cloth, 0.13, 0.13, 0.32, 0.1, 0, 0.15);
  if (classId === "fighter") {
    partS(g, mat, 0.15, -0.27, 0, 0.64);
    partS(g, mat, 0.15, 0.27, 0, 0.64);
    part(g, mat, 0.09, 0.09, 0.7, 0.34, 0, 0.62);
    part(g, mat, 0.16, 0.3, 0.02, -0.34, 0.16, 0.55);
    part(g, mat, 0.38, 0.1, 0.38, 0, 0, 1.14);
  } else if (classId === "mage") {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 6), cloth);
    hat.rotation.x = Math.PI / 2;
    hat.position.set(0, 0, 1.36);
    g.add(hat);
    partS(g, mat, 0.2, 0, 0, 1.66);
    part(g, mat, 0.06, 0.06, 0.8, 0.34, 0, 0.66);
  } else {
    part(g, cloth, 0.5, 0.5, 0.34, 0, 0, 0.28);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), mat);
    halo.position.set(0, 0, 1.3);
    g.add(halo);
    part(g, mat, 0.07, 0.07, 0.55, -0.32, 0, 0.58);
    partS(g, mat, 0.16, -0.32, 0, 0.92);
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
    if (e.kind === "chest" || e.kind === "door") {
      const key = "prop:" + loadedKey + ":" + e.kind + ":" + (e.locked ? "l" : "o") + ":" + e.x + "," + e.y;
      seen.add(key);
      const vis = visibleSet.has(e.x + "," + e.y);
      if (!pool.has(key)) {
        pool.set(key, makeProp(e, mapDims));
        const g = pool.get(key);
        g.position.set(wx(e.x, mapDims.w), wy(e.y, mapDims.h), 0);
        entityGroup.add(g);
      }
      pool.get(key).visible = vis;
      continue;
    }
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
      if (c) {
        c.visible = visibleSet.has(e.x + "," + e.y);
        if (c.visible && e.kind === "item") {
          c.position.z = 0.7 + 0.07 * Math.sin(t * 2.6 + e.x + e.y);
          c.material.rotation = Math.sin(t * 1.4 + e.x) * 0.1;
        }
      }
      continue;
    }
    if (e.kind !== "monster") continue;
    const key = "mon:" + e.uid;
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
      g.position.set(wx(e.x, mapDims.w), wy(e.y, mapDims.h), 0);
      if (e.facing) g.rotation.z = Math.atan2(-e.facing.dx, e.facing.dy);
      pool.set(key, g);
    }
    const g = pool.get(key);
    g.visible = vis;
    if (!vis) continue;
    const tx = wx(e.x, mapDims.w), ty = wy(e.y, mapDims.h);
    const step = Math.min(1, 0.45);
    g.position.x += (tx - g.position.x) * step;
    g.position.y += (ty - g.position.y) * step;
    if (Math.abs(g.position.x - tx) < 0.01) g.position.x = tx;
    if (Math.abs(g.position.y - ty) < 0.01) g.position.y = ty;
    g.userData.setMoving?.(Math.abs(tx - g.position.x) + Math.abs(ty - g.position.y) > 0.03);
    g.position.z = g.userData.floats ? 0.35 + 0.1 * Math.sin(t * 2.2 + e.x) : 0;
    const bar = g.userData.bar;
    bar.visible = e.hp < e.maxHp;
    bar.scale.x = Math.max(0.05, e.hp / e.maxHp);
    if (e.facing) {
      const target = Math.atan2(-e.facing.dx, e.facing.dy);
      let d = target - g.rotation.z;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.rotation.z += d * 0.3;
    }
    if ((g.userData.lastHp ?? e.hp) > e.hp) g.userData.flashUntil = t + 0.35;
    g.userData.lastHp = e.hp;
    const flashing = t < (g.userData.flashUntil || 0);
    if (flashing !== g.userData.flashOn) {
      g.userData.flashOn = flashing;
      for (const m of g.userData.mats || []) {
        m.emissive.setHex(flashing ? 0x903020 : 0x000000);
      }
    }
  }
  for (const [key, obj] of pool) {
    if (!seen.has(key)) { entityGroup.remove(obj); pool.delete(key); }
  }
  if (!playerSprite) {
    playerSprite = makePlayerVoxel(core.player.classId, CLASSES[core.player.classId].color);
    playerSprite.userData.voxel = true;
    const pf0 = core.player.facing || { dx: 1, dy: 0 };
    playerSprite.rotation.z = Math.atan2(-pf0.dx, pf0.dy);
    scene.add(playerSprite);
  }
  const ppx = wx(core.player.x, mapDims.w), ppy = wy(core.player.y, mapDims.h);
  if (Math.abs(playerSprite.position.x - ppx) + Math.abs(playerSprite.position.y - ppy) > 0.02)
    playerSprite.userData.moveUntil = t + 0.55;
  playerSprite.position.set(ppx, ppy, 0);
  playerSprite.userData.setMoving?.(t < (playerSprite.userData.moveUntil || 0));
  const pf = core.player.facing || { dx: 1, dy: 0 };
  const pTarget = Math.atan2(-pf.dx, pf.dy);
  let pd = pTarget - playerSprite.rotation.z;
  pd = Math.atan2(Math.sin(pd), Math.cos(pd));
  playerSprite.rotation.z += pd * 0.55;
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
  const shopOpen = el("shop").style.display === "block";
  inv.innerHTML = "<h3>Pack</h3>" + s.player.bag.map(it => {
    let btn = "";
    if (["weapon", "armor", "trinket"].includes(it.kind)) btn = `<button data-act="equip" data-uid="${it.uid}">Equip</button>`;
    if (it.kind === "potion" || it.kind === "book" || it.kind === "scroll-identify")
      btn += ` <button data-act="use" data-uid="${it.uid}">Use</button>`;
    if (["weapon", "armor", "trinket"].includes(it.kind) && it.ident === false)
      btn += ` <button data-act="identify" data-uid="${it.uid}">Identify</button>`;
    btn += ` <button data-act="drop" data-uid="${it.uid}">Drop</button>`;
    if (shopOpen) btn += ` <button data-act="sell" data-uid="${it.uid}">Sell</button>`;
    const ic = it.icon ? `<img src="assets/img/${it.icon}.png" class="ic" style="filter: invert(1);">` : it.glyph;
    return `<div class="row" style="color:${it.color}">${ic} ${it.label} ${btn}</div>`;
  }).join("") || "<div class='row'>empty</div>";
}
function renderShop() {
  const sh = el("shop");
  if (sh.style.display !== "block") return;
  const vendor = core.nearbyVendor();
  if (!vendor) return;
  sh.innerHTML = `<h3>${VENDORS[vendor.npcId].name}</h3>` + SHOP.filter(g => g.vendor === vendor.npcId).map(g =>
    `<div class="row" style="color:#e8d090">${g.name} — ${g.price}g <button data-act="buy" data-key="${g.key}">Buy</button></div>`).join("") +
    `<div class="row" style="color:#889">Sell from your Pack (I) — unidentified goods fetch a scrap.</div>`;
}
el("shop").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.act === "buy") core.act({ type: "buy", key: b.dataset.key });
  afterAction();
});
el("inv").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const uid = Number(b.dataset.uid);
  if (b.dataset.act === "equip") core.act({ type: "equip", uid });
  else if (b.dataset.act === "drop") core.act({ type: "drop", uid });
  else if (b.dataset.act === "sell") core.act({ type: "sell", uid });
  else if (b.dataset.act === "identify") core.act({ type: "identify", uid });
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
    if (playerSprite) { scene.remove(playerSprite); playerSprite = null; }
    for (const obj of pool.values()) if (obj.parent) obj.parent.remove(obj);
    pool.clear();
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
    else if (e.kind === "chest") dot(e.x, e.y, e.locked ? "#d06030" : "#e0b040", Math.max(2, s * 0.5));
    else if (e.kind === "door") dot(e.x, e.y, "#b06060", Math.max(2, s * 0.5));
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
  el("shop").style.display = core.nearbyVendor() ? "block" : "none";
  renderShop();
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
  else if (e.key === "<" || e.key === ",") { core.act({ type: "ascend" }); afterAction(); }
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
  const sec = performance.now() / 1000;
  const mdt = Math.min(0.06, sec - (loop.lastSec ?? sec));
  loop.lastSec = sec;
  for (const g of pool.values()) if (g.userData.mixer) g.userData.mixer.update(mdt);
  if (playerSprite?.userData.mixer) playerSprite.userData.mixer.update(mdt);
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
  for (const f of flames) {
    if (f.isPointLight) f.intensity = 9 + 3 * Math.sin(tsec * 9 + f.position.x * 3) + 2 * Math.sin(tsec * 17 + f.position.y);
    else f.scale.setScalar(0.85 + 0.3 * Math.sin(tsec * 9 + f.position.x * 3));
  }
  composer.render();
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
  create: (c, r, n) => {
    core.start(c, r, n); loadedKey = null;
    if (playerSprite) { scene.remove(playerSprite); playerSprite = null; }
    for (const obj of pool.values()) if (obj.parent) obj.parent.remove(obj);
    pool.clear();
    afterAction(); return core.status();
  },
  status: () => core.status(),
  act: a => core.act(a),
  travel: (t, tier) => { core.act({ type: "travel", target: t, tier }); afterAction(); },
  descend: () => { core.act({ type: "descend" }); afterAction(); },
  ascend: () => { core.act({ type: "ascend" }); afterAction(); },
  heroAngle: () => playerSprite ? playerSprite.rotation.z : null,
  setBloom: s => { bloomPass.strength = s; return bloomPass.strength; },
  debugPost: () => ({
    rtType: composer.renderTarget1.texture.type,
    rtFilter: composer.renderTarget1.texture.magFilter,
    bloomRes: [bloomPass.resolution.x, bloomPass.resolution.y],
    strength: bloomPass.strength, threshold: bloomPass.threshold,
    gl2: renderer.capabilities.isWebGL2,
    dpr: renderer.getPixelRatio(),
    passes: composer.passes.map(p => p.constructor.name),
    halfFloat: !!renderer.extensions.has("EXT_color_buffer_float")
  }),
  interact: () => { core.act({ type: "interact" }); afterAction(); },
  stepTowards: (x, y) => { const r = core.stepTowards(x, y); afterAction(); return r; },
  monsters: () => core.monstersNear(),
  items: () => core.itemsOnMap(),
  stairs: () => core.stairsPos(),
  layoutCount: m => core.layoutCount(m),
  saveGame, tryContinue,
  debugVoxel: id => {
    const g = makeVoxel(id, "", "#ffffff", false, true);
    return { species: g.userData.species, parts: g.children.length, scale: g.scale.x };
  },
  debugModels: () => ({ ...modelStatus }),
  heroForward: () => {
    const root = playerSprite?.userData.modelRoot;
    if (!root) return null;
    playerSprite.updateWorldMatrix(true, true);
    const q = new THREE.Quaternion();
    root.getWorldQuaternion(q);
    const v = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) };
  },
  debugModelFor: id => {
    const g = makeVoxel(id, "", "#888888");
    return { model: g.userData.model || null, animated: !!g.userData.mixer };
  },
  debugSceneModels: () => {
    const names = [];
    let hero = null, animated = 0, meshes = 0;
    if (playerSprite?.userData.model) { hero = playerSprite.userData.model; if (playerSprite.userData.mixer) animated++; }
    for (const g of pool.values()) {
      if (g.userData.model) { names.push(g.userData.model); if (g.userData.mixer) animated++; }
      g.traverse(o => { if (o.isMesh) meshes++; });
    }
    return { hero, sceneModels: names, animated, meshes };
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
