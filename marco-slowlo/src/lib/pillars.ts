import type { CoverPillar } from './physics'
import {
  ARENA_HALF_SIZE,
  COVER_PILLAR_CLEAR_RADIUS,
  COVER_PILLAR_COUNT,
  COVER_PILLAR_RADIUS,
} from './constants'

/**
 * Scattered cover pillars generated once at module load. Kept as plain data
 * (not React state) so the exact same list drives both the InstancedMesh
 * rendering (CoverPillars.tsx) and the pure line-of-sight check
 * (isLineOfSightBlocked in physics.ts) used by SoundBubbleManager — there is
 * no other source of truth for pillar placement to drift out of sync with.
 */
function generateCoverPillars(): CoverPillar[] {
  const pillars: CoverPillar[] = []
  const maxRadius = ARENA_HALF_SIZE - COVER_PILLAR_RADIUS - 1
  const minSpacing = COVER_PILLAR_RADIUS * 3
  let attempts = 0

  while (pillars.length < COVER_PILLAR_COUNT && attempts < COVER_PILLAR_COUNT * 30) {
    attempts += 1
    const angle = Math.random() * Math.PI * 2
    const dist = COVER_PILLAR_CLEAR_RADIUS + Math.random() * (maxRadius - COVER_PILLAR_CLEAR_RADIUS)
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist

    const tooClose = pillars.some((p) => Math.hypot(p.x - x, p.z - z) < minSpacing)
    if (tooClose) continue

    pillars.push({ x, z, radius: COVER_PILLAR_RADIUS })
  }

  return pillars
}

export const COVER_PILLARS: CoverPillar[] = generateCoverPillars()
