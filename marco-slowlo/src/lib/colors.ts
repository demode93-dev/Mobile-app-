const BOT_PALETTE = ['#f59e0b', '#22d3ee', '#f43f5e', '#84cc16']

/** Rich teal-green identity color for the player's own true/native colors —
 * the chameleon's own hue whenever it isn't camouflaged against anything.
 * Distinct from every pet-store item color (see pillars.ts) and from the
 * Sensory Pulse's own color, so "not currently matching anything" never
 * accidentally reads as a match. Paired with TAIL_ACCENT_COLOR (a violet)
 * on the tail, so the whole character reads as a green-teal-purple blend
 * without needing a multi-hue material on any single mesh. */
const PLAYER_IDENTITY_COLOR = '#1fae8e'

/** Violet accent for Chent's tail — the "purple" note in his green-teal
 * palette. Fixed (not camouflage-washed): the tail doesn't participate in
 * the color-match survival check, only the torso does. */
export const TAIL_ACCENT_COLOR = '#8b5cf6'

/** Deterministic identity color per owner — each actor's true/native color
 * whenever it isn't camouflaged. */
export function colorForOwner(ownerId: string): string {
  if (ownerId === 'player') return PLAYER_IDENTITY_COLOR
  let hash = 0
  for (let i = 0; i < ownerId.length; i++) hash = (hash * 31 + ownerId.charCodeAt(i)) >>> 0
  return BOT_PALETTE[hash % BOT_PALETTE.length]
}

/**
 * The owner's Sensory Pulse: a flat, semi-translucent, hyper-vibrant
 * electric hot-pink wavefront that sweeps outward from whoever is
 * currently "It". One fixed color regardless of who cast it, so the
 * threat always reads as one unmistakable shape.
 */
export const SENSORY_PULSE_COLOR = '#ff17d6'
