import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { gameClock, playerTransform } from '../lib/world'
import { playShout, SHOUT_SOUND_URL, unlockAudio } from '../lib/audio'
import {
  ARENA_HALF_SIZE,
  AUDIO_REFERENCE_DISTANCE,
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

/** Third-person player rig: pointer-lock mouse look, WASD movement relative
 * to camera yaw, hold-to-sprint with a stamina budget, and a shout trigger.
 * Writes the authoritative transform into `playerTransform` (see lib/world)
 * every frame instead of React state, so it never causes a re-render. */
export function PlayerController() {
  const { camera, gl } = useThree()
  const phase = useGameStore((s) => s.phase)
  const bodyRef = useRef<THREE.Group>(null)
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
    function triggerShout() {
      const { phase, shoutCooldownRemaining, spawnBubble } = useGameStore.getState()
      if (phase !== 'playing' || shoutCooldownRemaining > 0) return
      spawnBubble('player', playerTransform.position, gameClock.elapsed)
      rootedUntilRef.current = gameClock.elapsed + SHOUT_ROOT_DURATION
      playShout(audioRef.current)
    }

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
          triggerShout()
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
        triggerShout()
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
      const inputForward = (forward ? 1 : 0) - (back ? 1 : 0)
      const inputRight = (right ? 1 : 0) - (left ? 1 : 0)
      const hasInput = inputForward !== 0 || inputRight !== 0

      let dx = inputForward * forwardX + inputRight * rightX
      let dz = inputForward * forwardZ + inputRight * rightZ
      const len = Math.hypot(dx, dz)
      if (len > 0.0001) {
        dx /= len
        dz /= len
      }

      const wantsSprint = !isRooted && sprint && hasInput && stamina > STAMINA_SPRINT_MIN
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
    } else {
      wasPlayingRef.current = false
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
      {/* Player capsule body — kept dark so it doesn't fight the visor for attention */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[PLAYER_HITBOX_RADIUS, 1.0, 6, 12]} />
        <meshStandardMaterial color="#2a2733" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Glowing visor: a bright emissive band across the "face" so the
       * player reads clearly in a very dark arena without needing the body
       * itself to be lit up. */}
      <mesh position={[0, 1.35, -0.4]}>
        <boxGeometry args={[0.34, 0.09, 0.06]} />
        <meshStandardMaterial color="#22e0ff" emissive="#22e0ff" emissiveIntensity={4.5} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.4, -0.3]} color="#22e0ff" intensity={1.6} distance={4.5} decay={2} />
      <PositionalAudio ref={audioRef} url={SHOUT_SOUND_URL} distance={AUDIO_REFERENCE_DISTANCE} loop={false} />
    </group>
  )
}
