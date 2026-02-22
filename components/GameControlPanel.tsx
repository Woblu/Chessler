'use client'

import { useState, useEffect, useRef } from 'react'
import { Chess, type Move } from 'chess.js'

interface GameControlPanelProps {
  chess: Chess
  onPositionChange: (fen: string) => void
  onResign: () => void
  onDrawOffer: () => void
  isGameActive: boolean
}

export default function GameControlPanel({
  chess,
  onPositionChange,
  onResign,
  onDrawOffer,
  isGameActive,
}: GameControlPanelProps) {
  const [history, setHistory] = useState<Move[]>([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)
  const [isNavigating, setIsNavigating] = useState(false)
  const fullHistoryRef = useRef<Move[]>([])

  // Update history when chess state changes
  // Always keep the full history, regardless of navigation position
  useEffect(() => {
    // Always get the full history from the chess instance
    const moveHistory = chess.history({ verbose: true })
    const newHistoryLength = moveHistory.length
    const oldHistoryLength = fullHistoryRef.current.length
    
    // Update the ref with full move list (this is the source of truth)
    if (newHistoryLength >= oldHistoryLength) {
      fullHistoryRef.current = moveHistory
    }
    
    // Always update state with the full history from ref
    setHistory([...fullHistoryRef.current]) // Create new array to trigger re-render
    
    // If a new move was made (and we're not navigating), reset to current position
    if (!isNavigating) {
      if (newHistoryLength > oldHistoryLength) {
        setCurrentMoveIndex(newHistoryLength - 1)
        onPositionChange(chess.fen())
      } else if (oldHistoryLength === 0 && newHistoryLength === 0) {
        // Game just started
        setCurrentMoveIndex(-1)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, isNavigating])


  // Format moves into numbered pairs
  const formatMoves = () => {
    const pairs: Array<{ number: number; white: string; black?: string }> = []
    
    for (let i = 0; i < history.length; i += 2) {
      const whiteMove = history[i]
      const blackMove = history[i + 1]
      
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: whiteMove?.san || '',
        black: blackMove?.san,
      })
    }
    
    return pairs
  }

  const movePairs = formatMoves()

  const navigateToPosition = (targetIndex: number) => {
    setIsNavigating(true)
    
    // If target is -1, show starting position
    if (targetIndex === -1) {
      const tempChess = new Chess()
      setCurrentMoveIndex(-1)
      onPositionChange(tempChess.fen())
      setTimeout(() => setIsNavigating(false), 100)
      return
    }
    
    // Create a new chess instance and replay moves up to target index
    const tempChess = new Chess()
    
    for (let i = 0; i <= targetIndex && i < history.length; i++) {
      const move = history[i]
      try {
        tempChess.move(move.san)
      } catch (error) {
        console.error('Error replaying move:', error)
        break
      }
    }
    
    setCurrentMoveIndex(targetIndex)
    onPositionChange(tempChess.fen())
    
    // Reset navigating flag after a short delay
    setTimeout(() => setIsNavigating(false), 100)
  }

  const goToStart = () => {
    navigateToPosition(-1)
  }

  const goToPrevious = () => {
    if (currentMoveIndex >= 0) {
      navigateToPosition(currentMoveIndex - 1)
    }
  }

  const goToNext = () => {
    if (currentMoveIndex < history.length - 1) {
      navigateToPosition(currentMoveIndex + 1)
    }
  }

  const goToCurrent = () => {
    navigateToPosition(history.length - 1)
  }

  return (
    <div className="flex flex-col h-full bg-[#2d2d2d]">
      {/* Move Tracker */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <h3 className="text-lg font-bold text-[#f0d9b5] mb-4">Move History</h3>
        <div className="space-y-1">
          {movePairs.map((pair, index) => {
            const whiteMoveIndex = (pair.number - 1) * 2
            const blackMoveIndex = whiteMoveIndex + 1
            const isWhiteActive = currentMoveIndex === whiteMoveIndex
            const isBlackActive = currentMoveIndex === blackMoveIndex
            const isActive = isWhiteActive || isBlackActive

            return (
              <div
                key={pair.number}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[#4a7c59] text-[#f0d9b5]'
                    : 'hover:bg-[#3d3d3d] text-[#b58863]'
                }`}
                onClick={() => {
                  if (isBlackActive) {
                    navigateToPosition(blackMoveIndex)
                  } else {
                    navigateToPosition(whiteMoveIndex)
                  }
                }}
              >
                <span className="font-semibold min-w-[2rem] text-sm">{pair.number}.</span>
                <span
                  className={`flex-1 ${
                    isWhiteActive ? 'font-bold text-[#f0d9b5]' : ''
                  }`}
                >
                  {pair.white}
                </span>
                {pair.black && (
                  <span
                    className={`flex-1 ${
                      isBlackActive ? 'font-bold text-[#f0d9b5]' : ''
                    }`}
                  >
                    {pair.black}
                  </span>
                )}
              </div>
            )
          })}
          {movePairs.length === 0 && (
            <div className="text-[#6b6b6b] text-sm text-center py-4">
              No moves yet
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t border-[#3d3d3d] p-4 space-y-3">
        {/* Navigation Buttons */}
        <div className="flex gap-2">
          <button
            onClick={goToStart}
            disabled={currentMoveIndex < 0 || !isGameActive}
            className="flex-1 px-3 py-2 bg-[#3d3d3d] hover:bg-[#4d4d4d] disabled:opacity-50 disabled:cursor-not-allowed text-[#f0d9b5] rounded transition-colors font-mono text-sm"
            title="Go to start"
          >
            |&lt;
          </button>
          <button
            onClick={goToPrevious}
            disabled={currentMoveIndex < 0 || !isGameActive}
            className="flex-1 px-3 py-2 bg-[#3d3d3d] hover:bg-[#4d4d4d] disabled:opacity-50 disabled:cursor-not-allowed text-[#f0d9b5] rounded transition-colors font-mono text-sm"
            title="Previous move"
          >
            &lt;
          </button>
          <button
            onClick={goToNext}
            disabled={currentMoveIndex >= history.length - 1 || !isGameActive}
            className="flex-1 px-3 py-2 bg-[#3d3d3d] hover:bg-[#4d4d4d] disabled:opacity-50 disabled:cursor-not-allowed text-[#f0d9b5] rounded transition-colors font-mono text-sm"
            title="Next move"
          >
            &gt;
          </button>
          <button
            onClick={goToCurrent}
            disabled={currentMoveIndex >= history.length - 1 || !isGameActive}
            className="flex-1 px-3 py-2 bg-[#3d3d3d] hover:bg-[#4d4d4d] disabled:opacity-50 disabled:cursor-not-allowed text-[#f0d9b5] rounded transition-colors font-mono text-sm"
            title="Go to current position"
          >
            &gt;|
          </button>
        </div>

        {/* Game Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onResign}
            disabled={!isGameActive}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors font-semibold flex items-center justify-center gap-2"
            title="Resign"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 01-2 0V6z"
                clipRule="evenodd"
              />
            </svg>
            Resign
          </button>
          <button
            onClick={onDrawOffer}
            disabled={!isGameActive}
            className="flex-1 px-4 py-2 bg-[#4a7c59] hover:bg-[#5a8c69] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors font-semibold flex items-center justify-center gap-2"
            title="Offer draw"
          >
            <span className="text-lg">½</span>
            Draw
          </button>
        </div>
      </div>
    </div>
  )
}
