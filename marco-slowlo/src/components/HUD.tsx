import { useGameStore } from '../store/gameStore'
import { unlockAudio } from '../lib/audio'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`
}

function StaminaBar() {
  const stamina = useGameStore((s) => s.stamina)
  const pct = Math.round(stamina * 100)
  const barColor = stamina > 0.5 ? 'bg-violet-400' : stamina > 0.2 ? 'bg-amber-400' : 'bg-rose-500'

  return (
    <div className="flex flex-col gap-1 w-48">
      <span className="text-[10px] tracking-[0.2em] text-white/50 font-medium">STAMINA</span>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden ring-1 ring-white/10">
        <div
          className={`h-full ${barColor} transition-[width] duration-100 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ShoutIndicator() {
  const cooldown = useGameStore((s) => s.shoutCooldownRemaining)
  const ready = cooldown <= 0

  return (
    <div className="flex flex-col items-end gap-1 w-40">
      <span className="text-[10px] tracking-[0.2em] text-white/50 font-medium">SHOUT</span>
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden ring-1 ring-white/10">
        <div
          className={`h-full transition-[width] duration-100 ease-out ${ready ? 'bg-fuchsia-400' : 'bg-white/25'}`}
          style={{ width: ready ? '100%' : `${100 - (cooldown / 2.2) * 100}%` }}
        />
      </div>
      <span className={`text-xs font-semibold ${ready ? 'text-fuchsia-300' : 'text-white/40'}`}>
        {ready ? 'READY — SPACE' : cooldown.toFixed(1) + 's'}
      </span>
    </div>
  )
}

function ShoutPulse() {
  const nonce = useGameStore((s) => s.shoutFxNonce)
  if (nonce === 0) return null
  return (
    <div
      key={nonce}
      className="shout-ring absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fuchsia-300/70"
    />
  )
}

function ReadyOverlay() {
  const startGame = useGameStore((s) => s.startGame)
  const bestSurvivalTime = useGameStore((s) => s.bestSurvivalTime)

  function handleStart() {
    unlockAudio()
    startGame()
    requestAnimationFrame(() => {
      document.querySelector('canvas')?.requestPointerLock()
    })
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="max-w-md rounded-2xl border border-white/10 bg-[#0b0912]/90 p-8 text-center shadow-[0_0_60px_rgba(124,58,237,0.25)]">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          MARCO <span className="text-fuchsia-400">SLOW</span>-LO
        </h1>
        <p className="mt-2 text-sm text-white/60">Outrun your own voice.</p>

        <div className="mt-6 space-y-2 text-left text-sm text-white/70">
          <p>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">WASD</kbd> move ·{' '}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">SHIFT</kbd> sprint
          </p>
          <p>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">SPACE</kbd> /{' '}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">CLICK</kbd> shout — spawns an
            expanding sound bubble at walking speed
          </p>
          <p className="text-white/50">
            The bubble grows outward from where you stood. Stand still, and it swallows you.
            Sprint clear before it catches up.
          </p>
        </div>

        {bestSurvivalTime > 0 && (
          <p className="mt-4 text-xs text-white/40">
            Best survival: <span className="text-violet-300">{formatTime(bestSurvivalTime)}</span>
          </p>
        )}

        <button
          onClick={handleStart}
          className="mt-6 w-full rounded-lg bg-fuchsia-500 px-6 py-3 font-semibold text-white transition hover:bg-fuchsia-400 active:scale-[0.98]"
        >
          Enter the Arena
        </button>
      </div>
    </div>
  )
}

function CaughtOverlay() {
  const startGame = useGameStore((s) => s.startGame)
  const survivalTime = useGameStore((s) => s.survivalTime)
  const bestSurvivalTime = useGameStore((s) => s.bestSurvivalTime)
  const caughtByOwnerId = useGameStore((s) => s.caughtByOwnerId)
  const isNewBest = survivalTime >= bestSurvivalTime && survivalTime > 0

  const caughtMessage =
    caughtByOwnerId === 'player'
      ? 'Your own voice caught you.'
      : `${caughtByOwnerId}'s shout swallowed you.`

  function handleRestart() {
    unlockAudio()
    startGame()
    requestAnimationFrame(() => {
      document.querySelector('canvas')?.requestPointerLock()
    })
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md rounded-2xl border border-white/10 bg-[#0b0912]/90 p-8 text-center shadow-[0_0_60px_rgba(244,63,94,0.25)]">
        <h2 className="text-2xl font-semibold text-rose-400">CAUGHT</h2>
        <p className="mt-1 text-sm text-white/60">{caughtMessage}</p>

        <p className="mt-6 text-4xl font-bold tabular-nums text-white">{formatTime(survivalTime)}</p>
        {isNewBest ? (
          <p className="mt-1 text-xs font-semibold text-emerald-300">NEW BEST</p>
        ) : (
          <p className="mt-1 text-xs text-white/40">Best: {formatTime(bestSurvivalTime)}</p>
        )}

        <button
          onClick={handleRestart}
          className="mt-6 w-full rounded-lg bg-fuchsia-500 px-6 py-3 font-semibold text-white transition hover:bg-fuchsia-400 active:scale-[0.98]"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

function PlayingHUD() {
  const survivalTime = useGameStore((s) => s.survivalTime)
  const isRooted = useGameStore((s) => s.isRooted)

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center">
        <p className="text-2xl font-bold tabular-nums text-white/90 drop-shadow">
          {formatTime(survivalTime)}
        </p>
        {isRooted && (
          <p className="mt-1 text-xs font-bold tracking-[0.3em] text-rose-400 animate-pulse">
            ROOTED
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
        <StaminaBar />
        <ShoutIndicator />
      </div>

      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      <ShoutPulse />
    </div>
  )
}

export function HUD() {
  const phase = useGameStore((s) => s.phase)

  return (
    <div className="absolute inset-0">
      <PlayingHUD />
      {phase === 'ready' && <ReadyOverlay />}
      {phase === 'caught' && <CaughtOverlay />}
    </div>
  )
}
