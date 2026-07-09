import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store/gameStore'
import { SoundBubbleView } from './SoundBubble'
import { isBubbleExpired, isPointCaughtByBubble } from '../lib/physics'
import { gameClock, playerTransform } from '../lib/world'

/** Owns the bubble lifecycle: expires old bubbles and runs the real-time
 * intersection test against the player's hitbox every frame. Rendering of
 * the still-alive bubbles is driven by the (infrequently changing) zustand
 * bubble list, while expiry/collision reads happen straight off the shared
 * gameClock (not THREE's wall clock — see lib/world.ts) so timing stays on
 * the same timeline as player/bot movement regardless of frame-rate hitches.
 *
 * Deliberately no hitbox-radius padding here: every shout originates exactly
 * at the shouter's own position (distance 0, radius 0), so padding the catch
 * radius with the player's body size would make `dist <= radius + padding`
 * true for a mandatory stretch right after every shout — even at full sprint
 * — since a constant offset dominates while both distance and radius are
 * still small. A bare point/sphere check is what makes "sprint strictly
 * faster than your own voice" the actual, winnable rule (see the "sprinting
 * faster than growthRate stays safe indefinitely" case in physics.test.ts). */
export function SoundBubbleManager() {
  const bubbles = useGameStore((s) => s.bubbles)

  useFrame(() => {
    const now = gameClock.elapsed
    const { phase, bubbles: currentBubbles, pruneExpiredBubbles, endGame } = useGameStore.getState()
    if (currentBubbles.length === 0) return

    const alive = new Set<string>()
    let caughtByOwnerId: string | null = null

    for (const bubble of currentBubbles) {
      if (isBubbleExpired(bubble, now)) continue
      alive.add(bubble.id)

      if (phase === 'playing' && !caughtByOwnerId) {
        if (isPointCaughtByBubble(playerTransform.position, bubble, now)) {
          caughtByOwnerId = bubble.ownerId
        }
      }
    }

    if (alive.size !== currentBubbles.length) {
      pruneExpiredBubbles(alive)
    }

    if (caughtByOwnerId) {
      endGame(caughtByOwnerId)
    }
  })

  return (
    <>
      {bubbles.map((b) => (
        <SoundBubbleView key={b.id} bubble={b} />
      ))}
    </>
  )
}
