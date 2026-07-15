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
  HUD: 10,
  FLOATING_TEXT: 30,
  MODAL_OVERLAY: 100,
  MODAL_BG: 101,
  MODAL_CARD: 102,
  MODAL_TEXT: 103
};

// ---------------------------------------------------------------------------
// Reveal grid
// ---------------------------------------------------------------------------
export const GRID_SIZE = 7;
export const TILE_SIZE = 50;
export const GRID_OFFSET_X = 20;
export const GRID_OFFSET_Y = 150;

// Tile-reveal outcome types.
export const REVEAL = {
  EMPTY: 'empty',
  GOLD: 'gold',
  WEAPON: 'weapon',
  ENEMY: 'enemy',
  META: 'meta'
};

// Weighted-random distribution for what a face-down cell turns out to be.
// Weapons deliberately outnumber enemies on average so broad exploration is
// usually survivable, while early bad luck still creates real risk - that's
// the push-your-luck tension the whole loop is built around.
export const REVEAL_TABLE = {
  [REVEAL.EMPTY]: 40,
  [REVEAL.GOLD]: 30,
  [REVEAL.WEAPON]: 15,
  [REVEAL.ENEMY]: 12,
  [REVEAL.META]: 3
};

export const REVEAL_TEXTURE_KEY = {
  facedown: 'tile_facedown',
  [REVEAL.EMPTY]: 'tile_empty',
  [REVEAL.GOLD]: 'icon_gold',
  [REVEAL.WEAPON]: 'icon_weapon',
  [REVEAL.META]: 'icon_meta',
  enemyBlocked: 'skeleton',
  enemyCleared: 'tile_empty'
};

// ---------------------------------------------------------------------------
// Hero / run economy
// ---------------------------------------------------------------------------
export const DUNGEON_HP = 30;
export const ENEMY_NO_WEAPON_DAMAGE = 8;
export const GOLD_MIN = 5;
export const GOLD_MAX = 20;
export const META_DROP_AMOUNT = 1;

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = {
  PLAYER_NAME: 'dungeonSweeper_playerName',
  META_CURRENCY: 'dungeonSweeper_metaCurrency',
  GOLD_RUN_SCORES: 'dungeonSweeper_goldRunScores',
  AUDIO_MUTED: 'dungeonSweeper_audioMuted',
  AUDIO_VOLUME: 'dungeonSweeper_audioVolume'
};

export const COLORS = {
  PARCHMENT: 0xe8d9b5,
  WOOD: 0x8b5a2b,
  INK: 0x1a1a1a,
  BLOOD_RED: 0xc0392b,
  BONE: 0xe5e5e0
};
