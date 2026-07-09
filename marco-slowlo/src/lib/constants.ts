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

/** There is exactly one bot in the tag match — Player vs. "the Bot". */
export const BOT_COUNT = 1

/** Fixed id for the single bot, referenced directly by gameStore/SoundBubbleManager. */
export const BOT_ID = 'bot-1'

/** Bots must spawn at least this far from the player's (0,0,0) spawn point. */
export const BOT_SPAWN_MIN_DISTANCE = 15

/**
 * Seconds of total tag-immunity at the very start of a match (measured from
 * elapsed match time), so the hunter can't tag the instant the match
 * begins — mostly a safety net now that BOT_SPAWN_MIN_DISTANCE already
 * forces a real gap to close first.
 */
export const ROUND_START_GRACE = 1.0

/** Seconds the shouter is rooted in place (0 speed) immediately after shouting. */
export const SHOUT_ROOT_DURATION = 0.5

/**
 * Seconds of tag-immunity after any role reversal. A bubble that just
 * caused a tag is owned by the now-former "It", so it structurally can't
 * cause another tag next frame (only the CURRENT "It"'s bubble can tag) —
 * this is purely a defensive margin against any other lingering bubble
 * causing an immediate re-flip the same instant.
 */
export const TAG_IMMUNITY_DURATION = 0.3

/** Length of a match, in seconds. */
export const MATCH_DURATION = 60

/**
 * Distance, in meters, within which the hunting bot commits to a shout
 * attempt on the evader. Too far and the bubble would never catch up;
 * this is roughly "close enough that a miss is a real risk."
 */
export const BOT_HUNT_AGGRO_RANGE = 10

/** Number of scattered cover pillars generated across the floor. */
export const COVER_PILLAR_COUNT = 42

/** Radius of each cover pillar's collision cylinder, in meters. */
export const COVER_PILLAR_RADIUS = 0.9

/** Visual height of each cover pillar, in meters. */
export const COVER_PILLAR_HEIGHT = 5.5

/** Keep-out radius around the arena center so pillars never spawn on the player's spawn point. */
export const COVER_PILLAR_CLEAR_RADIUS = 4

/** PositionalAudio reference distance, in meters — volume halves roughly every this many meters. */
export const AUDIO_REFERENCE_DISTANCE = 5

/**
 * Hard cap on the simulated delta applied in any single frame, in seconds.
 * Every system (player movement, bot movement, and the shared game clock
 * that drives bubble-radius math) must clamp with this SAME constant, or
 * the wavefront and the actors it's chasing will silently drift onto
 * different timelines under frame-rate hitches. See lib/world.ts (gameClock).
 */
export const MAX_FRAME_DELTA = 0.05
