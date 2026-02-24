'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface Evaluation {
  score: number
  isMate: boolean
  mateIn: number | null
}

export interface UseStockfishReturn {
  isReady: boolean
  isThinking: boolean
  sendCommand: (command: string) => void
  getBestMove: (fen: string, depth: number, moveTimeMs?: number) => Promise<string | null>
  getEvaluation: (fen: string, depth: number) => Promise<Evaluation | null>
  error: string | null
}

type PendingKind = 'bestmove' | 'eval' | null

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
  const workerRef       = useRef<Worker | null>(null)
  const [isReady, setIsReady]       = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Pending resolution callbacks
  const pendingMoveRef  = useRef<((v: string | null) => void) | null>(null)
  const pendingEvalRef  = useRef<((v: Evaluation | null) => void) | null>(null)
  const pendingKindRef  = useRef<PendingKind>(null)

  // Accumulated eval from the most recent info lines
  const accumEvalRef    = useRef<Evaluation | null>(null)

  // Guards
  const isBusyRef       = useRef(false)
  const isReadyRef      = useRef(false)

  // ─── Worker setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    let worker: Worker
    try {
      worker = new Worker('/stockfish.js')
      workerRef.current = worker

      worker.onmessage = (e: MessageEvent<string>) => {
        const msg = e.data.trim()

        // ── Ready ──────────────────────────────────────────────────────────
        if (msg === 'uciok' || msg.includes('readyok')) {
          isReadyRef.current = true
          setIsReady(true)
          setError(null)
          return
        }

        // ── Info lines — accumulate but do not resolve yet ─────────────────
        if (msg.startsWith('info')) {
          const cpMatch   = msg.match(/score cp (-?\d+)/)
          const mateMatch = msg.match(/score mate (-?\d+)/)
          if (cpMatch) {
            accumEvalRef.current = { score: parseInt(cpMatch[1]), isMate: false, mateIn: null }
          } else if (mateMatch) {
            const mv = parseInt(mateMatch[1])
            accumEvalRef.current = { score: mv > 0 ? 10000 : -10000, isMate: true, mateIn: mv }
          }
          return
        }

        // ── bestmove — resolve whichever request is pending ────────────────
        if (msg.startsWith('bestmove')) {
          setIsThinking(false)
          isBusyRef.current = false

          const bm = msg.split(' ')[1]
          const bestMove = (bm && bm !== '(none)') ? bm : null

          if (pendingKindRef.current === 'bestmove' && pendingMoveRef.current) {
            pendingMoveRef.current(bestMove)
            pendingMoveRef.current = null
          }
          if (pendingKindRef.current === 'eval' && pendingEvalRef.current) {
            pendingEvalRef.current(accumEvalRef.current)
            pendingEvalRef.current = null
          }
          pendingKindRef.current = null
          accumEvalRef.current   = null
          return
        }

        // ── Engine errors ──────────────────────────────────────────────────
        if (msg.toLowerCase().includes('error')) {
          setError(msg)
          setIsThinking(false)
          isBusyRef.current = false
          pendingMoveRef.current?.(null);  pendingMoveRef.current = null
          pendingEvalRef.current?.(null);  pendingEvalRef.current = null
          pendingKindRef.current = null
        }
      }

      worker.onerror = (err) => {
        console.error('Stockfish worker error:', err)
        setError('Stockfish worker error')
        setIsReady(false)
        isReadyRef.current = false
        isBusyRef.current  = false
        setIsThinking(false)
        pendingMoveRef.current?.(null)
        pendingEvalRef.current?.(null)
        pendingMoveRef.current = pendingEvalRef.current = null
        pendingKindRef.current = null
      }

      worker.postMessage('uci')
      worker.postMessage('isready')
    } catch (err) {
      console.error('Failed to init Stockfish:', err)
      setError('Failed to initialize Stockfish worker')
    }

    return () => {
      worker?.terminate()
      workerRef.current = null
    }
  }, [])

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Stop an in-flight search and clear pending state synchronously. */
  const abortCurrent = useCallback(() => {
    if (isBusyRef.current && workerRef.current) {
      workerRef.current.postMessage('stop')
    }
    pendingMoveRef.current?.(null);  pendingMoveRef.current = null
    pendingEvalRef.current?.(null);  pendingEvalRef.current = null
    pendingKindRef.current = null
    accumEvalRef.current   = null
    isBusyRef.current      = false
    setIsThinking(false)
  }, [])

  // ─── Public API ────────────────────────────────────────────────────────────

  const sendCommand = useCallback((cmd: string) => {
    if (workerRef.current && isReadyRef.current) {
      workerRef.current.postMessage(cmd)
    }
  }, [])

  /**
   * Ask Stockfish for the best move at a position.
   * `moveTimeMs` caps the search time in milliseconds (good for mobile).
   */
  const getBestMove = useCallback(
    (fen: string, depth: number, moveTimeMs?: number): Promise<string | null> => {
      return new Promise((resolve) => {
        if (!workerRef.current || !isReadyRef.current) { resolve(null); return }

        abortCurrent()
        isBusyRef.current       = true
        pendingKindRef.current  = 'bestmove'
        pendingMoveRef.current  = resolve
        accumEvalRef.current    = null
        setIsThinking(true)
        setError(null)

        workerRef.current.postMessage(`position fen ${fen}`)
        if (moveTimeMs) {
          workerRef.current.postMessage(`go depth ${depth} movetime ${moveTimeMs}`)
        } else {
          workerRef.current.postMessage(`go depth ${depth}`)
        }

        // Hard timeout fallback
        const deadline = (moveTimeMs ?? 12000) + 3000
        setTimeout(() => {
          if (pendingMoveRef.current === resolve) {
            abortCurrent()
            resolve(null)
          }
        }, deadline)
      })
    },
    [abortCurrent]
  )

  /**
   * Evaluate a position.
   * Resolves ONLY after the `bestmove` response so the score reflects the
   * deepest completed depth, not the first intermediate info line.
   */
  const getEvaluation = useCallback(
    (fen: string, depth: number): Promise<Evaluation | null> => {
      return new Promise((resolve) => {
        if (!workerRef.current || !isReadyRef.current) { resolve(null); return }

        // Skip if engine is already calculating a best move for the bot
        if (isBusyRef.current && pendingKindRef.current === 'bestmove') {
          resolve(null)
          return
        }

        abortCurrent()
        isBusyRef.current       = true
        pendingKindRef.current  = 'eval'
        pendingEvalRef.current  = resolve
        accumEvalRef.current    = null

        workerRef.current.postMessage(`position fen ${fen}`)
        workerRef.current.postMessage(`go depth ${depth} movetime 2000`)

        setTimeout(() => {
          if (pendingEvalRef.current === resolve) {
            pendingEvalRef.current = null
            isBusyRef.current      = false
            pendingKindRef.current = null
            resolve(accumEvalRef.current)
            accumEvalRef.current   = null
          }
        }, 5000)
      })
    },
    [abortCurrent]
  )

  return { isReady, isThinking, sendCommand, getBestMove, getEvaluation, error }
}
