'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface StockfishMessage {
  type: 'bestmove' | 'info' | 'readyok' | 'error'
  bestmove?: string
  ponder?: string
  depth?: number
  score?: number
  message?: string
}

export interface Evaluation {
  score: number // in centipawns
  isMate: boolean
  mateIn: number | null // number of moves to mate (positive = white mates, negative = black mates)
}

export interface UseStockfishReturn {
  isReady: boolean
  isThinking: boolean
  sendCommand: (command: string) => void
  getBestMove: (fen: string, depth: number) => Promise<string | null>
  getEvaluation: (fen: string, depth: number) => Promise<Evaluation | null>
  error: string | null
}

export function useStockfish(): UseStockfishReturn {
  const workerRef = useRef<Worker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingResolveRef = useRef<((move: string | null) => void) | null>(null)
  const pendingEvalResolveRef = useRef<((evalResult: Evaluation | null) => void) | null>(null)
  const currentEvalRef = useRef<Evaluation | null>(null)

  useEffect(() => {
    // Initialize Web Worker
    try {
      const worker = new Worker('/stockfish.js')
      workerRef.current = worker

      worker.onmessage = (e: MessageEvent<string>) => {
        const message = e.data.trim()
        
        // Handle readyok
        if (message === 'uciok' || message.includes('readyok')) {
          setIsReady(true)
          setError(null)
          return
        }

        // Handle info messages with evaluation
        if (message.startsWith('info')) {
          // Parse evaluation from info message
          // Format: "info depth X score cp Y" or "info depth X score mate Y"
          const scoreMatch = message.match(/score (cp|mate) (-?\d+)/)
          if (scoreMatch) {
            const scoreType = scoreMatch[1]
            const scoreValue = parseInt(scoreMatch[2], 10)
            
            if (scoreType === 'cp') {
              // Centipawns: positive = white advantage, negative = black advantage
              currentEvalRef.current = {
                score: scoreValue,
                isMate: false,
                mateIn: null,
              }
            } else if (scoreType === 'mate') {
              // Mate: positive = white mates in X, negative = black mates in X
              currentEvalRef.current = {
                score: scoreValue > 0 ? 10000 : -10000, // Large value for mate
                isMate: true,
                mateIn: scoreValue,
              }
            }
            
            // Resolve pending evaluation request if we have a complete evaluation
            if (pendingEvalResolveRef.current && currentEvalRef.current) {
              pendingEvalResolveRef.current(currentEvalRef.current)
              pendingEvalResolveRef.current = null
              currentEvalRef.current = null
            }
          }
          return
        }

        // Handle bestmove
        if (message.startsWith('bestmove')) {
          setIsThinking(false)
          const parts = message.split(' ')
          const bestmove = parts[1]
          
          if (bestmove && bestmove !== '(none)') {
            if (pendingResolveRef.current) {
              pendingResolveRef.current(bestmove)
              pendingResolveRef.current = null
            }
          } else {
            if (pendingResolveRef.current) {
              pendingResolveRef.current(null)
              pendingResolveRef.current = null
            }
          }
          return
        }

        // Handle errors
        if (message.includes('error') || message.includes('Error')) {
          setError(message)
          setIsThinking(false)
          if (pendingResolveRef.current) {
            pendingResolveRef.current(null)
            pendingResolveRef.current = null
          }
          if (pendingEvalResolveRef.current) {
            pendingEvalResolveRef.current(null)
            pendingEvalResolveRef.current = null
          }
        }
      }

      worker.onerror = (err) => {
        console.error('Stockfish worker error:', err)
        setError('Stockfish worker error')
        setIsReady(false)
        setIsThinking(false)
        if (pendingResolveRef.current) {
          pendingResolveRef.current(null)
          pendingResolveRef.current = null
        }
      }

      // Initialize UCI
      worker.postMessage('uci')
      worker.postMessage('isready')

      return () => {
        if (workerRef.current) {
          workerRef.current.terminate()
          workerRef.current = null
        }
      }
    } catch (err) {
      console.error('Failed to initialize Stockfish:', err)
      setError('Failed to initialize Stockfish worker')
      setIsReady(false)
    }
  }, [])

  const sendCommand = useCallback((command: string) => {
    if (workerRef.current && isReady) {
      workerRef.current.postMessage(command)
    } else {
      console.warn('Stockfish not ready, command ignored:', command)
    }
  }, [isReady])

  const getBestMove = useCallback((fen: string, depth: number): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!workerRef.current || !isReady) {
        resolve(null)
        return
      }

      setIsThinking(true)
      setError(null)
      pendingResolveRef.current = resolve

      // Set position and calculate best move
      workerRef.current.postMessage(`position fen ${fen}`)
      workerRef.current.postMessage(`go depth ${depth}`)

      // Timeout after 10 seconds
      setTimeout(() => {
        if (pendingResolveRef.current === resolve) {
          setIsThinking(false)
          pendingResolveRef.current = null
          resolve(null)
        }
      }, 10000)
    })
  }, [isReady])

  const getEvaluation = useCallback((fen: string, depth: number): Promise<Evaluation | null> => {
    return new Promise((resolve) => {
      if (!workerRef.current || !isReady) {
        resolve(null)
        return
      }

      setError(null)
      pendingEvalResolveRef.current = resolve
      currentEvalRef.current = null

      // Set position and get evaluation
      workerRef.current.postMessage(`position fen ${fen}`)
      workerRef.current.postMessage(`go depth ${depth}`)

      // Wait for evaluation from info messages
      // The existing message handler will capture the evaluation and resolve
      // Timeout after 5 seconds
      setTimeout(() => {
        if (pendingEvalResolveRef.current === resolve) {
          pendingEvalResolveRef.current = null
          // Return the last evaluation we received, or null if none
          resolve(currentEvalRef.current)
          currentEvalRef.current = null
        }
      }, 5000)
    })
  }, [isReady])

  return {
    isReady,
    isThinking,
    sendCommand,
    getBestMove,
    getEvaluation,
    error,
  }
}
