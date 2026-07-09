/** Tuning knobs for the core "outrun your own voice" loop. */

/** Walking speed, m/s — also the fixed growth rate of every sound bubble. */
export const WALK_SPEED = 3.0

/** Sprint speed, m/s — must exceed WALK_SPEED or a shout is unsurvivable. */
export const SPRINT_SPEED = 6.0

/** How fast the player/camera turns to face input direction, in 1/s (lerp rate). */
export const TURN_SMOOTHING = 12

/** Radius of the player's own collision hitbox, in meters. */
export const PLAYER_HITBOX_RADIUS = 0.45

/** Seconds a full stamina bar lasts under continuous sprint. */
export const STAMINA_MAX = 4.5

/** Seconds of standing/walking (non-sprint) to fully refill stamina from empty. */
export const STAMINA_REGEN_TIME = 3.5

/** Minimum stamina fraction required to trigger a sprint. */
export const STAMINA_SPRINT_MIN = 0.08

/** Seconds between allowed shouts. */
export const SHOUT_COOLDOWN = 2.2

/** A shout bubble despawns once its wavefront reaches this radius, in meters. */
export const BUBBLE_MAX_RADIUS = 34

/** Half-extent of the square arena floor, in meters. */
export const ARENA_HALF_SIZE = 22

/** Number of wandering AI "shouters" sharing the arena. */
export const BOT_COUNT = 3

/** Bots must spawn at least this far from the player's (0,0,0) spawn point. */
export const BOT_SPAWN_MIN_DISTANCE = 15

/**
 * Seconds of total invulnerability at the very start of a round (measured
 * from `survivalTime`, which only ticks while phase === 'playing'), so a
 * bot can't shout the instant the player spawns in.
 */
export const ROUND_START_GRACE = 1.0

/** Seconds the player is rooted in place (0 speed) immediately after shouting. */
export const SHOUT_ROOT_DURATION = 0.5

/**
 * Seconds after a bubble's origin during which its OWNER is immune to being
 * caught by that specific bubble. Must be >= SHOUT_ROOT_DURATION plus the
 * time it takes to close the gap the root created (root time * growth
 * rate, covered at (sprint - growth) m/s) or rooting the player would make
 * every shout an unavoidable self-catch. With the numbers above:
 * root creates a 0.5*WALK_SPEED gap the player must close by sprinting,
 * which takes 0.5*WALK_SPEED / (SPRINT_SPEED - WALK_SPEED) seconds after
 * the root ends — 1.0s total covers exactly that.
 */
export const SELF_BUBBLE_CATCH_GRACE = 1.0

/** Number of scattered cover pillars generated across the floor. */
export const COVER_PILLAR_COUNT = 42

/** Radius of each cover pillar's collision cylinder, in meters. */
export const COVER_PILLAR_RADIUS = 0.9

/** Visual height of each cover pillar, in meters. */
export const COVER_PILLAR_HEIGHT = 5.5

/** Keep-out radius around the arena center so pillars never spawn on the player's spawn point. */
export const COVER_PILLAR_CLEAR_RADIUS = 4

/**
 * Hard cap on the simulated delta applied in any single frame, in seconds.
 * Every system (player movement, bot movement, and the shared game clock
 * that drives bubble-radius math) must clamp with this SAME constant, or
 * the wavefront and the actors it's chasing will silently drift onto
 * different timelines under frame-rate hitches. See lib/world.ts (gameClock).
 */
export const MAX_FRAME_DELTA = 0.05
