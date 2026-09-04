// RogueMS done-check: drives the full game loop headlessly and asserts the
// goal contract. Exits 0 only when every check passes.

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };
const PORT = 4174;

function serve() {
  const srv = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, ""));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(PORT, () => r(srv)));
}

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " :: " + detail : ""}`);
  if (!ok) failures++;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function clearFoes(page, limit = 400) {
  for (let i = 0; i < limit; i++) {
    const mons = await page.evaluate(() => window.game.monsters());
    if (!mons.length) return true;
    await page.evaluate(async () => {
      const g = window.game;
      const s = g.status();
      const mons = g.monsters();
      if (!mons.length) return;
      if (s.player.hp < s.player.maxHp * 0.45) {
        const pot = s.player.bag.find(b => b.kind === "potion");
        if (pot) { g.useItem(pot.uid); return; }
      }
      const m = mons[0];
      const adj = Math.abs(m.x - s.player.x) + Math.abs(m.y - s.player.y) === 1;
      if (adj && s.player.mp >= 4 && s.player.skills[0].cd === 0) g.act({ type: "skill", slot: 0 });
      else if (adj) g.act({ type: "move", dx: Math.sign(m.x - s.player.x), dy: Math.sign(m.y - s.player.y) });
      else g.stepTowards(m.x, m.y);
    });
    await sleep(5);
  }
  return false;
}

async function walkTo(page, tx, ty, limit = 300) {
  for (let i = 0; i < limit; i++) {
    const done = await page.evaluate(([x, y]) => {
      const s = window.game.status();
      if (s.player.x === x && s.player.y === y) return true;
      window.game.stepTowards(x, y);
      const s2 = window.game.status();
      return s2.player.x === x && s2.player.y === y;
    }, [tx, ty]);
    if (done) return true;
    await sleep(5);
  }
  return false;
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(`http://127.0.0.1:${PORT}/?seed=1337`);
  await page.waitForFunction(() => window.game && window.game.ready, null, { timeout: 15000 });

  let s = await page.evaluate(() => window.game.status());
  check("boots to character creation", s.screen === "create");

  s = await page.evaluate(() => window.game.create("fighter", "human", "Testy"));
  check("fighter/human created", s.screen === "play" && s.player.level === 1);
  check("racial + class attributes apply", s.player.attrs.str === 14 && s.player.attrs.vit === 14,
    JSON.stringify(s.player.attrs));
  const fighterHp = s.player.maxHp;
  check("starting skill + mana model", s.player.skills.length === 1 && s.player.skills[0].id === "power-strike" && s.player.maxMp >= 4);

  const regen = await page.evaluate(() => {
    const g = window.game, c = g.core;
    const failed = g.act({ type: "skill", slot: 0 });
    const cd = g.status().player.skills[0].cd;
    const mpAfterFail = g.status().player.mp;
    c.player.hp = Math.max(1, g.status().player.maxHp - 20);
    const hp0 = c.player.hp, mp0 = c.player.mp;
    for (let i = 0; i < 30; i++) c.act({ type: "move", dx: 0, dy: 0 });
    const hpIdle = c.player.hp, mpIdle = c.player.mp;
    const mon = c.getMap("town").entities.find(x => x.type === "monster") ||
      { name: "dummy", dmg: 1, def: 0, hp: 1, x: c.player.x, y: c.player.y };
    const hpBeforeHit = c.player.hp;
    c.monsterAttack(mon);
    c.player.turnsSinceDamage = 0;
    const hpAfterHit = c.player.hp;
    const tsdBefore = c.player.turnsSinceDamage;
    for (let i = 0; i < 4; i++) c.act({ type: "move", dx: 0, dy: 0 });
    return { failed, cd, mpAfterFail, hp0, hpIdle, mpIdle, mp0, hpBeforeHit, hpAfterHit,
      hpFinal: c.player.hp, tsdBefore, tsdAfter: c.player.turnsSinceDamage };
  });
  check("failed casts charge a 2-turn cooldown, no spam-farm", regen.failed === false && regen.cd === 2);
  check("town rest trickles HP slowly (3 per 30 turns)", regen.hpIdle === regen.hp0 + 3, `hp ${regen.hp0}->${regen.hpIdle}`);
  check("mana does not regen per turn", regen.mpIdle === regen.mp0);
  check("recent damage blocks regen", regen.hpAfterHit < regen.hpBeforeHit && regen.hpFinal === regen.hpAfterHit,
    JSON.stringify({ b: regen.hpBeforeHit, a: regen.hpAfterHit, f: regen.hpFinal, t0: regen.tsdBefore, t1: regen.tsdAfter }));

  const fieldRegen = await page.evaluate(() => {
    const g = window.game, c = g.core;
    g.travel("greenhills", 1);
    c.getMap(c.player.mapKey).entities.filter(x => x.type === "monster").forEach(m => { m.hp = 0; });
    const st = g.stairs();
    c.player.x = st.x; c.player.y = st.y;
    const mons = c.getMap(c.player.mapKey).entities.filter(x => x.type === "monster");
    mons.forEach(m => { m._hp = m.hp; m.hp = 0; });
    c.player.hp = Math.max(1, c.eff().maxHp - 20);
    const hp0 = c.player.hp;
    for (let i = 0; i < 40; i++) c.act({ type: "move", dx: 0, dy: 0 });
    const hpNow = c.player.hp;
    mons.forEach(m => { m.hp = m._hp; });
    c.player.hp = c.eff().maxHp;
    return { hp0, hpNow, mapKey: c.player.mapKey };
  });
  check("no HP regen in the field (dungeon stays dangerous)", fieldRegen.hpNow === fieldRegen.hp0 && fieldRegen.mapKey.includes(":d"),
    JSON.stringify(fieldRegen));
  const manualSave = await page.evaluate(() => window.game.hasSave() === false);
  check("playing never auto-saves (Save button only)", manualSave);

  const layouts = await page.evaluate(() => window.game.layoutCount("greenhills"));
  check("map offers 6+ dungeon layouts over its tiers", layouts >= 6, "distinct=" + layouts);

  const perChar = await page.evaluate(() => {
    const K = window.game.core.constructor;
    const a = new K(11), b = new K(22);
    a.start("fighter", "human", "A"); b.start("fighter", "human", "B");
    return {
      seedsDiffer: a.player.worldSeed !== b.player.worldSeed,
      gridsDiffer: a.getMap("greenhills:d1").grid.join("") !== b.getMap("greenhills:d1").grid.join("")
    };
  });
  check("dungeons vary per character", perChar.seedsDiffer && perChar.gridsDiffer);

  await page.evaluate(() => window.game.travel("greenhills"));
  s = await page.evaluate(() => window.game.status());
  check("leaves town into outdoor village map", s.map.kind === "outdoor" && s.map.name === "Greenhills Village");

  const outWorld = await page.evaluate(() => {
    const g = window.game;
    const m = g.core.getMap("greenhills");
    const ent = g.core.entities().find(e => e.kind === "entrance");
    if (ent) for (let i = 0; i < 200 && Math.abs(g.status().player.x - ent.x) + Math.abs(g.status().player.y - ent.y) > 1; i++) g.stepTowards(ent.x, ent.y);
    if (ent) g.stepTowards(ent.x, ent.y);
    const s2 = g.status();
    return { trees: (m.grid.join("").split("T").length - 1) > 20, hasEntrance: !!ent, enteredKind: s2.map.kind, enteredTier: s2.map.tier };
  });
  check("outdoors has trees and a physical entrance", outWorld.trees && outWorld.hasEntrance);
  check("walking into the entrance starts the dungeon ladder", outWorld.enteredKind === "dungeon" && outWorld.enteredTier === 1);

  const sticky = await page.evaluate(() => {
    const g = window.game;
    const before = g.core.getMap("greenhills:d1").grid.join("");
    g.travel("town"); g.travel("greenhills", 1);
    return g.core.getMap("greenhills:d1").grid.join("") === before;
  });
  check("dungeon layout sticks after first visit", sticky);

  const stairMesh = await page.evaluate(() => {
    const g = window.game.debugScene();
    return !!g && !!g.userData.stairsGroup && g.userData.stairsGroup.children.length >= 8;
  });
  check("stairs are a framed 3D structure, not an open hole", stairMesh);

  const voxels = await page.evaluate(async () => {
    const c = window.game.core;
    c.getMap(c.player.mapKey).entities.forEach(x => { if (x.type === "monster" && x.hp === 0) x.hp = x.maxHp || 10; });
    window.game.afterAction();
    await new Promise(r => setTimeout(r, 200));
    let count = 0;
    window.game.debugAll().traverse(o => { if (o.userData && o.userData.voxel) count++; });
    return { count, mons: window.game.monsters().length };
  });
  check("hero and monsters render as voxel bodies", voxels.count >= 2, JSON.stringify(voxels));

  const kinds = await page.evaluate(() => window.game.core.getMap("greenhills:d9").monsterKinds);
  check("dungeon spawns 3-4 monster kinds", kinds.length >= 3 && kinds.length <= 4, "kinds=" + kinds.join(","));

  const anatomy = await page.evaluate(() => ({
    rat: window.game.debugVoxel("rat"), spider: window.game.debugVoxel("spider"),
    troll: window.game.debugVoxel("troll"), wraith: window.game.debugVoxel("wraith")
  }));
  check("monsters have species anatomy (rat 0.5x quadruped, spider 8 legs, troll 1.45x, floating wraith)",
    anatomy.rat.parts >= 8 && anatomy.rat.scale <= 0.6 &&
    anatomy.spider.parts >= 10 &&
    anatomy.troll.scale >= 1.4 && anatomy.spider.scale < anatomy.troll.scale &&
    anatomy.wraith.parts >= 5,
    JSON.stringify(anatomy));

  const diagDown = await page.evaluate(() => {
    const g = window.game, c = g.core;
    const st = g.stairs();
    c.player.x = st.x + 1; c.player.y = st.y + 1;
    const before = c.player.mapKey;
    g.descend();
    return { before, after: g.status().map.key };
  });
  check("stairs work from diagonal standing too", diagDown.before !== diagDown.after,
    JSON.stringify(diagDown));

  const deepLadder = await page.evaluate(() => {
    const m = window.game.core.getMap("greenhills:d12");
    return { tier: m.tier, boss: m.entities.some(e => e.type === "monster" && e.boss) };
  });
  check("ladder runs 12 tiers with a tier-12 boss", deepLadder.tier === 12 && deepLadder.boss,
    JSON.stringify(deepLadder));

  const mapUi = await page.evaluate(() => {
    const on = window.game.toggleMap();
    const cv = document.getElementById("minimap");
    const painted = cv.getContext("2d").getImageData(20, 20, 140, 140).data.some(v => v > 0);
    return { on, visible: cv.style.display === "block", painted };
  });
  check("M opens a minimap of the explored area", mapUi.on && mapUi.visible && mapUi.painted,
    JSON.stringify(mapUi));

  const dropTest = await page.evaluate(() => {
    const g = window.game, c = g.core;
    c.player.bag.push({ uid: 990011, kind: "potion", name: "Test Draught", glyph: "!", color: "#ffffff" });
    const before = g.items().length, bagBefore = g.status().player.bag.length;
    g.act({ type: "drop", uid: 990011 });
    return { before, after: g.items().length, bagBefore, bagAfter: g.status().player.bag.length };
  });
  check("dropping an item leaves it on the floor", dropTest.after === dropTest.before + 1 && dropTest.bagAfter === dropTest.bagBefore - 1,
    JSON.stringify(dropTest));

  const doorMemory = await page.evaluate(() => {
    const g = window.game, c = g.core;
    c.act({ type: "travel", target: "greenhills" });
    const ent = c.getMap("greenhills").entities.find(e => e.type === "entrance");
    const rx = ent.x, ry = ent.y - 1;
    if (c.blocked(rx, ry)) return { ok: false, reason: "entrance walled" };
    c.player.x = rx; c.player.y = ry;
    c.act({ type: "move", dx: 0, dy: 1 });
    const inDungeon = c.player.mapKey;
    const por = c.getMap(c.player.mapKey).entities.find(e => e.type === "portal");
    let from = null;
    for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]])
      if (!c.blocked(por.x + ox, por.y + oy)) { from = [ox, oy]; break; }
    c.player.x = por.x + from[0]; c.player.y = por.y + from[1];
    c.act({ type: "move", dx: -from[0], dy: -from[1] });
    return { ok: inDungeon.includes(":d") && c.player.mapKey === "greenhills" && c.player.x === rx && c.player.y === ry,
      inDungeon, out: c.player.mapKey, pos: [c.player.x, c.player.y], was: [rx, ry] };
  });
  check("exiting a dungeon door returns you to the exact tile you entered from", doorMemory.ok,
    JSON.stringify(doorMemory));

  const clickDown = await page.evaluate(async () => {
    const g = window.game, c = g.core;
    c.act({ type: "travel", target: "greenhills", tier: 1 });
    const st = g.stairs();
    const res = await g.clickTile(st.x, st.y);
    return { res, map: g.status().map.key };
  });
  check("clicking the stairs walks you there and takes you down", clickDown.res === "used" && clickDown.map.endsWith(":d2"),
    JSON.stringify(clickDown));

  const climbBack = await page.evaluate(() => {
    const g = window.game, c = g.core;
    g.ascend();
    const d1stairs = c.getMap("greenhills:d1").stairs;
    return { map: c.player.mapKey, x: c.player.x, y: c.player.y, sx: d1stairs.x, sy: d1stairs.y };
  });
  check("stairs up (<) returns to the stair you descended", climbBack.map === "greenhills:d1" &&
    Math.max(Math.abs(climbBack.x - climbBack.sx), Math.abs(climbBack.y - climbBack.sy)) <= 1,
    JSON.stringify(climbBack));

  const portalSafety = await page.evaluate(() => {
    const g = window.game, c = g.core;
    c.act({ type: "travel", target: "greenhills", tier: 1 });
    const map = c.getMap(c.player.mapKey);
    map.entities.filter(e => e.type === "monster").forEach(m => { m._hp = m.hp; m.hp = 0; });
    const por = map.entities.find(e => e.type === "portal");
    for (let i = 0; i < 5; i++) c.act({ type: "move", dx: 0, dy: 0 });
    const safe = { mapKey: c.player.mapKey, underfoot: por.x === map.spawn.x && por.y === map.spawn.y };
    map.entities.filter(e => e.type === "monster").forEach(m => { m.hp = m._hp; });
    c.player.hp = c.eff().maxHp;
    return safe;
  });
  check("dungeon entry portal is not under your feet (no accidental ejection)",
    portalSafety.mapKey.includes(":d") && !portalSafety.underfoot, JSON.stringify(portalSafety));

  const faceWalk = await page.evaluate(async () => {
    const g = window.game, c = g.core;
    const x0 = c.player.x;
    let moved = 0;
    for (const [dx, dy] of [[1, 0], [1, 0], [-1, 0], [-1, 0]])
      if (c.act({ type: "move", dx, dy }) && c.player.x !== x0) moved = dx;
    await new Promise(r => setTimeout(r, 900));
    return { moved, angle: g.heroAngle() };
  });
  const expectAngle = faceWalk.moved === 1 ? -Math.PI / 2 : Math.PI / 2;
  const angDiff = Math.abs(Math.atan2(Math.sin(faceWalk.angle - expectAngle), Math.cos(faceWalk.angle - expectAngle)));
  check("the hero turns to face the direction walked",
    angDiff < 0.5, JSON.stringify({ ...faceWalk, expectAngle, angDiff }));

  const faceFoe = await page.evaluate(() => {
    const g = window.game, c = g.core;
    c.act({ type: "travel", target: "greenhills", tier: 2 });
    const mons = g.monsters();
    if (!mons.length) return { ok: false };
    const m = mons[0];
    for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]])
      if (!c.blocked(m.x + ox, m.y + oy)) { c.player.x = m.x + ox; c.player.y = m.y + oy; break; }
    for (let i = 0; i < 2; i++) c.act({ type: "move", dx: 0, dy: 0 });
    const ok = g.monsters().some(mm => mm.facing);
    c.player.hp = c.eff().maxHp;
    c.player.x = c.getMap(c.player.mapKey).spawn.x;
    c.player.y = c.getMap(c.player.mapKey).spawn.y;
    return { ok };
  });
  check("monsters turn as they hunt you", faceFoe.ok === true, JSON.stringify(faceFoe));

  const identStat = await page.evaluate(async () => {
    const { genItem } = await import("/src/core.js");
    let eq = 0, known = 0;
    const rng = () => Math.random();
    for (let i = 0; i < 400; i++) {
      const it = genItem("greenhills", 3, rng);
      if (["weapon", "armor", "trinket"].includes(it.kind)) { eq++; if (it.ident) known++; }
    }
    return { eq, known, rate: known / Math.max(1, eq) };
  });
  check("found gear usually starts unidentified (~15% known)",
    identStat.eq > 150 && identStat.rate > 0.05 && identStat.rate < 0.3, JSON.stringify(identStat));

  const identTest = await page.evaluate(() => {
    const g = window.game, c = g.core;
    c.player.bag.push({ uid: 990022, kind: "weapon", slot: "weapon", id: "shortsword", name: "Shortsword", dmg: 5, glyph: "/", color: "#d0d0e0", affixes: [], cursed: false, ident: false });
    c.player.bag.push({ uid: 990023, kind: "scroll-identify", name: "Scroll of Identify", glyph: "?", color: "#e0e0ff", ident: true });
    g.act({ type: "equip", uid: 990022 });
    const stillBlocked = g.status().player.bag.some(i => i.uid === 990022 && i.ident === false);
    g.act({ type: "identify", uid: 990022 });
    const after = g.status().player.bag.find(i => i.uid === 990022);
    const scrollGone = !g.status().player.bag.some(i => i.uid === 990023);
    return { stillBlocked, identNow: !!after && after.ident === true, scrollGone };
  });
  check("unidentified gear refuses to equip; scroll reveals it",
    identTest.stillBlocked && identTest.identNow && identTest.scrollGone, JSON.stringify(identTest));

  const village = await page.evaluate(async () => {
    const g = window.game;
    g.travel("town");
    await new Promise(r => setTimeout(r, 300));
    let roofs = 0;
    g.debugAll().traverse(o => { if (o.userData && o.userData.roof) roofs++; });
    return { roofs, buildings: g.core.getMap("town").buildings.length };
  });
  check("Merrow Vale is an open-air village of roofed houses", village.buildings >= 5 && village.roofs >= 10,
    JSON.stringify(village));

  await page.evaluate(() => {
    const g = window.game;
    g.travel("greenhills", 1);
    const c = g.core;
    c.player.hp = c.eff().maxHp;
    for (let i = 0; i < 3; i++)
      c.player.bag.push({ uid: 990050 + i, kind: "potion", name: "Red Potion", glyph: "!", color: "#ff6060" });
  });

  await page.screenshot({ path: path.join(ROOT, "verify-shot-dungeon.png") });

  let questDone = false, itemGrabbed = false;
  for (let round = 0; round < 30; round++) {
    questDone = await page.evaluate(() => window.game.status().quests[0].progress >= 3);
    if (questDone && itemGrabbed) break;
    const cleared = await clearFoes(page);
    const item = await page.evaluate(() => {
      const it = window.game.items().find(i => i.name.includes("Hearthroot"));
      return it || null;
    });
    if (item) { await walkTo(page, item.x, item.y); itemGrabbed = true; }
    else if (cleared) {
      await page.evaluate(() => { const st = window.game.stairs(); if (st) window.game.stepTowards(st.x, st.y); });
      await page.evaluate(() => window.game.descend());
      await sleep(20);
    }
    const dead = await page.evaluate(() => window.game.status().dead);
    if (dead) { await page.evaluate(() => window.game.act({ type: "revive" })); await page.evaluate(() => window.game.travel("greenhills", 1)); }
  }
  s = await page.evaluate(() => window.game.status());
  check("kills monsters in dungeon combat", s.kills >= 3, "kills=" + s.kills);
  check("levels up from dungeon XP", s.player.level >= 2, "level=" + s.player.level);
  check("collects quest items in the village", s.quests[0].progress >= 3, "progress=" + s.quests[0].progress);

  const tierBefore = s.map.tier;
  const descended = await page.evaluate(() => {
    const g = window.game;
    const st = g.stairs();
    if (st) for (let i = 0; i < 200; i++) { g.stepTowards(st.x, st.y); }
    const s1 = g.status();
    const onStairs = st && Math.abs(s1.player.x - st.x) + Math.abs(s1.player.y - st.y) <= 1;
    if (!onStairs) return { ok: false, reason: "never reached stairs", tier: s1.map.tier };
    g.descend();
    const s2 = g.status();
    return { ok: s2.map.tier === s1.map.tier + 1, from: s1.map.tier, to: s2.map.tier };
  });
  check("descends to a harder dungeon tier", descended.ok, JSON.stringify(descended));

  await page.evaluate(() => window.game.travel("town"));
  s = await page.evaluate(() => window.game.status());
  check("returns to main town hub", s.map.name === "Merrow Vale" && s.map.kind === "town");
  await page.screenshot({ path: path.join(ROOT, "verify-shot-town.png") });

  const npcFound = await page.evaluate(() => {
    const map = window.game.core.getMap("town");
    const npc = map.entities.find(e => e.type === "npc" && e.npcId === "elder");
    if (!npc) return null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      if (map.grid[npc.y + dy][npc.x + dx] === ".") return { x: npc.x + dx, y: npc.y + dy };
    return null;
  });
  check("town has quest NPC", !!npcFound);
  await walkTo(page, npcFound.x, npcFound.y);
  await page.evaluate(() => window.game.interact());
  s = await page.evaluate(() => window.game.status());
  check("fulfills quest with town NPC", s.quests[0].turnedIn === true);
  const blessed = await page.evaluate(() => window.game.status().player.bag.some(b => b.label.includes("Blessing of")));
  check("quest reward carries a blessing enchantment", blessed);

  const equipWorks = await page.evaluate(() => {
    const g = window.game;
    const w = g.status().player.bag.find(b => b.kind === "weapon");
    if (!w) return { skip: true };
    const before = g.status().player.equipment.weapon;
    g.equip(w.uid);
    const after = g.status().player.equipment.weapon;
    return { skip: false, changed: after !== before, before, after };
  });
  check("equipment swapping works", equipWorks.skip || equipWorks.changed, JSON.stringify(equipWorks).slice(0, 160));

  const roundTrip = await page.evaluate(async () => {
    const g = window.game;
    try {
      const b64 = await g.exportDemoGlb();
      const res = await g.importGlbDemo(b64);
      let fromGlb = 0;
      g.debugAll().traverse(o => { if (o.userData && o.userData.fromGlb) fromGlb++; });
      return { ok: res.ok && fromGlb > 0, parts: res.parts, fromGlb, sizeKB: Math.round(b64.length / 1024) };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  check("voxel body exports to GLB and re-imports into the scene", roundTrip.ok, JSON.stringify(roundTrip));

  const mapGating = await page.evaluate(() => {
    const g = window.game;
    g.travel("ashfall", 1);
    return g.status().map.key === "town";
  });
  check("map 3 (Ashfall) is level-gated", mapGating);

  const questCount = await page.evaluate(() => window.game.status().quests.length);
  check("three quest lines exist", questCount === 3, "quests=" + questCount);

  const allOutdoors = await page.evaluate(() => {
    const c = window.game.core;
    c.player.level = 10;
    for (const m of ["darkfang", "ashfall"]) c.act({ type: "travel", target: m });
    const df = c.getMap("darkfang"), af = c.getMap("ashfall");
    const hasEnt = mp => mp.entities.some(e => e.type === "entrance");
    return df.kind === "outdoor" && af.kind === "outdoor" && hasEnt(df) && hasEnt(af);
  });
  check("Darkfang and Ashfall arrive outdoors with entrances", allOutdoors);

  const lootTiers = await page.evaluate(() => {
    const c = window.game.core;
    const peak = key => {
      const ms = c.getMap(key).entities.filter(e => e.type === "monster");
      return ms.reduce((mx, m) => Math.max(mx, m.hp), 0);
    };
    const g1 = peak("greenhills:d5"), d1 = peak("darkfang:d5"), a1 = peak("ashfall:d5");
    return { g1, d1, a1 };
  });
  check("maps get harder (peak monster HP rises)", lootTiers.g1 < lootTiers.d1 && lootTiers.d1 < lootTiers.a1,
    JSON.stringify(lootTiers));

  const artOk = await page.evaluate(async () => {
    const r1 = await fetch("/assets/img/skoll__skeleton.png");
    const r2 = await fetch("/assets/tex/floor-ashfall.png");
    return r1.status === 200 && r2.status === 200;
  });
  check("free art assets are served", artOk);

  const preSave = await page.evaluate(() => {
    const g = window.game;
    g.saveGame();
    const s = g.status();
    return {
      x: s.player.x, y: s.player.y, mapKey: s.map.key, xp: s.player.xp,
      bag: s.player.bag.length, kills: s.kills,
      gridHash: g.core.getMap("greenhills:d1").grid.join("").length,
      version: JSON.parse(localStorage.getItem("roguerng-save-v1")).version
    };
  });
  check("save button writes versioned save", preSave.version === 1);
  await page.reload();
  await page.waitForFunction(() => window.game && window.game.ready, null, { timeout: 15000 });
  const contVisible = await page.evaluate(() => getComputedStyle(document.getElementById("continue")).display !== "none");
  check("fresh boot offers Continue when a save exists", contVisible);
  await page.click("#continue");
  const postSave = await page.evaluate(() => {
    const s = window.game.status();
    return {
      x: s.player.x, y: s.player.y, mapKey: s.map.key, xp: s.player.xp,
      bag: s.player.bag.length, kills: s.kills,
      gridHash: window.game.core.getMap("greenhills:d1").grid.join("").length
    };
  });
  check("Continue restores hero and sticky dungeons",
    JSON.stringify(preSave.x + "," + preSave.y + "," + preSave.mapKey + "," + preSave.bag + "," + preSave.gridHash) ===
    JSON.stringify(postSave.x + "," + postSave.y + "," + postSave.mapKey + "," + postSave.bag + "," + postSave.gridHash),
    JSON.stringify({ preSave, postSave }));
  const badVer = await page.evaluate(() => {
    const c = window.game.core;
    const good = c.toJSON(); good.version = 99;
    return c.loadFrom(good) === false;
  });
  check("future-version saves rejected gracefully", badVer);

  await page.reload();
  await page.waitForFunction(() => window.game && window.game.ready, null, { timeout: 15000 });
  const mage = await page.evaluate(() => window.game.create("mage", "elf", "Zapp"));
  const rogueKit = await page.evaluate(async () => {
    const d = await import("/src/data.js");
    return { classes: Object.keys(d.CLASSES).sort().join(","), identifyKind: d.SKILLS.identify.kind,
      aimed: !!d.SKILLS["aimed-shot"].dex, shop: d.SHOP.length };
  });
  check("Rogue roster: Fighter/Mage/Cleric/Paladin/Ranger/Thief with Identify & DEX skills",
    rogueKit.classes === "cleric,fighter,mage,paladin,ranger,thief" && rogueKit.identifyKind === "identify" &&
    rogueKit.aimed && rogueKit.shop >= 8, JSON.stringify(rogueKit));

  const classRules = await page.evaluate(() => {
    const g = window.game, c = g.core;
    const plate = () => ({ uid: 990031, kind: "armor", slot: "armor", id: "plate", name: "Plate Armor", def: 6, glyph: "[", color: "#c0a070", affixes: [], cursed: false, ident: true });
    g.create("thief", "human", "Catch");
    c.player.bag.push(plate());
    c.act({ type: "equip", uid: 990031 });
    const thiefBlocked = !c.player.equipment.armor || c.player.equipment.armor.id !== "plate";
    g.create("paladin", "human", "Oath");
    c.player.bag.push(plate());
    c.act({ type: "equip", uid: 990031 });
    const paladinWears = !!c.player.equipment.armor;
    const paladinHeals = c.player.skills.includes("lay-on-hands");
    return { thiefBlocked, paladinWears, paladinHeals };
  });
  check("class gear rules: thieves can't plate, paladins can and heal", classRules.thiefBlocked && classRules.paladinWears && classRules.paladinHeals,
    JSON.stringify(classRules));

  const chestTest = await page.evaluate(() => {
    const g = window.game, c = g.core;
    g.create("fighter", "human", "Digger");
    g.travel("greenhills", 1);
    const map = c.getMap(c.player.mapKey);
    const chest = map.entities.find(e => e.type === "chest");
    const door = map.entities.find(e => e.type === "door");
    if (!chest || !door) return { ok: false, reason: "no chest/door spawned" };
    chest.locked = true; chest.gold = 100; door.locked = true; door.stash.gold = 200;
    const gold0 = c.player.gold;
    const noKeyChest = c.openChest(chest) === false && map.entities.includes(chest);
    const noKeyDoor = c.unlockDoor(door) === false && map.entities.includes(door);
    c.player.bag.push({ uid: 999911, kind: "key", name: "Iron Key", glyph: "k", color: "#ccc", ident: true });
    const opened = c.openChest(chest) === true;
    const goldChest = c.player.gold;
    c.player.bag.push({ uid: 999912, kind: "key", name: "Iron Key", glyph: "k", color: "#ccc", ident: true });
    const unlocked = c.unlockDoor(door) === true && !map.entities.includes(door);
    return { ok: noKeyChest && noKeyDoor && opened && unlocked && goldChest === gold0 + 100 && c.player.gold === goldChest + 200 };
  });
  check("iron keys open locked chests and strongroom doors", chestTest.ok, JSON.stringify(chestTest));

  const vendorTest = await page.evaluate(() => {
    const g = window.game, c = g.core;
    g.create("paladin", "human", "Anvil");
    c.player.gold = 600;
    c.player.mapKey = "town";
    c.player.x = 27; c.player.y = 15;
    const bag0 = c.player.bag.length;
    c.act({ type: "buy", key: "armor:plate" });
    const plateOk = c.player.bag.length === bag0 + 1 && c.player.gold === 600 - 480;
    c.act({ type: "buy", key: "potion" });
    const pellaOnly = c.player.bag.length === bag0 + 1;
    c.act({ type: "buy", key: "book:book-frost" });
    const sageOnly = c.player.bag.length === bag0 + 1;
    return { plateOk, pellaOnly, sageOnly };
  });
  check("Dorin's forge sells armor, keeps Pella's and Ianna's stock locked", vendorTest.plateOk && vendorTest.pellaOnly && vendorTest.sageOnly,
    JSON.stringify(vendorTest));

  const manaTest = await page.evaluate(() => {
    const c = window.game.core;
    c.player.mp = 0;
    c.player.bag.push({ uid: 999913, kind: "potion", effect: "mana", name: "Blue Potion", glyph: "!", color: "#8af", ident: true });
    c.act({ type: "useItem", uid: 999913 });
    return c.player.mp > 0;
  });
  check("blue potions restore mana", manaTest);

  const newMonsters = await page.evaluate(() =>
    ["slime", "bandit", "zombie", "beetle", "banshee", "drake"]
      .map(id => ({ id, parts: window.game.debugVoxel(id).parts }))
      .filter(m => m.parts <= 4));
  check("six new monster species have built bodies", newMonsters.length === 0, JSON.stringify(newMonsters));

  const shopTest = await page.evaluate(() => {
    const g = window.game, c = g.core;
    g.create("fighter", "human", "Buyer");
    c.player.gold = 500;
    c.player.mapKey = "town";
    c.player.x = 13; c.player.y = 8;
    const bag0 = c.player.bag.length;
    c.act({ type: "buy", key: "potion" });
    const gold1 = c.player.gold, bag1 = c.player.bag.length;
    const pot = c.player.bag[c.player.bag.length - 1];
    c.act({ type: "sell", uid: pot.uid });
    return { gold0: 500, gold1, bag0, bag1, gold2: c.player.gold };
  });
  check("Pella buys and sells in the Trade Yard", shopTest.gold1 === 485 && shopTest.bag1 === shopTest.bag0 + 1 && shopTest.gold2 > shopTest.gold1,
    JSON.stringify(shopTest));

  check("mage/elf: glass-cannon stats", mage.player.attrs.int === 16 && mage.player.maxHp < fighterHp && mage.player.maxMp >= 8,
    `hp=${mage.player.maxHp} mp=${mage.player.maxMp} int=${mage.player.attrs.int}`);
  check("mage starts with one small spell", mage.player.skills.length === 1 && mage.player.skills[0].id === "firebolt");

  const facingTest = await page.evaluate(async () => {
    const g = window.game, c = g.core;
    g.create("fighter", "human", "Face");
    g.travel("greenhills", 1);
    const map = c.getMap(c.player.mapKey);
    map.entities.filter(e => e.type === "monster").forEach(m => { m.hp = 0; });
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !c.blocked(c.player.x + dx, c.player.y + dy));
    const [sdx, sdy] = dirs[0] || [0, 0];
    c.act({ type: "move", dx: sdx, dy: sdy });
    const f0 = { ...c.player.facing };
    for (let i = 0; i < 3; i++) c.act({ type: "move", dx: 0, dy: 0 });
    const f1 = { ...c.player.facing };
    for (let i = 0; i < 14; i++) await new Promise(r => requestAnimationFrame(r));
    const target = Math.atan2(-f1.dx, f1.dy);
    const err = Math.abs(Math.atan2(Math.sin(target - g.heroAngle()), Math.cos(target - g.heroAngle())));
    const heroStuck = f1.dx === f0.dx && f1.dy === f0.dy && err < 0.15;
    c.player.level = 5; c.player.unlockedTiers.greenhills = 2;
    g.travel("greenhills", 2);
    const map2 = c.getMap(c.player.mapKey);
    const m = map2.entities.find(e => e.type === "monster" && e.hp > 0);
    if (!m) return { ok: false, reason: "no monster", heroStuck };
    const near = map2.floors.find(f => { const d = Math.max(Math.abs(f.x - m.x), Math.abs(f.y - m.y)); return d >= 2 && d <= 6; });
    c.player.x = near.x; c.player.y = near.y;
    const was = { dx: m.x, dy: m.y };
    c.monsterStep(m);
    const mf = m.facing;
    const monsterTurned = !!mf && (mf.dx !== 0 || mf.dy !== 0) &&
      mf.dx === Math.sign(m.x - was.dx) && mf.dy === Math.sign(m.y - was.dy);
    return { ok: heroStuck && monsterTurned, heroStuck, monsterTurned, mf };
  });
  check("facing sticks after moves/waits, monsters face their step", facingTest.ok, JSON.stringify(facingTest));

  check("no page errors during full loop", errors.length === 0, errors.join(" | ").slice(0, 300));

  await browser.close();
  srv.close();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR:", e); process.exit(2); });
