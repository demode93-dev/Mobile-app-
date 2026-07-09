import { useGameStore } from '../store/gameStore'
import { unlockAudio } from '../lib/audio'
import { BOT_ID } from '../lib/constants'

function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${s.toString().padStart(2, '0')}`
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

function RoleBanner() {
  const currentItId = useGameStore((s) => s.currentItId)
  const isHunting = currentItId === 'player'

  return (
    <div
      className={`mt-2 inline-block rounded-full px-4 py-1 text-sm font-black tracking-[0.2em] ${
        isHunting ? 'bg-red-600/90 text-white' : 'bg-emerald-500/90 text-black'
      }`}
    >
      {isHunting ? 'YOU ARE HUNTING' : 'EVADE'}
    </div>
  )
}

function StartOverlay() {
  const startMatch = useGameStore((s) => s.startMatch)

  function handleStart() {
    unlockAudio()
    startMatch()
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
        <p className="mt-2 text-sm text-white/60">Tag, with your own voice as the weapon.</p>

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
            The Bot starts as "It." Whoever is It must catch the other in their bubble to pass the
            tag on — a hit through a pillar's shadow doesn't count. Survive as the target until the
            60-second clock runs out to win.
          </p>
        </div>

        <button
          onClick={handleStart}
          className="mt-6 w-full rounded-lg bg-fuchsia-500 px-6 py-3 font-semibold text-white transition hover:bg-fuchsia-400 active:scale-[0.98]"
        >
          Start Match
        </button>
      </div>
    </div>
  )
}

function GameOverOverlay() {
  const startMatch = useGameStore((s) => s.startMatch)
  const currentItId = useGameStore((s) => s.currentItId)
  const playerWon = currentItId === BOT_ID // whoever is NOT "It" when the clock hits 0 wins

  function handleRestart() {
    unlockAudio()
    startMatch()
    requestAnimationFrame(() => {
      document.querySelector('canvas')?.requestPointerLock()
    })
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md rounded-2xl border border-white/10 bg-[#0b0912]/90 p-8 text-center shadow-[0_0_60px_rgba(124,58,237,0.25)]">
        <h2 className={`text-3xl font-black tracking-tight ${playerWon ? 'text-emerald-400' : 'text-rose-400'}`}>
          {playerWon ? 'YOU WIN' : 'YOU LOSE'}
        </h2>
        <p className="mt-2 text-sm text-white/60">
          {playerWon
            ? "Time ran out with the Bot still hunting — you evaded the whole match."
            : "Time ran out while you were still hunting — the Bot evaded you."}
        </p>

        <button
          onClick={handleRestart}
          className="mt-6 w-full rounded-lg bg-fuchsia-500 px-6 py-3 font-semibold text-white transition hover:bg-fuchsia-400 active:scale-[0.98]"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}

function PlayingHUD() {
  const matchTimeRemaining = useGameStore((s) => s.matchTimeRemaining)
  const isRooted = useGameStore((s) => s.isRooted)

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center">
        <p className="text-4xl font-black tabular-nums text-white/95 drop-shadow">
          {formatCountdown(matchTimeRemaining)}
        </p>
        <RoleBanner />
        {isRooted && (
          <p className="mt-2 text-xs font-bold tracking-[0.3em] text-rose-400 animate-pulse">ROOTED</p>
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
      {phase === 'start' && <StartOverlay />}
      {phase === 'gameOver' && <GameOverOverlay />}
    </div>
  )
}
