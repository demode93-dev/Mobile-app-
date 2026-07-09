import { create } from 'zustand'
import type { SoundBubble, Vec3Like } from '../lib/physics'
import { gameClock } from '../lib/world'
import {
  BOT_ID,
  BUBBLE_MAX_RADIUS,
  MATCH_DURATION,
  SHOUT_COOLDOWN,
  TAG_IMMUNITY_DURATION,
  WALK_SPEED,
} from '../lib/constants'

export type GamePhase = 'start' | 'playing' | 'gameOver'

let bubbleSeq = 0
export function nextBubbleId(): string {
  bubbleSeq += 1
  return `bubble-${bubbleSeq}-${Date.now()}`
}

interface GameState {
  phase: GamePhase
  matchTimeRemaining: number
  /** gameClock.elapsed at the moment the current match began — gameClock
   * itself is a continuously-running session clock (never resets), so
   * "time since match start" must be measured relative to this, not to 0. */
  matchStartTime: number
  /** Id of whoever is currently "It" (the hunter): 'player' or BOT_ID. */
  currentItId: string
  /** No tag can land before this gameClock time — see TAG_IMMUNITY_DURATION. */
  tagImmuneUntil: number
  stamina: number
  shoutCooldownRemaining: number
  bubbles: SoundBubble[]
  /** Bumped every time the player shouts, so the HUD can retrigger a CSS pulse. */
  shoutFxNonce: number
  /** True while the player is rooted in place right after shouting. */
  isRooted: boolean

  startMatch: () => void

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

  startMatch: () =>
    set({
      phase: 'playing',
      matchTimeRemaining: MATCH_DURATION,
      matchStartTime: gameClock.elapsed,
      currentItId: BOT_ID, // the Bot always starts as It
      tagImmuneUntil: 0,
      stamina: 1,
      shoutCooldownRemaining: 0,
      bubbles: [],
      isRooted: false,
    }),

  setStamina: (value) => set({ stamina: Math.min(1, Math.max(0, value)) }),
  setShoutCooldownRemaining: (value) => set({ shoutCooldownRemaining: Math.max(0, value) }),
  setRooted: (value) => set({ isRooted: value }),

  tickMatch: (dt) =>
    set((s) => {
      if (s.phase !== 'playing') return s
      const next = s.matchTimeRemaining - dt
      if (next <= 0) {
        return { matchTimeRemaining: 0, phase: 'gameOver' }
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
