import { useRef, useState, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, RigidBody, useRopeJoint, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { findGrappleAnchor } from '../lib/physics'
import { COVER_PILLARS } from '../lib/pillars'
import { playerTransform, playerVelocity } from '../lib/world'
import { grappleInputHeld, grappleState } from '../lib/input'
import {
  COVER_PILLAR_HEIGHT,
  GRAPPLE_AIM_PITCH,
  GRAPPLE_LANDING_Y,
  GRAPPLE_MAX_RANGE,
  GRAPPLE_MIN_HEIGHT,
  GRAPPLE_ROPE_SLACK_FACTOR,
  PLAYER_HITBOX_RADIUS,
} from '../lib/constants'

type SwingPhase = 'idle' | 'attached' | 'freeFlight'

/** Aim direction for the grapple raycast: Chent's current facing (yaw),
 * blended with a fixed upward pitch so a level-aimed attempt naturally
 * reaches for elevated anchors ahead instead of needing the player to
 * physically look up first. Always unit length (cos/sin split cleanly). */
function computeAimDirection(yaw: number): THREE.Vector3 {
  const cosPitch = Math.cos(GRAPPLE_AIM_PITCH)
  return new THREE.Vector3(-Math.sin(yaw) * cosPitch, Math.sin(GRAPPLE_AIM_PITCH), -Math.cos(yaw) * cosPitch)
}

/** Joint-only child: mounted while, and only while, the grapple is actually
 * attached. Releasing the input unmounts this — dropping the rope joint —
 * while the dynamic body it was constraining (owned by the parent
 * SwingRig, which stays mounted) keeps simulating under gravity with
 * whatever velocity it had the instant the rope let go. That's the entire
 * "momentum launch": no impulse to compute, just removing a constraint
 * mid-swing. */
function GrappleAnchor({
  chentBodyRef,
  anchorPoint,
  ropeLength,
}: {
  chentBodyRef: RefObject<RapierRigidBody>
  anchorPoint: THREE.Vector3
  ropeLength: number
}) {
  // useRopeJoint requires a non-nullable RefObject<RapierRigidBody> — the
  // `null!` initializer keeps that type while the ref is still genuinely
  // null until React/Rapier attach the body; every read below is guarded.
  const anchorBodyRef = useRef<RapierRigidBody>(null!)
  useRopeJoint(chentBodyRef, anchorBodyRef, [
    [0, 0, 0],
    [0, 0, 0],
    ropeLength,
  ])

  return (
    <RigidBody
      ref={anchorBodyRef}
      type="fixed"
      position={[anchorPoint.x, anchorPoint.y, anchorPoint.z]}
      colliders={false}
    >
      <BallCollider args={[0.05]} sensor />
    </RigidBody>
  )
}

/** The invisible physics "ghost" that simulates the swing: Chent's actual
 * rendered body (PlayerController) never joins the Rapier world at all —
 * it just keeps reading playerTransform.position every frame exactly like
 * it does for ordinary kinematic movement. This body only exists to
 * compute where that position SHOULD be while swinging/free-falling, and
 * writes it back into the same shared transform. */
function SwingRig({
  anchorPoint,
  ropeLength,
  attached,
  onLanded,
}: {
  anchorPoint: THREE.Vector3
  ropeLength: number
  attached: boolean
  onLanded: () => void
}) {
  const chentBodyRef = useRef<RapierRigidBody>(null!)

  useFrame(() => {
    const body = chentBodyRef.current
    if (!body) return
    const t = body.translation()
    playerTransform.position.set(t.x, t.y, t.z)

    if (!attached && t.y <= GRAPPLE_LANDING_Y) {
      onLanded()
    }
  })

  return (
    <>
      <RigidBody
        ref={chentBodyRef}
        type="dynamic"
        position={[playerTransform.position.x, playerTransform.position.y, playerTransform.position.z]}
        linearVelocity={[playerVelocity.x, playerVelocity.y, playerVelocity.z]}
        colliders={false}
        linearDamping={0.05}
        ccd
      >
        <BallCollider args={[PLAYER_HITBOX_RADIUS]} />
      </RigidBody>
      {attached && <GrappleAnchor chentBodyRef={chentBodyRef} anchorPoint={anchorPoint} ropeLength={ropeLength} />}
    </>
  )
}

/** Owns the tail-grapple state machine: idle (watching for the grapple
 * input near a valid anchor) → attached (rope-jointed pendulum swing) →
 * freeFlight (input released, momentum carries Chent onward under gravity
 * alone) → back to idle once he lands, handing control back to
 * PlayerController's ordinary kinematic WASD movement. Mounted once inside
 * the <Physics> provider in Experience.tsx. */
export function GrappleController() {
  const [phase, setPhase] = useState<SwingPhase>('idle')
  const anchorPointRef = useRef(new THREE.Vector3())
  const ropeLengthRef = useRef(1)

  useFrame(() => {
    if (phase === 'idle') {
      if (!grappleInputHeld.current) return
      const direction = computeAimDirection(playerTransform.yaw)
      const hit = findGrappleAnchor(
        playerTransform.position,
        direction,
        COVER_PILLARS,
        GRAPPLE_MAX_RANGE,
        GRAPPLE_MIN_HEIGHT,
        COVER_PILLAR_HEIGHT,
      )
      if (!hit) return

      anchorPointRef.current.set(hit.x, hit.y, hit.z)
      ropeLengthRef.current = playerTransform.position.distanceTo(anchorPointRef.current) * GRAPPLE_ROPE_SLACK_FACTOR
      grappleState.anchorPoint.copy(anchorPointRef.current)
      grappleState.attached = true
      grappleState.active = true
      setPhase('attached')
      return
    }

    if (phase === 'attached' && !grappleInputHeld.current) {
      grappleState.attached = false
      setPhase('freeFlight')
    }
  })

  function handleLanded() {
    playerTransform.position.y = 0
    grappleState.active = false
    grappleState.attached = false
    setPhase('idle')
  }

  if (phase === 'idle') return null

  return (
    <SwingRig
      anchorPoint={anchorPointRef.current}
      ropeLength={ropeLengthRef.current}
      attached={phase === 'attached'}
      onLanded={handleLanded}
    />
  )
}
