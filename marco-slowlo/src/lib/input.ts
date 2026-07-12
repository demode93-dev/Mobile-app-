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
 * PlayerController assigns its real triggerAction() here once on mount, so
 * the on-screen action button calls the exact same function Space/click
 * does — not a re-implementation of it. What it does depends on role: a
 * Sensory Pulse while hunting, a camouflage attempt while evading.
 */
export const actionTrigger = { current: () => {} }

/**
 * Radial deadzone for an analog stick vector: magnitudes strictly inside
 * `deadzone` (a fraction of max deflection, 0-1) collapse to exactly
 * (0, 0) — a resting or barely-drifting thumb produces zero game input,
 * not a faint one. Anything at or past the deadzone passes through
 * completely unchanged (no rescale): speed is a binary walk/sprint choice
 * downstream, not proportional to deflection, so there's nothing for a
 * rescaled range to buy here.
 */
export function applyJoystickDeadzone(x: number, y: number, deadzone: number): { x: number; y: number } {
  if (Math.hypot(x, y) < deadzone) return { x: 0, y: 0 }
  return { x, y }
}
