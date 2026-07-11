/** Tuning knobs for the core Pet Store Break Out loop: movement, the
 * Sensory Pulse threat wave, and Chent's camouflage. */

/** Walking speed, m/s. */
export const WALK_SPEED = 3.0

/** Sprint speed, m/s — tuned high for a hyper-agile feel. Movement itself
 * has no velocity/momentum (see the position update in PlayerController /
 * Bots: it's a direct `position += dx * speed * delta` every frame, nothing
 * else), so releasing input already stops Chent dead on a dime regardless
 * of how high this number goes. */
export const SPRINT_SPEED = 9.0

/** How fast the player/camera turns to face input direction, in 1/s (lerp rate). */
export const TURN_SMOOTHING = 12

/**
 * There's no separate sprint button on touch — pushing the joystick past
 * this fraction of its max radius sprints instead, the common mobile
 * convention ("push harder to run"). Still gated by the same stamina rule
 * as Shift on keyboard; this only decides intent.
 */
export const TOUCH_SPRINT_DEFLECTION = 0.9

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

/**
 * Fixed growth rate of every Sensory Pulse wavefront, in m/s — deliberately
 * its own tunable rather than reusing WALK_SPEED, and deliberately slow:
 * the survival check is "find a matching color and camouflage," not "outrun
 * the wave," so this needs to stay a manageable pace that gives a real
 * window to read the pulse, spot an obstacle, and react.
 */
export const SENSORY_PULSE_GROWTH_RATE = 2.0

/** A Sensory Pulse despawns once its wavefront reaches this radius, in meters. */
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

/** Length of a match, in seconds — a strict 3:00 round. */
export const MATCH_DURATION = 180

/**
 * Distance, in meters, within which the hunting bot commits to a shout
 * attempt on the evader. Too far and the bubble would never catch up;
 * this is roughly "close enough that a miss is a real risk."
 */
export const BOT_HUNT_AGGRO_RANGE = 10

/** Visual height of each cover pillar, in meters — constant across floors;
 * count/spacing are per-level, radius is per-item-kind (see lib/levels.ts
 * and lib/pillars.ts). */
export const COVER_PILLAR_HEIGHT = 5.5

/** Keep-out radius around the arena center so pillars never spawn on the player's spawn point. */
export const COVER_PILLAR_CLEAR_RADIUS = 4

/**
 * How close (to an obstacle's surface, in meters) an evader must be to
 * successfully camouflage against it — checked both when the ability is
 * attempted and again, live, at the instant a Sensory Pulse would hit.
 */
export const CAMOUFLAGE_RANGE = 2.4

/** How fast the chameleon's displayed body color chases its target color
 * (native or camouflaged), in 1/s — a lerp rate, not a hard duration. */
export const CAMOUFLAGE_LERP_RATE = 12

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
