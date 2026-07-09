import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store/gameStore'
import { SoundBubbleView } from './SoundBubble'
import { isBubbleExpired, isLineOfSightBlocked, isPointCaughtByBubble } from '../lib/physics'
import { gameClock, getBotTransform, playerTransform } from '../lib/world'
import { COVER_PILLARS } from '../lib/pillars'
import { BOT_ID, ROUND_START_GRACE } from '../lib/constants'

/** Owns the bubble lifecycle: expires old bubbles and runs the live tag
 * check every frame. Rendering of the still-alive bubbles is driven by the
 * (infrequently changing) zustand bubble list, while expiry/tag reads
 * happen straight off the shared gameClock (not THREE's wall clock — see
 * lib/world.ts) so timing stays on the same timeline as player/bot movement
 * regardless of frame-rate hitches.
 *
 * Tag rule: only a bubble owned by whoever is CURRENTLY "It" can tag the
 * other party. This one condition quietly retires the old "self-catch"
 * problem entirely — a bubble can never target its own owner, only "the
 * other character" — so there's no hitbox-padding trap and no per-shout
 * self-immunity window to maintain here anymore. What's left:
 *  - ROUND_START_GRACE / TAG_IMMUNITY_DURATION: brief windows where no tag
 *    can land (match start, and right after a role reversal).
 *  - Cover: a pillar on the straight line between the bubble's origin and
 *    the target blocks the tag ("acoustic shadow"), regardless of radius. */
export function SoundBubbleManager() {
  const bubbles = useGameStore((s) => s.bubbles)

  useFrame(() => {
    const now = gameClock.elapsed
    const {
      phase,
      currentItId,
      tagImmuneUntil,
      matchStartTime,
      bubbles: currentBubbles,
      pruneExpiredBubbles,
      tagOpponent,
    } = useGameStore.getState()
    if (currentBubbles.length === 0) return

    const alive = new Set<string>()
    let tagged = false
    const immune = now < tagImmuneUntil || now - matchStartTime < ROUND_START_GRACE

    if (phase === 'playing' && !immune) {
      const targetId = currentItId === 'player' ? BOT_ID : 'player'
      const targetPos = targetId === 'player' ? playerTransform.position : getBotTransform(targetId).position

      for (const bubble of currentBubbles) {
        if (isBubbleExpired(bubble, now)) continue
        alive.add(bubble.id)

        if (!tagged && bubble.ownerId === currentItId) {
          const inCover = isLineOfSightBlocked(bubble.origin, targetPos, COVER_PILLARS)
          if (!inCover && isPointCaughtByBubble(targetPos, bubble, now)) {
            tagged = true
          }
        }
      }
    } else {
      for (const bubble of currentBubbles) {
        if (!isBubbleExpired(bubble, now)) alive.add(bubble.id)
      }
    }

    if (alive.size !== currentBubbles.length) {
      pruneExpiredBubbles(alive)
    }

    if (tagged) {
      tagOpponent(now)
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
