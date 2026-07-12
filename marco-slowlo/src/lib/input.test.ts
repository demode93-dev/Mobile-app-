import { describe, expect, it } from 'vitest'
import { applyJoystickDeadzone } from './input'

describe('applyJoystickDeadzone', () => {
  it('collapses a resting/micro-drift thumb to exactly zero', () => {
    expect(applyJoystickDeadzone(0, 0, 0.15)).toEqual({ x: 0, y: 0 })
    expect(applyJoystickDeadzone(0.05, 0.03, 0.15)).toEqual({ x: 0, y: 0 })
  })

  it('checks combined 2D magnitude, not each axis independently', () => {
    // Neither axis alone reaches 0.15, but the combined magnitude does.
    const magnitude = Math.hypot(0.12, 0.12)
    expect(magnitude).toBeGreaterThan(0.15)
    expect(applyJoystickDeadzone(0.12, 0.12, 0.15)).toEqual({ x: 0.12, y: 0.12 })
  })

  it('passes a real push through completely unchanged, with no rescale', () => {
    expect(applyJoystickDeadzone(0.9, -0.3, 0.15)).toEqual({ x: 0.9, y: -0.3 })
  })

  it('a magnitude exactly at the deadzone boundary is NOT zeroed (strict <)', () => {
    expect(applyJoystickDeadzone(0.15, 0, 0.15)).toEqual({ x: 0.15, y: 0 })
  })
})
