import { Arena, ArenaFog } from './Arena'
import { GameClockDriver } from './GameClockDriver'
import { PlayerController } from './PlayerController'
import { SoundBubbleManager } from './SoundBubbleManager'
import { Bots } from './Bots'
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

      <hemisphereLight args={['#4c3d8f', '#0a0710', 0.55]} />
      <directionalLight
        position={[10, 14, -6]}
        intensity={0.9}
        color="#9d8cff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 6, 0]} intensity={0.5} color="#7c3aed" distance={30} decay={2} />

      <Arena />
      <DustParticles />
      <PlayerController />
      <Bots />
      <SoundBubbleManager />

      <Effects />
    </>
  )
}
