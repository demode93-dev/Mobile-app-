const BOT_PALETTE = ['#f59e0b', '#22d3ee', '#f43f5e', '#84cc16']

/** Vivid hot-pink for the player's own voice — reads instantly against the
 * bots' cooler palette and gives the bloom/floor-reflection something
 * saturated to grab onto. */
const PLAYER_BUBBLE_COLOR = '#ff2bd6'

/** Deterministic color per shout owner so overlapping bubbles stay legible. */
export function colorForOwner(ownerId: string): string {
  if (ownerId === 'player') return PLAYER_BUBBLE_COLOR
  let hash = 0
  for (let i = 0; i < ownerId.length; i++) hash = (hash * 31 + ownerId.charCodeAt(i)) >>> 0
  return BOT_PALETTE[hash % BOT_PALETTE.length]
}
