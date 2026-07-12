import * as THREE from 'three'

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

/**
 * Hold-state for the tail-grapple input (KeyE on keyboard, a dedicated
 * touch button) — a continuous "is it currently held" flag rather than a
 * one-shot trigger like actionTrigger, since GrappleController polls it
 * every frame to decide whether to attempt/maintain/release a swing.
 */
export const grappleInputHeld = { current: false }

/**
 * Bridge from GrappleController (owns the Rapier swing simulation) back to
 * PlayerController (owns rendering + the kinematic WASD movement it must
 * stand down during a swing) and the tail's stretch-vs-curled visual.
 *  - active: true for the whole swing (both the anchored pendulum AND the
 *    post-release free-flight arc) — PlayerController's WASD block no-ops
 *    while this is true, since GrappleController is writing
 *    playerTransform.position instead.
 *  - attached: true only while the rope joint actually exists. The tail
 *    stretches to anchorPoint while this is true and snaps back to its
 *    curled rest pose the instant it goes false — including during the
 *    free-flight phase, per "snap back immediately upon release".
 */
export const grappleState = {
  active: false,
  attached: false,
  anchorPoint: new THREE.Vector3(),
}
