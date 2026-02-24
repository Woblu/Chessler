'use client'

import { useState, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'

export interface Premove {
  from: string
  to: string
  promotion?: string
}

export interface UsePremoveReturn {
  premove: Premove | null
  premoveFrom: string | null
  /** Called when user clicks a square while it is NOT their turn */
  handlePremoveClick: (square: string, chess: Chess, userColor: 'w' | 'b') => void
  /** Attempt to execute the stored premove against the given chess instance.
   *  Returns a new Chess instance if successful, or null if illegal / no premove. */
  attemptPremove: (chess: Chess) => Chess | null
  /** Wipe the premove (e.g. on right-click or new game) */
  clearPremove: () => void
  /** customSquareStyles object — red tint on the two premove squares */
  premoveStyles: Record<string, React.CSSProperties>
}

export function usePremove(): UsePremoveReturn {
  const [premove, setPremove]         = useState<Premove | null>(null)
  const [premoveFrom, setPremoveFrom] = useState<string | null>(null)

  const clearPremove = useCallback(() => {
    setPremove(null)
    setPremoveFrom(null)
  }, [])

  /**
   * Two-click flow:
   *  1st click → select piece (must own it)
   *  2nd click → store premove; clicking own piece resets selection
   */
  const handlePremoveClick = useCallback(
    (square: string, chess: Chess, userColor: 'w' | 'b') => {
      const piece = chess.get(square as Parameters<typeof chess.get>[0])

      if (!premoveFrom) {
        // Select piece
        if (piece && piece.color === userColor) {
          setPremoveFrom(square)
        }
      } else {
        if (square === premoveFrom) {
          // Deselect
          setPremoveFrom(null)
          return
        }
        if (piece && piece.color === userColor) {
          // Clicked another own piece — re-select
          setPremoveFrom(square)
          return
        }
        // Commit the premove (legality checked later when it's our turn)
        setPremove({ from: premoveFrom, to: square })
        setPremoveFrom(null)
      }
    },
    [premoveFrom]
  )

  /**
   * Try to play the stored premove on `chess`.
   * Returns a fresh Chess instance with the move applied, or null.
   */
  const attemptPremove = useCallback(
    (chess: Chess): Chess | null => {
      if (!premove) return null
      const pm = premove
      try {
        const next = new Chess(chess.fen())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const move = next.move({ from: pm.from, to: pm.to, promotion: pm.promotion ?? 'q' } as any)
        if (move) {
          clearPremove()
          return next
        }
      } catch {
        // premove was illegal — just discard it
      }
      clearPremove()
      return null
    },
    [premove, clearPremove]
  )

  const premoveStyles: Record<string, React.CSSProperties> = {}
  if (premoveFrom) {
    premoveStyles[premoveFrom] = { backgroundColor: 'rgba(220, 50, 50, 0.55)' }
  }
  if (premove) {
    premoveStyles[premove.from] = { backgroundColor: 'rgba(220, 50, 50, 0.55)' }
    premoveStyles[premove.to]   = { backgroundColor: 'rgba(220, 50, 50, 0.35)' }
  }

  return { premove, premoveFrom, handlePremoveClick, attemptPremove, clearPremove, premoveStyles }
}
