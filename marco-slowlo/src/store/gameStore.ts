import { create } from 'zustand'
import type { SoundBubble, Vec3Like } from '../lib/physics'
import { gameClock } from '../lib/world'
import { regenerateCoverPillars } from '../lib/pillars'
import {
  BOT_ID,
  BUBBLE_MAX_RADIUS,
  MATCH_DURATION,
  SHOUT_COOLDOWN,
  TAG_IMMUNITY_DURATION,
  WALK_SPEED,
} from '../lib/constants'
import { LEVELS } from '../lib/levels'

export type GamePhase = 'start' | 'playing' | 'levelComplete' | 'gameOver'

let bubbleSeq = 0
export function nextBubbleId(): string {
  bubbleSeq += 1
  return `bubble-${bubbleSeq}-${Date.now()}`
}

/** Fields reset at the start of every round, win-and-advance or fresh start alike. */
interface RoundReset {
  phase: GamePhase
  matchTimeRemaining: number
  matchStartTime: number
  currentItId: string
  tagImmuneUntil: number
  stamina: number
  shoutCooldownRemaining: number
  bubbles: SoundBubble[]
  isRooted: boolean
}

function freshRound(): RoundReset {
  return {
    phase: 'playing',
    matchTimeRemaining: MATCH_DURATION,
    matchStartTime: gameClock.elapsed,
    currentItId: BOT_ID, // the Bot always starts as It
    tagImmuneUntil: 0,
    stamina: 1,
    shoutCooldownRemaining: 0,
    bubbles: [],
    isRooted: false,
  }
}

interface GameState extends RoundReset {
  /** 0-based index into LEVELS — "Floor 1" is levelIndex 0. */
  levelIndex: number
  /** Bumped every time the player shouts, so the HUD can retrigger a CSS pulse. */
  shoutFxNonce: number

  startMatch: () => void
  advanceLevel: () => void

  setStamina: (value: number) => void
  setShoutCooldownRemaining: (value: number) => void
  setRooted: (value: boolean) => void
  tickMatch: (dt: number) => void

  spawnBubble: (ownerId: string, origin: Vec3Like, now: number) => void
  pruneExpiredBubbles: (aliveIds: Set<string>) => void
  tagOpponent: (now: number) => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'start',
  matchTimeRemaining: MATCH_DURATION,
  matchStartTime: 0,
  currentItId: BOT_ID,
  tagImmuneUntil: 0,
  stamina: 1,
  shoutCooldownRemaining: 0,
  bubbles: [],
  shoutFxNonce: 0,
  isRooted: false,
  levelIndex: 0,

  startMatch: () => {
    regenerateCoverPillars(0)
    set({ ...freshRound(), levelIndex: 0 })
  },

  advanceLevel: () =>
    set((s) => {
      const nextLevelIndex = Math.min(s.levelIndex + 1, LEVELS.length - 1)
      regenerateCoverPillars(nextLevelIndex)
      return { ...freshRound(), levelIndex: nextLevelIndex }
    }),

  setStamina: (value) => set({ stamina: Math.min(1, Math.max(0, value)) }),
  setShoutCooldownRemaining: (value) => set({ shoutCooldownRemaining: Math.max(0, value) }),
  setRooted: (value) => set({ isRooted: value }),

  tickMatch: (dt) =>
    set((s) => {
      if (s.phase !== 'playing') return s
      const next = s.matchTimeRemaining - dt
      if (next <= 0) {
        // Whoever is NOT "It" when the clock hits 0 made it through the
        // floor. Still hunting (or still stuck as It) at the buzzer means
        // the Bot evaded you the whole match — that's a loss.
        const playerWon = s.currentItId === BOT_ID
        return { matchTimeRemaining: 0, phase: playerWon ? 'levelComplete' : 'gameOver' }
      }
      return { matchTimeRemaining: next }
    }),

  spawnBubble: (ownerId, origin, now) =>
    set((s) => ({
      bubbles: [
        ...s.bubbles,
        {
          id: nextBubbleId(),
          ownerId,
          origin: { x: origin.x, y: origin.y, z: origin.z },
          originTime: now,
          growthRate: WALK_SPEED,
          maxRadius: BUBBLE_MAX_RADIUS,
        },
      ],
      shoutCooldownRemaining: ownerId === 'player' ? SHOUT_COOLDOWN : s.shoutCooldownRemaining,
      shoutFxNonce: ownerId === 'player' ? s.shoutFxNonce + 1 : s.shoutFxNonce,
    })),

  pruneExpiredBubbles: (aliveIds) =>
    set((s) => {
      const filtered = s.bubbles.filter((b) => aliveIds.has(b.id))
      return filtered.length === s.bubbles.length ? s : { bubbles: filtered }
    }),

  tagOpponent: (now) =>
    set((s) => ({
      currentItId: s.currentItId === 'player' ? BOT_ID : 'player',
      tagImmuneUntil: now + TAG_IMMUNITY_DURATION,
    })),
}))
