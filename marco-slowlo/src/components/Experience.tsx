import { Environment, Lightformer } from '@react-three/drei'
import { Arena, ArenaFog } from './Arena'
import { GameClockDriver } from './GameClockDriver'
import { PlayerController } from './PlayerController'
import { SoundBubbleManager } from './SoundBubbleManager'
import { Bots } from './Bots'
import { CoverPillars } from './CoverPillars'
import { DustParticles } from './DustParticles'
import { Effects } from './Effects'

/** Everything that lives inside the <Canvas>. Kept separate from App.tsx so
 * the HUD (plain DOM/Tailwind) never re-renders alongside R3F's render loop. */
export function Experience() {
  return (
    <>
      {/* Must mount first: every other system reads gameClock.elapsed this same frame. */}
      <GameClockDriver />

      <ArenaFog />
      <color attach="background" args={['#050308']} />

      {/* Procedural (no HDRI fetch) environment so the reflective floor has
       * something moody and neon-colored to mirror instead of flat black. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} color="#7c3aed" position={[0, 6, -12]} scale={[16, 8, 1]} />
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#ff2bd6"
          position={[14, 5, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[14, 8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#22d3ee"
          position={[-14, 5, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[14, 8, 1]}
        />
      </Environment>

      {/* Deliberately dim: the arena should read as very dark, with the
       * bubbles/visors/emissive trim doing the actual work of lighting it
       * via bloom, not flat ambient fill. */}
      <hemisphereLight args={['#4c3d8f', '#0a0710', 0.16]} />
      <directionalLight
        position={[10, 14, -6]}
        intensity={0.35}
        color="#9d8cff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 6, 0]} intensity={0.22} color="#7c3aed" distance={30} decay={2} />

      <Arena />
      <CoverPillars />
      <DustParticles />
      <PlayerController />
      <Bots />
      <SoundBubbleManager />

      <Effects />
    </>
  )
}
