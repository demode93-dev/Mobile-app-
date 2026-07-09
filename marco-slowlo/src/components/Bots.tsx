import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { gameClock, getBotTransform } from '../lib/world'
import { clearanceFromBubble } from '../lib/physics'
import { colorForOwner } from '../lib/colors'
import {
  ARENA_HALF_SIZE,
  BOT_COUNT,
  BOT_SPAWN_MIN_DISTANCE,
  MAX_FRAME_DELTA,
  PLAYER_HITBOX_RADIUS,
  SPRINT_SPEED,
  WALK_SPEED,
} from '../lib/constants'

const BOT_WALK_SPEED = WALK_SPEED * 0.75
const BOT_EVADE_SPEED = SPRINT_SPEED * 0.85
const BOT_EVADE_TRIGGER_CLEARANCE = 3.2
const BOT_SHOUT_INTERVAL_MIN = 3.5
const BOT_SHOUT_INTERVAL_MAX = 8

interface BotProps {
  id: string
  initialPosition: [number, number, number]
}

/** A wandering NPC that shouts on its own timer and flees nearby bubbles
 * (its own or anyone else's). This is not "real" multiplayer networking —
 * it exists to prove the bubble physics generalize to more than one
 * simultaneous shouter, which is the part that matters when a netcode layer
 * gets bolted on later. */
function Bot({ id, initialPosition }: BotProps) {
  const bodyRef = useRef<THREE.Group>(null)
  const transform = useMemo(() => getBotTransform(id), [id])
  const targetRef = useRef(new THREE.Vector3())
  const sessionTimeRef = useRef(0)
  const nextShoutAtRef = useRef(THREE.MathUtils.randFloat(BOT_SHOUT_INTERVAL_MIN, BOT_SHOUT_INTERVAL_MAX))
  const wasPlayingRef = useRef(false)
  const color = useMemo(() => colorForOwner(id), [id])

  useEffect(() => {
    transform.position.set(initialPosition[0], initialPosition[1], initialPosition[2])
    targetRef.current.set(initialPosition[0], initialPosition[1], initialPosition[2])
    if (bodyRef.current) bodyRef.current.position.copy(transform.position)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_FRAME_DELTA)
    const now = gameClock.elapsed
    const { phase, bubbles, spawnBubble } = useGameStore.getState()

    if (phase !== 'playing') {
      wasPlayingRef.current = false
      return
    }
    if (!wasPlayingRef.current) {
      wasPlayingRef.current = true
      transform.position.set(initialPosition[0], initialPosition[1], initialPosition[2])
      targetRef.current.set(initialPosition[0], initialPosition[1], initialPosition[2])
      sessionTimeRef.current = 0
      nextShoutAtRef.current = THREE.MathUtils.randFloat(BOT_SHOUT_INTERVAL_MIN, BOT_SHOUT_INTERVAL_MAX)
    }
    sessionTimeRef.current += delta

    let nearestClearance = Infinity
    let awayX = 0
    let awayZ = 0
    for (const b of bubbles) {
      const c = clearanceFromBubble(transform.position, b, now)
      if (c < nearestClearance) {
        nearestClearance = c
        awayX = transform.position.x - b.origin.x
        awayZ = transform.position.z - b.origin.z
      }
    }

    let moveX = 0
    let moveZ = 0
    let speed = BOT_WALK_SPEED

    if (nearestClearance < BOT_EVADE_TRIGGER_CLEARANCE) {
      const len = Math.hypot(awayX, awayZ) || 1
      moveX = awayX / len
      moveZ = awayZ / len
      speed = BOT_EVADE_SPEED
    } else {
      const dx = targetRef.current.x - transform.position.x
      const dz = targetRef.current.z - transform.position.z
      const dist = Math.hypot(dx, dz)
      if (dist < 1) {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * ARENA_HALF_SIZE * 0.8
        targetRef.current.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
      } else {
        moveX = dx / dist
        moveZ = dz / dist
      }
    }

    transform.position.x += moveX * speed * delta
    transform.position.z += moveZ * speed * delta

    const distFromCenter = Math.hypot(transform.position.x, transform.position.z)
    const maxDist = ARENA_HALF_SIZE - PLAYER_HITBOX_RADIUS
    if (distFromCenter > maxDist) {
      const scale = maxDist / distFromCenter
      transform.position.x *= scale
      transform.position.z *= scale
    }

    if (moveX !== 0 || moveZ !== 0) {
      transform.yaw = Math.atan2(-moveX, -moveZ)
    }

    if (sessionTimeRef.current >= nextShoutAtRef.current) {
      spawnBubble(id, transform.position, now)
      nextShoutAtRef.current =
        sessionTimeRef.current + THREE.MathUtils.randFloat(BOT_SHOUT_INTERVAL_MIN, BOT_SHOUT_INTERVAL_MAX)
    }

    if (bodyRef.current) {
      bodyRef.current.position.set(transform.position.x, transform.position.y, transform.position.z)
      bodyRef.current.rotation.y = transform.yaw
    }
  })

  return (
    <group ref={bodyRef}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[PLAYER_HITBOX_RADIUS, 1.0, 6, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.55} />
      </mesh>
      <pointLight position={[0, 1.4, 0]} color={color} intensity={0.9} distance={3} decay={2} />
    </group>
  )
}

export function Bots() {
  const ids = useMemo(() => Array.from({ length: BOT_COUNT }, (_, i) => `bot-${i + 1}`), [])
  return (
    <>
      {ids.map((id, i) => {
        const angle = (i / ids.length) * Math.PI * 2
        // Player always spawns at the arena origin, so this radius IS the
        // bot's distance from the player at round start — must clear
        // BOT_SPAWN_MIN_DISTANCE with margin to spare.
        const r = Math.min(BOT_SPAWN_MIN_DISTANCE + 2, ARENA_HALF_SIZE - 2)
        const pos: [number, number, number] = [Math.cos(angle) * r, 0, Math.sin(angle) * r]
        return <Bot key={id} id={id} initialPosition={pos} />
      })}
    </>
  )
}
