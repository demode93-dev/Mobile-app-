import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SoundBubble as SoundBubbleData } from '../lib/physics'
import { bubbleRadiusAt } from '../lib/physics'
import { BUBBLE_THREAT_COLOR } from '../lib/colors'
import { gameClock } from '../lib/world'
import '../shaders/SoundBubbleMaterial'

interface SoundBubbleProps {
  bubble: SoundBubbleData
}

/** Renders one expanding sound bubble as a dark, semi-translucent crimson
 * threat: a fresnel-edged outer shell plus a denser inner fill so it reads
 * as a solid encroaching mass against the bright facility, not a hollow
 * glowing shell. Deliberately no light source of its own — in this
 * aesthetic the danger is a shadow, not a glow. */
export function SoundBubbleView({ bubble }: SoundBubbleProps) {
  const shellRef = useRef<THREE.Mesh>(null)
  const fillRef = useRef<THREE.Mesh>(null)
  const shellMatRef = useRef<any>(null)

  useFrame(() => {
    const now = gameClock.elapsed
    const radius = Math.max(0.001, bubbleRadiusAt(bubble, now))
    const life = radius / bubble.maxRadius
    // Fade in fast over the first half-meter, fade out over the last 20% of life.
    const fadeIn = THREE.MathUtils.clamp(radius / 0.5, 0, 1)
    const fadeOut = 1 - THREE.MathUtils.smoothstep(life, 0.8, 1)
    const opacity = fadeIn * fadeOut

    if (shellRef.current) {
      shellRef.current.position.set(bubble.origin.x, bubble.origin.y, bubble.origin.z)
      shellRef.current.scale.setScalar(radius)
    }
    if (fillRef.current) {
      fillRef.current.position.set(bubble.origin.x, bubble.origin.y, bubble.origin.z)
      fillRef.current.scale.setScalar(radius)
      const fillMat = fillRef.current.material as THREE.MeshBasicMaterial
      fillMat.opacity = opacity * 0.45
    }
    if (shellMatRef.current) {
      shellMatRef.current.uTime = now
      shellMatRef.current.uOpacity = opacity
    }
  })

  return (
    <group>
      <mesh ref={shellRef}>
        <sphereGeometry args={[1, 48, 32]} />
        <soundBubbleMaterial
          ref={shellMatRef}
          uColor={BUBBLE_THREAT_COLOR}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={fillRef}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial
          color={BUBBLE_THREAT_COLOR}
          transparent
          opacity={0.45}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
