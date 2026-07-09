import { Environment, Lightformer } from '@react-three/drei'
import { Arena, ArenaFog } from './Arena'
import { GameClockDriver } from './GameClockDriver'
import { PlayerController } from './PlayerController'
import { ResponsiveCamera } from './ResponsiveCamera'
import { SoundBubbleManager } from './SoundBubbleManager'
import { Bots } from './Bots'
import { CoverPillars } from './CoverPillars'
import { Effects } from './Effects'

/** Everything that lives inside the <Canvas>. Kept separate from App.tsx so
 * the HUD (plain DOM/Tailwind) never re-renders alongside R3F's render loop. */
export function Experience() {
  return (
    <>
      {/* Must mount first: every other system reads gameClock.elapsed this same frame. */}
      <GameClockDriver />
      <ResponsiveCamera />

      <ArenaFog />
      <color attach="background" args={['#f2f4f8']} />

      {/* Procedural (no HDRI fetch) environment: neutral white ceiling
       * panels so the glossy floor reflects clean fluorescent light rather
       * than flat white nothing. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={4} color="#ffffff" position={[0, 10, -10]} scale={[18, 8, 1]} />
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#eaf2ff"
          position={[14, 8, 4]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[14, 8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#eaf2ff"
          position={[-14, 8, 4]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[14, 8, 1]}
        />
      </Environment>

      {/* Bright, sterile clean-room fill — the arena should read as
       * evenly, clinically lit, with the dark bubbles doing all the
       * contrast work instead of glowing trim. */}
      <hemisphereLight args={['#ffffff', '#c7cbd6', 1.2]} />
      <directionalLight
        position={[10, 16, -6]}
        intensity={1.6}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <Arena />
      <CoverPillars />
      <PlayerController />
      <Bots />
      <SoundBubbleManager />

      <Effects />
    </>
  )
}
