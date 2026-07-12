/**
 * Pure spatial math for the expanding "sound bubble" mechanic.
 *
 * A shout is a point event: it originates at the shouter's position at time
 * `originTime` and expands outward as a spherical wavefront at a constant
 * `growthRate` (walking speed, m/s). Anything whose center point lies within
 * the current radius has been "enveloped" by the wave.
 *
 * Because a shout originates exactly at the shouter's own position, at
 * t = originTime the radius is 0 and the shouter's own distance to the
 * origin is also 0 — they are not yet caught (0 < 0 is false). From that
 * instant on, the shouter is safe only if their distance from the origin
 * grows faster than the wavefront, i.e. only if they move strictly faster
 * than `growthRate` (they must sprint, not walk, to outrun their own voice).
 */

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface SoundBubble {
  id: string
  ownerId: string
  origin: Vec3Like
  originTime: number
  growthRate: number
  maxRadius: number
}

export function distance3(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Radius of a bubble's wavefront at a given time. Never negative. */
export function bubbleRadiusAt(bubble: SoundBubble, now: number): number {
  const elapsed = now - bubble.originTime
  if (elapsed <= 0) return 0
  return elapsed * bubble.growthRate
}

/** True once a bubble has grown past its despawn radius and should be removed. */
export function isBubbleExpired(bubble: SoundBubble, now: number): boolean {
  return bubbleRadiusAt(bubble, now) >= bubble.maxRadius
}

/**
 * A point (player/NPC hitbox center) is "caught" by a bubble when the
 * expanding shell has enveloped it: distance from the bubble's origin to the
 * point is less than or equal to the current wavefront radius, expanded by
 * the target's own hitbox radius (so the shell only needs to touch the
 * surface of the body, not its exact center).
 *
 * We use `<=` (not `<`) so that a target moving at *exactly* growthRate is
 * treated as caught rather than eternally balanced on the boundary — the
 * player must be strictly faster than their own voice, matching the design
 * intent ("sprint to escape", not "match pace to escape").
 */
export function isPointCaughtByBubble(
  point: Vec3Like,
  bubble: SoundBubble,
  now: number,
  targetHitboxRadius = 0,
): boolean {
  const radius = bubbleRadiusAt(bubble, now)
  if (radius <= 0) return false
  const dist = distance3(point, bubble.origin)
  return dist <= radius + targetHitboxRadius
}

/** Returns every bubble (from a list) currently enveloping the given point. */
export function bubblesCatchingPoint(
  point: Vec3Like,
  bubbles: SoundBubble[],
  now: number,
  targetHitboxRadius = 0,
): SoundBubble[] {
  return bubbles.filter((b) => isPointCaughtByBubble(point, b, now, targetHitboxRadius))
}

/**
 * Signed clearance between a point and a bubble's wavefront: positive means
 * the point is still outside/ahead of the wave (safe), negative means the
 * wave has already swallowed it. Useful for HUD proximity warnings.
 */
export function clearanceFromBubble(point: Vec3Like, bubble: SoundBubble, now: number): number {
  const radius = bubbleRadiusAt(bubble, now)
  const dist = distance3(point, bubble.origin)
  return dist - radius
}

export interface CoverPillar {
  x: number
  z: number
  radius: number
  /** Exact solid color of this pet-store item — a chameleon camouflaging
   * against it takes this EXACT hex string, compared for strict equality
   * (see nearestPillar / the color-match survival check in
   * SoundBubbleManager). */
  color: string
}

/**
 * Shortest distance from a point to a 2D line segment (XZ plane — pillars
 * are vertical cylinders, so height doesn't factor into the projection).
 * Clamping t to [0, 1] means a circle "behind" either endpoint is measured
 * against that endpoint rather than the infinite line through the segment.
 */
function pointToSegmentDistance2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const abx = bx - ax
  const abz = bz - az
  const lengthSq = abx * abx + abz * abz
  let t = lengthSq > 0 ? ((px - ax) * abx + (pz - az) * abz) / lengthSq : 0
  t = Math.max(0, Math.min(1, t))
  const closestX = ax + abx * t
  const closestZ = az + abz * t
  return Math.hypot(px - closestX, pz - closestZ)
}

/**
 * True if a straight line from `origin` to `target` passes through any
 * pillar's collision cylinder — an "acoustic shadow" that blocks a shout's
 * wavefront from reaching whatever's on the far side, regardless of the
 * wavefront's radius. Ignores Y entirely: pillars are tall enough to
 * intersect the whole vertical range shouts/hitboxes occupy.
 */
export function isLineOfSightBlocked(
  origin: Vec3Like,
  target: Vec3Like,
  pillars: CoverPillar[],
): boolean {
  for (const pillar of pillars) {
    const dist = pointToSegmentDistance2D(pillar.x, pillar.z, origin.x, origin.z, target.x, target.z)
    if (dist <= pillar.radius) return true
  }
  return false
}

/** Whichever pillar (pet-store item) is closest to a point, or null if the
 * list is empty. Used both to decide what an evader is trying to camouflage
 * against and, live, at the instant a Sensory Pulse would hit, to check
 * whether they still match whatever's actually nearest right now. */
export function nearestPillar(position: Vec3Like, pillars: CoverPillar[]): CoverPillar | null {
  let best: CoverPillar | null = null
  let bestDistSq = Infinity
  for (const pillar of pillars) {
    const dx = pillar.x - position.x
    const dz = pillar.z - position.z
    const distSq = dx * dx + dz * dz
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      best = pillar
    }
  }
  return best
}

/** Distance from a point to a pillar's surface — negative once the point is
 * inside the pillar's own radius. */
export function distanceToPillarSurface(position: Vec3Like, pillar: CoverPillar): number {
  return Math.hypot(pillar.x - position.x, pillar.z - position.z) - pillar.radius
}

/**
 * Ray-vs-vertical-cylinder intersection against every pillar (pet-store
 * item), used to find a valid tail-grapple anchor. `direction` MUST be
 * normalized — the intersection parameter `t` is used directly as a
 * distance. Each pillar is treated as an infinite vertical cylinder in the
 * XZ plane; a hit only counts if it lands within `maxRange` and its height
 * falls inside [minHeight, pillarHeight] (high enough to read as "grabbing
 * a tall shelf," not the floor, and no higher than the shelf actually is).
 * Returns the closest qualifying grip point, or null if nothing qualifies.
 */
export function findGrappleAnchor(
  origin: Vec3Like,
  direction: Vec3Like,
  pillars: CoverPillar[],
  maxRange: number,
  minHeight: number,
  pillarHeight: number,
): Vec3Like | null {
  let best: Vec3Like | null = null
  let bestDist = Infinity

  for (const pillar of pillars) {
    const ox = origin.x - pillar.x
    const oz = origin.z - pillar.z
    const a = direction.x * direction.x + direction.z * direction.z
    if (a < 1e-8) continue // ray points straight up/down — can't cross a vertical cylinder's side

    const b = 2 * (ox * direction.x + oz * direction.z)
    const c = ox * ox + oz * oz - pillar.radius * pillar.radius
    const discriminant = b * b - 4 * a * c
    if (discriminant < 0) continue // ray misses this pillar entirely

    const sqrtDisc = Math.sqrt(discriminant)
    const t1 = (-b - sqrtDisc) / (2 * a)
    const t2 = (-b + sqrtDisc) / (2 * a)
    const t = t1 >= 0 ? t1 : t2 >= 0 ? t2 : -1 // smallest non-negative root = entering the cylinder
    if (t < 0 || t > maxRange) continue

    const hitY = origin.y + direction.y * t
    if (hitY < minHeight || hitY > pillarHeight) continue

    if (t < bestDist) {
      bestDist = t
      best = { x: origin.x + direction.x * t, y: hitY, z: origin.z + direction.z * t }
    }
  }

  return best
}

/**
 * Picks the best nearby "hiding spot" for someone fleeing `threatPos`: for
 * every pillar, the point just beyond it on the far side from the threat
 * (i.e. in that pillar's acoustic/visual shadow), then returns whichever
 * such spot is closest to `hiderPos`. Returns null if there are no pillars
 * at all. Pure 2D (XZ) geometry — same convention as isLineOfSightBlocked.
 */
export function findHidingSpot(
  hiderPos: Vec3Like,
  threatPos: Vec3Like,
  pillars: CoverPillar[],
  margin: number,
): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null
  let bestDistSq = Infinity

  for (const pillar of pillars) {
    const awayX = pillar.x - threatPos.x
    const awayZ = pillar.z - threatPos.z
    const len = Math.hypot(awayX, awayZ)
    if (len < 1e-4) continue // threat is exactly on the pillar center; ill-defined direction

    const spotX = pillar.x + (awayX / len) * (pillar.radius + margin)
    const spotZ = pillar.z + (awayZ / len) * (pillar.radius + margin)
    const dx = spotX - hiderPos.x
    const dz = spotZ - hiderPos.z
    const distSq = dx * dx + dz * dz

    if (distSq < bestDistSq) {
      bestDistSq = distSq
      best = { x: spotX, z: spotZ }
    }
  }

  return best
}
