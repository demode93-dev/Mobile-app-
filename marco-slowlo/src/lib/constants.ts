/** Tuning knobs for the core "outrun your own voice" loop. */

/** Walking speed, m/s — also the fixed growth rate of every sound bubble. */
export const WALK_SPEED = 3.0

/** Sprint speed, m/s — must exceed WALK_SPEED or a shout is unsurvivable. */
export const SPRINT_SPEED = 6.2

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

/**
 * Hard cap on the simulated delta applied in any single frame, in seconds.
 * Every system (player movement, bot movement, and the shared game clock
 * that drives bubble-radius math) must clamp with this SAME constant, or
 * the wavefront and the actors it's chasing will silently drift onto
 * different timelines under frame-rate hitches. See lib/world.ts (gameClock).
 */
export const MAX_FRAME_DELTA = 0.05
