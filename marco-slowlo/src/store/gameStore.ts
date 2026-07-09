import { create } from 'zustand'
import type { SoundBubble, Vec3Like } from '../lib/physics'
import { BUBBLE_MAX_RADIUS, SHOUT_COOLDOWN, STAMINA_MAX, WALK_SPEED } from '../lib/constants'

export type GamePhase = 'ready' | 'playing' | 'caught'

const BEST_TIME_KEY = 'marco-slowlo:best-survival-time'

function readBestTime(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(BEST_TIME_KEY)
  const n = raw ? Number.parseFloat(raw) : 0
  return Number.isFinite(n) ? n : 0
}

let bubbleSeq = 0
export function nextBubbleId(): string {
  bubbleSeq += 1
  return `bubble-${bubbleSeq}-${Date.now()}`
}

interface GameState {
  phase: GamePhase
  survivalTime: number
  stamina: number
  shoutCooldownRemaining: number
  bubbles: SoundBubble[]
  caughtByOwnerId: string | null
  bestSurvivalTime: number
  /** Bumped every time the player shouts, so the HUD can retrigger a CSS pulse. */
  shoutFxNonce: number
  /** True while the player is rooted in place right after shouting. */
  isRooted: boolean

  startGame: () => void
  endGame: (caughtByOwnerId: string) => void
  resetToReady: () => void

  setStamina: (value: number) => void
  setShoutCooldownRemaining: (value: number) => void
  setRooted: (value: boolean) => void
  tickSurvival: (dt: number) => void

  spawnBubble: (ownerId: string, origin: Vec3Like, now: number) => void
  removeBubble: (id: string) => void
  pruneExpiredBubbles: (aliveIds: Set<string>) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'ready',
  survivalTime: 0,
  stamina: 1,
  shoutCooldownRemaining: 0,
  bubbles: [],
  caughtByOwnerId: null,
  bestSurvivalTime: readBestTime(),
  shoutFxNonce: 0,
  isRooted: false,

  startGame: () =>
    set({
      phase: 'playing',
      survivalTime: 0,
      stamina: 1,
      shoutCooldownRemaining: 0,
      bubbles: [],
      caughtByOwnerId: null,
      isRooted: false,
    }),

  endGame: (caughtByOwnerId) => {
    const { survivalTime, bestSurvivalTime } = get()
    const nextBest = Math.max(survivalTime, bestSurvivalTime)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BEST_TIME_KEY, nextBest.toFixed(2))
    }
    set({ phase: 'caught', caughtByOwnerId, bestSurvivalTime: nextBest })
  },

  resetToReady: () => set({ phase: 'ready', bubbles: [], caughtByOwnerId: null }),

  setStamina: (value) => set({ stamina: Math.min(1, Math.max(0, value)) }),
  setShoutCooldownRemaining: (value) => set({ shoutCooldownRemaining: Math.max(0, value) }),
  setRooted: (value) => set({ isRooted: value }),
  tickSurvival: (dt) => set((s) => ({ survivalTime: s.survivalTime + dt })),

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

  removeBubble: (id) => set((s) => ({ bubbles: s.bubbles.filter((b) => b.id !== id) })),

  pruneExpiredBubbles: (aliveIds) =>
    set((s) => {
      const filtered = s.bubbles.filter((b) => aliveIds.has(b.id))
      return filtered.length === s.bubbles.length ? s : { bubbles: filtered }
    }),
}))

export const STAMINA_DRAIN_PER_SECOND = 1 / STAMINA_MAX
