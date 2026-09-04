// RogueMS data tables: races, classes, skills, items, enchantments, monsters, maps, quests.

export const RACES = {
  human: { name: "Human", icon: "delapouite__character", enchant: { str: 1, int: 1, wis: 1, dex: 1, vit: 1 }, blurb: "Well-rounded (+1 all)." },
  elf:   { name: "Elf",   icon: "delapouite__elf-ear", enchant: { int: 2, dex: 1, vit: -1 }, blurb: "Clever and nimble, but frail (INT +2, DEX +1, VIT -1)." },
  dwarf: { name: "Dwarf", icon: "delapouite__dwarf-face", enchant: { vit: 2, str: 1, dex: -1 }, blurb: "Stout and strong, but clumsy (VIT +2, STR +1, DEX -1)." }
};

export const CLASSES = {
  fighter: {
    name: "Fighter", glyph: "@", color: "#ffd24d", icon: "delapouite__fencer",
    base: { str: 13, int: 7, wis: 8, dex: 10, vit: 13 },
    growth: { str: 1, vit: 1, other: 0.5 },
    hpPer: 6, mpPer: 1, hpBase: 8,
    skills: ["power-strike", "second-wind", "berserk", "cleave"],
    blurb: "Sword first, deep hit points later. Low mana, big HP growth."
  },
  mage: {
    name: "Mage", glyph: "@", color: "#7db6ff", icon: "delapouite__wizard-face",
    base: { str: 7, int: 14, wis: 11, dex: 10, vit: 8 },
    growth: { int: 1, wis: 1, other: 0.5 },
    hpPer: 2, mpPer: 6, hpBase: 0,
    skills: ["firebolt", "frost-shock", "arcane-barrier", "chain-lightning"],
    blurb: "Tiny spells and low mana at first. Devastating once fed."
  },
  cleric: {
    name: "Cleric", glyph: "@", color: "#f5f0c8", icon: "delapouite__prayer-beads",
    base: { str: 9, int: 9, wis: 14, dex: 8, vit: 11 },
    growth: { wis: 1, vit: 1, other: 0.5 },
    hpPer: 4, mpPer: 3, hpBase: 3,
    skills: ["heal", "blessing", "smite", "divine-shield"],
    blurb: "Heals self, blesses, smites. Steady in the middle."
  }
};

// Skills: cost = mana, cd = cooldown turns, buff/neg show bonuses and minuses.
export const SKILLS = {
  "power-strike":  { name: "Power Strike",  level: 1, cost: 4,  cd: 3,  kind: "melee", desc: "1.8x weapon damage to an adjacent foe." },
  "second-wind":   { name: "Second Wind",   level: 3, cost: 6,  cd: 8,  kind: "self-heal", power: 0.3, desc: "Heal 30% of max HP." },
  "berserk":       { name: "Berserk",       level: 5, cost: 8,  cd: 10, kind: "buff", buff: { atk: 4, def: -3, turns: 5 }, desc: "ATK +4, DEF -3 for 5 turns." },
  "cleave":        { name: "Cleave",        level: 7, cost: 10, cd: 5,  kind: "melee-all", power: 1.2, desc: "1.2x weapon damage to ALL adjacent foes." },
  "firebolt":      { name: "Firebolt",      level: 1, cost: 3,  cd: 0,  kind: "bolt", power: 4, range: 6, desc: "Ranged bolt: 4 + INT damage." },
  "frost-shock":   { name: "Frost Shock",   level: 2, cost: 5,  cd: 3,  kind: "bolt", power: 6, range: 5, stun: 1, desc: "6 + INT damage, stuns 1 turn." },
  "arcane-barrier":{ name: "Arcane Barrier",level: 4, cost: 6,  cd: 8,  kind: "buff", buff: { def: 5, turns: 4 }, desc: "DEF +5 for 4 turns." },
  "chain-lightning":{name: "Chain Lightning",level: 6, cost: 12, cd: 5,  kind: "multi-bolt", power: 8, range: 6, count: 3, desc: "8 + INT damage to up to 3 foes." },
  "heal":          { name: "Heal",          level: 1, cost: 4,  cd: 2,  kind: "self-heal", power: 0.2, wis: true, desc: "Heal 20% max HP + WIS." },
  "blessing":      { name: "Blessing",      level: 2, cost: 5,  cd: 8,  kind: "buff", buff: { atk: 2, def: 2, turns: 6 }, desc: "ATK +2, DEF +2 for 6 turns." },
  "smite":         { name: "Divine Smite",  level: 4, cost: 7,  cd: 3,  kind: "bolt", power: 6, range: 4, wis: true, desc: "Holy bolt: 6 + WIS damage." },
  "divine-shield": { name: "Divine Shield", level: 7, cost: 12, cd: 10, kind: "buff", buff: { def: 99, turns: 2 }, desc: "Near-invulnerable for 2 turns." }
};

// Spellbooks teach their skill to any class at the required level.
export const SPELLBOOKS = {
  "book-frost":  { name: "Book of Frost Shock",   teaches: "frost-shock",    reqLevel: 2, glyph: "=", color: "#9fd8ff", icon: "delapouite__spell-book" },
  "book-lightning": { name: "Book of Chain Lightning", teaches: "chain-lightning", reqLevel: 6, glyph: "=", color: "#c8b4ff", icon: "delapouite__spell-book" },
  "book-smite":  { name: "Book of Divine Smite",  teaches: "smite",          reqLevel: 4, glyph: "=", color: "#fff0a0", icon: "delapouite__spell-book" },
  "book-barrier":{ name: "Book of Arcane Barrier",teaches: "arcane-barrier", reqLevel: 4, glyph: "=", color: "#a0ffd8", icon: "delapouite__spell-book" }
};

export const WEAPONS = [
  { id: "dagger", name: "Dagger", tier: 1, dmg: 3, icon: "delapouite__butterfly-knife" },
  { id: "sickle", name: "Sickle", tier: 1, dmg: 4, icon: "delapouite__cleaver" },
  { id: "shortsword", name: "Shortsword", tier: 2, dmg: 5, icon: "delapouite__ancient-sword" },
  { id: "mace", name: "Mace", tier: 3, dmg: 6, icon: "delapouite__flanged-mace" },
  { id: "longsword", name: "Longsword", tier: 4, dmg: 7, icon: "delapouite__sword-brandish" },
  { id: "greataxe", name: "Greataxe", tier: 6, dmg: 9, icon: "lorc__battle-axe" },
  { id: "warhammer", name: "Warhammer", tier: 8, dmg: 10, icon: "delapouite__warhammer" },
  { id: "runesblade", name: "Runesblade", tier: 10, dmg: 12, icon: "delapouite__swords-power" }
];
export const ARMORS = [
  { id: "rags", name: "Tattered Rags", tier: 1, def: 1, icon: "delapouite__fur-shirt" },
  { id: "robes", name: "Sage Robes", tier: 1, def: 1, icon: "lorc__robe" },
  { id: "leather", name: "Leather Armor", tier: 2, def: 2, icon: "delapouite__leather-armor" },
  { id: "chain", name: "Chainmail", tier: 4, def: 4, icon: "lorc__scale-mail" },
  { id: "plate", name: "Plate Armor", tier: 7, def: 6, icon: "delapouite__chest-armor" }
];
export const TRINKETS = [
  { id: "copper-ring", name: "Copper Ring", tier: 1, icon: "delapouite__diamond-ring" },
  { id: "bone-amulet", name: "Bone Amulet", tier: 3, icon: "delapouite__double-necklace" },
  { id: "warden-charm", name: "Warden's Charm", tier: 5, icon: "delapouite__feather-necklace" },
  { id: "starcirclet", name: "Star Circlet", tier: 8, icon: "delapouite__jewel-crown" }
];

// Enchantment affixes: blessings add, curses subtract (cursed gear keeps a stronger base).
export const BLESSINGS = [
  { key: "str", name: "Might" }, { key: "dex", name: "Grace" }, { key: "vit", name: "the Bear" },
  { key: "int", name: "Focus" }, { key: "wis", name: "Insight" }, { key: "atk", name: "the Titan" },
  { key: "def", name: "the Aegis" }, { key: "hp", name: "Vigor" }, { key: "mp", name: "Reservoir" }
];
export const CURSES = [
  { key: "str", name: "Frailty" }, { key: "dex", name: "Clumsiness" }, { key: "vit", name: "Withering" },
  { key: "int", name: "Dimming" }, { key: "wis", name: "Doubt" }, { key: "def", name: "Exposure" },
  { key: "hp", name: "Fragility" }, { key: "mp", name: "Hollowness" }
];

export const MONSTERS = {
  rat:      { name: "Giant Rat",     glyph: "r", color: "#b08060", icon: "delapouite__rat", hp: 6,  dmg: 3,  def: 0, xp: 5,  minTier: 1 },
  bat:      { name: "Cave Bat",      glyph: "b", color: "#9090b0", icon: "delapouite__bat", hp: 5,  dmg: 3,  def: 0, xp: 5,  minTier: 1 },
  wolf:     { name: "Grey Wolf",     glyph: "w", color: "#a8a8a8", icon: "lorc__wolf-head", hp: 10, dmg: 4,  def: 1, xp: 8,  minTier: 1 },
  goblin:   { name: "Goblin",        glyph: "g", color: "#60c060", icon: "caro-asercion__goblin", hp: 11, dmg: 4,  def: 1, xp: 9,  minTier: 1 },
  imp:      { name: "Ember Imp",     glyph: "i", color: "#ff7040", icon: "lorc__imp", hp: 8,  dmg: 4,  def: 0, xp: 8,  minTier: 1 },
  skeleton: { name: "Skeleton",      glyph: "Z", color: "#e0e0d0", icon: "skoll__skeleton", hp: 13, dmg: 5,  def: 2, xp: 12, minTier: 2 },
  spider:   { name: "Fang Spider",   glyph: "x", color: "#c070c0", icon: "carl-olsen__spider-face", hp: 14, dmg: 5,  def: 1, xp: 12, minTier: 2 },
  orc:      { name: "Orc Raider",    glyph: "o", color: "#40a040", icon: "delapouite__ogre", hp: 20, dmg: 6,  def: 3, xp: 18, minTier: 3 },
  harpy:    { name: "Harpy",         glyph: "h", color: "#e0a040", icon: "lorc__harpy", hp: 18, dmg: 7,  def: 2, xp: 20, minTier: 4 },
  wraith:   { name: "Wraith",        glyph: "W", color: "#9060d0", icon: "lorc__ghost", hp: 22, dmg: 8,  def: 3, xp: 26, minTier: 5 },
  magma:    { name: "Magma Slab",    glyph: "m", color: "#ff5020", icon: "sbed__lava", hp: 26, dmg: 9,  def: 4, xp: 30, minTier: 5 },
  shade:    { name: "Gloom Shade",   glyph: "U", color: "#8080a0", icon: "delapouite__elysium-shade", hp: 26, dmg: 9,  def: 4, xp: 30, minTier: 6 },
  troll:    { name: "Cave Troll",    glyph: "T", color: "#608060", icon: "skoll__troll", hp: 34, dmg: 10, def: 5, xp: 40, minTier: 7 },
  wendigo:  { name: "Wendigo",       glyph: "Y", color: "#d0d0ff", icon: "delapouite__ice-golem", hp: 38, dmg: 11, def: 5, xp: 46, minTier: 8 }
};

export const BOSSES = {
  "greenpaw": { name: "Greenpaw the Troll King", glyph: "&", color: "#40e040", icon: "lorc__minotaur", hp: 90, dmg: 11, def: 5, xp: 200 },
  "hagraven": { name: "The Hagraven", glyph: "&", color: "#e040a0", icon: "lorc__raven", hp: 110, dmg: 13, def: 6, xp: 300 },
  "cinder":   { name: "The Cinder Golem", glyph: "&", color: "#ff6030", icon: "delapouite__golem-head", hp: 130, dmg: 15, def: 7, xp: 420 }
};

export const MAPS = {
  greenhills: {
    name: "Greenhills Village", layouts: 7, tiers: 12, unlockLevel: 1,
    difficulty: 1.0, lootShift: 0,
    monsters: ["rat", "bat", "wolf", "goblin", "skeleton", "spider"],
    boss: "greenpaw",
    quest: {
      id: "hearthroot", npc: "elder", item: "hearthroot", itemName: "Hearthroot",
      glyph: "\"", color: "#7be07b", icon: "delapouite__herbs-bundle", need: 3, rewardXp: 120,
      greeting: "Elder Marowe: The village hearth is dying. Bring me 3 sprigs of Hearthroot from the Greenhills cellars.",
      complete: "Elder Marowe: The hearth roars back to life! Take this ring; it carries a true blessing."
    }
  },
  darkfang: {
    name: "Darkfang Forest", layouts: 7, tiers: 12, unlockLevel: 4,
    difficulty: 1.5, lootShift: 4,
    monsters: ["goblin", "skeleton", "orc", "harpy", "wraith", "shade", "troll", "wendigo"],
    boss: "hagraven",
    quest: {
      id: "token", npc: "warden", item: "token", itemName: "Hagraven Token",
      glyph: "\"", color: "#e080ff", icon: "delapouite__glowing-artifact", need: 3, rewardXp: 300,
      greeting: "Warden Bryn: The Hagraven's cultists wear cursed tokens. Bring me 3 and the forest road stays open.",
      complete: "Warden Bryn: With these we can seal the cult. You have done Darkfang a great service."
    }
  },
  ashfall: {
    name: "Ashfall Mine", layouts: 7, tiers: 12, unlockLevel: 8,
    difficulty: 2.1, lootShift: 8,
    monsters: ["imp", "skeleton", "spider", "orc", "magma", "wraith", "troll", "wendigo"],
    boss: "cinder",
    quest: {
      id: "ore", npc: "foreman", item: "ore", itemName: "Ember-Ore Seam",
      glyph: "\"", color: "#ff9050", icon: "delapouite__coal-pile", need: 3, rewardXp: 600,
      greeting: "Foreman Halla: The forge bellows died with the mine. Cut 3 seams of Ember-Ore below and Merrow Vale will steel itself again.",
      complete: "Foreman Halla: True ember-steel! The smithy sings again - and so will you, in this gear."
    }
  }
};

export const QUEST_ITEM_NAMES = { hearthroot: "Hearthroot", token: "Hagraven Token", ore: "Ember-Ore Seam" };
