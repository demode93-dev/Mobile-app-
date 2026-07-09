import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SoundBubble as SoundBubbleData } from '../lib/physics'
import { bubbleRadiusAt } from '../lib/physics'
import { colorForOwner } from '../lib/colors'
import { gameClock } from '../lib/world'
import '../shaders/SoundBubbleMaterial'

interface SoundBubbleProps {
  bubble: SoundBubbleData
}

/** Renders one expanding sound bubble: an outer fresnel "energy shell" plus a
 * faint additive inner fill so bloom picks up volume, not just the rim. */
export function SoundBubbleView({ bubble }: SoundBubbleProps) {
  const shellRef = useRef<THREE.Mesh>(null)
  const fillRef = useRef<THREE.Mesh>(null)
  const shellMatRef = useRef<any>(null)
  const washLightRef = useRef<THREE.PointLight>(null)
  const color = colorForOwner(bubble.ownerId)

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
      fillMat.opacity = opacity * 0.05
    }
    if (shellMatRef.current) {
      shellMatRef.current.uTime = now
      shellMatRef.current.uOpacity = opacity
    }
    if (washLightRef.current) {
      // Sits low near the floor so its glow washes across the reflective
      // metal as the wavefront grows, rather than lighting the sky. With
      // the scene's ambient light turned way down, this is the arena's
      // main light source while a bubble is alive — deliberately dramatic.
      washLightRef.current.position.set(bubble.origin.x, 0.4, bubble.origin.z)
      washLightRef.current.intensity = opacity * 14
      washLightRef.current.distance = Math.max(6, radius * 1.8)
    }
  })

  return (
    <group>
      <mesh ref={shellRef}>
        <sphereGeometry args={[1, 48, 32]} />
        <soundBubbleMaterial
          ref={shellMatRef}
          uColor={color}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={fillRef}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={washLightRef} color={color} intensity={0} decay={2} />
    </group>
  )
}
