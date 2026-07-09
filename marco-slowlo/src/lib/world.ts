import * as THREE from 'three'

/**
 * High-frequency transforms (player + bots) live here as plain mutable
 * objects rather than in the zustand store. They are written and read every
 * frame inside useFrame callbacks; routing them through React/zustand state
 * would trigger a re-render up to 60 times a second for no benefit, since
 * nothing about their *shape* changes frame to frame — only their values do,
 * and Three.js meshes already own that mutation loop.
 *
 * The zustand store (see gameStore.ts) is reserved for low-frequency,
 * HUD-relevant state: game phase, stamina, cooldown, and the bubble list
 * (which really does need to mount/unmount React nodes).
 */
export interface ActorTransform {
  position: THREE.Vector3
  yaw: number
}

export const playerTransform: ActorTransform = {
  position: new THREE.Vector3(0, 0, 0),
  yaw: 0,
}

const botTransforms = new Map<string, ActorTransform>()

export function getBotTransform(id: string): ActorTransform {
  let t = botTransforms.get(id)
  if (!t) {
    t = { position: new THREE.Vector3(), yaw: 0 }
    botTransforms.set(id, t)
  }
  return t
}

export function allActorTransforms(): { id: string; transform: ActorTransform }[] {
  const list = [{ id: 'player', transform: playerTransform }]
  for (const [id, transform] of botTransforms) list.push({ id, transform })
  return list
}

/**
 * Single authoritative "game time" used for ALL bubble-physics timestamps
 * (origin time, radius-at, expiry) and shout scheduling.
 *
 * This must NOT be `state.clock.elapsedTime` (THREE's real wall-clock).
 * Player/bot movement is integrated frame-by-frame using a *clamped* delta
 * (see MAX_FRAME_DELTA in constants.ts) so a lag spike can't teleport an
 * actor through a wall in one giant step. If bubble radii were computed from
 * real elapsed time while movement was computed from clamped elapsed time,
 * the two would drift apart under any frame-rate hitch: the wavefront would
 * keep growing at full real-time speed while the player's simulated
 * displacement fell behind, silently breaking the "sprint speed beats
 * growth rate" guarantee the whole game is built on. Advancing this clock by
 * the same clamped delta every frame (see GameClockDriver) keeps every
 * system on one consistent timeline.
 */
export const gameClock = { elapsed: 0 }
