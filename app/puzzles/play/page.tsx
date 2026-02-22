'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'
import { getRandomPuzzleByTheme } from '@/actions/puzzles'
import { awardPawns } from '@/actions/economy'
import { getCustomPieces, getCustomSquareStyles } from '@/lib/chess-customization'

interface Puzzle {
  id: string
  fen: string
  moves: string
  rating: number
  themes: string
  pawnReward: number
}

function PuzzlePlayPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = searchParams.get('theme') || 'mate'

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [chess, setChess] = useState<Chess | null>(null)
  const [moveSequence, setMoveSequence] = useState<string[]>([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)
  const [isUserTurn, setIsUserTurn] = useState(false)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [flashRed, setFlashRed] = useState(false)
  const [flashGreen, setFlashGreen] = useState(false)
  const [userPreferences, setUserPreferences] = useState<{ pieceSet: string; boardStyle: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [validMoves, setValidMoves] = useState<Square[]>([])
  const [minRating, setMinRating] = useState(800)
  const [maxRating, setMaxRating] = useState(1500)

  const chessRef = useRef<Chess | null>(null)

  // Fetch user preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setUserPreferences({
              pieceSet: data.user.pieceSet || 'caliente',
              boardStyle: data.user.boardStyle || 'canvas2',
            })
            setUserId(data.user.id)
          }
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error)
      }
    }
    fetchPreferences()
  }, [])

  // Load puzzle when theme or rating range changes
  useEffect(() => {
    loadPuzzle()
    // Reset selection when puzzle changes
    setSelectedSquare(null)
    setValidMoves([])
  }, [theme, minRating, maxRating])

  const loadPuzzle = async () => {
    try {
      setLoading(true)
      setError(null)
      setShowSuccessModal(false)
      setCurrentMoveIndex(0)
      setIsUserTurn(false)
      setIsAutoPlaying(false)

      const result = await getRandomPuzzleByTheme(theme, minRating, maxRating)

      if (!result.success || !result.puzzle) {
        setError(result.error || 'Failed to load puzzle')
        return
      }

      const puzzleData = result.puzzle
      setPuzzle(puzzleData)

      // Split moves string into array (moves are space-separated UCI format)
      const moves = puzzleData.moves.split(' ').filter((m: string) => m.trim())
      setMoveSequence(moves)

      // Initialize chess with puzzle FEN
      const newChess = new Chess(puzzleData.fen)
      setChess(newChess)
      chessRef.current = newChess

      // Auto-play first move (opponent's blunder) after a short delay
      if (moves.length > 0) {
        setIsAutoPlaying(true)
        setTimeout(() => {
          const chessCopy = new Chess(puzzleData.fen)
          if (playMove(moves[0], chessCopy)) {
            setChess(chessCopy)
            chessRef.current = chessCopy
            setCurrentMoveIndex(1)
            setIsUserTurn(true)
          }
          setIsAutoPlaying(false)
        }, 500)
      }
    } catch (err) {
      console.error('Error loading puzzle:', err)
      setError('Failed to load puzzle')
    } finally {
      setLoading(false)
    }
  }

  const playMove = (moveUci: string, chessInstance: Chess): boolean => {
    try {
      // Convert UCI to move object
      const from = moveUci.substring(0, 2)
      const to = moveUci.substring(2, 4)
      const promotion = moveUci.length > 4 ? moveUci.substring(4, 5) : undefined

      const move = chessInstance.move({
        from,
        to,
        promotion: promotion as any,
      })

      return !!move
    } catch (error) {
      console.error('Error playing move:', error)
      return false
    }
  }

  const handleSquareClick = (square: Square) => {
    if (!chess || !isUserTurn || isAutoPlaying || !puzzle) {
      return
    }

    // If no square is selected, select this square and show valid moves
    if (!selectedSquare) {
      const piece = chess.get(square)
      // Only allow selecting pieces of the current player's color
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square)
        // Get all valid moves from this square
        const moves = chess.moves({ square, verbose: true })
        setValidMoves(moves.map((m) => m.to))
      }
    } else {
      // If clicking the same square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null)
        setValidMoves([])
        return
      }

      // If clicking a valid move square, make the move
      if (validMoves.includes(square)) {
        handleMove(selectedSquare, square)
        setSelectedSquare(null)
        setValidMoves([])
      } else {
        // Clicking a different piece - select that instead
        const piece = chess.get(square)
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square)
          const moves = chess.moves({ square, verbose: true })
          setValidMoves(moves.map((m) => m.to))
        } else {
          // Clicking empty square or opponent piece - deselect
          setSelectedSquare(null)
          setValidMoves([])
        }
      }
    }
  }

  const handleMove = (sourceSquare: Square, targetSquare: Square) => {
    if (!chess || !isUserTurn || isAutoPlaying || !puzzle) {
      return false
    }

    try {
      // Check if this is a pawn promotion move
      const piece = chess.get(sourceSquare)
      const isPawn = piece?.type === 'p'
      const isPromotionRank = targetSquare[1] === '8' || targetSquare[1] === '1'
      
      // Only set promotion if it's a pawn moving to promotion rank
      const moveOptions: any = {
        from: sourceSquare,
        to: targetSquare,
      }
      
      if (isPawn && isPromotionRank) {
        moveOptions.promotion = 'q' // Always promote to queen for puzzles
      }

      const move = chess.move(moveOptions)

      if (!move) {
        return false
      }

      // Check if this is the correct move
      const expectedMove = moveSequence[currentMoveIndex]
      // UCI format: sourceSquare + targetSquare + (optional promotion)
      let userMoveUci = sourceSquare + targetSquare
      // Add promotion if it's a promotion move
      if (move.promotion) {
        userMoveUci += move.promotion.toLowerCase()
      }

      if (userMoveUci !== expectedMove) {
        // Incorrect move - flash red and undo
        setFlashRed(true)
        setTimeout(() => {
          setFlashRed(false)
          // Undo the move
          chess.undo()
          setChess(new Chess(chess.fen()))
          chessRef.current = new Chess(chess.fen())
        }, 500)
        return false
      }

      // Correct move! Flash green
      setFlashGreen(true)
      setTimeout(() => {
        setFlashGreen(false)
      }, 300)

      const newChess = new Chess(chess.fen())
      setChess(newChess)
      chessRef.current = newChess
      const nextIndex = currentMoveIndex + 1
      setCurrentMoveIndex(nextIndex)
      setIsUserTurn(false)

      // Check if puzzle is complete
      if (nextIndex >= moveSequence.length) {
        // Puzzle solved!
        handlePuzzleSolved()
      } else {
        // Auto-play next opponent move
        setIsAutoPlaying(true)
        setTimeout(() => {
          if (chessRef.current && nextIndex < moveSequence.length) {
            const nextMove = moveSequence[nextIndex]
            const chessCopy = new Chess(chessRef.current.fen())
            if (playMove(nextMove, chessCopy)) {
              setChess(chessCopy)
              chessRef.current = chessCopy
              setCurrentMoveIndex(nextIndex + 1)
              setIsUserTurn(true)
            }
            setIsAutoPlaying(false)
          }
        }, 500)
      }

      return true
    } catch (error) {
      console.error('Error making move:', error)
      return false
    }
  }

  const onDrop = (sourceSquare: Square, targetSquare: Square, _piece: string): boolean => {
    setSelectedSquare(null)
    setValidMoves([])
    return handleMove(sourceSquare, targetSquare)
  }

  const onSquareClick = (square: Square) => {
    handleSquareClick(square)
  }

  const handlePuzzleSolved = async () => {
    if (!puzzle || !userId) return

    setShowSuccessModal(true)

    // Award pawns
    try {
      await awardPawns(userId, puzzle.pawnReward, 'puzzle_solved')
      
      // Evaluate quests for puzzle solved
      const { evaluateQuests } = await import('@/actions/quests')
      await evaluateQuests(userId, 'PUZZLE_SOLVED', 1).catch((error) => {
        console.error('Error evaluating quests for puzzle:', error)
      })
    } catch (error) {
      console.error('Error awarding pawns:', error)
    }
  }

  const handleNextPuzzle = () => {
    setShowSuccessModal(false)
    loadPuzzle()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !puzzle || !chess) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error || 'Failed to load puzzle'}</div>
          <button
            onClick={() => router.push('/puzzles')}
            className="px-6 py-3 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
          >
            Back to Categories
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-chess-bg p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/puzzles')}
            className="text-pawn-gold hover:text-pawn-gold-hover mb-4 flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Categories
          </button>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2">Puzzle Training</h1>
              <p className="text-slate-300">
                Rating: {puzzle.rating} • Theme: {theme}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-300">Reward</div>
              <div className="text-xl font-bold text-pawn-gold">
                {puzzle.pawnReward} pawns
              </div>
            </div>
          </div>

          {/* ELO Range Selector */}
          <div className="bg-chess-card border border-chess-border rounded-xl p-4">
            <div className="flex items-center gap-4">
              <label className="text-slate-300 text-sm">Rating Range:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="800"
                  max="2000"
                  value={minRating}
                  onChange={(e) => setMinRating(parseInt(e.target.value) || 800)}
                  className="w-20 px-2 py-1 bg-chess-bg border border-chess-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pawn-gold"
                />
                <span className="text-slate-300">-</span>
                <input
                  type="number"
                  min="800"
                  max="2000"
                  value={maxRating}
                  onChange={(e) => setMaxRating(parseInt(e.target.value) || 1500)}
                  className="w-20 px-2 py-1 bg-chess-bg border border-chess-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pawn-gold"
                />
              </div>
              <button
                onClick={loadPuzzle}
                className="px-4 py-1 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 rounded-lg text-sm font-bold transition-colors"
              >
                New Puzzle
              </button>
            </div>
          </div>
        </div>

        {/* Chess Board */}
        <div className="flex justify-center mb-6">
          <div
            className={`w-full max-w-2xl transition-all duration-300 ${
              flashRed ? 'ring-4 ring-red-500 rounded-lg' : flashGreen ? 'ring-4 ring-green-500 rounded-lg' : ''
            }`}
          >
            <Chessboard
              position={chess.fen()}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              boardOrientation="white"
              arePiecesDraggable={isUserTurn && !isAutoPlaying}
              customSquareStyles={{
                ...(selectedSquare && {
                  [selectedSquare]: {
                    background: 'rgba(251, 191, 36, 0.4)',
                  },
                }),
                ...validMoves.reduce((acc, square) => {
                  acc[square] = {
                    background: 'radial-gradient(circle, rgba(251, 191, 36, 0.4) 25%, transparent 25%)',
                    borderRadius: '50%',
                  }
                  return acc
                }, {} as Record<string, any>),
              }}
              customPieces={userPreferences ? getCustomPieces(userPreferences.pieceSet) : getCustomPieces('caliente')}
              customDarkSquareStyle={userPreferences ? getCustomSquareStyles(userPreferences.boardStyle).dark : getCustomSquareStyles('canvas2').dark}
              customLightSquareStyle={userPreferences ? getCustomSquareStyles(userPreferences.boardStyle).light : getCustomSquareStyles('canvas2').light}
              customBoardStyle={{
                borderRadius: '4px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
              }}
            />
          </div>
        </div>

        {/* Status */}
        <div className="bg-chess-card border border-chess-border rounded-xl p-4 mb-6">
          <div className="text-center">
            {isAutoPlaying ? (
              <p className="text-slate-300">Opponent is thinking...</p>
            ) : isUserTurn ? (
              <div>
                <p className="text-pawn-gold font-extrabold text-lg mb-2">Your turn! Find the best move</p>
                {selectedSquare && (
                  <p className="text-slate-300 text-sm">Click a highlighted square to move</p>
                )}
              </div>
            ) : (
              <p className="text-slate-300">Loading...</p>
            )}
          </div>
        </div>

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-chess-card border-2 border-pawn-gold rounded-xl p-8 max-w-md w-full text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-extrabold text-white mb-4">Puzzle Solved!</h2>
              <p className="text-slate-300 mb-2">You earned</p>
              <p className="text-2xl font-bold text-pawn-gold mb-6">
                {puzzle.pawnReward} pawns
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => router.push('/puzzles')}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                >
                  Back to Categories
                </button>
                <button
                  onClick={handleNextPuzzle}
                  className="flex-1 px-4 py-3 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
                >
                  Next Puzzle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PuzzlePlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#7fa650] border-t-transparent rounded-full animate-spin"></div></div>}>
      <PuzzlePlayPageInner />
    </Suspense>
  )
}
