// Central constants for Dungeon Sweeper. No magic numbers outside this file.

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;

// ---------------------------------------------------------------------------
// Board / Grid
// ---------------------------------------------------------------------------
export const GRID_SIZE = 5;
export const TILE_SIZE = 64;
export const GRID_OFFSET_X = 35;
export const GRID_OFFSET_Y = 180;
export const HERO_START_ROW = 2;
export const HERO_START_COL = 2;

// ---------------------------------------------------------------------------
// Isometric board projection
// ---------------------------------------------------------------------------
// The board renders as a diamond: each tile is a square sprite visually
// rotated 45deg, laid out on isometric axes rather than a flat row/col grid.
export const ISO_TILE_WIDTH = TILE_SIZE;
export const ISO_TILE_HEIGHT = TILE_SIZE;
export const ISO_OFFSET_X = GAME_WIDTH / 2;
export const ISO_OFFSET_Y = 200;

// Single source of truth for row/col -> screen position, shared by the board,
// hero, and enemies so everything lines up on the same diamond grid.
export function gridToScreen(row, col) {
  return {
    x: ISO_OFFSET_X + (col - row) * (ISO_TILE_WIDTH / 2),
    y: ISO_OFFSET_Y + (col + row) * (ISO_TILE_HEIGHT / 2)
  };
}

// Colors that can appear as normal, matchable board tiles.
// 'brown' is reserved for a disguised Mimic and is never part of the random refill pool.
export const BOARD_TILE_COLORS = ['red', 'blue', 'purple', 'green'];
export const MIMIC_TILE_COLOR = 'brown';

export const TILE_ABILITY = {
  red: 'sword',
  blue: 'shield',
  purple: 'magic',
  green: 'potion',
  brown: null
};

export const TILE_TEXTURE_KEY = {
  red: 'tile_red',
  blue: 'tile_blue',
  purple: 'tile_purple',
  green: 'tile_green',
  brown: 'tile_brown'
};

export const ABILITY_BASE = {
  sword: { damage: 3 },
  shield: { block: 2 },
  magic: { damage: 2, lineLength: 3 },
  potion: { heal: 2 }
};

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
export const HERO_BASE_HP = 20;

// ---------------------------------------------------------------------------
// Depth scaling
// ---------------------------------------------------------------------------
export const ENEMY_HP_SCALE_PER_DEPTHS = 2; // +1 HP per 2 depths
export const ENEMY_DMG_SCALE_PER_DEPTHS = 5; // +1 damage per 5 depths

// ---------------------------------------------------------------------------
// Enemy base stats
// ---------------------------------------------------------------------------
export const ENEMY_STATS = {
  skeleton: { name: 'Skeleton Knight', hp: 6, speed: 1, damage: 3, texture: 'skeleton' },
  mimic: { name: 'Mimic Chest', hp: 8, speed: 0, ambushDamage: 5, revealedDamage: 2, texture: 'mimic' },
  cultist: { name: 'Cultist Acolyte', hp: 4, speed: 0, healAmount: 3, texture: 'cultist' },
  bat: { name: 'Rattling Bat', hp: 3, speed: 2, damage: 1, dodgeChance: 0.2, texture: 'bat' },
  mushroom: { name: 'Walking Mushroom', hp: 5, speed: 0, poisonDamage: 2, texture: 'mushroom' },
  wraith: { name: 'Wraith', hp: 10, speed: 1, damage: 4, magicImmune: true, texture: 'wraith' }
};

// Enemy act order each enemy phase.
export const ENEMY_ACT_ORDER = ['mimic', 'skeleton', 'cultist', 'bat', 'mushroom', 'wraith'];

// ---------------------------------------------------------------------------
// Spawn tables
// ---------------------------------------------------------------------------
export const SPAWN_TABLES = [
  { minDepth: 1, maxDepth: 3, types: ['skeleton', 'mimic'], maxEnemies: 3 },
  { minDepth: 4, maxDepth: 6, types: ['skeleton', 'mimic', 'cultist', 'bat', 'mushroom'], maxEnemies: 4 },
  { minDepth: 7, maxDepth: 9, types: ['skeleton', 'mimic', 'cultist', 'bat', 'mushroom', 'wraith'], maxEnemies: 5 },
  { minDepth: 10, maxDepth: Infinity, types: ['skeleton', 'mimic', 'cultist', 'bat', 'mushroom', 'wraith'], maxEnemies: 6 }
];

export function getSpawnTableForDepth(depth) {
  return SPAWN_TABLES.find(t => depth >= t.minDepth && depth <= t.maxDepth) || SPAWN_TABLES[SPAWN_TABLES.length - 1];
}

// ---------------------------------------------------------------------------
// Camp upgrade card pool (20 cards)
// ---------------------------------------------------------------------------
export const RARITY = { COMMON: 'common', RARE: 'rare', LEGENDARY: 'legendary' };

export const RARITY_WEIGHTS = { [RARITY.COMMON]: 10, [RARITY.RARE]: 4, [RARITY.LEGENDARY]: 1 };

export const UPGRADE_POOL = [
  // Common
  { id: 'sharpened_blade', name: 'Sharpened Blade', desc: 'Sword deals +1 damage.', rarity: RARITY.COMMON, effect: { type: 'stat', key: 'swordDamage', value: 1 } },
  { id: 'reinforced_shield', name: 'Reinforced Shield', desc: 'Shield grants +1 Block.', rarity: RARITY.COMMON, effect: { type: 'stat', key: 'shieldBlock', value: 1 } },
  { id: 'arcane_focus', name: 'Arcane Focus', desc: 'Magic deals +1 damage.', rarity: RARITY.COMMON, effect: { type: 'stat', key: 'magicDamage', value: 1 } },
  { id: 'healing_salve', name: 'Healing Salve', desc: 'Potion heals +1 HP.', rarity: RARITY.COMMON, effect: { type: 'stat', key: 'potionHeal', value: 1 } },
  { id: 'sturdy_boots', name: 'Sturdy Boots', desc: '+3 max HP.', rarity: RARITY.COMMON, effect: { type: 'stat', key: 'maxHp', value: 3 } },
  { id: 'quick_reflexes', name: 'Quick Reflexes', desc: 'Once per depth, redo a failed swap for free.', rarity: RARITY.COMMON, effect: { type: 'flag', key: 'quickReflexes' } },
  { id: 'scavenged_armor', name: 'Scavenged Armor', desc: 'Start each depth with 2 Block.', rarity: RARITY.COMMON, effect: { type: 'flag', key: 'startingBlock', value: 2 } },
  { id: 'torchlight', name: 'Torchlight', desc: 'Mimics start revealed.', rarity: RARITY.COMMON, effect: { type: 'flag', key: 'torchlight' } },
  { id: 'light_footing', name: 'Light Footing', desc: 'Immune to Mushroom poison.', rarity: RARITY.COMMON, effect: { type: 'flag', key: 'poisonImmune' } },
  { id: 'extra_rations', name: 'Extra Rations', desc: 'Heal 5 HP immediately (one-time).', rarity: RARITY.COMMON, effect: { type: 'instant', key: 'healNow', value: 5 } },

  // Rare
  { id: 'chain_lightning', name: 'Chain Lightning', desc: 'Magic kills bounce to another enemy for half damage.', rarity: RARITY.RARE, effect: { type: 'flag', key: 'chainLightning' } },
  { id: 'vampiric_edge', name: 'Vampiric Edge', desc: 'Heal 1 HP whenever Sword kills an enemy.', rarity: RARITY.RARE, effect: { type: 'flag', key: 'vampiricEdge' } },
  { id: 'iron_wall', name: 'Iron Wall', desc: 'Block lasts 2 turns instead of 1.', rarity: RARITY.RARE, effect: { type: 'flag', key: 'ironWall' } },
  { id: 'bat_swatter', name: 'Bat Swatter', desc: 'Deal double damage to Bats.', rarity: RARITY.RARE, effect: { type: 'flag', key: 'batSwatter' } },
  { id: 'purifying_strike', name: 'Purifying Strike', desc: 'Sword removes poison from the hero.', rarity: RARITY.RARE, effect: { type: 'flag', key: 'purifyingStrike' } },
  { id: 'cultists_bane', name: "Cultist's Bane", desc: 'A damaged Cultist cannot heal that turn.', rarity: RARITY.RARE, effect: { type: 'flag', key: 'cultistsBane' } },

  // Legendary
  { id: 'fireball', name: 'Fireball', desc: 'Once per depth: deal 8 damage to all enemies (tap icon).', rarity: RARITY.LEGENDARY, effect: { type: 'active', key: 'fireball' } },
  { id: 'double_strike', name: 'Double Strike', desc: 'Sword hits 2 adjacent enemies.', rarity: RARITY.LEGENDARY, effect: { type: 'flag', key: 'doubleStrike' } },
  { id: 'time_warp', name: 'Time Warp', desc: 'The first match each depth triggers twice.', rarity: RARITY.LEGENDARY, effect: { type: 'flag', key: 'timeWarp' } },
  { id: 'phoenix_down', name: 'Phoenix Down', desc: 'Revive with full HP once (consumed on use).', rarity: RARITY.LEGENDARY, effect: { type: 'flag', key: 'phoenixDown' } }
];

// ---------------------------------------------------------------------------
// Expedition Journal (meta-progression skill tree) - 22 nodes total
// ---------------------------------------------------------------------------
export const INSIGHT_PER_DEPTH = 3;
export const INSIGHT_PER_3_KILLS = 1;
export const INSIGHT_MILESTONE_BONUS = { 5: 10, 10: 25, 15: 50, 20: 100 };

export const JOURNAL_BRANCHES = {
  blade: { name: 'Blade', color: 0xc0392b },
  aegis: { name: 'Aegis', color: 0x2e6da4 },
  arcanum: { name: 'Arcanum', color: 0x8e44ad },
  hybrid: { name: 'Hybrid', color: 0xd9a441 }
};

export const JOURNAL_NODES = [
  // --- Blade branch ---
  { id: 'blade_1', branch: 'blade', name: 'Honed Edge', desc: 'Sword deals +1 damage.', cost: 3, prereqs: [], effect: { key: 'swordDamage', value: 1 } },
  { id: 'blade_2', branch: 'blade', name: 'Twin Strike', desc: '10% chance Sword triggers twice.', cost: 5, prereqs: ['blade_1'], effect: { key: 'twinStrikeChance', value: 0.1 } },
  { id: 'blade_3', branch: 'blade', name: 'Bloodlust', desc: 'Heal 1 HP on any enemy kill.', cost: 5, prereqs: ['blade_1'], effect: { key: 'bloodlust', value: 1 } },
  { id: 'blade_4', branch: 'blade', name: 'Executioner', desc: 'Sword deals +2 damage to enemies below 30% HP.', cost: 8, prereqs: ['blade_2'], effect: { key: 'executionerBonus', value: 2 } },
  { id: 'blade_5', branch: 'blade', name: "Weapon Master", desc: 'First Sword match each depth deals double damage.', cost: 8, prereqs: ['blade_3'], effect: { key: 'firstSwordDouble', value: true } },
  { id: 'blade_6', branch: 'blade', name: "Berserker's Vow", desc: 'Sword damage +2, but max HP -2.', cost: 12, prereqs: ['blade_4', 'blade_5'], effect: { key: 'berserkersVow', value: true } },

  // --- Aegis branch ---
  { id: 'aegis_1', branch: 'aegis', name: 'Padded Armor', desc: '+2 max HP.', cost: 3, prereqs: [], effect: { key: 'maxHp', value: 2 } },
  { id: 'aegis_2', branch: 'aegis', name: 'Fortify', desc: 'Shield grants +1 Block.', cost: 5, prereqs: ['aegis_1'], effect: { key: 'shieldBlock', value: 1 } },
  { id: 'aegis_3', branch: 'aegis', name: 'Second Skin', desc: 'Block persists 1 extra turn.', cost: 5, prereqs: ['aegis_1'], effect: { key: 'blockDurationBonus', value: 1 } },
  { id: 'aegis_4', branch: 'aegis', name: 'Iron Resolve', desc: 'Start every depth with 1 Block.', cost: 8, prereqs: ['aegis_2'], effect: { key: 'startingBlock', value: 1 } },
  { id: 'aegis_5', branch: 'aegis', name: 'Thick Hide', desc: 'Reduce all incoming damage by 1 (min 1).', cost: 8, prereqs: ['aegis_3'], effect: { key: 'damageReduction', value: 1 } },
  { id: 'aegis_6', branch: 'aegis', name: "Guardian's Bulwark", desc: 'Block also absorbs poison damage.', cost: 12, prereqs: ['aegis_4', 'aegis_5'], effect: { key: 'blockAbsorbsPoison', value: true } },

  // --- Arcanum branch ---
  { id: 'arcanum_1', branch: 'arcanum', name: 'Focused Mind', desc: 'Magic deals +1 damage.', cost: 3, prereqs: [], effect: { key: 'magicDamage', value: 1 } },
  { id: 'arcanum_2', branch: 'arcanum', name: 'Wide Cast', desc: 'Magic hits a 5-tile line instead of 3.', cost: 5, prereqs: ['arcanum_1'], effect: { key: 'magicLineLength', value: 5 } },
  { id: 'arcanum_3', branch: 'arcanum', name: 'Arcane Echo', desc: '15% chance Magic casts twice.', cost: 5, prereqs: ['arcanum_1'], effect: { key: 'arcaneEchoChance', value: 0.15 } },
  { id: 'arcanum_4', branch: 'arcanum', name: 'Piercing Bolts', desc: 'Magic ignores Wraith immunity.', cost: 8, prereqs: ['arcanum_2'], effect: { key: 'piercesWraithImmunity', value: true } },
  { id: 'arcanum_5', branch: 'arcanum', name: 'Spell Weaving', desc: 'Matching 4+ Purple tiles doubles Magic damage.', cost: 8, prereqs: ['arcanum_3'], effect: { key: 'spellWeaving', value: true } },
  { id: 'arcanum_6', branch: 'arcanum', name: "Archmage's Grimoire", desc: 'Magic +2 damage, hits in a cross pattern.', cost: 12, prereqs: ['arcanum_4', 'arcanum_5'], effect: { key: 'crossMagic', value: true } },

  // --- Hybrid nodes ---
  { id: 'hybrid_1', branch: 'hybrid', name: "Adventurer's Grit", desc: '+1 max HP, +1 Insight per depth cleared.', cost: 6, prereqs: ['blade_1', 'aegis_1'], effect: { key: 'adventurersGrit', value: true } },
  { id: 'hybrid_2', branch: 'hybrid', name: 'Battle Priest', desc: 'Potion heals +2 and grants 1 Block.', cost: 10, prereqs: ['aegis_2', 'arcanum_1'], effect: { key: 'battlePriest', value: true } },
  { id: 'hybrid_3', branch: 'hybrid', name: 'Elemental Fury', desc: 'Sword kills burst 1 Magic damage to adjacent enemies.', cost: 10, prereqs: ['blade_2', 'arcanum_2'], effect: { key: 'elementalFury', value: true } },
  { id: 'hybrid_4', branch: 'hybrid', name: 'Dungeon Master', desc: 'All ability tiles gain +1 effect.', cost: 16, prereqs: ['blade_4', 'aegis_4', 'arcanum_4'], effect: { key: 'dungeonMaster', value: true } }
];

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = {
  JOURNAL: 'dungeonSweeper_journal',
  BEST_RUN: 'dungeonSweeper_bestRun',
  PLAYER_NAME: 'dungeonSweeper_playerName',
  DAILY_DUNGEON_CACHE: 'dungeonSweeper_dailyDungeonCache'
};

export const COLORS = {
  PARCHMENT: 0xe8d9b5,
  WOOD: 0x8b5a2b,
  INK: 0x1a1a1a,
  BLOOD_RED: 0xc0392b,
  BONE: 0xe5e5e0
};
