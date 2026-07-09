/**
 * Shared bridge between the touch UI (TouchControls.tsx, plain DOM, outside
 * the Canvas) and PlayerController (inside the Canvas, driving movement
 * every frame). Same mutable-singleton pattern as gameClock/playerTransform
 * in lib/world.ts: writing/reading a plain object every frame is cheap and
 * needs no React re-renders on either side.
 */

/**
 * Analog joystick vector, both axes in [-1, 1]. `x` is strafe (right
 * positive), `y` is forward (forward positive) — deliberately the same
 * sign convention as the keyboard's inputRight/inputForward so
 * PlayerController can just add them together.
 */
export const touchMoveVector = { x: 0, y: 0 }

/**
 * PlayerController assigns its real triggerShout() here once on mount, so
 * the on-screen SHOUT button calls the exact same function Space does —
 * not a re-implementation of it.
 */
export const shoutTrigger = { current: () => {} }
