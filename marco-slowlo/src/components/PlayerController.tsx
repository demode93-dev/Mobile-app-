import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { gameClock, playerTransform, playerVelocity } from '../lib/world'
import { playShout, SHOUT_SOUND_URL, unlockAudio } from '../lib/audio'
import { actionTrigger, grappleInputHeld, grappleState, touchMoveVector } from '../lib/input'
import { colorForOwner, TAIL_ACCENT_COLOR } from '../lib/colors'
import { distanceToPillarSurface, nearestPillar } from '../lib/physics'
import { COVER_PILLARS } from '../lib/pillars'
import { getLevel } from '../lib/levels'
import '../shaders/CamouflageWashMaterial'
import {
  ARENA_HALF_SIZE,
  AUDIO_REFERENCE_DISTANCE,
  CAMOUFLAGE_RANGE,
  MAX_FRAME_DELTA,
  PLAYER_HITBOX_RADIUS,
  SHOUT_ROOT_DURATION,
  SPRINT_SPEED,
  STAMINA_MAX,
  STAMINA_REGEN_TIME,
  STAMINA_SPRINT_MIN,
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

const TAIL_BASE_RADIUS = 0.1
const TAIL_TIP_RADIUS = 0.055
const TAIL_CURVE_SPLIT = 0.6
const TAIL_ATTACH_Y = TORSO_Y - 0.35
const TAIL_ATTACH_Z = 0.4
const TAIL_STRETCH_SEGMENTS = 14
const TAIL_STRETCH_RADIUS = 0.075
const TAIL_ATTACH_LOCAL_OFFSET = new THREE.Vector3(0, TAIL_ATTACH_Y, TAIL_ATTACH_Z)

const scratchTailWorldOrigin = new THREE.Vector3()
const scratchAnchorLocal = new THREE.Vector3()
const scratchBezierMid = new THREE.Vector3()
const TAIL_STRETCH_ORIGIN = new THREE.Vector3(0, 0, 0)

/** Rotates a vector around the world Y axis by `angle` radians — matches
 * Three.js's own Object3D rotation.y convention exactly, so it can stand in
 * for a full scene-graph worldToLocal/localToWorld conversion using just
 * the yaw angle we already track, no matrixWorld timing games mid-frame. */
function rotateAroundY(v: THREE.Vector3, angle: number, out: THREE.Vector3): THREE.Vector3 {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const x = v.x * cos + v.z * sin
  const z = -v.x * sin + v.z * cos
  return out.set(x, v.y, z)
}

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

/** Sample points for Chent's resting tail: a spiral that tightens turn
 * over turn (radius shrinking toward the tip) sampled in a single local
 * plane, so viewed from behind — where the follow camera sits — it reads
 * as a proper curled chameleon tail rather than a flat disc. */
function createTailSpiralPoints(): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  const turns = 1.4
  const steps = 28
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * Math.PI * 2 * turns
    const radius = 0.46 * (1 - t * 0.85)
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
  }
  return points
}

/** Builds the resting curled tail as two tube segments sharing one spiral
 * curve — a thicker base and a thinner tip — instead of one constant-radius
 * tube, so it tapers toward the point without needing per-vertex radius
 * support from TubeGeometry. Both stay lightweight, low-segment-count
 * procedural geometry, same spirit as the lathed torso. */
function createTailSpiralGeometries(): { base: THREE.TubeGeometry; tip: THREE.TubeGeometry } {
  const points = createTailSpiralPoints()
  const splitIndex = Math.floor(points.length * TAIL_CURVE_SPLIT)
  const baseCurve = new THREE.CatmullRomCurve3(points.slice(0, splitIndex + 1))
  const tipCurve = new THREE.CatmullRomCurve3(points.slice(splitIndex))
  return {
    base: new THREE.TubeGeometry(baseCurve, 16, TAIL_BASE_RADIUS, 8, false),
    tip: new THREE.TubeGeometry(tipCurve, 12, TAIL_TIP_RADIUS, 8, false),
  }
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
  const bodyMaterialRef = useRef<any>(null)
  const leanGroupRef = useRef<THREE.Group>(null)
  const leftLegPivotRef = useRef<THREE.Group>(null)
  const rightLegPivotRef = useRef<THREE.Group>(null)
  const leanAngleRef = useRef(0)
  const legAmplitudeRef = useRef(0)
  const legPhaseRef = useRef(0)
  const teardropGeometry = useMemo(() => createTeardropGeometry(), [])
  const tailGeometries = useMemo(() => createTailSpiralGeometries(), [])
  const curledTailGroupRef = useRef<THREE.Group>(null)
  const tailStretchRef = useRef<THREE.Mesh>(null)
  const nativeColor = useMemo(() => colorForOwner('player'), [])
  // Camouflage wash-over state: "from"/"to" are the two colors the current
  // sweep is traveling between, and washProgress (0-1) is how far along it
  // is — see the wash block in useFrame and CamouflageWashMaterial.
  const washFromColorRef = useRef(new THREE.Color(nativeColor))
  const washTargetColorRef = useRef(new THREE.Color(nativeColor))
  const washTargetHexRef = useRef(nativeColor)
  const washProgressRef = useRef(1)
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
        case 'KeyE':
          // Hold to grapple — Shift is already sprint, so this gets its own
          // key. GrappleController polls grappleInputHeld every frame
          // rather than reacting to a discrete press, since a swing needs
          // to know "is it still held" continuously, not just "was pressed".
          grappleInputHeld.current = true
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
        case 'KeyE':
          grappleInputHeld.current = false
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
      levelIndex,
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

      // While the tail-grapple is swinging (or free-flying after release),
      // GrappleController owns playerTransform.position entirely — this
      // whole kinematic WASD block stands down rather than fighting it.
      if (!grappleState.active) {
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

        // No separate sprint button on touch: touchMoveVector is already
        // deadzone-gated to exactly (0, 0) for thumb drift (see
        // JOYSTICK_DEADZONE / TouchControls), so ANY nonzero deflection here
        // is a deliberate push — that alone immediately counts as full
        // sprint intent, same as holding Shift, with no separate walk tier.
        const touchDeflection = Math.hypot(touchMoveVector.x, touchMoveVector.y)
        const sprintHeld = sprint || touchDeflection > 0
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

        // No velocity to integrate — position moves only while hasInput is
        // true, by exactly this frame's distance, so releasing input (or
        // getting rooted) stops Chent dead the very next frame. No slide.
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

        // Track current velocity so a grapple grabbed the instant after
        // this frame can seed its swing with the momentum Chent already had.
        playerVelocity.set(dx * speed, 0, dz * speed)

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
        playerVelocity.set(0, 0, 0)
        leanAngleRef.current = 0
        legAmplitudeRef.current = 0
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

    // Camouflage wash-over: the logical camouflageColor itself updates
    // instantly on a button press (that's what the survival check reads —
    // see SoundBubbleManager), but the VISUAL transition is a traveling
    // color-swap sweep, not a snap or a uniform blend. A change of target
    // restarts the sweep using whatever we were already washing toward as
    // the new "from", so back-to-back matches don't pop; its duration is
    // level-tuned (moderate on Floor 1, faster on higher floors).
    const targetColorHex = playerTransform.camouflageColor ?? nativeColor
    if (targetColorHex !== washTargetHexRef.current) {
      washFromColorRef.current.copy(washTargetColorRef.current)
      washTargetColorRef.current.set(targetColorHex)
      washTargetHexRef.current = targetColorHex
      washProgressRef.current = 0
    }
    const washDuration = getLevel(levelIndex).camouflageWashDuration
    washProgressRef.current = Math.min(1, washProgressRef.current + delta / washDuration)
    if (bodyMaterialRef.current) {
      bodyMaterialRef.current.uFromColor = washFromColorRef.current
      bodyMaterialRef.current.uToColor = washTargetColorRef.current
      bodyMaterialRef.current.uProgress = washProgressRef.current
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

    // Tail-grapple visual: while actually anchored, the curled resting
    // tail is hidden and a stretched tube is rebuilt every frame from the
    // tail's attach point to the grapple anchor — snapping back to the
    // curled spiral the instant grappleState.attached goes false (input
    // released), even if Chent is still mid-launch. bodyYawRef.current is
    // frozen for the whole swing (the WASD block that changes it stands
    // down), so a pure yaw-based rotation does the same job as a full
    // scene-graph worldToLocal conversion without any matrixWorld timing
    // concerns mid-frame.
    if (curledTailGroupRef.current) {
      curledTailGroupRef.current.visible = !grappleState.attached
    }
    if (tailStretchRef.current) {
      tailStretchRef.current.visible = grappleState.attached
      if (grappleState.attached) {
        rotateAroundY(TAIL_ATTACH_LOCAL_OFFSET, bodyYawRef.current, scratchTailWorldOrigin)
        scratchTailWorldOrigin.add(playerTransform.position)
        scratchAnchorLocal.copy(grappleState.anchorPoint).sub(scratchTailWorldOrigin)
        rotateAroundY(scratchAnchorLocal, -bodyYawRef.current, scratchAnchorLocal)

        scratchBezierMid.copy(scratchAnchorLocal).multiplyScalar(0.5)
        scratchBezierMid.y += 0.3
        const curve = new THREE.QuadraticBezierCurve3(TAIL_STRETCH_ORIGIN, scratchBezierMid, scratchAnchorLocal)
        const oldGeometry = tailStretchRef.current.geometry
        tailStretchRef.current.geometry = new THREE.TubeGeometry(curve, TAIL_STRETCH_SEGMENTS, TAIL_STRETCH_RADIUS, 8, false)
        oldGeometry.dispose()
      }
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
       * material washes, bottom-to-top, toward either the exact color of
       * whatever it's camouflaged against or its own native hue while
       * showing true colors (see the wash block in useFrame above and
       * CamouflageWashMaterial). */}
      <group ref={leanGroupRef}>
        <mesh geometry={teardropGeometry} position={[0, TORSO_Y, 0]} castShadow>
          <camouflageWashMaterial ref={bodyMaterialRef} uFromColor={nativeColor} uToColor={nativeColor} uProgress={1} />
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
         * gets rooted — see the amplitude/phase refs driven in useFrame.
         * Each has a white athletic side-stripe breaking up the two-tone
         * color blocking. */}
        <group ref={leftLegPivotRef} position={[-HIP_OFFSET, HIP_Y, 0]}>
          <mesh position={[0, -UPPER_LEG_LENGTH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.09, UPPER_LEG_LENGTH, 8]} />
            <meshStandardMaterial color="#22212b" roughness={0.6} />
          </mesh>
          <mesh position={[-0.095, -UPPER_LEG_LENGTH / 2, 0]}>
            <boxGeometry args={[0.025, UPPER_LEG_LENGTH * 0.95, 0.05]} />
            <meshStandardMaterial color="#f5f5f5" roughness={0.4} />
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
          <mesh position={[0.095, -UPPER_LEG_LENGTH / 2, 0]}>
            <boxGeometry args={[0.025, UPPER_LEG_LENGTH * 0.95, 0.05]} />
            <meshStandardMaterial color="#f5f5f5" roughness={0.4} />
          </mesh>
          <mesh position={[0, -UPPER_LEG_LENGTH - SHOE_LENGTH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.1, SHOE_LENGTH, 8]} />
            <meshStandardMaterial color="#4b4b57" roughness={0.5} />
          </mesh>
        </group>

        {/* Curled tail: a fixed violet accent (not camouflage-washed — only
         * the torso participates in the color-match survival check) that,
         * together with the teal-green torso, gives Chent his green-teal-
         * purple palette. Hidden in favor of the stretched grapple-line
         * mesh below while actually anchored to a tail-swing point. */}
        <group ref={curledTailGroupRef} position={[0, TAIL_ATTACH_Y, TAIL_ATTACH_Z]}>
          <mesh geometry={tailGeometries.base} castShadow>
            <meshStandardMaterial color={TAIL_ACCENT_COLOR} roughness={0.4} metalness={0.15} />
          </mesh>
          <mesh geometry={tailGeometries.tip} castShadow>
            <meshStandardMaterial color={TAIL_ACCENT_COLOR} roughness={0.4} metalness={0.15} />
          </mesh>
        </group>

        {/* Stretched grapple-line tail: invisible until attached, then its
         * geometry is rebuilt every frame as a QuadraticBezierCurve3 from
         * this same attach point to the anchor (see the tail-grapple block
         * in useFrame above). The tiny placeholder sphere below is only
         * ever visible for a single frame at most, if at all. */}
        <mesh ref={tailStretchRef} position={[0, TAIL_ATTACH_Y, TAIL_ATTACH_Z]} visible={false} castShadow>
          <sphereGeometry args={[0.01, 4, 4]} />
          <meshStandardMaterial color={TAIL_ACCENT_COLOR} roughness={0.4} metalness={0.15} />
        </mesh>
      </group>

      <PositionalAudio ref={audioRef} url={SHOUT_SOUND_URL} distance={AUDIO_REFERENCE_DISTANCE} loop={false} />
    </group>
  )
}
