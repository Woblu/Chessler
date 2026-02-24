'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'
import { getCustomPieces, getCustomSquareStyles } from '@/lib/chess-customization'
import { useDbUser } from '@/app/context/UserContext'

interface LineData {
  line: string[]
  lineNumber: number
  description: string
  openingName: string
  completed?: boolean
}

export default function LearnOpeningPage() {
  const params = useParams()
  const router = useRouter()
  const { dbUser } = useDbUser()
  const openingId = params.openingId as string

  const [lineData, setLineData] = useState<LineData | null>(null)
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lineCompleted, setLineCompleted] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isUserTurn, setIsUserTurn] = useState(true)
  const [isOpponentMoving, setIsOpponentMoving] = useState(false)

  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(new Chess().fen())

  useEffect(() => {
    fetchNextLine()
  }, [openingId])

  const fetchNextLine = async () => {
    try {
      setLoading(true)
      setError(null)
      setLineCompleted(false)
      setShowSuccessModal(false)

      const response = await fetch(`/api/openings/${openingId}/next-line`)

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        if (response.status === 404) {
          setError('Opening not found')
          return
        }
        throw new Error('Failed to fetch line')
      }

      const data = await response.json()

      if (!data.line || data.line.length === 0) {
        setError('No lines available for this opening')
        return
      }

      chessRef.current = new Chess()
      setFen(chessRef.current.fen())
      setCurrentMoveIndex(0)
      setIsUserTurn(true)
      setIsOpponentMoving(false)
      setLineData(data)
    } catch (err) {
      console.error('Error fetching line:', err)
      setError('Failed to load opening line')
    } finally {
      setLoading(false)
    }
  }

  const playOpponentMove = (moveSan: string, currentFen: string) => {
    setIsOpponentMoving(true)
    setTimeout(() => {
      try {
        const gameCopy = new Chess(currentFen)
        gameCopy.move(moveSan)
        const newFen = gameCopy.fen()
        chessRef.current = gameCopy
        setFen(newFen)
        setCurrentMoveIndex((prev) => prev + 1)
        setIsUserTurn(true)
        setIsOpponentMoving(false)
      } catch (err) {
        console.error('Error playing opponent move:', err)
        setIsOpponentMoving(false)
      }
    }, 500)
  }

  const markLineAsLearned = async () => {
    try {
      await fetch(`/api/openings/${openingId}/mark-learned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineNumber: lineData?.lineNumber }),
      })
    } catch (err) {
      console.error('Error marking line as learned:', err)
    }
  }

  const handleCorrectMoveAsync = (
    nextIndex: number,
    newFen: string,
    moveSan: string
  ) => {
    if (nextIndex >= lineData!.line.length) {
      markLineAsLearned().then(() => {
        setLineCompleted(true)
        setShowSuccessModal(true)
      }).catch((err) => console.error('Error marking line as learned:', err))
    } else {
      setIsUserTurn(false)
      setCurrentMoveIndex(nextIndex)
      const opponentMove = lineData!.line[nextIndex]
      playOpponentMove(opponentMove, newFen)
    }
  }

  const onDrop = (
    sourceSquare: Square,
    targetSquare: Square,
    _piece: string
  ): boolean => {
    if (!lineData || lineCompleted || !isUserTurn || isOpponentMoving) return false

    const expectedMoveSan = lineData.line[currentMoveIndex]
    if (!expectedMoveSan) return false

    try {
      const gameCopy = new Chess(chessRef.current.fen())

      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })

      if (!move) return false

      // Verify it matches the expected move in the opening line
      const expectedGame = new Chess(chessRef.current.fen())
      let expectedMove
      try {
        expectedMove = expectedGame.move(expectedMoveSan)
      } catch {
        return false
      }

      if (move.san !== expectedMove?.san) {
        // Wrong move - reset the piece
        return false
      }

      const newFen = gameCopy.fen()
      chessRef.current = gameCopy
      setFen(newFen)

      const nextIndex = currentMoveIndex + 1
      handleCorrectMoveAsync(nextIndex, newFen, move.san)

      return true
    } catch {
      return false
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <button
            onClick={() => router.push('/learn')}
            className="px-6 py-3 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
          >
            Back to Openings
          </button>
        </div>
      </div>
    )
  }

  if (!lineData) return null

  const progress = lineData.line.length > 0
    ? Math.round((currentMoveIndex / lineData.line.length) * 100)
    : 0

  return (
    <div className="min-h-screen bg-chess-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/learn')}
            className="text-pawn-gold hover:text-pawn-gold-hover mb-4 text-sm font-medium"
          >
            ← Back to Openings
          </button>
          <h1 className="text-3xl font-extrabold text-white">{lineData.openingName}</h1>
          {lineData.description && (
            <p className="text-slate-400 mt-1">{lineData.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Board */}
          <div className="lg:col-span-2">
            <div className="bg-chess-card rounded-xl p-4 border border-chess-border">
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                arePiecesDraggable={!!(!lineCompleted && isUserTurn && !isOpponentMoving && lineData && currentMoveIndex < lineData.line.length)}
                customPieces={getCustomPieces(dbUser?.pieceSet || 'caliente')}
                customDarkSquareStyle={getCustomSquareStyles(dbUser?.boardStyle || 'canvas2').dark}
                customLightSquareStyle={getCustomSquareStyles(dbUser?.boardStyle || 'canvas2').light}
                customBoardStyle={{
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                }}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Status */}
            <div className="bg-chess-card rounded-xl p-4 border border-chess-border">
              <h2 className="text-lg font-bold text-white mb-3">Status</h2>
              {isOpponentMoving ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <div className="w-4 h-4 border-2 border-pawn-gold border-t-transparent rounded-full animate-spin"></div>
                  <span>Opponent is moving...</span>
                </div>
              ) : lineCompleted ? (
                <div className="text-pawn-gold font-semibold">✓ Line completed!</div>
              ) : (
                <div className="text-slate-300">
                  {isUserTurn ? 'Your turn — play the correct move' : 'Waiting...'}
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="bg-chess-card rounded-xl p-4 border border-chess-border">
              <h2 className="text-lg font-bold text-white mb-3">Progress</h2>
              <div className="text-sm text-slate-400 mb-2">
                Move {currentMoveIndex} of {lineData.line.length}
              </div>
              <div className="w-full bg-chess-bg rounded-full h-3">
                <div
                  className="h-full bg-pawn-gold rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Line Moves */}
            <div className="bg-chess-card rounded-xl p-4 border border-chess-border">
              <h2 className="text-lg font-bold text-white mb-3">Opening Line</h2>
              <div className="flex flex-wrap gap-1">
                {lineData.line.map((move, index) => (
                  <span
                    key={index}
                    className={`text-sm px-2 py-1 rounded ${
                      index < currentMoveIndex
                        ? 'bg-pawn-gold text-slate-900 font-semibold'
                        : index === currentMoveIndex
                        ? 'bg-pawn-gold/30 text-pawn-gold border border-pawn-gold'
                        : 'bg-chess-bg text-slate-400'
                    }`}
                  >
                    {Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '...'}{move}
                  </span>
                ))}
              </div>
            </div>

            {/* Next Variation button */}
            {lineCompleted && (
              <button
                onClick={fetchNextLine}
                className="w-full px-6 py-3 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
              >
                Next Variation →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-chess-card rounded-xl p-8 max-w-md w-full mx-4 shadow-xl border border-chess-border text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-extrabold text-white mb-2">Line Complete!</h2>
            <p className="text-slate-300 mb-6">
              You successfully played through the {lineData.openingName} opening line.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={fetchNextLine}
                className="px-6 py-3 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
              >
                Next Variation
              </button>
              <button
                onClick={() => router.push('/learn')}
                className="px-6 py-3 bg-chess-bg hover:bg-slate-700 text-white font-bold rounded-lg border border-chess-border transition-colors"
              >
                Back to Openings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
