// RogueMS web client: Three.js rogue-style renderer + DOM HUD. All rules in core.js.

import * as THREE from "three";
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
document.getElementById("scene").appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x9999bb, 0.9));
const torch = new THREE.PointLight(0xffc880, 60, 18, 2);
scene.add(torch);
const moon = new THREE.DirectionalLight(0x8899ff, 0.6);
moon.position.set(-10, -14, 20);
scene.add(moon);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

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
  scene.fog.color.set(outdoor ? 0x7d9cc0 : 0x05060c);
  scene.background.set(outdoor ? 0x8fb0d8 : 0x05060c);
  moon.intensity = outdoor ? 1.4 : 0.6;
  floorIndex = new Map(); wallIndex = new Map();
  floors.forEach((f, i) => floorIndex.set(f.x + "," + f.y, i));
  walls.forEach((f, i) => wallIndex.set(f.x + "," + f.y, i));

  const theme = map.kind === "town" ? "town" : map.mapId;
  const fgeo = new THREE.BoxGeometry(TILE * 0.98, TILE * 0.98, 0.12);
  const fmat = new THREE.MeshStandardMaterial({ map: tileTexture("floor", theme), roughness: 0.95 });
  floorMesh = new THREE.InstancedMesh(fgeo, fmat, Math.max(floors.length, 1));
  floorMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(floors.length, 1) * 3), 3);
  const m = new THREE.Matrix4();
  floors.forEach((f, i) => {
    m.makeTranslation(wx(f.x, map.w), wy(f.y, map.h), 0);
    floorMesh.setMatrixAt(i, m);
  });
  mapGroup.add(floorMesh);

  const wgeo = new THREE.BoxGeometry(TILE * 0.98, TILE * 0.98, 1.2);
  const wmat = new THREE.MeshStandardMaterial({ map: tileTexture("wall", theme), roughness: 0.8, emissive: 0x0c0e1c, emissiveIntensity: 0.35 });
  wallMesh = new THREE.InstancedMesh(wgeo, wmat, Math.max(walls.length, 1));
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
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x6a5f4a, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.15), stepMat);
      step.position.set(wx(map.stairs.x, map.w), wy(map.stairs.y, map.h), 0.15 + i * 0.15);
      stairsGroup.add(step);
    }
    const glow = new THREE.PointLight(0xffb060, 4, 4);
    glow.position.set(wx(map.stairs.x, map.w), wy(map.stairs.y, map.h), 1.5);
    stairsGroup.add(glow);
    mapGroup.add(stairsGroup);
    mapGroup.userData.stairsGroup = stairsGroup;
  }
}

const floorLit = new THREE.Color(0x2c4436), floorDim = new THREE.Color(0x15201a);
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
    floorMesh.setColorAt(i, vis ? floorLit : floorDim);
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

// ---------- entity sprites ----------

let entityGroup = null;
let playerSprite = null;

function rebuildEntities() {
  if (entityGroup) scene.remove(entityGroup);
  entityGroup = new THREE.Group();
  scene.add(entityGroup);
  if (!core.player) return;
  for (const e of core.entities()) {
    if (!visibleSet.has(e.x + "," + e.y)) continue;
    const s = sprite(e, e.kind === "stairs" ? 1.15 : 0.9);
    s.position.set(wx(e.x, mapDims.w), wy(e.y, mapDims.h), 0.7);
    if (e.kind === "monster" && e.hp < e.maxHp) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * (e.hp / e.maxHp), 0.07),
        new THREE.MeshBasicMaterial({ color: 0xff4040 }));
      bar.position.set(wx(e.x, mapDims.w), wy(e.y, mapDims.h) + 0.55, 0.75);
      entityGroup.add(bar);
    }
    s.userData.label = e.name;
    entityGroup.add(s);
  }
  if (!playerSprite) {
    playerSprite = sprite({ icon: CLASSES[core.player.classId].icon, glyph: "@", color: CLASSES[core.player.classId].color }, 1);
    scene.add(playerSprite);
  }
  playerSprite.position.set(wx(core.player.x, mapDims.w), wy(core.player.y, mapDims.h), 0.7);
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
    const ic = it.icon ? `<img src="assets/img/${it.icon}.png" class="ic" style="filter: invert(1);">` : it.glyph;
    return `<div class="row" style="color:${it.color}">${ic} ${it.label} ${btn}</div>`;
  }).join("") || "<div class='row'>empty</div>";
}
el("inv").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const uid = Number(b.dataset.uid);
  if (b.dataset.act === "equip") core.act({ type: "equip", uid });
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
  saveGame();
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
  if (core.dead) { if (e.key === "Enter") { core.act({ type: "revive" }); afterAction(); } return; }
  if (MOVE[e.key]) { core.act({ type: "move", dx: MOVE[e.key][0], dy: MOVE[e.key][1] }); afterAction(); e.preventDefault(); }
  else if (e.key === "." || e.key === "5") { core.act({ type: "move", dx: 0, dy: 0 }); afterAction(); }
  else if (e.key === "e" || e.key === "E") { core.act({ type: "interact" }); afterAction(); }
  else if (e.key === ">" || e.key === ">") { core.act({ type: "descend" }); afterAction(); }
  else if (e.key === "i" || e.key === "I") { el("inv").classList.toggle("open"); renderHud(); }
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
  renderer.render(scene, camera);
}
loop();

// ---------- test API (used by scripts/verify.mjs and future clients) ----------

window.game = {
  ready: true,
  core,
  debugScene: () => mapGroup,
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
  hasSave: () => !!localStorage.getItem(Core.SAVE_KEY),
  equip: uid => core.act({ type: "equip", uid }),
  useItem: uid => core.act({ type: "useItem", uid }),
  afterAction
};
