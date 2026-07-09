import { Canvas } from '@react-three/fiber'
import { Experience } from './components/Experience'
import { HUD } from './components/HUD'

export default function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Canvas
        shadows
        camera={{ fov: 62, near: 0.1, far: 120, position: [0, 3, 6.5] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.75]}
      >
        <Experience />
      </Canvas>
      <HUD />
    </div>
  )
}
