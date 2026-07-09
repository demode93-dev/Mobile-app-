import { describe, expect, it } from 'vitest'
import {
  bubbleRadiusAt,
  bubblesCatchingPoint,
  clearanceFromBubble,
  distance3,
  isBubbleExpired,
  isPointCaughtByBubble,
  type SoundBubble,
} from './physics'

function makeBubble(overrides: Partial<SoundBubble> = {}): SoundBubble {
  return {
    id: 'b1',
    ownerId: 'player',
    origin: { x: 0, y: 0, z: 0 },
    originTime: 0,
    growthRate: 3, // walking speed, m/s
    maxRadius: 40,
    ...overrides,
  }
}

describe('bubbleRadiusAt', () => {
  it('is exactly 0 at the moment of origin', () => {
    const b = makeBubble()
    expect(bubbleRadiusAt(b, 0)).toBe(0)
  })

  it('is 0 for any time before origin (defensive)', () => {
    const b = makeBubble({ originTime: 5 })
    expect(bubbleRadiusAt(b, 2)).toBe(0)
  })

  it('grows linearly with elapsed time at growthRate', () => {
    const b = makeBubble({ growthRate: 3 })
    expect(bubbleRadiusAt(b, 2)).toBeCloseTo(6)
    expect(bubbleRadiusAt(b, 10)).toBeCloseTo(30)
  })
})

describe('isPointCaughtByBubble - edge cases', () => {
  it('player standing exactly at the shout origin is NOT caught at t=0 (0 radius, 0 distance)', () => {
    const b = makeBubble()
    expect(isPointCaughtByBubble({ x: 0, y: 0, z: 0 }, b, 0)).toBe(false)
  })

  it('a stationary player at the origin IS caught an instant later, since radius > 0 = distance', () => {
    const b = makeBubble()
    expect(isPointCaughtByBubble({ x: 0, y: 0, z: 0 }, b, 0.016)).toBe(true)
  })

  it('a player moving at exactly growthRate stays exactly on the boundary and counts as caught (<=)', () => {
    const b = makeBubble({ growthRate: 3 })
    const t = 4
    const point = { x: 3 * t, y: 0, z: 0 } // moved outward at exactly 3 m/s
    expect(distance3(point, b.origin)).toBeCloseTo(bubbleRadiusAt(b, t))
    expect(isPointCaughtByBubble(point, b, t)).toBe(true)
  })

  it('a player sprinting faster than growthRate stays safe indefinitely', () => {
    const b = makeBubble({ growthRate: 3 })
    const sprintSpeed = 6
    for (const t of [0.5, 1, 5, 20, 100]) {
      const point = { x: sprintSpeed * t, y: 0, z: 0 }
      expect(isPointCaughtByBubble(point, b, t)).toBe(false)
    }
  })

  it('REGRESSION: padding the SELF-shout catch check with a hitbox radius makes sprinting unwinnable', () => {
    // A shout originates at distance 0 from its own owner. If the catch
    // check pads the radius with the shouter's own hitbox size, then for a
    // window right after the shout, `distance - radius < hitboxRadius` is
    // true no matter how fast the shouter moves, because a constant offset
    // dominates while both distance and radius are still small. This was a
    // real bug (see SoundBubbleManager's comment) — the game must call
    // isPointCaughtByBubble WITHOUT hitbox padding for a shouter's own
    // bubble, or every shout becomes an instant, unavoidable loss.
    const growthRate = 3
    const sprintSpeed = 6.2
    const hitboxRadius = 0.45
    const b = makeBubble({ growthRate })

    let stillUnsafeAt = 0
    for (let t = 0; t <= 0.2; t += 0.01) {
      const point = { x: sprintSpeed * t, y: 0, z: 0 } // sprinting away from the origin from t=0
      if (isPointCaughtByBubble(point, b, t, hitboxRadius)) stillUnsafeAt = t
    }
    // Demonstrates the trap: even sprinting at nearly double the growth
    // rate, padding keeps the shouter "caught" for a real stretch of time.
    expect(stillUnsafeAt).toBeGreaterThan(0.1)

    // The fix the game actually ships: no padding on the shouter's own check.
    for (let t = 0; t <= 0.2; t += 0.01) {
      const point = { x: sprintSpeed * t, y: 0, z: 0 }
      expect(isPointCaughtByBubble(point, b, t)).toBe(false)
    }
  })

  it('a player walking at exactly the growth rate but starting with any head start stays safe', () => {
    const b = makeBubble({ growthRate: 3 })
    // Player already 5m away when the shout fires, then matches the wave's pace.
    for (const t of [0, 1, 10]) {
      const point = { x: 5 + 3 * t, y: 0, z: 0 }
      expect(isPointCaughtByBubble(point, b, t)).toBe(false)
    }
  })

  it('hitbox radius extends the effective catch radius (surface-touch, not center-touch)', () => {
    const b = makeBubble({ growthRate: 3 })
    const t = 1 // radius = 3
    const point = { x: 3.4, y: 0, z: 0 } // just outside the bare radius
    expect(isPointCaughtByBubble(point, b, t, 0)).toBe(false)
    expect(isPointCaughtByBubble(point, b, t, 0.5)).toBe(true)
  })

  it('is symmetric in 3D, not just on a single axis', () => {
    const b = makeBubble({ growthRate: 3, origin: { x: 1, y: 2, z: -3 } })
    const t = 2 // radius = 6
    const farEnough = { x: 1, y: 2 + 6.01, z: -3 }
    const tooClose = { x: 1, y: 2 + 5.9, z: -3 }
    expect(isPointCaughtByBubble(farEnough, b, t)).toBe(false)
    expect(isPointCaughtByBubble(tooClose, b, t)).toBe(true)
  })
})

describe('isBubbleExpired', () => {
  it('expires once the wavefront reaches maxRadius', () => {
    const b = makeBubble({ growthRate: 4, maxRadius: 20 })
    expect(isBubbleExpired(b, 4.9)).toBe(false) // radius 19.6
    expect(isBubbleExpired(b, 5)).toBe(true) // radius 20
  })
})

describe('bubblesCatchingPoint', () => {
  it('supports multiple simultaneous shouters (multiplayer-ready)', () => {
    const bubbles = [
      makeBubble({ id: 'a', ownerId: 'p1', origin: { x: 0, y: 0, z: 0 }, originTime: 0 }),
      makeBubble({ id: 'b', ownerId: 'p2', origin: { x: 50, y: 0, z: 0 }, originTime: 0 }),
    ]
    const point = { x: 2, y: 0, z: 0 }
    const t = 1 // bubble a radius = 3 (catches), bubble b radius = 3 but 48 away (safe)
    const caught = bubblesCatchingPoint(point, bubbles, t)
    expect(caught.map((b) => b.id)).toEqual(['a'])
  })

  it('a player can be caught by their own bubble even while safe from another', () => {
    const bubbles = [
      makeBubble({ id: 'own', ownerId: 'self', origin: { x: 0, y: 0, z: 0 }, originTime: 0 }),
    ]
    expect(bubblesCatchingPoint({ x: 0, y: 0, z: 0 }, bubbles, 1).length).toBe(1)
  })
})

describe('clearanceFromBubble', () => {
  it('is positive when safe, zero at the instant of contact, negative when engulfed', () => {
    const b = makeBubble({ growthRate: 2 })
    const t = 3 // radius = 6
    expect(clearanceFromBubble({ x: 10, y: 0, z: 0 }, b, t)).toBeCloseTo(4)
    expect(clearanceFromBubble({ x: 6, y: 0, z: 0 }, b, t)).toBeCloseTo(0)
    expect(clearanceFromBubble({ x: 2, y: 0, z: 0 }, b, t)).toBeCloseTo(-4)
  })
})
