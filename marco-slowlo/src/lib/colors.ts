const BOT_PALETTE = ['#f59e0b', '#22d3ee', '#f43f5e', '#84cc16']

/** Deterministic color per shout owner so overlapping bubbles stay legible. */
export function colorForOwner(ownerId: string): string {
  if (ownerId === 'player') return '#a78bfa'
  let hash = 0
  for (let i = 0; i < ownerId.length; i++) hash = (hash * 31 + ownerId.charCodeAt(i)) >>> 0
  return BOT_PALETTE[hash % BOT_PALETTE.length]
}
