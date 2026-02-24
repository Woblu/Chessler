'use client'

import { useState, useEffect, useCallback } from 'react'
import { Chess } from 'chess.js'
import CustomBoard from '@/components/CustomBoard'
import { useGameAnalysis } from '@/hooks/useGameAnalysis'
import {
  MoveQuality,
  QUALITY_LABELS,
  QUALITY_SYMBOLS,
  QUALITY_COLORS,
  QUALITY_BG,
  GameAnalysis,
  buildFenSequence,
} from '@/lib/analysis'
import { GameResult } from '@prisma/client'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, BarChart2 } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  gameId: string
  moves: string
  whiteName: string
  blackName: string
  result: GameResult | null
  playedAt: string
  userPlayerId: string
  whitePlayerId: string
}

const QUALITY_ORDER: MoveQuality[] = [
  'brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder',
]

// ─── Small helpers ─────────────────────────────────────────────────────────────

function resultLabel(r: GameResult | null, userIsWhite: boolean): string {
  if (!r) return 'In Progress'
  if (r === GameResult.DRAW) return 'Draw'
  if (r === GameResult.WHITE_WIN) return userIsWhite ? 'You Won' : 'You Lost'
  return userIsWhite ? 'You Lost' : 'You Won'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewClient({
  moves: movesStr,
  whiteName,
  blackName,
  result,
  playedAt,
  userPlayerId,
  whitePlayerId,
}: Props) {
  const uciMoves = movesStr ? movesStr.split(' ').filter(Boolean) : []
  const fens = buildFenSequence(uciMoves)

  const [currentPly, setCurrentPly] = useState(0)
  const [displayFen, setDisplayFen] = useState(fens[0])
  const [hoveredPly, setHoveredPly] = useState<number | null>(null)
  const [equippedPieceSet, setEquippedPieceSet] = useState<string | null>(null)
  const [equippedBoardUrl, setEquippedBoardUrl] = useState<string | null>(null)

  const { isAnalyzing, progress, result: analysis, analyze } = useGameAnalysis()

  const userIsWhite = userPlayerId === whitePlayerId

  // Run analysis on mount
  useEffect(() => {
    if (uciMoves.length) analyze(uciMoves)
    fetch('/api/user/equipped-cosmetics')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setEquippedBoardUrl(d.boardUrl); setEquippedPieceSet(d.pieceSet) } })
      .catch(() => {})
  }, [])

  // Sync FEN when ply changes
  useEffect(() => {
    setDisplayFen(fens[currentPly] ?? fens[0])
  }, [currentPly])

  const goTo = useCallback((ply: number) => {
    setCurrentPly(Math.min(Math.max(0, ply), uciMoves.length))
  }, [uciMoves.length])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(currentPly - 1)
      else if (e.key === 'ArrowRight') goTo(currentPly + 1)
      else if (e.key === 'ArrowUp') goTo(0)
      else if (e.key === 'ArrowDown') goTo(uciMoves.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentPly, goTo, uciMoves.length])

  const moveAtPly = analysis?.moves[currentPly - 1]

  // Evaluation bar value
  const evalScore = moveAtPly?.evaluation ?? null
  const evalCapped = evalScore !== null ? Math.min(Math.max(evalScore, -1000), 1000) : 0
  const whitePercent = evalScore !== null ? Math.round(((evalCapped + 1000) / 2000) * 100) : 50

  return (
    <div className="min-h-screen bg-chess-bg px-4 py-6">
      <div className="max-w-6xl mx-auto">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-pawn-gold" /> Game Review
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              <span className="text-white">{whiteName}</span>
              <span className="text-slate-500 mx-2">vs</span>
              <span className="text-white">{blackName}</span>
              <span className="text-slate-600 mx-2">·</span>
              <span className={result === GameResult.DRAW ? 'text-blue-300'
                : (result === GameResult.WHITE_WIN) === userIsWhite ? 'text-green-400' : 'text-red-400'}>
                {resultLabel(result, userIsWhite)}
              </span>
              <span className="text-slate-600 mx-2">·</span>
              <span>{formatDate(playedAt)}</span>
            </p>
          </div>

          {isAnalyzing && (
            <div className="flex items-center gap-2 bg-chess-card border border-chess-border rounded-lg px-4 py-2">
              <div className="w-4 h-4 border-2 border-pawn-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-300 text-sm">Analysing… {progress}%</span>
              <div className="w-24 h-1.5 bg-chess-bg rounded-full overflow-hidden">
                <div className="h-full bg-pawn-gold transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Main layout ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Board column */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Opponent name */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-white">
                  {userIsWhite ? blackName[0] : whiteName[0]}
                </div>
                <span className="text-white font-semibold">{userIsWhite ? blackName : whiteName}</span>
              </div>
              {moveAtPly && currentPly > 0 && (
                <span className="text-slate-500 text-xs">
                  Eval: {moveAtPly.evaluation > 0 ? '+' : ''}{(moveAtPly.evaluation / 100).toFixed(2)}
                </span>
              )}
            </div>

            {/* Board + eval bar */}
            <div className="flex items-center gap-3">
              {/* Vertical eval bar */}
              <div className="h-[420px] w-4 bg-slate-800 rounded-full overflow-hidden flex flex-col-reverse shrink-0">
                <div
                  className="bg-white transition-all duration-500 rounded-full"
                  style={{ height: `${whitePercent}%` }}
                />
              </div>

              <div className="flex-1">
                <CustomBoard
                  position={displayFen}
                  onPieceDrop={() => false}
                  arePiecesDraggable={false}
                  boardOrientation={userIsWhite ? 'white' : 'black'}
                  equippedBoardUrl={equippedBoardUrl}
                  equippedPieceSet={equippedPieceSet}
                  customBoardStyle={{ borderRadius: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                />
              </div>
            </div>

            {/* Your name */}
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-pawn-gold/20 border border-pawn-gold/60 flex items-center justify-center text-xs font-bold text-pawn-gold">
                {userIsWhite ? whiteName[0] : blackName[0]}
              </div>
              <span className="text-white font-semibold">{userIsWhite ? whiteName : blackName}</span>
              <span className="text-pawn-gold text-xs font-semibold">You</span>
            </div>

            {/* Navigation controls */}
            <div className="bg-chess-card border border-chess-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">
                  Move <span className="text-white font-bold">{currentPly}</span>
                  <span className="text-slate-600"> / {uciMoves.length}</span>
                </span>
                {moveAtPly && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${QUALITY_BG[moveAtPly.quality]} ${QUALITY_COLORS[moveAtPly.quality]}`}>
                    <span>{QUALITY_SYMBOLS[moveAtPly.quality]}</span>
                    <span>{moveAtPly.move}</span>
                    <span className="text-slate-400">·</span>
                    <span>{QUALITY_LABELS[moveAtPly.quality]}</span>
                  </div>
                )}
              </div>

              {/* Move slider */}
              <input type="range" min={0} max={uciMoves.length} value={currentPly}
                onChange={(e) => goTo(Number(e.target.value))}
                className="w-full accent-pawn-gold mb-4 cursor-pointer" />

              {/* Arrow buttons */}
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => goTo(0)}
                  className="bg-chess-bg border border-chess-border hover:border-pawn-gold text-white p-2 rounded-lg transition-colors">
                  <ChevronsLeft className="w-5 h-5" />
                </button>
                <button onClick={() => goTo(currentPly - 1)}
                  className="bg-chess-bg border border-chess-border hover:border-pawn-gold text-white p-2.5 rounded-lg transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={() => goTo(currentPly + 1)}
                  className="bg-chess-bg border border-chess-border hover:border-pawn-gold text-white p-2.5 rounded-lg transition-colors">
                  <ChevronRight className="w-6 h-6" />
                </button>
                <button onClick={() => goTo(uciMoves.length)}
                  className="bg-chess-bg border border-chess-border hover:border-pawn-gold text-white p-2 rounded-lg transition-colors">
                  <ChevronsRight className="w-5 h-5" />
                </button>
              </div>

              <p className="text-slate-600 text-xs text-center mt-3">← → arrow keys also work</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Summary stats */}
            <div className="bg-chess-card border border-chess-border rounded-xl p-4">
              <h3 className="text-white font-extrabold text-sm uppercase tracking-widest mb-3">
                Analysis Summary
              </h3>

              {isAnalyzing && !analysis ? (
                <div className="text-slate-500 text-sm text-center py-4">Analysing positions…</div>
              ) : analysis ? (
                <div className="space-y-2">
                  {QUALITY_ORDER.map((q) => {
                    const count = analysis.counts[q]
                    const movesOfQuality = analysis.moves.filter((m) => m.quality === q)
                    return (
                      <button
                        key={q}
                        disabled={count === 0}
                        onClick={() => {
                          if (count === 0) return
                          // Jump to first move of this quality
                          const first = movesOfQuality[0]
                          if (first) goTo(first.ply + 1)
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${
                          count === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer hover:scale-[1.01]'
                        } ${QUALITY_BG[q]}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm w-6 ${QUALITY_COLORS[q]}`}>
                            {QUALITY_SYMBOLS[q]}
                          </span>
                          <span className="text-slate-200 text-sm">{QUALITY_LABELS[q]}</span>
                        </div>
                        <span className={`font-extrabold text-lg ${QUALITY_COLORS[q]}`}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center py-4">No analysis available</p>
              )}
            </div>

            {/* Move list */}
            <div className="bg-chess-card border border-chess-border rounded-xl p-4 flex-1 overflow-hidden">
              <h3 className="text-white font-extrabold text-sm uppercase tracking-widest mb-3">
                Move List
              </h3>

              <div className="overflow-y-auto max-h-[420px] pr-1 space-y-0.5">
                {Array.from({ length: Math.ceil(uciMoves.length / 2) }, (_, i) => {
                  const whitePly = i * 2
                  const blackPly = i * 2 + 1
                  const whiteMove = analysis?.moves[whitePly]
                  const blackMove = analysis?.moves[blackPly]

                  return (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs w-7 shrink-0 text-right">{i + 1}.</span>

                      {/* White move */}
                      <button
                        onClick={() => goTo(whitePly + 1)}
                        onMouseEnter={() => setHoveredPly(whitePly + 1)}
                        onMouseLeave={() => setHoveredPly(null)}
                        className={`flex-1 flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors text-left ${
                          currentPly === whitePly + 1
                            ? 'bg-pawn-gold/20 text-pawn-gold'
                            : hoveredPly === whitePly + 1
                            ? 'bg-chess-bg text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <span>{uciMoves[whitePly] ? (whiteMove?.move ?? '…') : ''}</span>
                        {whiteMove && (
                          <span className={`text-xs ${QUALITY_COLORS[whiteMove.quality]}`}>
                            {QUALITY_SYMBOLS[whiteMove.quality]}
                          </span>
                        )}
                      </button>

                      {/* Black move */}
                      {uciMoves[blackPly] && (
                        <button
                          onClick={() => goTo(blackPly + 1)}
                          onMouseEnter={() => setHoveredPly(blackPly + 1)}
                          onMouseLeave={() => setHoveredPly(null)}
                          className={`flex-1 flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors text-left ${
                            currentPly === blackPly + 1
                              ? 'bg-pawn-gold/20 text-pawn-gold'
                              : hoveredPly === blackPly + 1
                              ? 'bg-chess-bg text-white'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          <span>{blackMove?.move ?? '…'}</span>
                          {blackMove && (
                            <span className={`text-xs ${QUALITY_COLORS[blackMove.quality]}`}>
                              {QUALITY_SYMBOLS[blackMove.quality]}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Engine suggestion for current position */}
            {moveAtPly && currentPly > 0 && (
              <div className="bg-chess-card border border-chess-border rounded-xl p-4">
                <h3 className="text-white font-extrabold text-sm uppercase tracking-widest mb-2">
                  Position Analysis
                </h3>
                <div className="flex items-center gap-3">
                  <div className={`text-3xl font-black ${QUALITY_COLORS[moveAtPly.quality]}`}>
                    {QUALITY_SYMBOLS[moveAtPly.quality]}
                  </div>
                  <div>
                    <p className={`font-bold ${QUALITY_COLORS[moveAtPly.quality]}`}>
                      {moveAtPly.move} — {QUALITY_LABELS[moveAtPly.quality]}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {moveAtPly.cpLoss === 0
                        ? 'Perfect move — no cp loss'
                        : `−${moveAtPly.cpLoss} cp vs engine best`}
                      {moveAtPly.engineBestMove && moveAtPly.engineBestMove !== moveAtPly.uci && (
                        <span className="text-slate-500 ml-2">
                          (best: <span className="text-white">{moveAtPly.engineBestMove}</span>)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
