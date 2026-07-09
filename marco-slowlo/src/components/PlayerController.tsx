import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { gameClock, playerTransform } from '../lib/world'
import {
  ARENA_HALF_SIZE,
  MAX_FRAME_DELTA,
  PLAYER_HITBOX_RADIUS,
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
  const bodyRef = useRef<THREE.Group>(null)
  const yawRef = useRef(0)
  const pitchRef = useRef(0.22)
  const bodyYawRef = useRef(0)
  const keys = useRef<KeyState>({ forward: false, back: false, left: false, right: false, sprint: false })
  const cameraCurrentPos = useRef(new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_DISTANCE))
  const isLockedRef = useRef(false)
  const wasPlayingRef = useRef(false)

  useEffect(() => {
    function triggerShout() {
      const { phase, shoutCooldownRemaining, spawnBubble } = useGameStore.getState()
      if (phase !== 'playing' || shoutCooldownRemaining > 0) return
      spawnBubble('player', playerTransform.position, gameClock.elapsed)
    }

    const canvas = gl.domElement

    function onKeyDown(e: KeyboardEvent) {
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
      const { phase } = useGameStore.getState()
      if (phase === 'caught') return
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

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_FRAME_DELTA)
    const {
      phase,
      stamina,
      shoutCooldownRemaining,
      setStamina,
      setShoutCooldownRemaining,
      tickSurvival,
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
      }

      tickSurvival(delta)

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

      const wantsSprint = sprint && hasInput && stamina > STAMINA_SPRINT_MIN
      const speed = wantsSprint ? SPRINT_SPEED : WALK_SPEED

      if (wantsSprint) {
        setStamina(stamina - delta / STAMINA_MAX)
      } else {
        setStamina(stamina + delta / STAMINA_REGEN_TIME)
      }

      if (hasInput) {
        playerTransform.position.x += dx * speed * delta
        playerTransform.position.z += dz * speed * delta

        const targetBodyYaw = Math.atan2(-dx, -dz)
        bodyYawRef.current += shortestAngleDelta(bodyYawRef.current, targetBodyYaw) * Math.min(1, TURN_SMOOTHING * delta)
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
      {/* Player capsule body */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[PLAYER_HITBOX_RADIUS, 1.0, 6, 12]} />
        <meshStandardMaterial color="#e5e1f5" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Facing indicator */}
      <mesh position={[0, 1.35, -0.42]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#a78bfa" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.4, 0]} color="#a78bfa" intensity={1.4} distance={4} decay={2} />
    </group>
  )
}
