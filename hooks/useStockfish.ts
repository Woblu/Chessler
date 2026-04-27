'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  subscribeStockfish,
  getStockfishSnapshot,
  sendStockfishCommand,
  getStockfishBestMove,
  getStockfishEvaluation,
  type Evaluation,
} from '@/lib/stockfish-engine'

export interface UseStockfishReturn {
  isReady: boolean
  isThinking: boolean
  sendCommand: (command: string) => void
  getBestMove: (fen: string, depth: number, moveTimeMs?: number) => Promise<string | null>
  getEvaluation: (fen: string, depth: number) => Promise<Evaluation | null>
  error: string | null
}

/**
 * useStockfish — communicates with the /stockfish.js web worker.
 *
 * Key guarantees:
 *  • Evaluation resolves at `bestmove`, not at the first `info score` line,
 *    so the reported score comes from the deepest completed search ply.
 *  • Only one `go` command is in-flight at a time; new requests send `stop`
 *    first to abort the running search and prevent response collisions.
 *  • getBestMove accepts an optional `moveTimeMs` cap for mobile performance.
 */
export function useStockfish(): UseStockfishReturn {
  const initial = useMemo(() => getStockfishSnapshot(), [])
  const [isReady, setIsReady] = useState(initial.isReady)
  const [isThinking, setIsThinking] = useState(initial.isThinking)
  const [error, setError] = useState<string | null>(initial.error)

  // Subscribe to the singleton engine so state persists across route changes.
  useEffect(() => {
    return subscribeStockfish((s) => {
      setIsReady(s.isReady)
      setIsThinking(s.isThinking)
      setError(s.error)
    })
  }, [])

  // ─── Public API ────────────────────────────────────────────────────────────

  const sendCommand = useCallback((cmd: string) => {
    sendStockfishCommand(cmd)
  }, [])

  /**
   * Ask Stockfish for the best move at a position.
   * `moveTimeMs` caps the search time in milliseconds (good for mobile).
   */
  const getBestMove = useCallback(
    (fen: string, depth: number, moveTimeMs?: number): Promise<string | null> => {
      return getStockfishBestMove(fen, depth, moveTimeMs)
    },
    []
  )

  /**
   * Evaluate a position.
   * Resolves ONLY after the `bestmove` response so the score reflects the
   * deepest completed depth, not the first intermediate info line.
   */
  const getEvaluation = useCallback(
    (fen: string, depth: number): Promise<Evaluation | null> => {
      return getStockfishEvaluation(fen, depth)
    },
    []
  )

  return { isReady, isThinking, sendCommand, getBestMove, getEvaluation, error }
}
