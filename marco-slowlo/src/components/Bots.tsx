import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { gameClock, getBotTransform, playerTransform } from '../lib/world'
import { clearanceFromBubble, findHidingSpot, isLineOfSightBlocked } from '../lib/physics'
import { colorForOwner } from '../lib/colors'
import { playShout, setAudioMuffled, SHOUT_SOUND_URL } from '../lib/audio'
import { COVER_PILLARS } from '../lib/pillars'
import { getLevel } from '../lib/levels'
import {
  ARENA_HALF_SIZE,
  AUDIO_REFERENCE_DISTANCE,
  BOT_HUNT_AGGRO_RANGE,
  BOT_ID,
  BOT_SPAWN_MIN_DISTANCE,
  MAX_FRAME_DELTA,
  PLAYER_HITBOX_RADIUS,
  SHOUT_COOLDOWN,
  SHOUT_ROOT_DURATION,
  SPRINT_SPEED,
  WALK_SPEED,
} from '../lib/constants'

// Base speeds before the current floor's botSpeedMultiplier is applied.
const BASE_BOT_WALK_SPEED = WALK_SPEED * 0.75
const BASE_BOT_EVADE_SPEED = SPRINT_SPEED * 0.85
const BOT_EVADE_TRIGGER_CLEARANCE = 3.2
const HIDE_SPOT_MARGIN = 1.5
const HIDE_SPOT_REACHED_DIST = 0.5
const HIDE_SPOT_REFRESH_INTERVAL = 1.5

/** The single Bot, playing tag against the player. Its whole strategy
 * flips on one question, asked fresh every frame: am I "It"?
 *  - Hunting: beeline for the player and, once in range and off cooldown,
 *    take a shout — which roots it in place for the same 0.5s the player
 *    eats, so a missed shout is a real opening for the player to close in.
 *  - Evading: run from the hunter's actual bubble if one is closing in,
 *    otherwise path toward whichever pillar's "shadow" (see findHidingSpot)
 *    is nearest, and sit there. It never shouts while evading — that would
 *    only give its position away for no benefit. */
function Bot({ id, initialPosition }: { id: string; initialPosition: [number, number, number] }) {
  const bodyRef = useRef<THREE.Group>(null)
  const transform = useMemo(() => getBotTransform(id), [id])
  const wasPlayingRef = useRef(false)
  const rootedUntilRef = useRef(0)
  const shoutCooldownRef = useRef(0)
  const hideTargetRef = useRef(new THREE.Vector3())
  const hideTargetRefreshAtRef = useRef(0)
  const audioRef = useRef<THREE.PositionalAudio>(null)
  const wasMuffledRef = useRef(false)
  const color = useMemo(() => colorForOwner(id), [id])

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_FRAME_DELTA)
    const now = gameClock.elapsed
    const { phase, currentItId, levelIndex, bubbles, spawnBubble } = useGameStore.getState()

    if (phase !== 'playing') {
      wasPlayingRef.current = false
      return
    }
    if (!wasPlayingRef.current) {
      wasPlayingRef.current = true
      transform.position.set(initialPosition[0], initialPosition[1], initialPosition[2])
      hideTargetRef.current.set(initialPosition[0], initialPosition[1], initialPosition[2])
      rootedUntilRef.current = 0
      shoutCooldownRef.current = 0
      hideTargetRefreshAtRef.current = 0
    }

    const isHunting = currentItId === id
    const isRooted = now < rootedUntilRef.current
    const speedMultiplier = getLevel(levelIndex).botSpeedMultiplier
    const botWalkSpeed = BASE_BOT_WALK_SPEED * speedMultiplier
    const botEvadeSpeed = BASE_BOT_EVADE_SPEED * speedMultiplier

    let moveX = 0
    let moveZ = 0
    let speed = botWalkSpeed

    if (isHunting) {
      const dx = playerTransform.position.x - transform.position.x
      const dz = playerTransform.position.z - transform.position.z
      const dist = Math.hypot(dx, dz)
      if (dist > 0.05) {
        moveX = dx / dist
        moveZ = dz / dist
      }

      shoutCooldownRef.current = Math.max(0, shoutCooldownRef.current - delta)
      if (!isRooted && shoutCooldownRef.current <= 0 && dist <= BOT_HUNT_AGGRO_RANGE) {
        spawnBubble(id, transform.position, now)
        shoutCooldownRef.current = SHOUT_COOLDOWN
        rootedUntilRef.current = now + SHOUT_ROOT_DURATION
        playShout(audioRef.current)
      }
    } else {
      let nearestClearance = Infinity
      let awayX = 0
      let awayZ = 0
      for (const b of bubbles) {
        if (b.ownerId !== currentItId) continue // only the actual hunter's bubble is a real threat
        const c = clearanceFromBubble(transform.position, b, now)
        if (c < nearestClearance) {
          nearestClearance = c
          awayX = transform.position.x - b.origin.x
          awayZ = transform.position.z - b.origin.z
        }
      }

      if (nearestClearance < BOT_EVADE_TRIGGER_CLEARANCE) {
        const len = Math.hypot(awayX, awayZ) || 1
        moveX = awayX / len
        moveZ = awayZ / len
        speed = botEvadeSpeed
      } else {
        if (now >= hideTargetRefreshAtRef.current) {
          const spot = findHidingSpot(transform.position, playerTransform.position, COVER_PILLARS, HIDE_SPOT_MARGIN)
          if (spot) {
            hideTargetRef.current.set(spot.x, 0, spot.z)
          } else {
            // No pillars at all (shouldn't happen in practice) — just run directly away.
            const awayFromPlayerX = transform.position.x - playerTransform.position.x
            const awayFromPlayerZ = transform.position.z - playerTransform.position.z
            const len = Math.hypot(awayFromPlayerX, awayFromPlayerZ) || 1
            hideTargetRef.current.set(
              transform.position.x + (awayFromPlayerX / len) * 6,
              0,
              transform.position.z + (awayFromPlayerZ / len) * 6,
            )
          }
          hideTargetRefreshAtRef.current = now + HIDE_SPOT_REFRESH_INTERVAL
        }

        const dx = hideTargetRef.current.x - transform.position.x
        const dz = hideTargetRef.current.z - transform.position.z
        const dist = Math.hypot(dx, dz)
        if (dist > HIDE_SPOT_REACHED_DIST) {
          moveX = dx / dist
          moveZ = dz / dist
        } else {
          // Sitting in cover; re-check next frame in case the player moved
          // enough that a different pillar would hide it better.
          hideTargetRefreshAtRef.current = now
        }
      }
    }

    if (!isRooted && (moveX !== 0 || moveZ !== 0)) {
      transform.position.x += moveX * speed * delta
      transform.position.z += moveZ * speed * delta
      transform.yaw = Math.atan2(-moveX, -moveZ)
    }

    const distFromCenter = Math.hypot(transform.position.x, transform.position.z)
    const maxDist = ARENA_HALF_SIZE - PLAYER_HITBOX_RADIUS
    if (distFromCenter > maxDist) {
      const scale = maxDist / distFromCenter
      transform.position.x *= scale
      transform.position.z *= scale
    }

    // Acoustic shadow: if a pillar sits between this bot and the player,
    // muffle its voice with a lowpass filter; restore full frequency the
    // instant the player steps back into the clear. Only touches the audio
    // graph on state changes, not every frame.
    const isMuffled = isLineOfSightBlocked(transform.position, playerTransform.position, COVER_PILLARS)
    if (isMuffled !== wasMuffledRef.current) {
      wasMuffledRef.current = isMuffled
      setAudioMuffled(audioRef.current, isMuffled)
    }

    if (bodyRef.current) {
      bodyRef.current.position.set(transform.position.x, transform.position.y, transform.position.z)
      bodyRef.current.rotation.y = transform.yaw
    }
  })

  return (
    <group ref={bodyRef}>
      {/* Body stays a dark shell with only a faint tint — the visor below
       * is what should read as "glowing" against the bright arena. */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[PLAYER_HITBOX_RADIUS, 1.0, 6, 12]} />
        <meshStandardMaterial color="#1a1720" emissive={color} emissiveIntensity={0.12} roughness={0.6} />
      </mesh>
      {/* Glowing visor, colored per-owner so a bot is identifiable at a glance. */}
      <mesh position={[0, 1.35, -0.4]}>
        <boxGeometry args={[0.34, 0.09, 0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.4, -0.3]} color={color} intensity={1.1} distance={3.5} decay={2} />
      <PositionalAudio ref={audioRef} url={SHOUT_SOUND_URL} distance={AUDIO_REFERENCE_DISTANCE} loop={false} />
    </group>
  )
}

export function Bots() {
  const initialPosition = useMemo<[number, number, number]>(() => {
    const angle = Math.random() * Math.PI * 2
    const r = Math.min(BOT_SPAWN_MIN_DISTANCE + 2, ARENA_HALF_SIZE - 2)
    return [Math.cos(angle) * r, 0, Math.sin(angle) * r]
  }, [])

  return <Bot id={BOT_ID} initialPosition={initialPosition} />
}
