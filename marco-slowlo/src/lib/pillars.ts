import type { CoverPillar } from './physics'
import { ARENA_HALF_SIZE, COVER_PILLAR_CLEAR_RADIUS } from './constants'
import { getLevel, type LevelConfig } from './levels'

export interface PetStoreItemKind {
  name: string
  /** Main solid body color — the EXACT color a chameleon must match to
   * camouflage against this item. */
  color: string
  /** Darker accent-band color, kept distinct from the body for contrast. */
  accentColor: string
  /** Collision/visual footprint radius, in meters. */
  radius: number
}

/** Every pet-store obstacle is one of these three item types, mixed
 * together across the whole floor (not one color per floor anymore) — the
 * survival rule depends on there being a small, fixed set of exact colors
 * to match. */
export const PET_STORE_ITEM_KINDS: PetStoreItemKind[] = [
  { name: 'Fish Tank', color: '#0ea5e9', accentColor: '#0369a1', radius: 1.05 },
  { name: 'Food Bags', color: '#15803d', accentColor: '#14532d', radius: 0.8 },
  { name: 'Scratching Post', color: '#b91c3c', accentColor: '#7f1d1d', radius: 0.65 },
]

function randomItemKind(): PetStoreItemKind {
  return PET_STORE_ITEM_KINDS[Math.floor(Math.random() * PET_STORE_ITEM_KINDS.length)]
}

/**
 * Cover pillars (pet-store items), regenerated per floor from that floor's
 * LevelConfig. Kept as plain mutable data (not React state) so the exact
 * same array drives the InstancedMesh rendering (CoverPillars.tsx), the
 * pure line-of-sight check (isLineOfSightBlocked in physics.ts, via
 * Bots.tsx's audio muffle), the color-match survival check
 * (nearestPillar, via SoundBubbleManager), and the evading Bot's hiding
 * search (findHidingSpot, via Bots.tsx) — there is no other source of
 * truth for item placement to drift out of sync with.
 *
 * `COVER_PILLARS` is exported as a mutable `let` rather than a `const` on
 * purpose: ES module bindings are live, so every other module that already
 * does `import { COVER_PILLARS } from './pillars'` automatically sees a
 * freshly-generated array the instant regenerateCoverPillars() reassigns
 * it here — no need to touch SoundBubbleManager.tsx or Bots.tsx at all.
 */
function generate(config: LevelConfig): CoverPillar[] {
  const pillars: CoverPillar[] = []
  const maxKindRadius = Math.max(...PET_STORE_ITEM_KINDS.map((k) => k.radius))
  const maxRadius = ARENA_HALF_SIZE - maxKindRadius - 1
  let attempts = 0

  while (pillars.length < config.pillarCount && attempts < config.pillarCount * 30) {
    attempts += 1
    const kind = randomItemKind()
    const angle = Math.random() * Math.PI * 2
    const dist = COVER_PILLAR_CLEAR_RADIUS + Math.random() * (maxRadius - COVER_PILLAR_CLEAR_RADIUS)
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist

    const tooClose = pillars.some((p) => {
      const minSpacing = (kind.radius + p.radius) * 1.5 * config.spacingMultiplier
      return Math.hypot(p.x - x, p.z - z) < minSpacing
    })
    if (tooClose) continue

    pillars.push({ x, z, radius: kind.radius, color: kind.color })
  }

  return pillars
}

export let COVER_PILLARS: CoverPillar[] = generate(getLevel(0))

/** Called by gameStore whenever a match (re)starts or the player advances
 * a floor, before the level-index change that makes CoverPillars.tsx
 * remount — by the time it re-renders, this array is already the new
 * floor's maze. */
export function regenerateCoverPillars(levelIndex: number): void {
  COVER_PILLARS = generate(getLevel(levelIndex))
}
