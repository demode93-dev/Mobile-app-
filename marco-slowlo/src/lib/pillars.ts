import type { CoverPillar } from './physics'
import { ARENA_HALF_SIZE, COVER_PILLAR_CLEAR_RADIUS } from './constants'
import { getLevel, type LevelConfig } from './levels'

/**
 * Cover pillars, regenerated per floor from that floor's LevelConfig. Kept
 * as plain mutable data (not React state) so the exact same array drives
 * the InstancedMesh rendering (CoverPillars.tsx), the pure line-of-sight
 * check (isLineOfSightBlocked in physics.ts, via SoundBubbleManager), and
 * the evading Bot's hiding search (findHidingSpot, via Bots.tsx) — there is
 * no other source of truth for pillar placement to drift out of sync with.
 *
 * `COVER_PILLARS` is exported as a mutable `let` rather than a `const` on
 * purpose: ES module bindings are live, so every other module that already
 * does `import { COVER_PILLARS } from './pillars'` automatically sees a
 * freshly-generated array the instant regenerateCoverPillars() reassigns
 * it here — no need to touch SoundBubbleManager.tsx or Bots.tsx at all.
 */
function generate(config: LevelConfig): CoverPillar[] {
  const pillars: CoverPillar[] = []
  const maxRadius = ARENA_HALF_SIZE - config.pillarRadius - 1
  const minSpacing = config.pillarRadius * 3 * config.spacingMultiplier
  let attempts = 0

  while (pillars.length < config.pillarCount && attempts < config.pillarCount * 30) {
    attempts += 1
    const angle = Math.random() * Math.PI * 2
    const dist = COVER_PILLAR_CLEAR_RADIUS + Math.random() * (maxRadius - COVER_PILLAR_CLEAR_RADIUS)
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist

    const tooClose = pillars.some((p) => Math.hypot(p.x - x, p.z - z) < minSpacing)
    if (tooClose) continue

    pillars.push({ x, z, radius: config.pillarRadius })
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
