import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { gameClock, playerTransform } from '../lib/world'
import { playShout, SHOUT_SOUND_URL, unlockAudio } from '../lib/audio'
import { actionTrigger, touchMoveVector } from '../lib/input'
import { colorForOwner } from '../lib/colors'
import { distanceToPillarSurface, nearestPillar } from '../lib/physics'
import { COVER_PILLARS } from '../lib/pillars'
import {
  ARENA_HALF_SIZE,
  AUDIO_REFERENCE_DISTANCE,
  CAMOUFLAGE_LERP_RATE,
  CAMOUFLAGE_RANGE,
  MAX_FRAME_DELTA,
  PLAYER_HITBOX_RADIUS,
  SHOUT_ROOT_DURATION,
  SPRINT_SPEED,
  STAMINA_MAX,
  STAMINA_REGEN_TIME,
  STAMINA_SPRINT_MIN,
  TOUCH_SPRINT_DEFLECTION,
  TURN_SMOOTHING,
  WALK_SPEED,
} from '../lib/constants'

const CAMERA_DISTANCE = 6.5
const CAMERA_HEIGHT = 3.1
const CAMERA_LOOK_HEIGHT = 1.25
const MOUSE_SENSITIVITY = 0.0022
const PITCH_MIN = -0.3
const PITCH_MAX = 0.55
const CAMERA_SMOOTHING = 14

// Chent's sprint posture: pitched forward like a runner leaning into a dash.
// The 30–45° range is the ask; sprinting sits at the top of it, walking eases
// off so he isn't perpetually diving forward at a stroll.
const LEAN_ANGLE_WALK = THREE.MathUtils.degToRad(16)
const LEAN_ANGLE_SPRINT = THREE.MathUtils.degToRad(38)
const LEAN_SMOOTHING = 10

// Cartoon-sprint leg cycle: two hip pivots swinging in opposite phase, sine-
// driven rather than a full animation clip — cheap and reads as "explosive"
// once the amplitude and cycle rate are both pushed well past realism.
const LEG_SWING_MAX = THREE.MathUtils.degToRad(52)
const LEG_SWING_SMOOTHING = 14
const LEG_CYCLE_RATE_WALK = 9
const LEG_CYCLE_RATE_SPRINT = 17

const HIP_OFFSET = 0.16
const HIP_Y = 0.62
const UPPER_LEG_LENGTH = 0.42
const SHOE_LENGTH = 0.2
const TORSO_Y = HIP_Y + 0.55

const scratchColor = new THREE.Color()

interface KeyState {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  sprint: boolean
}

function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

/** A lathed "teardrop" solid of revolution for Chent's torso — round and
 * full up top, tapering to a point at the base — reads as a sleek,
 * aerodynamic core once the whole body group is pitched into a sprint lean,
 * instead of the uniform capsule every other actor still uses. */
function createTeardropGeometry(): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0, -0.55),
    new THREE.Vector2(0.14, -0.42),
    new THREE.Vector2(0.28, -0.18),
    new THREE.Vector2(0.36, 0.05),
    new THREE.Vector2(0.34, 0.28),
    new THREE.Vector2(0.22, 0.46),
    new THREE.Vector2(0.08, 0.54),
    new THREE.Vector2(0, 0.56),
  ]
  return new THREE.LatheGeometry(points, 20)
}

/** Third-person rig for Chent, the player's chameleon runner: pointer-lock
 * mouse look, WASD movement relative to camera yaw, hold-to-sprint with a
 * stamina budget, and one dual-purpose action trigger (Sensory Pulse while
 * hunting, camouflage while evading). Writes the authoritative transform
 * into `playerTransform` (see lib/world) every frame instead of React
 * state, so it never causes a re-render. */
export function PlayerController() {
  const { camera, gl } = useThree()
  const phase = useGameStore((s) => s.phase)
  const bodyRef = useRef<THREE.Group>(null)
  const bodyMaterialRef = useRef<THREE.MeshStandardMaterial>(null)
  const leanGroupRef = useRef<THREE.Group>(null)
  const leftLegPivotRef = useRef<THREE.Group>(null)
  const rightLegPivotRef = useRef<THREE.Group>(null)
  const leanAngleRef = useRef(0)
  const legAmplitudeRef = useRef(0)
  const legPhaseRef = useRef(0)
  const teardropGeometry = useMemo(() => createTeardropGeometry(), [])
  const nativeColor = useMemo(() => colorForOwner('player'), [])
  const displayColorRef = useRef(new THREE.Color(nativeColor))
  const yawRef = useRef(0)
  const pitchRef = useRef(0.22)
  const bodyYawRef = useRef(0)
  const keys = useRef<KeyState>({ forward: false, back: false, left: false, right: false, sprint: false })
  const cameraCurrentPos = useRef(new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_DISTANCE))
  const isLockedRef = useRef(false)
  const wasPlayingRef = useRef(false)
  const rootedUntilRef = useRef(0)
  const wasRootedRef = useRef(false)
  const audioRef = useRef<THREE.PositionalAudio>(null)

  useEffect(() => {
    function triggerAction() {
      const { phase, currentItId, shoutCooldownRemaining, spawnBubble } = useGameStore.getState()
      if (phase !== 'playing') return

      if (currentItId === 'player') {
        // Hunting: cast a Sensory Pulse.
        if (shoutCooldownRemaining > 0) return
        spawnBubble('player', playerTransform.position, gameClock.elapsed)
        rootedUntilRef.current = gameClock.elapsed + SHOUT_ROOT_DURATION
        playShout(audioRef.current)
        return
      }

      // Evading: attempt to camouflage against whatever's nearest, if
      // close enough — otherwise this reverts to true colors.
      const nearest = nearestPillar(playerTransform.position, COVER_PILLARS)
      const inRange = nearest !== null && distanceToPillarSurface(playerTransform.position, nearest) <= CAMOUFLAGE_RANGE
      playerTransform.camouflageColor = inRange ? nearest!.color : null
    }

    // The on-screen action button (TouchControls.tsx, plain DOM outside the
    // Canvas) calls this exact function through the shared ref — not a
    // reimplementation of it.
    actionTrigger.current = triggerAction

    const canvas = gl.domElement

    function onKeyDown(e: KeyboardEvent) {
      unlockAudio()
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.current.back = true
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = true
          break
        case 'Space':
          e.preventDefault()
          triggerAction()
          break
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.current.back = false
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = false
          break
      }
    }
    function onMouseMove(e: MouseEvent) {
      if (!isLockedRef.current) return
      yawRef.current -= e.movementX * MOUSE_SENSITIVITY
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - e.movementY * MOUSE_SENSITIVITY,
        PITCH_MIN,
        PITCH_MAX,
      )
    }
    function onPointerLockChange() {
      isLockedRef.current = document.pointerLockElement === canvas
    }
    function onMouseDown() {
      unlockAudio()
      const { phase } = useGameStore.getState()
      if (phase !== 'playing') return
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock()
      } else {
        triggerAction()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    canvas.addEventListener('mousedown', onMouseDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      canvas.removeEventListener('mousedown', onMouseDown)
    }
  }, [gl])

  // Release the mouse the instant we're not actively playing — otherwise
  // the cursor stays hidden/constrained under the Start/Game Over overlay
  // and a real click can't reliably land on the button underneath it.
  useEffect(() => {
    if (phase !== 'playing' && document.pointerLockElement === gl.domElement) {
      document.exitPointerLock()
    }
  }, [phase, gl])

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_FRAME_DELTA)
    const {
      phase,
      currentItId,
      stamina,
      shoutCooldownRemaining,
      setStamina,
      setShoutCooldownRemaining,
      tickMatch,
      setRooted,
    } = useGameStore.getState()

    if (shoutCooldownRemaining > 0) {
      setShoutCooldownRemaining(shoutCooldownRemaining - delta)
    }

    // Hunting shows true colors, not a leftover camouflage tint from the
    // last time this actor was evading.
    if (currentItId === 'player') {
      playerTransform.camouflageColor = null
    }

    const yaw = yawRef.current
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    const rightX = Math.cos(yaw)
    const rightZ = -Math.sin(yaw)

    if (phase === 'playing') {
      if (!wasPlayingRef.current) {
        wasPlayingRef.current = true
        playerTransform.position.set(0, 0, 0)
        bodyYawRef.current = 0
        rootedUntilRef.current = 0
        wasRootedRef.current = false
      }

      tickMatch(delta)

      const isRooted = gameClock.elapsed < rootedUntilRef.current
      if (isRooted !== wasRootedRef.current) {
        wasRootedRef.current = isRooted
        setRooted(isRooted)
      }

      const { forward, back, left, right, sprint } = keys.current
      // Keyboard and the touch joystick just add into the same input axes —
      // whichever the player is using (or both at once), the rest of the
      // movement/root/stamina logic below doesn't need to know which.
      const inputForward = (forward ? 1 : 0) - (back ? 1 : 0) + touchMoveVector.y
      const inputRight = (right ? 1 : 0) - (left ? 1 : 0) + touchMoveVector.x
      const hasInput = Math.abs(inputForward) > 0.0001 || Math.abs(inputRight) > 0.0001

      let dx = inputForward * forwardX + inputRight * rightX
      let dz = inputForward * forwardZ + inputRight * rightZ
      const len = Math.hypot(dx, dz)
      if (len > 0.0001) {
        dx /= len
        dz /= len
      }

      // No separate sprint button on touch: shoving the joystick to near
      // full deflection sprints instead, same as holding Shift.
      const touchDeflection = Math.hypot(touchMoveVector.x, touchMoveVector.y)
      const sprintHeld = sprint || touchDeflection >= TOUCH_SPRINT_DEFLECTION
      const wantsSprint = !isRooted && sprintHeld && hasInput && stamina > STAMINA_SPRINT_MIN
      const speed = wantsSprint ? SPRINT_SPEED : WALK_SPEED

      if (wantsSprint) {
        setStamina(stamina - delta / STAMINA_MAX)
      } else {
        setStamina(stamina + delta / STAMINA_REGEN_TIME)
      }

      if (hasInput) {
        const targetBodyYaw = Math.atan2(-dx, -dz)
        bodyYawRef.current += shortestAngleDelta(bodyYawRef.current, targetBodyYaw) * Math.min(1, TURN_SMOOTHING * delta)
      }

      if (hasInput && !isRooted) {
        playerTransform.position.x += dx * speed * delta
        playerTransform.position.z += dz * speed * delta
      }

      const distFromCenter = Math.hypot(playerTransform.position.x, playerTransform.position.z)
      const maxDist = ARENA_HALF_SIZE - PLAYER_HITBOX_RADIUS
      if (distFromCenter > maxDist) {
        const scale = maxDist / distFromCenter
        playerTransform.position.x *= scale
        playerTransform.position.z *= scale
      }

      // Sprint posture: lean deeper and pump the legs faster/wider while
      // actually translating; ease straight back to neutral the instant
      // Chent stops or gets rooted, rather than snapping.
      const isActivelyMoving = hasInput && !isRooted
      const leanTarget = isActivelyMoving ? (wantsSprint ? LEAN_ANGLE_SPRINT : LEAN_ANGLE_WALK) : 0
      leanAngleRef.current = THREE.MathUtils.lerp(leanAngleRef.current, leanTarget, 1 - Math.exp(-LEAN_SMOOTHING * delta))

      const legAmplitudeTarget = isActivelyMoving ? LEG_SWING_MAX : 0
      legAmplitudeRef.current = THREE.MathUtils.lerp(
        legAmplitudeRef.current,
        legAmplitudeTarget,
        1 - Math.exp(-LEG_SWING_SMOOTHING * delta),
      )
      if (isActivelyMoving) {
        legPhaseRef.current += delta * (wantsSprint ? LEG_CYCLE_RATE_SPRINT : LEG_CYCLE_RATE_WALK)
      }
    } else {
      wasPlayingRef.current = false
      leanAngleRef.current = 0
      legAmplitudeRef.current = 0
    }

    playerTransform.yaw = yaw

    if (bodyRef.current) {
      bodyRef.current.position.set(
        playerTransform.position.x,
        playerTransform.position.y,
        playerTransform.position.z,
      )
      bodyRef.current.rotation.y = bodyYawRef.current
    }

    // Chase whatever color we're currently supposed to be (camouflaged or
    // native) — the logical camouflageColor itself updates instantly on a
    // button press; only the VISUAL transition is smoothed here.
    const targetColorHex = playerTransform.camouflageColor ?? nativeColor
    displayColorRef.current.lerp(scratchColor.set(targetColorHex), 1 - Math.exp(-CAMOUFLAGE_LERP_RATE * delta))
    if (bodyMaterialRef.current) {
      bodyMaterialRef.current.color.copy(displayColorRef.current)
    }

    // Sprint lean (negative X tips the top toward -Z, i.e. forward) and the
    // opposite-phase leg swing — both smoothed refs computed above, applied
    // here regardless of phase so they also ease back to neutral at the
    // Start/Game Over screens instead of freezing mid-stride.
    if (leanGroupRef.current) {
      leanGroupRef.current.rotation.x = -leanAngleRef.current
    }
    if (leftLegPivotRef.current) {
      leftLegPivotRef.current.rotation.x = Math.sin(legPhaseRef.current) * legAmplitudeRef.current
    }
    if (rightLegPivotRef.current) {
      rightLegPivotRef.current.rotation.x = Math.sin(legPhaseRef.current + Math.PI) * legAmplitudeRef.current
    }

    const camDist = CAMERA_DISTANCE * Math.cos(pitchRef.current)
    const camHeight = CAMERA_HEIGHT + CAMERA_DISTANCE * Math.sin(pitchRef.current)
    const desiredCamPos = new THREE.Vector3(
      playerTransform.position.x - forwardX * camDist,
      playerTransform.position.y + camHeight,
      playerTransform.position.z - forwardZ * camDist,
    )
    const smoothing = 1 - Math.exp(-CAMERA_SMOOTHING * delta)
    cameraCurrentPos.current.lerp(desiredCamPos, THREE.MathUtils.clamp(smoothing, 0, 1))
    camera.position.copy(cameraCurrentPos.current)
    camera.lookAt(
      playerTransform.position.x,
      playerTransform.position.y + CAMERA_LOOK_HEIGHT,
      playerTransform.position.z,
    )
  })

  return (
    <group ref={bodyRef}>
      {/* Chent: a hyper-agile chameleon runner. Everything above the hips
       * lives in leanGroup, pitched forward into a sprint lean; the torso's
       * material color chases either the exact color of whatever it's
       * camouflaged against, or its own native hue while showing true
       * colors (see the lerp in useFrame above). */}
      <group ref={leanGroupRef}>
        <mesh geometry={teardropGeometry} position={[0, TORSO_Y, 0]} castShadow>
          <meshStandardMaterial ref={bodyMaterialRef} color={nativeColor} roughness={0.45} metalness={0.15} />
        </mesh>

        {/* Glowing visor: a fixed identity marker so the player can still
         * be told apart from the Bot even while both are camouflaged to
         * the same item color. */}
        <mesh position={[0, TORSO_Y + 0.42, -0.3]}>
          <boxGeometry args={[0.34, 0.09, 0.06]} />
          <meshStandardMaterial color="#22e0ff" emissive="#22e0ff" emissiveIntensity={4.5} toneMapped={false} />
        </mesh>
        <pointLight position={[0, TORSO_Y + 0.45, -0.3]} color="#22e0ff" intensity={1.6} distance={4.5} decay={2} />

        {/* Track-pants legs: a snappy opposite-phase sine swing while
         * moving, eased back to a dead stop the instant Chent idles or
         * gets rooted — see the amplitude/phase refs driven in useFrame. */}
        <group ref={leftLegPivotRef} position={[-HIP_OFFSET, HIP_Y, 0]}>
          <mesh position={[0, -UPPER_LEG_LENGTH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.09, UPPER_LEG_LENGTH, 8]} />
            <meshStandardMaterial color="#22212b" roughness={0.6} />
          </mesh>
          <mesh position={[0, -UPPER_LEG_LENGTH - SHOE_LENGTH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.1, SHOE_LENGTH, 8]} />
            <meshStandardMaterial color="#4b4b57" roughness={0.5} />
          </mesh>
        </group>
        <group ref={rightLegPivotRef} position={[HIP_OFFSET, HIP_Y, 0]}>
          <mesh position={[0, -UPPER_LEG_LENGTH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.09, UPPER_LEG_LENGTH, 8]} />
            <meshStandardMaterial color="#22212b" roughness={0.6} />
          </mesh>
          <mesh position={[0, -UPPER_LEG_LENGTH - SHOE_LENGTH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.1, SHOE_LENGTH, 8]} />
            <meshStandardMaterial color="#4b4b57" roughness={0.5} />
          </mesh>
        </group>
      </group>

      <PositionalAudio ref={audioRef} url={SHOUT_SOUND_URL} distance={AUDIO_REFERENCE_DISTANCE} loop={false} />
    </group>
  )
}
