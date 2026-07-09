import { useFrame } from '@react-three/fiber'
import { gameClock } from '../lib/world'
import { MAX_FRAME_DELTA } from '../lib/constants'

/**
 * Advances the single shared game clock every frame, using the same clamped
 * delta every other moving system uses. Must be mounted before any
 * component that reads `gameClock.elapsed` in the same frame (R3F runs
 * useFrame callbacks in subscription order, so keep this first in the
 * Experience tree) — see lib/world.ts for why a single clock matters.
 */
export function GameClockDriver() {
  useFrame((_state, rawDelta) => {
    gameClock.elapsed += Math.min(rawDelta, MAX_FRAME_DELTA)
  })
  return null
}
