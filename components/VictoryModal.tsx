'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  QUALITY_LABELS,
  QUALITY_SYMBOLS,
  QUALITY_COLORS,
  MoveQuality,
  MoveQualityCounts,
} from '@/lib/analysis'
import { BarChart2, RotateCcw, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { CreateTypes } from 'canvas-confetti'

// ─── Confetti helpers ───────────────────────────────────────────────────────────
// Loaded on-demand so it never enters the main bundle.

type ConfettiFn = CreateTypes

async function loadConfetti(): Promise<ConfettiFn> {
  const mod = await import('canvas-confetti')
  return mod.default as unknown as ConfettiFn
}

/** Gold + white burst from the centre of the screen — fires three times for drama. */
async function fireVictoryConfetti() {
  const confetti = await loadConfetti()

  const GOLD   = ['#f5c518', '#ffd700', '#ffec8b', '#fffacd']
  const SILVER = ['#ffffff', '#e0e0e0', '#c0c0c0']
  const ALL    = [...GOLD, ...SILVER]

  const base = {
    particleCount: 120,
    spread: 70,
    startVelocity: 55,
    ticks: 280,
    colors: ALL,
    gravity: 0.9,
    scalar: 1.1,
    drift: 0,
  } as const

  // Volley 1 — centre burst
  confetti({ ...base, origin: { x: 0.5, y: 0.6 } })

  await new Promise<void>((r) => setTimeout(r, 220))

  // Volley 2 — left + right simultaneous side-cannons
  confetti({ ...base, particleCount: 80, angle: 60,  origin: { x: 0, y: 0.65 } })
  confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 1, y: 0.65 } })

  await new Promise<void>((r) => setTimeout(r, 350))

  // Volley 3 — slower gold-only shower from above
  confetti({
    particleCount: 60,
    spread: 100,
    startVelocity: 20,
    ticks: 400,
    origin: { x: 0.5, y: 0 },
    colors: GOLD,
    gravity: 0.5,
    scalar: 0.9,
    drift: 0,
  })
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  result: 'win' | 'loss' | 'draw'
  botName: string
  botElo?: number
  gameId: string | null
  /** currentPoints before/after the match */
  mmrBefore: number
  mmrAfter: number
  /** gamesPlayedInCycle before/after */
  gamesInCycleBefore: number
  gamesInCycleAfter: number
  isAnalyzing: boolean
  analysisProgress: number
  counts: MoveQualityCounts | null
  onClose: () => void
  onNewGame: () => void
}

const QUALITY_ORDER: MoveQuality[] = [
  'brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder',
]

const WIN_TARGET = 10   // wins needed to rank up
const CYCLE_GAMES = 20  // total games in a cycle

// ─── Component ─────────────────────────────────────────────────────────────────

export default function VictoryModal({
  isOpen,
  result,
  botName,
  botElo,
  gameId,
  mmrBefore,
  mmrAfter,
  gamesInCycleBefore,
  gamesInCycleAfter,
  isAnalyzing,
  analysisProgress,
  counts,
  onClose,
  onNewGame,
}: Props) {
  const router = useRouter()

  // Animate win-bar from before → after
  const [animatedWins, setAnimatedWins] = useState(mmrBefore)
  const [showMmrDelta, setShowMmrDelta] = useState(false)
  const confettiFiredRef = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      confettiFiredRef.current = false
      return
    }

    setAnimatedWins(mmrBefore)
    setShowMmrDelta(false)

    const t1 = setTimeout(() => setAnimatedWins(mmrAfter), 350)
    const t2 = setTimeout(() => setShowMmrDelta(true), 800)

    // Fire confetti once per win — slight delay so the modal renders first
    if (result === 'win' && !confettiFiredRef.current) {
      confettiFiredRef.current = true
      const t3 = setTimeout(() => fireVictoryConfetti(), 150)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isOpen, mmrBefore, mmrAfter, result])

  if (!isOpen) return null

  const resultConfig = {
    win:  { label: 'Victory!',  emoji: '🏆', color: 'text-pawn-gold',  bg: 'from-yellow-900/30', border: 'border-yellow-800/50' },
    loss: { label: 'Defeated',  emoji: '💀', color: 'text-slate-300',  bg: 'from-slate-800/50',  border: 'border-slate-700/50' },
    draw: { label: 'Draw',      emoji: '🤝', color: 'text-blue-300',   bg: 'from-blue-900/25',   border: 'border-blue-800/50' },
  }[result]

  const mmrDelta     = mmrAfter - mmrBefore
  const mmrDeltaAbs  = Math.abs(mmrDelta).toFixed(1)
  const winsBarPct   = Math.min(100, (animatedWins / WIN_TARGET) * 100)
  const gamesPct     = Math.min(100, (gamesInCycleAfter / CYCLE_GAMES) * 100)
  const winsDisplay  = Math.min(Math.round(animatedWins), WIN_TARGET)
  const gamesDisplay = Math.min(gamesInCycleAfter, CYCLE_GAMES)

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div
        className={`relative bg-gradient-to-b ${resultConfig.bg} to-chess-card border ${resultConfig.border} rounded-2xl shadow-2xl w-full max-w-md my-auto`}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-7">
          {/* ── Result header ──────────────────────────────────────────────── */}
          <div className="text-center mb-5">
            <div className="text-4xl sm:text-5xl mb-2">{resultConfig.emoji}</div>
            <h2 className={`text-3xl sm:text-4xl font-extrabold mb-1 ${resultConfig.color}`}>
              {resultConfig.label}
            </h2>
            <p className="text-slate-400 text-sm">
              vs{' '}
              <span className="text-white font-semibold">{botName}</span>
              {botElo != null && (
                <span className="text-slate-500"> · ELO {botElo}</span>
              )}
            </p>
          </div>

          <hr className="border-chess-border mb-4" />

          {/* ── Cycle Progress ─────────────────────────────────────────────── */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
                Cycle Progress
              </span>

              {/* MMR delta badge */}
              {showMmrDelta && (
                <span
                  className={`flex items-center gap-1 text-sm font-extrabold tabular-nums transition-opacity duration-300 ${
                    mmrDelta > 0 ? 'text-green-400' : mmrDelta < 0 ? 'text-red-400' : 'text-slate-400'
                  }`}
                >
                  {mmrDelta > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : mmrDelta < 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : (
                    <Minus className="w-4 h-4" />
                  )}
                  {mmrDelta > 0 ? '+' : ''}{mmrDeltaAbs} MMR
                </span>
              )}
            </div>

            {/* Win progress bar */}
            <div className="w-full bg-chess-bg rounded-full h-5 overflow-hidden border border-chess-border mb-1">
              <div
                className="h-full bg-gradient-to-r from-pawn-gold to-pawn-gold-hover transition-all duration-1000 ease-out rounded-full flex items-center justify-end pr-2"
                style={{ width: `${winsBarPct}%` }}
              >
                {winsBarPct > 18 && (
                  <span className="text-slate-900 text-xs font-extrabold">{winsDisplay}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-white font-bold tabular-nums">
                {winsDisplay} / {WIN_TARGET} wins to rank up
              </span>
              {result === 'win' && (
                <span className="text-pawn-gold font-semibold">+1 win</span>
              )}
            </div>

            {/* Games-in-cycle strip */}
            <div className="mt-3">
              <div className="flex gap-0.5">
                {Array.from({ length: CYCLE_GAMES }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-1.5 rounded-sm transition-colors duration-300 ${
                      i < gamesInCycleBefore
                        ? 'bg-slate-500'
                        : i < gamesInCycleAfter
                        ? 'bg-pawn-gold'
                        : 'bg-chess-bg border border-chess-border/40'
                    }`}
                  />
                ))}
              </div>
              <p className="text-slate-400 text-xs mt-1.5">
                Game{' '}
                <span className="text-white font-semibold">{gamesDisplay}</span>
                {' '}of{' '}
                <span className="text-white font-semibold">{CYCLE_GAMES}</span>
                {' '}in current cycle
              </p>
            </div>
          </div>

          <hr className="border-chess-border mb-4" />

          {/* ── Analysis stats ─────────────────────────────────────────────── */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
                Game Analysis
              </span>
              {isAnalyzing && (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-chess-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pawn-gold transition-all duration-300"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                  <span className="text-slate-500 text-xs">{analysisProgress}%</span>
                </div>
              )}
            </div>

            {isAnalyzing && !counts ? (
              <p className="text-slate-500 text-xs text-center py-3">
                Analysing with Stockfish…
              </p>
            ) : counts ? (
              <div className="grid grid-cols-2 gap-1.5">
                {QUALITY_ORDER.map((q) => {
                  const count = counts[q]
                  if (count === 0 && (q === 'good' || q === 'excellent')) return null
                  return (
                    <div
                      key={q}
                      className="flex items-center justify-between bg-chess-bg rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm w-5 text-center ${QUALITY_COLORS[q]}`}>
                          {QUALITY_SYMBOLS[q]}
                        </span>
                        <span className="text-slate-300 text-xs">{QUALITY_LABELS[q]}</span>
                      </div>
                      <span className={`font-extrabold text-sm ${QUALITY_COLORS[q]}`}>
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>

          {/* ── Actions ────────────────────────────────────────────────────── */}
          <div className="flex gap-2 sm:gap-3">
            {gameId && (
              <button
                onClick={() => router.push(`/play/review/${gameId}`)}
                className="flex-1 flex items-center justify-center gap-2 bg-chess-bg border border-chess-border hover:border-pawn-gold text-white font-semibold h-12 rounded-xl transition-colors text-sm"
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                <span>Review</span>
              </button>
            )}
            <button
              onClick={onNewGame}
              className="flex-1 flex items-center justify-center gap-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-extrabold h-12 rounded-xl transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>New Game</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
