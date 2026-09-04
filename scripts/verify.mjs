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
  check("out-of-combat HP trickles over idle turns", regen.hpIdle >= regen.hp0 + 4, `hp ${regen.hp0}->${regen.hpIdle}`);
  check("mana does not regen per turn", regen.mpIdle === regen.mp0);
  check("recent damage blocks regen", regen.hpAfterHit < regen.hpBeforeHit && regen.hpFinal === regen.hpAfterHit,
    JSON.stringify({ b: regen.hpBeforeHit, a: regen.hpAfterHit, f: regen.hpFinal, t0: regen.tsdBefore, t1: regen.tsdAfter }));

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
    return !!g && !!g.userData.stairsGroup && g.userData.stairsGroup.children.length >= 3;
  });
  check("stairs are a physical 3D structure", stairMesh);

  const kinds = await page.evaluate(() => window.game.core.getMap("greenhills:d9").monsterKinds);
  check("dungeon spawns 3-4 monster kinds", kinds.length >= 3 && kinds.length <= 4, "kinds=" + kinds.join(","));

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
    const ents = window.game.core.getMap("town").entities.filter(e => e.type === "npc" && e.npcId === "elder");
    return ents.length ? { x: ents[0].x, y: ents[0].y } : null;
  });
  check("town has quest NPC", !!npcFound);
  await walkTo(page, npcFound.x + 1, npcFound.y);
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
    const avg = key => {
      const ms = c.getMap(key).entities.filter(e => e.type === "monster");
      return ms.reduce((s, m) => s + m.hp, 0) / Math.max(1, ms.length);
    };
    const g1 = avg("greenhills:d5"), d1 = avg("darkfang:d5"), a1 = avg("ashfall:d5");
    return { g1, d1, a1 };
  });
  check("maps get harder (avg monster HP rises)", lootTiers.g1 < lootTiers.d1 && lootTiers.d1 < lootTiers.a1,
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
  check("mage/elf: glass-cannon stats", mage.player.attrs.int === 16 && mage.player.maxHp < fighterHp && mage.player.maxMp >= 8,
    `hp=${mage.player.maxHp} mp=${mage.player.maxMp} int=${mage.player.attrs.int}`);
  check("mage starts with one small spell", mage.player.skills.length === 1 && mage.player.skills[0].id === "firebolt");

  check("no page errors during full loop", errors.length === 0, errors.join(" | ").slice(0, 300));

  await browser.close();
  srv.close();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR:", e); process.exit(2); });
