// Central constants for Dungeon Sweeper. No magic numbers outside this file.

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;
export const SAFE_BOTTOM = 20; // margin reserved above the physical screen edge

// ---------------------------------------------------------------------------
// Render depth tiers (per-scene; Phaser depth sorting doesn't cross scenes).
// Every setDepth() call in the project should reference one of these instead
// of a raw number, so layering stays intentional and easy to reason about.
// ---------------------------------------------------------------------------
export const DEPTH = {
  BACKGROUND: 0,
  GRID: 1,
  TILE: 2,
  POISON_RING: 4,
  ENEMY: 6,
  ENEMY_HP_BG: 7,
  ENEMY_HP_FILL: 8,
  HUD: 10,
  TILE_HIGHLIGHT: 15,
  HERO: 20,
  FLOATING_TEXT: 30,
  MODAL_OVERLAY: 100,
  MODAL_BG: 101,
  MODAL_CARD: 102,
  MODAL_TEXT: 103
};

// ---------------------------------------------------------------------------
// Board / Grid
// ---------------------------------------------------------------------------
export const GRID_SIZE = 5;
export const TILE_SIZE = 64;
export const GRID_OFFSET_X = 35;
export const GRID_OFFSET_Y = 180;
export const HERO_START_ROW = 2;
export const HERO_START_COL = 2;

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
// Expedition Journal (meta-progression skill tree) - 18 nodes, 6 per branch
// ---------------------------------------------------------------------------
export const INSIGHT_PER_DEPTH = 3;
export const INSIGHT_PER_3_KILLS = 1;
export const INSIGHT_MILESTONE_BONUS = { 5: 10, 10: 25, 15: 50, 20: 100 };

export function computeInsightEarned({ depthReached, enemiesKilled }) {
  let earned = depthReached * INSIGHT_PER_DEPTH + Math.floor(enemiesKilled / 3) * INSIGHT_PER_3_KILLS;
  for (const [milestone, bonus] of Object.entries(INSIGHT_MILESTONE_BONUS)) {
    if (depthReached >= Number(milestone)) earned += bonus;
  }
  return earned;
}

export const JOURNAL_BRANCHES = {
  blade: { name: 'Blade', color: 0xc0392b },
  aegis: { name: 'Aegis', color: 0x2e6da4 },
  arcanum: { name: 'Arcanum', color: 0x8e44ad }
};

// id -> display data (name/icon/cost/tree position/prerequisite/human-readable effect text)
export const JOURNAL_TREE = {
  blade: [
    { id: '1A', name: "Veteran's Grip", icon: 'VG', cost: 20, row: 0, column: 'center', prerequisite: null, effect: 'Sword damage +1' },
    { id: '1D', name: 'Opening Strike', icon: 'OS', cost: 30, row: 1, column: 'left', prerequisite: '1A', effect: 'First Sword match each depth deals double' },
    { id: '1B', name: 'Blade Sharpener', icon: 'BS', cost: 40, row: 1, column: 'right', prerequisite: '1A', effect: 'Sword damage +2 base' },
    { id: '1E', name: 'Blood Price', icon: 'BP', cost: 60, row: 2, column: 'left', prerequisite: '1D', effect: 'Sword +3 damage, -5 max HP' },
    { id: '1C', name: 'Dual Wield', icon: 'DW', cost: 80, row: 2, column: 'right', prerequisite: '1B', effect: 'Start with Double Strike active' },
    { id: '1F', name: 'Executioner', icon: 'EX', cost: 120, row: 3, column: 'center', prerequisite: '1E', effect: 'Sword insta-kills enemies below 30% HP' }
  ],
  aegis: [
    { id: '2A', name: 'Reinforced Plating', icon: 'RP', cost: 20, row: 0, column: 'center', prerequisite: null, effect: '+5 max HP' },
    { id: '2D', name: 'Second Skin', icon: 'SS', cost: 30, row: 1, column: 'left', prerequisite: '2A', effect: 'Start each depth with 2 Block' },
    { id: '2B', name: 'Tower Shield', icon: 'TS', cost: 40, row: 1, column: 'right', prerequisite: '2A', effect: 'Block gained is now 3' },
    { id: '2E', name: 'Retaliation', icon: 'RT', cost: 60, row: 2, column: 'left', prerequisite: '2D', effect: 'Block absorbs deal 2 damage back' },
    { id: '2C', name: 'Unbreakable', icon: 'UW', cost: 80, row: 2, column: 'right', prerequisite: '2B', effect: 'Start with Iron Wall active' },
    { id: '2F', name: 'Fortress', icon: 'FT', cost: 120, row: 3, column: 'center', prerequisite: '2E', effect: 'Cannot take more than 5 damage per hit' }
  ],
  arcanum: [
    { id: '3A', name: 'Arcane Primer', icon: 'AP', cost: 20, row: 0, column: 'center', prerequisite: null, effect: 'Magic damage +1' },
    { id: '3D', name: 'Scout Training', icon: 'ST', cost: 30, row: 1, column: 'left', prerequisite: '3A', effect: 'Reveal one enemy type at depth start' },
    { id: '3B', name: 'Potion Mastery', icon: 'PM', cost: 40, row: 1, column: 'right', prerequisite: '3A', effect: 'Potion healing is now 3' },
    { id: '3E', name: 'Treasure Sense', icon: 'TS', cost: 60, row: 2, column: 'left', prerequisite: '3D', effect: 'Campfire shows 4 cards instead of 3' },
    { id: '3C', name: 'Alchemical Genius', icon: 'AG', cost: 80, row: 2, column: 'right', prerequisite: '3B', effect: 'Start with Chain Lightning active' },
    { id: '3F', name: 'Grand Arcanist', icon: 'GA', cost: 120, row: 3, column: 'center', prerequisite: '3E', effect: 'Once per run, redraw campfire cards' }
  ]
};

// id -> machine-readable modifier effect, applied to a fresh run's UpgradeManager
// modifiers (see CombatManager/GameScene/CampfireScene for how each key is consumed).
export const JOURNAL_NODE_MODIFIERS = {
  '1A': { swordDamage: 1 },
  '1D': { firstSwordDouble: true },
  '1B': { swordDamage: 2 },
  '1E': { swordDamage: 3, maxHp: -5 },
  '1C': { doubleStrike: true },
  '1F': { executionerInstaKill: true },
  '2A': { maxHp: 5 },
  '2D': { startingBlock: 2 },
  '2B': { shieldBlock: 1 },
  '2E': { retaliationDamage: 2 },
  '2C': { ironWall: true },
  '2F': { damageCap: 5 },
  '3A': { magicDamage: 1 },
  '3D': { scoutTraining: true },
  '3B': { potionHeal: 1 },
  '3E': { campfireCardCount: 4 },
  '3C': { chainLightning: true },
  '3F': { campfireRedraw: true }
};

export function computeJournalModifiers(unlockedNodeIds = []) {
  const mods = {};
  for (const id of unlockedNodeIds) {
    const effect = JOURNAL_NODE_MODIFIERS[id];
    if (!effect) continue;
    for (const [key, value] of Object.entries(effect)) {
      if (typeof value === 'number') mods[key] = (mods[key] || 0) + value;
      else mods[key] = value;
    }
  }
  return mods;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = {
  JOURNAL_NODES: 'dungeonSweeper_journalNodes',
  INSIGHT: 'dungeonSweeper_insight',
  BEST_RUN: 'dungeonSweeper_bestRun',
  PLAYER_NAME: 'dungeonSweeper_playerName',
  DAILY_DUNGEON_CACHE: 'dungeonSweeper_dailyDungeonCache',
  LAST_DAILY_ENTRY: 'dungeonSweeper_lastDailyEntry',
  DAILY_SCORES: 'dungeonSweeper_dailyScores'
};

export const COLORS = {
  PARCHMENT: 0xe8d9b5,
  WOOD: 0x8b5a2b,
  INK: 0x1a1a1a,
  BLOOD_RED: 0xc0392b,
  BONE: 0xe5e5e0
};
