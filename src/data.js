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
    blurb: "Sword first, deep hit points later. Low mana, big HP growth. Wields any weapon, any armor."
  },
  mage: {
    name: "Mage", glyph: "@", color: "#7db6ff", icon: "delapouite__wizard-face",
    base: { str: 7, int: 14, wis: 11, dex: 10, vit: 8 },
    growth: { int: 1, wis: 1, other: 0.5 },
    hpPer: 2, mpPer: 6, hpBase: 0,
    skills: ["firebolt", "identify", "frost-shock", "arcane-barrier", "chain-lightning", "elemental-ward"],
    weapons: ["staff", "dagger", "wand"], armors: ["rags", "robes"],
    blurb: "Tiny spells and low mana at first. Devastating once fed. Staves and daggers, robes only. Knows Identify."
  },
  cleric: {
    name: "Cleric", glyph: "@", color: "#f5f0c8", icon: "delapouite__prayer-beads",
    base: { str: 9, int: 9, wis: 14, dex: 8, vit: 11 },
    growth: { wis: 1, vit: 1, other: 0.5 },
    hpPer: 4, mpPer: 3, hpBase: 3,
    skills: ["heal", "blessing", "smite", "elemental-ward", "divine-shield"],
    weapons: ["sickle", "mace", "warhammer"], armors: ["rags", "robes", "leather", "chain"],
    blurb: "Heals self, blesses, smites. Blunt holy weapons, no plate."
  },
  thief: {
    name: "Thief", glyph: "@", color: "#b0e0c0", icon: "delapouite__butterfly-knife",
    base: { str: 8, int: 9, wis: 8, dex: 14, vit: 9 },
    growth: { dex: 1, int: 1, other: 0.5 },
    hpPer: 4, mpPer: 2, hpBase: 2,
    skills: ["backstab", "plunder", "escape"],
    weapons: ["dagger", "sickle", "shortsword", "scimitar"], armors: ["rags", "leather"],
    blurb: " strikes from the shadows and pockets gold on the way out. Light blades, leather only."
  },
  paladin: {
    name: "Paladin", glyph: "@", color: "#ffe9a0", icon: "delapouite__sword-brandish",
    base: { str: 12, int: 8, wis: 11, dex: 8, vit: 12 },
    growth: { str: 1, wis: 1, vit: 1, other: 0.4 },
    hpPer: 5, mpPer: 3, hpBase: 4,
    skills: ["lay-on-hands", "holy-smite", "divine-favor", "elemental-ward", "aura-of-courage"],
    weapons: ["mace", "warhammer", "shortsword", "spear", "longsword", "greataxe", "runesblade"],
    armors: ["rags", "leather", "studded", "chain", "plate"],
    blurb: "Holy warrior: lays on hands, smites evil, and wears the heaviest plate in the realm."
  },
  ranger: {
    name: "Ranger", glyph: "@", color: "#90d090", icon: "delapouite__archer",
    base: { str: 10, int: 8, wis: 11, dex: 13, vit: 10 },
    growth: { dex: 1, wis: 1, other: 0.5 },
    hpPer: 5, mpPer: 2, hpBase: 2,
    skills: ["aimed-shot", "natures-whisper", "hunters-mark", "volley"],
    weapons: ["dagger", "sickle", "shortsword", "spear", "longsword", "shortbow", "longbow"],
    armors: ["rags", "leather", "studded"],
    blurb: "Deadly at range with a DEX-aimed shot. Bows and blades, leather only."
  }
};

// Skills: cost = mana, cd = cooldown turns, buff/neg show bonuses and minuses.
export const SKILLS = {
  "power-strike":  { name: "Power Strike",  level: 1, cost: 4,  cd: 3,  kind: "melee", power: 1.8, desc: "1.8x weapon damage to an adjacent foe." },
  "second-wind":   { name: "Second Wind",   level: 3, cost: 6,  cd: 8,  kind: "self-heal", power: 0.3, desc: "Heal 30% of max HP." },
  "berserk":       { name: "Berserk",       level: 5, cost: 8,  cd: 10, kind: "buff", buff: { atk: 4, def: -3, turns: 5 }, desc: "ATK +4, DEF -3 for 5 turns." },
  "cleave":        { name: "Cleave",        level: 7, cost: 10, cd: 5,  kind: "melee-all", power: 1.2, desc: "1.2x weapon damage to ALL adjacent foes." },
  "firebolt":      { name: "Firebolt",      level: 1, cost: 3,  cd: 0,  kind: "bolt", power: 4, range: 6, desc: "Ranged bolt: 4 + INT damage." },
  "identify":      { name: "Identify",      level: 2, cost: 6,  cd: 1,  kind: "identify", desc: "Reveal what an unidentified item truly is." },
  "frost-shock":   { name: "Frost Shock",   level: 2, cost: 5,  cd: 3,  kind: "bolt", power: 6, range: 5, stun: 1, desc: "6 + INT damage, stuns 1 turn." },
  "arcane-barrier":{ name: "Arcane Barrier",level: 4, cost: 6,  cd: 8,  kind: "buff", buff: { def: 5, turns: 4 }, desc: "DEF +5 for 4 turns." },
  "chain-lightning":{name: "Chain Lightning",level: 6, cost: 12, cd: 5,  kind: "multi-bolt", power: 8, range: 6, count: 3, desc: "8 + INT damage to up to 3 foes." },
  "heal":          { name: "Heal",          level: 1, cost: 4,  cd: 2,  kind: "self-heal", power: 0.2, wis: true, desc: "Heal 20% max HP + WIS." },
  "blessing":      { name: "Blessing",      level: 2, cost: 5,  cd: 8,  kind: "buff", buff: { atk: 2, def: 2, turns: 6 }, desc: "ATK +2, DEF +2 for 6 turns." },
  "smite":         { name: "Divine Smite",  level: 4, cost: 7,  cd: 3,  kind: "bolt", power: 6, range: 4, wis: true, desc: "Holy bolt: 6 + WIS damage." },
  "divine-shield": { name: "Divine Shield", level: 7, cost: 12, cd: 10, kind: "buff", buff: { def: 99, turns: 2 }, desc: "Near-invulnerable for 2 turns." },
  "backstab":      { name: "Backstab",      level: 1, cost: 5,  cd: 4,  kind: "melee", power: 2.5, desc: "2.5x weapon damage from the shadows." },
  "plunder":       { name: "Plunder",       level: 3, cost: 4,  cd: 6,  kind: "plunder", desc: "Pick a nearby foe's pocket: stolen gold." },
  "escape":        { name: "Escape",        level: 5, cost: 6,  cd: 9,  kind: "buff", buff: { def: 6, turns: 3 }, desc: "Blur yourself: DEF +6 for 3 turns." },
  "lay-on-hands":  { name: "Lay on Hands",  level: 1, cost: 4,  cd: 2,  kind: "self-heal", power: 0.25, wis: true, desc: "Heal 25% max HP + WIS." },
  "holy-smite":    { name: "Holy Smite",    level: 3, cost: 6,  cd: 3,  kind: "bolt", power: 7, range: 4, wis: true, desc: "Radiant bolt: 7 + WIS damage." },
  "divine-favor":  { name: "Divine Favor",  level: 5, cost: 9,  cd: 9,  kind: "buff", buff: { atk: 3, def: 3, turns: 5 }, desc: "ATK +3, DEF +3 for 5 turns." },
  "aura-of-courage":{ name: "Aura of Courage", level: 7, cost: 8, cd: 10, kind: "buff", buff: { atk: 2, def: 2, turns: 8 }, desc: "Steadying aura: ATK +2, DEF +2 for 8 turns." },
  "aimed-shot":    { name: "Aimed Shot",    level: 1, cost: 4,  cd: 2,  kind: "bolt", power: 6, range: 7, dex: true, desc: "Ranged shot: 6 + DEX damage." },
  "natures-whisper":{ name: "Nature's Whisper", level: 3, cost: 5, cd: 4, kind: "self-heal", power: 0.2, wis: true, desc: "Heal 20% max HP + WIS." },
  "hunters-mark":  { name: "Hunter's Mark", level: 4, cost: 4,  cd: 6,  kind: "buff", buff: { atk: 3, turns: 5 }, desc: "Mark your prey: ATK +3 for 5 turns." },
  "volley":        { name: "Volley",        level: 5, cost: 8,  cd: 5,  kind: "multi-bolt", power: 7, range: 6, count: 2, dex: true, desc: "7 + DEX damage to up to 2 foes." },
  "elemental-ward":{ name: "Elemental Ward", level: 6, cost: 7, cd: 9,  kind: "buff", buff: { allRes: 2, turns: 14 }, desc: "All elemental resistance +2 for 14 turns." }
};

// Spellbooks teach their skill to any class at the required level.
export const SPELLBOOKS = {
  "book-frost":  { name: "Book of Frost Shock",   teaches: "frost-shock",    reqLevel: 2, glyph: "=", color: "#9fd8ff", icon: "delapouite__spell-book" },
  "book-lightning": { name: "Book of Chain Lightning", teaches: "chain-lightning", reqLevel: 6, glyph: "=", color: "#c8b4ff", icon: "delapouite__spell-book" },
  "book-smite":  { name: "Book of Divine Smite",  teaches: "smite",          reqLevel: 4, glyph: "=", color: "#fff0a0", icon: "delapouite__spell-book" },
  "book-barrier":{ name: "Book of Arcane Barrier",teaches: "arcane-barrier", reqLevel: 4, glyph: "=", color: "#a0ffd8", icon: "delapouite__spell-book" },
  "book-heal":   { name: "Book of Healing",     teaches: "heal",   reqLevel: 2, glyph: "=", color: "#c8ffc8", icon: "delapouite__spell-book" },
  "book-volley": { name: "Book of Volley",      teaches: "volley", reqLevel: 5, glyph: "=", color: "#ffd8a0", icon: "delapouite__spell-book" },
  "book-ward":   { name: "Book of Warding",     teaches: "elemental-ward", reqLevel: 6, glyph: "=", color: "#b0ffd8", icon: "delapouite__spell-book" }
};

export const WEAPONS = [
  { id: "dagger", name: "Dagger", tier: 1, dmg: 3, icon: "delapouite__butterfly-knife" },
  { id: "staff", name: "Oak Staff", tier: 1, dmg: 2, icon: "delapouite__ancient-sword" },
  { id: "sickle", name: "Sickle", tier: 1, dmg: 4, icon: "delapouite__cleaver" },
  { id: "shortbow", name: "Shortbow", tier: 1, dmg: 3, icon: "delapouite__archer" },
  { id: "shortsword", name: "Shortsword", tier: 2, dmg: 5, icon: "delapouite__ancient-sword" },
  { id: "spear", name: "Ash Spear", tier: 2, dmg: 5, icon: "delapouite__ancient-sword" },
  { id: "mace", name: "Mace", tier: 3, dmg: 6, icon: "delapouite__flanged-mace" },
  { id: "scimitar", name: "Scimitar", tier: 3, dmg: 6, icon: "delapouite__cleaver" },
  { id: "longsword", name: "Longsword", tier: 4, dmg: 7, icon: "delapouite__sword-brandish" },
  { id: "longbow", name: "Longbow", tier: 5, dmg: 8, icon: "delapouite__archer" },
  { id: "wand", name: "Fairy Wand", tier: 5, dmg: 6, icon: "lorc__fairy-wand" },
  { id: "greataxe", name: "Greataxe", tier: 6, dmg: 9, icon: "lorc__battle-axe" },
  { id: "warhammer", name: "Warhammer", tier: 8, dmg: 10, icon: "delapouite__warhammer" },
  { id: "runesblade", name: "Runesblade", tier: 10, dmg: 12, icon: "delapouite__swords-power" }
];
export const ARMORS = [
  { id: "rags", name: "Tattered Rags", tier: 1, def: 1, icon: "delapouite__fur-shirt" },
  { id: "robes", name: "Sage Robes", tier: 1, def: 1, icon: "lorc__robe" },
  { id: "leather", name: "Leather Armor", tier: 2, def: 2, icon: "delapouite__leather-armor" },
  { id: "studded", name: "Studded Leather", tier: 3, def: 3, icon: "delapouite__fur-shirt" },
  { id: "chain", name: "Chainmail", tier: 4, def: 4, icon: "lorc__scale-mail" },
  { id: "plate", name: "Plate Armor", tier: 7, def: 6, icon: "delapouite__chest-armor" }
];
export const TRINKETS = [
  { id: "copper-ring", name: "Copper Ring", tier: 1, icon: "delapouite__diamond-ring" },
  { id: "iron-band", name: "Iron Band", tier: 2, icon: "delapouite__double-necklace" },
  { id: "bone-amulet", name: "Bone Amulet", tier: 3, icon: "delapouite__double-necklace" },
  { id: "moonstone", name: "Moonstone Charm", tier: 6, icon: "delapouite__diamond-ring" },
  { id: "warden-charm", name: "Warden's Charm", tier: 5, icon: "delapouite__feather-necklace" },
  { id: "starcirclet", name: "Star Circlet", tier: 8, icon: "delapouite__jewel-crown" }
];

// Protection gear sold in town: fixed resistance affixes for themed floors.
export const WARD_ITEMS = [
  { id: "ring-warmth", name: "Ring of Warmth", element: "fire", value: 3, tier: 3, icon: "delapouite__diamond-ring" },
  { id: "ring-frostward", name: "Frostward Ring", element: "frost", value: 3, tier: 3, icon: "delapouite__double-necklace" },
  { id: "bark-brooch", name: "Barkwood Brooch", element: "acid", value: 3, tier: 4, icon: "delapouite__feather-necklace" },
  { id: "storm-totem", name: "Storm Totem", element: "storm", value: 3, tier: 5, icon: "delapouite__diamond-ring" },
  { id: "veil-eclipse", name: "Veil of Eclipse", element: "shadow", value: 3, tier: 5, icon: "delapouite__double-necklace" }
];

// Enchantment affixes: blessings add, curses subtract (cursed gear keeps a stronger base).
export const BLESSINGS = [
  { key: "str", name: "Might" }, { key: "dex", name: "Grace" }, { key: "vit", name: "the Bear" },
  { key: "int", name: "Focus" }, { key: "wis", name: "Insight" }, { key: "atk", name: "the Titan" },
  { key: "def", name: "the Aegis" }, { key: "hp", name: "Vigor" }, { key: "mp", name: "Reservoir" },
  { key: "fireRes", name: "the Salamander" }, { key: "frostRes", name: "the Yeti" },
  { key: "acidRes", name: "the Toad" }, { key: "stormRes", name: "the Tempest" },
  { key: "shadowRes", name: "the Eclipse" }
];
export const CURSES = [
  { key: "str", name: "Frailty" }, { key: "dex", name: "Clumsiness" }, { key: "vit", name: "Withering" },
  { key: "int", name: "Dimming" }, { key: "wis", name: "Doubt" }, { key: "def", name: "Exposure" },
  { key: "hp", name: "Fragility" }, { key: "mp", name: "Hollowness" }
];

// Elemental variants: themed dungeon floors prefix+tint base creatures, so a
// Fire Ant or Frost Skeleton is the same rig/shape with an element tag. Their
// attacks burn through the matching resistance (gear affix, Ward spell, buffs).
export const ELEMENTS = {
  none:   { name: "Unbound", prefix: "",       color: null,     tint: 0xffffff, res: null,         hp: 1.0,  xp: 1.0,  bonus: 0 },
  fire:   { name: "Fire",    prefix: "Fire ",   color: "#ff7040", tint: 0xff7850, res: "fireRes",   hp: 1.05, xp: 1.25, bonus: 3 },
  frost:  { name: "Frost",   prefix: "Frost ",  color: "#8fd0ff", tint: 0x9fd0ff, res: "frostRes",  hp: 1.08, xp: 1.25, bonus: 3 },
  acid:   { name: "Acid",    prefix: "Acid ",   color: "#90e050", tint: 0x9ae066, res: "acidRes",   hp: 1.06, xp: 1.2,  bonus: 3 },
  storm:  { name: "Storm",   prefix: "Storm ",  color: "#ffd860", tint: 0xffe080, res: "stormRes",  hp: 1.0,  xp: 1.25, bonus: 4 },
  shadow: { name: "Shadow",  prefix: "Shadow ", color: "#9a6ad0", tint: 0x9a72c8, res: "shadowRes", hp: 1.1,  xp: 1.3,  bonus: 3 }
};

// Bestiary families group species for the compendium ("the frozen mountains"
// style browsing by kind rather than 300 flat rows).
export const FAMILIES = {
  rat: "vermin", bat: "vermin", bloodbat: "vermin", direrat: "vermin", ant: "vermin", spider: "vermin",
  centipede: "vermin", scorpion: "vermin", beetle: "vermin", stalker: "vermin", snake: "vermin",
  wolf: "beast", direwolf: "beast", bear: "beast", boar: "beast", gnoll: "beast", hellhound: "beast",
  goblin: "humanoid", kobold: "humanoid", orc: "humanoid", bugbear: "humanoid", ogre: "humanoid",
  ogrmage: "humanoid", ettin: "humanoid", bandit: "humanoid", werewolf: "humanoid", harpy: "humanoid",
  skeleton: "undead", zombie: "undead", ghoul: "undead", ghast: "undead", wight: "undead",
  mummy: "undead", wraith: "undead", specter: "undead", shade: "undead", banshee: "undead",
  vampire: "undead", vamlord: "undead", lich: "undead", draugr: "undead", shadow: "undead",
  slime: "slime", magma: "slime", gianttoad: "slime", giant: "giant", hillgiant: "giant",
  firegiant: "giant", frostgiant: "giant", cloudgiant: "giant", troll: "giant", wendigo: "giant",
  imp: "elemental", elemental: "elemental", fireelem: "elemental", fireant: "elemental",
  stonegolem: "constructed", irongolem: "constructed", gargoyle: "constructed",
  manticore: "magical", chimera: "magical", basilisk: "magical", cockatrice: "magical",
  hydra: "magical", minotaur: "magical", drake: "dragon", wyrm: "dragon", archfiend: "fiend"
};

export const MONSTERS = {
  rat:      { name: "Giant Rat",     glyph: "r", color: "#b08060", icon: "delapouite__rat", hp: 6,  dmg: 3,  def: 0, xp: 5,  minTier: 1 },
  bat:      { name: "Cave Bat",      glyph: "b", color: "#9090b0", icon: "delapouite__bat", hp: 5,  dmg: 3,  def: 0, xp: 5,  minTier: 1 },
  wolf:     { name: "Grey Wolf",     glyph: "w", color: "#a8a8a8", icon: "lorc__wolf-head", hp: 10, dmg: 4,  def: 1, xp: 8,  minTier: 1 },
  goblin:   { name: "Goblin",        glyph: "g", color: "#60c060", icon: "caro-asercion__goblin", hp: 11, dmg: 4,  def: 1, xp: 9,  minTier: 1 },
  imp:      { name: "Ember Imp",     glyph: "i", color: "#ff7040", icon: "lorc__imp", hp: 8,  dmg: 4,  def: 0, xp: 8,  minTier: 1 },
  skeleton: { name: "Skeleton",      glyph: "Z", color: "#e0e0d0", icon: "skoll__skeleton", hp: 13, dmg: 5,  def: 2, xp: 12, minTier: 2 },
  spider:   { name: "Fang Spider",   glyph: "x", color: "#6e5747", icon: "carl-olsen__spider-face", hp: 14, dmg: 5,  def: 1, xp: 12, minTier: 2 },
  orc:      { name: "Orc Raider",    glyph: "o", color: "#40a040", icon: "delapouite__ogre", hp: 20, dmg: 6,  def: 3, xp: 18, minTier: 3 },
  harpy:    { name: "Harpy",         glyph: "h", color: "#e0a040", icon: "lorc__harpy", hp: 18, dmg: 7,  def: 2, xp: 20, minTier: 4 },
  wraith:   { name: "Wraith",        glyph: "W", color: "#9060d0", icon: "lorc__ghost", hp: 22, dmg: 8,  def: 3, xp: 26, minTier: 5 },
  magma:    { name: "Magma Slab",    glyph: "m", color: "#ff5020", icon: "sbed__lava", hp: 26, dmg: 9,  def: 4, xp: 30, minTier: 5 },
  shade:    { name: "Gloom Shade",   glyph: "U", color: "#8080a0", icon: "delapouite__elysium-shade", hp: 26, dmg: 9,  def: 4, xp: 30, minTier: 6 },
  troll:    { name: "Cave Troll",    glyph: "T", color: "#608060", icon: "skoll__troll", hp: 34, dmg: 10, def: 5, xp: 40, minTier: 7 },
  wendigo:  { name: "Wendigo",       glyph: "Y", color: "#d0d0ff", icon: "delapouite__ice-golem", hp: 38, dmg: 11, def: 5, xp: 46, minTier: 8 },
  slime:    { name: "Bog Slime",     glyph: "s", color: "#50c060", icon: "sbed__lava", hp: 9,   dmg: 3,  def: 1, xp: 7,  minTier: 1 },
  bandit:   { name: "Road Bandit",   glyph: "B", color: "#b07030", icon: "delapouite__fencer", hp: 14, dmg: 6, def: 2, xp: 14, minTier: 1 },
  zombie:   { name: "Rotting Zombie", glyph: "z", color: "#7a9a5a", icon: "delapouite__elysium-shade", hp: 16, dmg: 5, def: 1, xp: 13, minTier: 2 },
  beetle:   { name: "Ironback Beetle", glyph: "c", color: "#40a080", icon: "carl-olsen__spider-face", hp: 17, dmg: 6, def: 4, xp: 16, minTier: 3 },
  banshee:  { name: "Wailing Banshee", glyph: "N", color: "#a0c8ff", icon: "lorc__ghost", hp: 24, dmg: 9, def: 3, xp: 28, minTier: 5 },
  drake:    { name: "Cinder Drake",  glyph: "D", color: "#d04828", icon: "lorc__wolf-head", hp: 30, dmg: 10, def: 5, xp: 38, minTier: 6 },
  // --- classic bestiary expansion (folklore roots; tiers 1-12 ladder to level 100) ---
  kobold:   { name: "Kobold",        glyph: "k", color: "#c07048", icon: "caro-asercion__goblin", hp: 7, dmg: 3, def: 0, xp: 6, minTier: 1 },
  bloodbat: { name: "Blood Bat",     glyph: "t", color: "#a03030", icon: "delapouite__bat", hp: 6, dmg: 2, def: 0, xp: 5, minTier: 1 },
  direrat:  { name: "Dire Rat",      glyph: "R", color: "#8a6a55", icon: "delapouite__rat", hp: 12, dmg: 4, def: 1, xp: 10, minTier: 1 },
  gnoll:    { name: "Gnoll Reaver",  glyph: "n", color: "#b08858", icon: "lorc__wolf-head", hp: 15, dmg: 6, def: 2, xp: 14, minTier: 2 },
  ghoul:    { name: "Ghoul",         glyph: "G", color: "#9aa08a", icon: "delapouite__elysium-shade", hp: 17, dmg: 6, def: 1, xp: 15, minTier: 2 },
  gianttoad:{ name: "Giant Toad",    glyph: "d", color: "#6a8a3a", icon: "sbed__lava", hp: 16, dmg: 5, def: 2, xp: 13, minTier: 2 },
  shadow:   { name: "Shadow",        glyph: "s", color: "#3a3a4a", icon: "lorc__ghost", hp: 24, dmg: 9, def: 5, xp: 30, minTier: 3 },
  bugbear:  { name: "Bugbear",       glyph: "U", color: "#9a7f55", icon: "delapouite__ogre", hp: 22, dmg: 7, def: 3, xp: 20, minTier: 3 },
  ogre:     { name: "Ogre",          glyph: "O", color: "#9aa06a", icon: "delapouite__ogre", hp: 28, dmg: 8, def: 3, xp: 24, minTier: 3 },
  scorpion: { name: "Giant Scorpion", glyph: "S", color: "#c09048", icon: "carl-olsen__spider-face", hp: 20, dmg: 7, def: 4, xp: 19, minTier: 3 },
  wight:    { name: "Wight",         glyph: "h", color: "#7080a0", icon: "skoll__skeleton", hp: 21, dmg: 7, def: 3, xp: 21, minTier: 4 },
  werewolf: { name: "Werewolf",      glyph: "V", color: "#6a7078", icon: "lorc__wolf-head", hp: 26, dmg: 9, def: 3, xp: 26, minTier: 4 },
  ettin:    { name: "Ettin",         glyph: "E", color: "#8a7a5a", icon: "skoll__troll", hp: 32, dmg: 9, def: 4, xp: 30, minTier: 4 },
  cockatrice:{ name: "Cockatrice",   glyph: "C", color: "#b0a060", icon: "lorc__harpy", hp: 19, dmg: 7, def: 3, xp: 22, minTier: 4 },
  centipede:{ name: "Giant Centipede", glyph: "p", color: "#a0783a", icon: "carl-olsen__spider-face", hp: 21, dmg: 8, def: 4, xp: 23, minTier: 4 },
  gargoyle: { name: "Gargoyle",      glyph: "g", color: "#8a8a92", icon: "delapouite__gargoyle", hp: 30, dmg: 9, def: 6, xp: 32, minTier: 5 },
  specter:  { name: "Specter",       glyph: "P", color: "#8898b0", icon: "lorc__ghost", hp: 24, dmg: 9, def: 4, xp: 30, minTier: 5 },
  mummy:    { name: "Mummy",         glyph: "M", color: "#d8cba8", icon: "delapouite__elysium-shade", hp: 34, dmg: 9, def: 4, xp: 34, minTier: 5 },
  ogrmage:  { name: "Ogre Mage",     glyph: "Q", color: "#9a6ab0", icon: "delapouite__ogre", hp: 30, dmg: 10, def: 4, xp: 33, minTier: 5 },
  direwolf: { name: "Dire Wolf",     glyph: "W", color: "#586068", icon: "lorc__wolf-head", hp: 26, dmg: 9, def: 3, xp: 30, minTier: 5 },
  minotaur: { name: "Minotaur",      glyph: "m", color: "#7a5a3a", icon: "lorc__minotaur", hp: 38, dmg: 11, def: 5, xp: 40, minTier: 6 },
  basilisk: { name: "Basilisk",      glyph: "B", color: "#5a8a4a", icon: "lorc__wolf-head", hp: 32, dmg: 11, def: 6, xp: 42, minTier: 6 },
  hellhound:{ name: "Hell Hound",    glyph: "l", color: "#d04820", icon: "lorc__wolf-head", hp: 28, dmg: 10, def: 4, xp: 36, minTier: 6 },
  chimera:  { name: "Chimera",       glyph: "X", color: "#a06a3a", icon: "lorc__minotaur", hp: 42, dmg: 12, def: 5, xp: 46, minTier: 7 },
  fireelem: { name: "Fire Elemental", glyph: "f", color: "#ff6820", icon: "sbed__lava", hp: 36, dmg: 12, def: 4, xp: 44, minTier: 7 },
  stonegolem:{ name: "Stone Golem",  glyph: "o", color: "#9a9a9a", icon: "delapouite__golem-head", hp: 46, dmg: 11, def: 7, xp: 50, minTier: 7 },
  hillgiant:{ name: "Hill Giant",    glyph: "i", color: "#c0b088", icon: "skoll__troll", hp: 44, dmg: 12, def: 6, xp: 48, minTier: 7 },
  manticore:{ name: "Manticore",     glyph: "a", color: "#c08048", icon: "lorc__minotaur", hp: 40, dmg: 13, def: 6, xp: 52, minTier: 8 },
  frostworm:{ name: "Frost Worm",    glyph: "F", color: "#a8c8e0", icon: "delapouite__ice-golem", hp: 48, dmg: 13, def: 6, xp: 56, minTier: 8 },
  ghast:    { name: "Ghast",         glyph: "A", color: "#b8a8a0", icon: "delapouite__elysium-shade", hp: 40, dmg: 12, def: 5, xp: 58, minTier: 9 },
  vampire:  { name: "Vampire",       glyph: "e", color: "#b04050", icon: "lorc__imp", hp: 46, dmg: 13, def: 6, xp: 64, minTier: 9 },
  firegiant:{ name: "Fire Giant",    glyph: "I", color: "#c04830", icon: "skoll__troll", hp: 56, dmg: 14, def: 7, xp: 66, minTier: 9 },
  draugr:   { name: "Draugr",        glyph: "j", color: "#5a7080", icon: "skoll__skeleton", hp: 58, dmg: 14, def: 7, xp: 70, minTier: 9 },
  lich:     { name: "Lich",          glyph: "L", color: "#bcd8c8", icon: "skoll__skeleton", hp: 52, dmg: 15, def: 7, xp: 72, minTier: 10 },
  frostgiant:{ name: "Frost Giant",  glyph: "J", color: "#9fc4e0", icon: "skoll__troll", hp: 62, dmg: 15, def: 7, xp: 76, minTier: 10 },
  hydra:    { name: "Hydra",         glyph: "y", color: "#4a8a5a", icon: "lorc__wolf-head", hp: 60, dmg: 14, def: 6, xp: 74, minTier: 10 },
  irongolem:{ name: "Iron Golem",    glyph: "N", color: "#b0b8c0", icon: "delapouite__golem-head", hp: 70, dmg: 15, def: 9, xp: 84, minTier: 11 },
  vamlord:  { name: "Vampire Lord",  glyph: "w", color: "#8a233a", icon: "lorc__imp", hp: 60, dmg: 16, def: 7, xp: 88, minTier: 11 },
  stalker:  { name: "Silent Stalker", glyph: "u", color: "#7a6a8a", icon: "carl-olsen__spider-face", hp: 54, dmg: 15, def: 6, xp: 80, minTier: 11 },
  cloudgiant:{ name: "Cloud Giant",  glyph: "c", color: "#d8e0e8", icon: "skoll__troll", hp: 80, dmg: 17, def: 8, xp: 95, minTier: 12 },
  archfiend:{ name: "Archfiend",     glyph: "z", color: "#e02020", icon: "lorc__imp", hp: 88, dmg: 18, def: 8, xp: 105, minTier: 12, unique: true },
  wyrm:     { name: "Ancient Wyrm",  glyph: "d", color: "#e03010", icon: "lorc__wolf-head", hp: 100, dmg: 19, def: 9, xp: 120, minTier: 12, unique: true },
  // --- variant-able bases: these become Fire/Frost/Acid/Storm/Shadow X on themed floors ---
  ant:      { name: "Wood Ant",      glyph: "a", color: "#7a5a40", icon: "delapouite__rat", hp: 5, dmg: 2, def: 0, xp: 4, minTier: 1 },
  snake:    { name: "Crypt Snake",   glyph: "s", color: "#6a8a50", icon: "lorc__wolf-head", hp: 12, dmg: 6, def: 1, xp: 12, minTier: 2 },
  boar:     { name: "Tusked Boar",   glyph: "b", color: "#8a6a4a", icon: "delapouite__boar-head", hp: 17, dmg: 5, def: 2, xp: 13, minTier: 2 },
  bear:     { name: "Cave Bear",     glyph: "b", color: "#7a6248", icon: "lorc__wolf-head", hp: 26, dmg: 8, def: 3, xp: 22, minTier: 3 },
  worm:     { name: "Cave Worm",     glyph: "m", color: "#a08070", icon: "carl-olsen__spider-face", hp: 18, dmg: 7, def: 3, xp: 18, minTier: 4 },
  elemental:{ name: "Elemental",     glyph: "e", color: "#9ab0c8", icon: "sbed__lava", hp: 34, dmg: 11, def: 4, xp: 40, minTier: 6 },
  giant:    { name: "Stone Giant",   glyph: "g", color: "#b0a890", icon: "skoll__troll", hp: 44, dmg: 12, def: 6, xp: 48, minTier: 7 },
  lich:     { name: "Lich",          glyph: "L", color: "#bcd8c8", icon: "skoll__skeleton", hp: 52, dmg: 15, def: 7, xp: 72, minTier: 10, unique: true },
  vamlord:  { name: "Vampire Lord",  glyph: "w", color: "#8a233a", icon: "lorc__imp", hp: 60, dmg: 16, def: 7, xp: 88, minTier: 11, unique: true }
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
    elements: ["acid", "storm"], elemFrom: 5,
    monsters: ["rat", "bat", "wolf", "goblin", "skeleton", "spider", "slime", "bandit", "zombie",
               "kobold", "bloodbat", "direrat", "ant", "boar", "gnoll", "ghoul", "snake", "bear"],
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
    elements: ["frost", "shadow"], elemFrom: 3,
    monsters: ["goblin", "skeleton", "orc", "harpy", "wraith", "shade", "troll", "wendigo", "bandit", "zombie", "beetle", "banshee",
               "shadow", "bugbear", "ogre", "scorpion", "wight", "werewolf", "ettin", "centipede", "gargoyle", "specter", "snake", "direwolf", "worm"],
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
    elements: ["fire", "fire", "storm"], elemFrom: 2,
    monsters: ["imp", "skeleton", "spider", "orc", "magma", "wraith", "troll", "wendigo", "slime", "beetle", "drake", "banshee",
               "hellhound", "basilisk", "minotaur", "chimera", "manticore", "stonegolem", "hillgiant", "cockatrice", "fireelem",
               "vampire", "ghast", "draugr", "ogre", "scorpion", "hydra", "lich", "frostgiant", "irongolem", "vamlord", "worm"],
    boss: "cinder",
    quest: {
      id: "ore", npc: "foreman", item: "ore", itemName: "Ember-Ore Seam",
      glyph: "\"", color: "#ff9050", icon: "delapouite__coal-pile", need: 3, rewardXp: 600,
      greeting: "Foreman Halla: The forge bellows died with the mine. Cut 3 seams of Ember-Ore below and Merrow Vale will steel itself again.",
      complete: "Foreman Halla: True ember-steel! The smithy sings again - and so will you, in this gear."
    }
  }
};

// Deterministic themed floors: a deep floor of a map is mostly one element.
// Hash keeps dungeon gen, loot bias, HUD, and verify agreeing without rng drift.
export function floorElement(mapId, tier) {
  const def = MAPS[mapId];
  if (!def || !def.elements || tier < (def.elemFrom ?? 99)) return "none";
  let h = 2166136261;
  const s = `${mapId}#${tier}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const pool = ["none", ...def.elements, ...def.elements]; // element floors dominate
  return pool[h % pool.length];
}

export const QUEST_ITEM_NAMES = { hearthroot: "Hearthroot", token: "Hagraven Token", ore: "Ember-Ore Seam" };

// vendor: merchant = Pella (Trade Yard), smith = Dorin Anvil (Smithy), sage = Ianna (Temple).
export const VENDORS = {
  merchant: { npc: "merchant", name: "Pella's Trade Yard" },
  smith: { npc: "smith", name: "Dorin's Forge" },
  sage: { npc: "sage", name: "Ianna's Reliquary" }
};

export const SHOP = [
  { key: "potion", name: "Red Potion", price: 15, vendor: "merchant" },
  { key: "potion-mana", name: "Blue Potion", price: 20, vendor: "merchant" },
  { key: "scroll-identify", name: "Scroll of Identify", price: 30, vendor: "merchant" },
  { key: "key", name: "Iron Key", price: 25, vendor: "merchant" },
  { key: "weapon:dagger", name: "Dagger", price: 45, vendor: "merchant" },
  { key: "weapon:shortbow", name: "Shortbow", price: 55, vendor: "merchant" },
  { key: "weapon:shortsword", name: "Shortsword", price: 90, vendor: "smith" },
  { key: "weapon:spear", name: "Ash Spear", price: 85, vendor: "smith" },
  { key: "weapon:scimitar", name: "Scimitar", price: 130, vendor: "smith" },
  { key: "weapon:mace", name: "Mace", price: 120, vendor: "smith" },
  { key: "weapon:longsword", name: "Longsword", price: 200, vendor: "smith" },
  { key: "armor:leather", name: "Leather Armor", price: 100, vendor: "smith" },
  { key: "armor:studded", name: "Studded Leather", price: 170, vendor: "smith" },
  { key: "armor:chain", name: "Chainmail", price: 260, vendor: "smith" },
  { key: "armor:plate", name: "Plate Armor", price: 480, vendor: "smith" },
  { key: "trinket:ring-warmth", name: "Ring of Warmth (fire resist)", price: 110, vendor: "merchant" },
  { key: "trinket:ring-frostward", name: "Frostward Ring (frost resist)", price: 110, vendor: "merchant" },
  { key: "trinket:bark-brooch", name: "Barkwood Brooch (acid resist)", price: 130, vendor: "sage" },
  { key: "trinket:storm-totem", name: "Storm Totem (storm resist)", price: 150, vendor: "sage" },
  { key: "trinket:veil-eclipse", name: "Veil of Eclipse (shadow resist)", price: 150, vendor: "sage" },
  { key: "book:book-ward", name: "Book of Warding", price: 190, vendor: "sage" },
  { key: "book:book-frost", name: "Book of Frost Shock", price: 180, vendor: "sage" },
  { key: "book:book-heal", name: "Book of Healing", price: 160, vendor: "sage" },
  { key: "book:book-smite", name: "Book of Divine Smite", price: 220, vendor: "sage" },
  { key: "book:book-volley", name: "Book of Volley", price: 210, vendor: "sage" }
];
