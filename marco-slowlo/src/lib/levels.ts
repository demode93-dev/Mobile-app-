/** One floor's worth of tuning: how densely the pet-store shelving is
 * packed and how much faster the Bot moves. Item look (color/size) comes
 * from PET_STORE_ITEM_KINDS in lib/pillars.ts instead — every floor draws
 * from the same fish-tank/food-bag/scratching-post palette, just packed
 * tighter as you climb. Vertical progression is just "load the next entry
 * here and regenerate the maze." */
export interface LevelConfig {
  name: string
  /** How many pet-store items to scatter across the arena — the maze's "density." */
  pillarCount: number
  /** Multiplies the minimum required gap between item centers — below 1,
   * items are allowed to cluster tighter, narrowing the aisles between
   * them without changing the arena's overall size. */
  spacingMultiplier: number
  /** Multiplies every one of the Bot's movement speeds. */
  botSpeedMultiplier: number
}

export const LEVELS: LevelConfig[] = [
  {
    name: 'Floor 1',
    pillarCount: 42,
    spacingMultiplier: 1,
    botSpeedMultiplier: 1,
  },
  {
    name: 'Floor 2',
    pillarCount: 58,
    spacingMultiplier: 0.82,
    botSpeedMultiplier: 1.12,
  },
  {
    name: 'Floor 3',
    pillarCount: 76,
    spacingMultiplier: 0.68,
    botSpeedMultiplier: 1.25,
  },
]

/** Clamps to the last (hardest) floor once you've cleared them all, rather
 * than throwing — clearing Floor 3 just replays Floor 3 at Floor 3
 * difficulty instead of running off the end of the array. */
export function getLevel(index: number): LevelConfig {
  return LEVELS[Math.min(Math.max(index, 0), LEVELS.length - 1)]
}
