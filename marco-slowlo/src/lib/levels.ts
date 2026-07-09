/** One floor's worth of tuning: how the cover crates look, how densely
 * they're packed, and how much faster the Bot moves. Vertical progression
 * is just "load the next entry here and regenerate the maze." */
export interface LevelConfig {
  name: string
  /** Main containment-crate shaft color. */
  crateColor: string
  /** Metallic status-band color, kept distinct from the shaft for contrast. */
  crateAccentColor: string
  /** How many cover pillars to scatter across the arena — the maze's "density." */
  pillarCount: number
  /** Collision/visual radius of each pillar, in meters. */
  pillarRadius: number
  /** Multiplies the minimum required gap between pillar centers — below 1,
   * pillars are allowed to cluster tighter, narrowing the corridors between
   * them without changing the arena's overall size. */
  spacingMultiplier: number
  /** Multiplies every one of the Bot's movement speeds. */
  botSpeedMultiplier: number
}

export const LEVELS: LevelConfig[] = [
  {
    name: 'Floor 1',
    crateColor: '#2563eb', // blue
    crateAccentColor: '#1e3a8a',
    pillarCount: 42,
    pillarRadius: 0.9,
    spacingMultiplier: 1,
    botSpeedMultiplier: 1,
  },
  {
    name: 'Floor 2',
    crateColor: '#eab308', // warning yellow
    crateAccentColor: '#78350f',
    pillarCount: 58,
    pillarRadius: 0.95,
    spacingMultiplier: 0.82,
    botSpeedMultiplier: 1.12,
  },
  {
    name: 'Floor 3',
    crateColor: '#f97316', // hazard orange
    crateAccentColor: '#7c2d12',
    pillarCount: 76,
    pillarRadius: 1.0,
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
