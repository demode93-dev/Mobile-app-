const BOT_PALETTE = ['#f59e0b', '#22d3ee', '#f43f5e', '#84cc16']

/** Hot-pink for the player's own identity (visor/body trim) — reads
 * instantly against the bots' cooler palette. Distinct from the bubble's
 * own color (see BUBBLE_THREAT_COLOR below): who shouted and how
 * dangerous the shout looks are two different questions now. */
const PLAYER_IDENTITY_COLOR = '#ff2bd6'

/** Deterministic identity color per owner, for visors/body trim only. */
export function colorForOwner(ownerId: string): string {
  if (ownerId === 'player') return PLAYER_IDENTITY_COLOR
  let hash = 0
  for (let i = 0; i < ownerId.length; i++) hash = (hash * 31 + ownerId.charCodeAt(i)) >>> 0
  return BOT_PALETTE[hash % BOT_PALETTE.length]
}

/**
 * Every shout bubble uses this single deep-crimson threat color regardless
 * of who made it — in the bright sterile-facility aesthetic, the danger
 * should read as one unmistakable dark shape against the white arena, not
 * a rainbow of per-owner glows.
 */
export const BUBBLE_THREAT_COLOR = '#7a0012'
