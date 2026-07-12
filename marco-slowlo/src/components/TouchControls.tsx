import { useRef, useState } from 'react'
import { actionTrigger, applyJoystickDeadzone, grappleInputHeld, touchMoveVector } from '../lib/input'
import { JOYSTICK_DEADZONE } from '../lib/constants'
import { useGameStore } from '../store/gameStore'

const JOYSTICK_RADIUS = 55
const KNOB_SIZE = 76
const BASE_SIZE = JOYSTICK_RADIUS * 2

interface JoystickVisual {
  active: boolean
  originX: number
  originY: number
  knobX: number
  knobY: number
}

const IDLE: JoystickVisual = { active: false, originX: 0, originY: 0, knobX: 0, knobY: 0 }

/** Floating virtual joystick (bottom-left) + action button (bottom-right).
 * Uses the Pointer Events API — not raw touch or mouse events — so mouse,
 * touch, and pen all work identically, and each control tracks its own
 * pointer id independently. That last part matters: a real player drags
 * the joystick with one thumb while tapping the action button with the
 * other, and without per-pointer tracking the second touch would fight the
 * first for the same event stream instead of moving and acting at once. */
function Joystick() {
  const [visual, setVisual] = useState<JoystickVisual>(IDLE)
  const activePointerId = useRef<number | null>(null)

  function updateFromPoint(origin: { x: number; y: number }, clientX: number, clientY: number) {
    let dx = clientX - origin.x
    let dy = clientY - origin.y
    const dist = Math.hypot(dx, dy)
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS
      dy = (dy / dist) * JOYSTICK_RADIUS
    }
    // Deadzone gates the LOGICAL input only (touchMoveVector) — the knob
    // below still visually tracks the raw thumb position for tactile
    // feedback even while sitting inside the dead center.
    const normalizedX = dx / JOYSTICK_RADIUS
    const normalizedY = -dy / JOYSTICK_RADIUS // screen Y grows downward; forward is an upward drag
    const gated = applyJoystickDeadzone(normalizedX, normalizedY, JOYSTICK_DEADZONE)
    touchMoveVector.x = gated.x
    touchMoveVector.y = gated.y
    return { knobX: origin.x + dx, knobY: origin.y + dy }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (activePointerId.current !== null) return // one thumb on this stick at a time
    activePointerId.current = e.pointerId
    const origin = { x: e.clientX, y: e.clientY }
    const { knobX, knobY } = updateFromPoint(origin, e.clientX, e.clientY)
    setVisual({ active: true, originX: origin.x, originY: origin.y, knobX, knobY })
    // Best-effort: keeps move/up events targeting this element even if the
    // finger drags outside its bounds. Not load-bearing for correctness —
    // the pointerId check above already scopes every handler to this one
    // touch — so a browser that refuses capture here (or a pointer that's
    // already ended) shouldn't stop the joystick from registering input.
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return
    setVisual((v) => {
      if (!v.active) return v
      const { knobX, knobY } = updateFromPoint({ x: v.originX, y: v.originY }, e.clientX, e.clientY)
      return { ...v, knobX, knobY }
    })
  }

  function release(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return
    activePointerId.current = null
    touchMoveVector.x = 0
    touchMoveVector.y = 0
    setVisual(IDLE)
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-0 left-0 h-[55%] w-1/2 touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {!visual.active && (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-white/25 bg-white/5"
          style={{
            left: 36,
            bottom: 36,
            width: BASE_SIZE,
            height: BASE_SIZE,
          }}
        />
      )}
      {visual.active && (
        <>
          <div
            className="pointer-events-none fixed rounded-full border-2 border-white/30 bg-white/10"
            style={{
              left: visual.originX - JOYSTICK_RADIUS,
              top: visual.originY - JOYSTICK_RADIUS,
              width: BASE_SIZE,
              height: BASE_SIZE,
            }}
          />
          <div
            className="pointer-events-none fixed rounded-full bg-white/40 ring-1 ring-white/60"
            style={{
              left: visual.knobX - KNOB_SIZE / 2,
              top: visual.knobY - KNOB_SIZE / 2,
              width: KNOB_SIZE,
              height: KNOB_SIZE,
            }}
          />
        </>
      )}
    </div>
  )
}

/** Dual-purpose action button: emits a Sensory Pulse while hunting, or
 * attempts to camouflage against the nearest item while evading — the
 * label switches so it's always clear which one a tap will do. */
function ActionButton() {
  const [pressed, setPressed] = useState(false)
  const isHunting = useGameStore((s) => s.currentItId === 'player')

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault()
    setPressed(true)
    actionTrigger.current()
  }

  return (
    <div className="pointer-events-none absolute bottom-8 right-8">
      <button
        type="button"
        aria-label={isHunting ? 'Emit Sensory Pulse' : 'Camouflage'}
        className={`pointer-events-auto h-24 w-24 touch-none select-none rounded-full border-2 border-white/40 text-lg font-black tracking-widest text-white shadow-[0_0_30px_rgba(217,70,239,0.5)] transition-transform ${
          pressed ? 'scale-90 bg-fuchsia-400' : 'scale-100 bg-fuchsia-500'
        }`}
        onPointerDown={handlePointerDown}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {isHunting ? 'PULSE' : 'CAMO'}
      </button>
    </div>
  )
}

/** Tail-grapple: a hold button, not a tap trigger — grappleInputHeld stays
 * true for as long as a finger is down, exactly like KeyE on keyboard.
 * GrappleController polls it every frame to attempt/maintain/release a
 * swing; releasing (up/leave/cancel) always clears it, same as key-up. */
function GrappleButton() {
  const [pressed, setPressed] = useState(false)

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault()
    setPressed(true)
    grappleInputHeld.current = true
  }

  function release() {
    setPressed(false)
    grappleInputHeld.current = false
  }

  return (
    <div className="pointer-events-none absolute bottom-36 right-10">
      <button
        type="button"
        aria-label="Tail grapple"
        className={`pointer-events-auto h-20 w-20 touch-none select-none rounded-full border-2 border-white/40 text-sm font-black tracking-widest text-white shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-transform ${
          pressed ? 'scale-90 bg-violet-400' : 'scale-100 bg-violet-500'
        }`}
        onPointerDown={handlePointerDown}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        TAIL
      </button>
    </div>
  )
}

/** Only meaningful during active play — the Start/Game Over overlays have
 * their own buttons and cover the whole screen anyway. */
export function TouchControls() {
  return (
    <div className="absolute inset-0">
      <Joystick />
      <GrappleButton />
      <ActionButton />
    </div>
  )
}
