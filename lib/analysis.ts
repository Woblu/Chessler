import { Chess } from 'chess.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoveQuality =
  | 'brilliant'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

export interface AnalyzedMove {
  ply: number
  move: string          // SAN notation (e.g. "Nf3")
  uci: string           // UCI notation (e.g. "g1f3")
  fenBefore: string     // Position FEN before this move
  fen: string           // Position FEN after this move
  /** Centipawn evaluation AFTER the move, normalised to white's perspective */
  evaluation: number
  /** How many centipawns worse than the engine's best option (0 = perfect) */
  cpLoss: number
  quality: MoveQuality
  engineBestMove: string | null
}

export interface MoveQualityCounts {
  brilliant: number
  best: number
  excellent: number
  good: number
  inaccuracy: number
  mistake: number
  blunder: number
}

export interface GameAnalysis {
  moves: AnalyzedMove[]
  counts: MoveQualityCounts
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const QUALITY_LABELS: Record<MoveQuality, string> = {
  brilliant: 'Brilliant',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

export const QUALITY_SYMBOLS: Record<MoveQuality, string> = {
  brilliant: '!!',
  best: '!',
  excellent: '⊕',
  good: '·',
  inaccuracy: '?',
  mistake: '??',
  blunder: '???',
}

export const QUALITY_COLORS: Record<MoveQuality, string> = {
  brilliant: 'text-purple-400',
  best: 'text-green-400',
  excellent: 'text-emerald-300',
  good: 'text-slate-400',
  inaccuracy: 'text-yellow-400',
  mistake: 'text-orange-400',
  blunder: 'text-red-400',
}

export const QUALITY_BG: Record<MoveQuality, string> = {
  brilliant: 'bg-purple-900/40 border-purple-600',
  best: 'bg-green-900/40 border-green-600',
  excellent: 'bg-emerald-900/30 border-emerald-700',
  good: 'bg-slate-800/40 border-slate-700',
  inaccuracy: 'bg-yellow-900/30 border-yellow-700',
  mistake: 'bg-orange-900/30 border-orange-700',
  blunder: 'bg-red-900/40 border-red-600',
}

// ─── XP / Level system ────────────────────────────────────────────────────────

export const XP_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000]

export const XP_GAIN: Record<'win' | 'draw' | 'loss', number> = {
  win: 50,
  draw: 20,
  loss: 10,
}

export function getLevelInfo(xp: number) {
  let level = 1
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) {
      level = i + 1
      break
    }
  }
  const currentMin = XP_THRESHOLDS[level - 1] ?? 0
  const nextMin = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1] + 5000
  const xpInLevel = xp - currentMin
  const xpForLevel = nextMin - currentMin
  const progress = Math.min(100, Math.round((xpInLevel / xpForLevel) * 100))
  return { level, progress, xpInLevel, xpForLevel, xpForNext: nextMin - xp }
}

// ─── Move classification ──────────────────────────────────────────────────────

/**
 * Classifies a move based on centipawn loss relative to the engine's best choice.
 * "Brilliant" = exact engine top move with cpLoss ≤ 5.
 */
export function classifyMove(cpLoss: number, isEngineBest: boolean): MoveQuality {
  if (isEngineBest && cpLoss <= 5) return 'brilliant'
  if (cpLoss <= 10) return 'best'
  if (cpLoss <= 50) return 'excellent'
  if (cpLoss <= 100) return 'good'
  if (cpLoss <= 300) return 'inaccuracy'
  if (cpLoss <= 600) return 'mistake'
  return 'blunder'
}

// ─── Position builder ─────────────────────────────────────────────────────────

export interface PositionEntry {
  fenBefore: string
  sanMove: string
  uciMove: string
  sideToMove: 'w' | 'b'
}

/**
 * Replays UCI moves with chess.js and returns an array of positions with
 * the FEN before each move plus the SAN representation.
 */
export function buildPositions(uciMoves: string[]): PositionEntry[] {
  const chess = new Chess()
  const positions: PositionEntry[] = []

  for (const uciMove of uciMoves) {
    const fenBefore = chess.fen()
    const sideToMove = chess.turn()
    const from = uciMove.slice(0, 2)
    const to = uciMove.slice(2, 4)
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined

    const move = chess.move({ from, to, promotion: promotion as any })
    if (!move) break

    positions.push({ fenBefore, sanMove: move.san, uciMove, sideToMove })
  }

  return positions
}

/**
 * Returns the FEN after every move in the sequence, starting with the
 * start position.  Length = uciMoves.length + 1.
 */
export function buildFenSequence(uciMoves: string[]): string[] {
  const chess = new Chess()
  const fens: string[] = [chess.fen()]

  for (const uciMove of uciMoves) {
    const from = uciMove.slice(0, 2)
    const to = uciMove.slice(2, 4)
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined
    if (!chess.move({ from, to, promotion: promotion as any })) break
    fens.push(chess.fen())
  }

  return fens
}

/** Assembles the final GameAnalysis from raw evaluation data. */
export function buildAnalysis(
  positions: PositionEntry[],
  fens: string[],
  scores: number[],       // normalised to white's perspective, length = fens.length
  bestMoves: string[]     // engine best UCI at each pre-move position, length = fens.length
): GameAnalysis {
  const moves: AnalyzedMove[] = positions.map((pos, i) => {
    const evalBefore = scores[i]    // from white's pov, before move i
    const evalAfter = scores[i + 1] // from white's pov, after move i

    // cp loss from the mover's perspective
    let cpLoss: number
    if (pos.sideToMove === 'w') {
      // white moved: positive score before > positive score after = white lost ground
      cpLoss = Math.max(0, evalBefore - evalAfter)
    } else {
      // black moved: more-negative score after = black gained ground
      cpLoss = Math.max(0, evalAfter - evalBefore)
    }

    const isEngineBest = !!bestMoves[i] && bestMoves[i] === pos.uciMove
    const quality = classifyMove(cpLoss, isEngineBest)

    return {
      ply: i,
      move: pos.sanMove,
      uci: pos.uciMove,
      fenBefore: pos.fenBefore,
      fen: fens[i + 1],
      evaluation: evalAfter,
      cpLoss,
      quality,
      engineBestMove: bestMoves[i] || null,
    }
  })

  const counts: MoveQualityCounts = {
    brilliant: 0,
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  }
  moves.forEach((m) => counts[m.quality]++)

  return { moves, counts }
}
