'use client'

import { useState, useCallback, useRef } from 'react'
import { buildPositions, buildFenSequence, buildAnalysis, GameAnalysis } from '@/lib/analysis'

const ANALYSIS_DEPTH = 15

// ─── Helper: evaluate a single position ──────────────────────────────────────

function evaluatePosition(
  worker: Worker,
  fen: string
): Promise<{ score: number; bestMove: string }> {
  return new Promise((resolve) => {
    let score = 0
    let bestMove = ''

    const onMessage = (e: MessageEvent<string>) => {
      const msg = e.data.trim()

      if (msg.startsWith('info')) {
        const cpMatch = msg.match(/score cp (-?\d+)/)
        const mateMatch = msg.match(/score mate (-?\d+)/)
        const pvMatch = msg.match(/ pv (\S+)/)

        if (cpMatch) score = parseInt(cpMatch[1])
        if (mateMatch) score = parseInt(mateMatch[1]) > 0 ? 10000 : -10000
        if (pvMatch) bestMove = pvMatch[1] // last pv move = best at deepest depth
      }

      if (msg.startsWith('bestmove')) {
        worker.removeEventListener('message', onMessage)
        const parts = msg.split(' ')
        if (!bestMove) bestMove = parts[1] !== '(none)' ? (parts[1] ?? '') : ''
        resolve({ score, bestMove })
      }
    }

    worker.addEventListener('message', onMessage)
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${ANALYSIS_DEPTH}`)
  })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface GameAnalysisState {
  isAnalyzing: boolean
  progress: number     // 0–100
  result: GameAnalysis | null
  error: string | null
}

export function useGameAnalysis() {
  const [state, setState] = useState<GameAnalysisState>({
    isAnalyzing: false,
    progress: 0,
    result: null,
    error: null,
  })
  const workerRef = useRef<Worker | null>(null)
  const cancelledRef = useRef(false)

  const analyze = useCallback(async (uciMoves: string[]) => {
    // Cancel any previous run
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    cancelledRef.current = false

    if (!uciMoves.length) {
      setState({
        isAnalyzing: false,
        progress: 100,
        result: { moves: [], counts: { brilliant:0, best:0, excellent:0, good:0, inaccuracy:0, mistake:0, blunder:0 } },
        error: null,
      })
      return
    }

    setState({ isAnalyzing: true, progress: 0, result: null, error: null })

    try {
      // ── Init worker ──────────────────────────────────────────────────────
      const worker = new Worker('/stockfish.js')
      workerRef.current = worker

      await new Promise<void>((resolve, reject) => {
        const onReady = (e: MessageEvent<string>) => {
          if (e.data === 'uciok' || e.data.includes('readyok')) {
            worker.removeEventListener('message', onReady)
            resolve()
          }
        }
        worker.addEventListener('message', onReady)
        worker.onerror = () => reject(new Error('Worker init failed'))
        worker.postMessage('uci')
        worker.postMessage('isready')
      })

      if (cancelledRef.current) return

      // ── Build positions ──────────────────────────────────────────────────
      const positions = buildPositions(uciMoves)
      const fens = buildFenSequence(uciMoves)

      // ── Evaluate each position ───────────────────────────────────────────
      const scores: number[] = []
      const bestMoves: string[] = []

      for (let i = 0; i < fens.length; i++) {
        if (cancelledRef.current) return

        const fen = fens[i]
        const sideToMove = fen.split(' ')[1] as 'w' | 'b'
        const { score, bestMove } = await evaluatePosition(worker, fen)

        // Normalise to white's perspective
        scores.push(sideToMove === 'b' ? -score : score)
        bestMoves.push(bestMove)

        setState((s) => ({
          ...s,
          progress: Math.round(((i + 1) / fens.length) * 100),
        }))
      }

      if (cancelledRef.current) return

      worker.terminate()
      workerRef.current = null

      const result = buildAnalysis(positions, fens, scores, bestMoves)
      setState({ isAnalyzing: false, progress: 100, result, error: null })
    } catch (err) {
      if (!cancelledRef.current) {
        setState({
          isAnalyzing: false,
          progress: 0,
          result: null,
          error: err instanceof Error ? err.message : 'Analysis failed',
        })
      }
    }
  }, [])

  const cancelAnalysis = useCallback(() => {
    cancelledRef.current = true
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setState((s) => ({ ...s, isAnalyzing: false }))
  }, [])

  return { ...state, analyze, cancelAnalysis }
}
