import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store/gameStore'
import { SoundBubbleView } from './SoundBubble'
import { isBubbleExpired, isLineOfSightBlocked, isPointCaughtByBubble } from '../lib/physics'
import { gameClock, playerTransform } from '../lib/world'
import { COVER_PILLARS } from '../lib/pillars'
import { ROUND_START_GRACE, SELF_BUBBLE_CATCH_GRACE } from '../lib/constants'

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
 * faster than growthRate stays safe indefinitely" case in physics.test.ts).
 *
 * Three exemptions layered on top of that bare check:
 *  - ROUND_START_GRACE: total invulnerability for the first stretch of a
 *    round, so a bot can't shout the instant the player spawns in.
 *  - SELF_BUBBLE_CATCH_GRACE: a shouter is immune to their OWN bubble for a
 *    window sized to exactly cover the root-and-recover gap created by
 *    SHOUT_ROOT_DURATION (see PlayerController) — without it, rooting the
 *    player after a shout would make every shout unavoidable.
 *  - Cover: if a pillar sits on the straight line between a bubble's origin
 *    and the player, the wavefront is treated as blocked ("acoustic
 *    shadow") and can't catch them, regardless of radius. */
export function SoundBubbleManager() {
  const bubbles = useGameStore((s) => s.bubbles)

  useFrame(() => {
    const now = gameClock.elapsed
    const { phase, survivalTime, bubbles: currentBubbles, pruneExpiredBubbles, endGame } =
      useGameStore.getState()
    if (currentBubbles.length === 0) return

    const alive = new Set<string>()
    let caughtByOwnerId: string | null = null
    const invulnerable = survivalTime < ROUND_START_GRACE

    for (const bubble of currentBubbles) {
      if (isBubbleExpired(bubble, now)) continue
      alive.add(bubble.id)

      if (phase === 'playing' && !caughtByOwnerId && !invulnerable) {
        const isOwnRecentBubble =
          bubble.ownerId === 'player' && now - bubble.originTime < SELF_BUBBLE_CATCH_GRACE
        const inCover = isLineOfSightBlocked(bubble.origin, playerTransform.position, COVER_PILLARS)

        if (
          !isOwnRecentBubble &&
          !inCover &&
          isPointCaughtByBubble(playerTransform.position, bubble, now)
        ) {
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
