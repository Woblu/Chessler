'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'
import { getCustomPieces, getCustomSquareStyles } from '@/lib/chess-customization'

interface LineData {
  line: string[]
  lineNumber: number
  description: string
  openingName: string
  completed?: boolean
}

interface MoveInfo {
  piece: string
  from: string
  to: string
  san: string
}

export default function LearnOpeningPage() {
  const params = useParams()
  const router = useRouter()
  const openingId = params.openingId as string
  const [lineData, setLineData] = useState<LineData | null>(null)
  const [chess, setChess] = useState(new Chess())
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)
  const [userMoves, setUserMoves] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lineCompleted, setLineCompleted] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isUserTurn, setIsUserTurn] = useState(true)
  const [isOpponentMoving, setIsOpponentMoving] = useState(false)
  const [userPreferences, setUserPreferences] = useState<{ pieceSet: string; boardStyle: string } | null>(null)
  const chessRef = useRef(new Chess())

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
          }
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error)
        // Use defaults if fetch fails
        setUserPreferences({ pieceSet: 'caliente', boardStyle: 'canvas2' })
      }
    }
    fetchPreferences()
  }, [])

  useEffect(() => {
    fetchNextLine()
  }, [openingId])

  const fetchNextLine = async () => {
    try {
      setLoading(true)
      setError(null)
      setLineCompleted(false)
      setShowSuccessModal(false)
      setCurrentMoveIndex(0)
      setUserMoves([])
      setIsUserTurn(true)
      setIsOpponentMoving(false)

      const response = await fetch(`/api/openings/${openingId}/next-line`)
      if (!response.ok) {
        throw new Error('Failed to fetch next line')
      }

      const data: LineData = await response.json()

      if (data.completed) {
        setLineCompleted(true)
        setLineData(data)
        const newChess = new Chess()
        setChess(newChess)
        chessRef.current = newChess
      } else {
        setLineData(data)
        const newChess = new Chess()
        setChess(newChess)
        chessRef.current = newChess
        
        // User always plays white (even indices: 0, 2, 4...)
        // Opponent plays black (odd indices: 1, 3, 5...)
        // First move (index 0) is always white, so user starts
        setIsUserTurn(true)
        
        // Validate the line by replaying it to ensure all moves are valid
        if (data.line && data.line.length > 0) {
          const testChess = new Chess()
          for (const moveSan of data.line) {
            try {
              const testMove = testChess.move(moveSan)
              if (!testMove) {
                console.warn(`Warning: Move ${moveSan} in line is invalid`)
              }
            } catch (error) {
              console.warn(`Warning: Error validating move ${moveSan}:`, error)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching next line:', error)
      setError(error instanceof Error ? error.message : 'Failed to load line')
    } finally {
      setLoading(false)
    }
  }

  const getPieceName = (piece: string): string => {
    const pieceMap: { [key: string]: string } = {
      'P': 'Pawn',
      'R': 'Rook',
      'N': 'Knight',
      'B': 'Bishop',
      'Q': 'Queen',
      'K': 'King',
    }
    return pieceMap[piece] || 'Piece'
  }

  const parseMoveInfo = (moveSan: string, fen: string): MoveInfo | null => {
    try {
      const tempChess = new Chess(fen)
      const moves = tempChess.moves({ verbose: true })
      
      // Find the move that matches the SAN
      for (const move of moves) {
        if (move.san === moveSan || move.san.replace(/[+#]/g, '') === moveSan.replace(/[+#]/g, '')) {
          const piece = move.piece.toUpperCase()
          return {
            piece: getPieceName(piece),
            from: move.from,
            to: move.to,
            san: move.san,
          }
        }
      }
      
      // If not found, try to parse the SAN directly
      const move = tempChess.move(moveSan)
      if (move) {
        const piece = move.piece.toUpperCase()
        return {
          piece: getPieceName(piece),
          from: move.from,
          to: move.to,
          san: move.san,
        }
      }
    } catch (error) {
      console.error('Error parsing move:', error)
    }
    return null
  }

  const playOpponentMove = (moveSan: string, fromFen?: string) => {
    if (!lineData) return

    setIsOpponentMoving(true)
    setError(null)

    setTimeout(() => {
      try {
        // Use provided FEN or get from ref
        const currentFen = fromFen || chessRef.current.fen()
        const gameCopy = new Chess(currentFen)
        
        // Try to play the move - chess.js should handle SAN notation including captures
        let move
        try {
          move = gameCopy.move(moveSan)
        } catch (moveError) {
          // If SAN fails, try to find the move from available moves
          const availableMoves = gameCopy.moves({ verbose: true })
          const matchingMove = availableMoves.find(m => 
            m.san === moveSan || 
            m.san.replace(/[+#]/g, '') === moveSan.replace(/[+#]/g, '') ||
            (m.from + m.to) === moveSan.replace(/[^a-h1-8]/g, '')
          )
          
          if (matchingMove) {
            move = gameCopy.move({
              from: matchingMove.from,
              to: matchingMove.to,
              promotion: matchingMove.promotion,
            })
          } else {
            throw moveError
          }
        }
        
        if (!move) {
          console.error(`Failed to play opponent move: ${moveSan} from position:`, currentFen)
          console.error('Available moves:', gameCopy.moves())
          setIsOpponentMoving(false)
          setError(`Failed to play opponent move: ${moveSan}`)
          return
        }

        // Update both ref and state with the new position
        const newFen = gameCopy.fen()
        chessRef.current = new Chess(newFen)
        setChess(new Chess(newFen))
        
        // Use functional update to ensure we have the latest currentMoveIndex
        setCurrentMoveIndex((prevIndex) => {
          const nextIndex = prevIndex + 1
          
          // Check if line is complete
          if (nextIndex >= lineData.line.length) {
            markLineAsLearned()
            setLineCompleted(true)
            setShowSuccessModal(true)
          } else {
            setIsUserTurn(true) // Next move is user's turn (even index)
          }
          
          return nextIndex
        })
        
        setIsOpponentMoving(false)
      } catch (error) {
        console.error('Error playing opponent move:', error, moveSan, 'FEN:', chessRef.current.fen())
        console.error('Available moves:', new Chess(chessRef.current.fen()).moves())
        setIsOpponentMoving(false)
        setError(`Error playing opponent move: ${moveSan}. Please refresh and try again.`)
      }
    }, 800) // Delay for visual effect
  }

  // Async side effects after a correct move (progress save, opponent move, completion).
  // Fired from onDrop without awaiting so onDrop can stay synchronous.
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
    if (!lineData || lineData.completed || lineCompleted || !isUserTurn || isOpponentMoving) {
      return false
    }

    if (currentMoveIndex >= lineData.line.length) {
      return false
    }

    if (currentMoveIndex % 2 !== 0) {
      setError('Not your turn!')
      return false
    }

    try {
      const currentFen = chessRef.current.fen()
      const gameCopy = new Chess(currentFen)

      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })

      if (!move) {
        const expectedMove = lineData.line[currentMoveIndex]
        const moveInfo = parseMoveInfo(expectedMove, currentFen)
        if (moveInfo) {
          setError(`Invalid move. Move the ${moveInfo.piece} from ${moveInfo.from.toUpperCase()} to ${moveInfo.to.toUpperCase()}`)
        } else {
          setError(`Invalid move. The correct move is: ${expectedMove}`)
        }
        return false
      }

      const expectedMove = lineData.line[currentMoveIndex]
      const normalizedUserMove = move.san.replace(/[+#x]/g, '').trim()
      const normalizedExpectedMove = expectedMove.replace(/[+#x]/g, '').trim()

      if (normalizedUserMove !== normalizedExpectedMove) {
        const moveInfo = parseMoveInfo(expectedMove, currentFen)
        if (moveInfo) {
          setError(`Incorrect! Move the ${moveInfo.piece} from ${moveInfo.from.toUpperCase()} to ${moveInfo.to.toUpperCase()}`)
        } else {
          setError(`Incorrect! The correct move is: ${expectedMove}`)
        }
        return false
      }

      setError(null)
      const newFen = gameCopy.fen()
      chessRef.current = new Chess(newFen)
      setChess(new Chess(newFen))
      setUserMoves((prev) => [...prev, move.san])
      const nextIndex = currentMoveIndex + 1

      handleCorrectMoveAsync(nextIndex, newFen, move.san)
      return true
    } catch {
      const expectedMove = lineData?.line[currentMoveIndex]
      const moveInfo = expectedMove ? parseMoveInfo(expectedMove, chessRef.current.fen()) : null
      if (moveInfo) {
        setError(`Invalid move. Move the ${moveInfo.piece} to ${moveInfo.to.toUpperCase()}`)
      } else {
        setError('Invalid move')
      }
      return false
    }
  }

  const markLineAsLearned = async () => {
    if (!lineData || !lineData.line) return

    try {
      const response = await fetch(`/api/openings/${openingId}/mark-learned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: lineData.line }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to mark line as learned')
      }

      const data = await response.json()
      console.log(`Successfully marked ${data.nodesLearned} nodes as learned`)
    } catch (error) {
      console.error('Error marking line as learned:', error)
    }
  }

  const handleNextVariation = async () => {
    setShowSuccessModal(false)
    // Small delay to ensure the database update has propagated
    await new Promise(resolve => setTimeout(resolve, 100))
    fetchNextLine()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#7fa650] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error && !lineData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center">
        <div className="bg-[#2d2d2d] rounded-lg shadow-lg p-8 max-w-md border border-[#3d3d3d]">
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={() => router.push('/learn')}
            className="w-full bg-[#7fa650] text-white py-2 rounded-lg hover:bg-[#6d8f42] transition-colors"
          >
            Back to Openings
          </button>
        </div>
      </div>
    )
  }

  if (lineData?.completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-[#2d2d2d] rounded-lg shadow-lg p-8 text-center border border-[#3d3d3d]">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-white mb-4">
              Congratulations!
            </h1>
            <p className="text-gray-300 mb-6">
              You've learned all variations of {lineData.openingName}!
            </p>
            <button
              onClick={() => router.push('/learn')}
              className="px-6 py-3 bg-[#7fa650] text-white rounded-lg hover:bg-[#6d8f42] transition-colors font-medium"
            >
              Learn Another Opening
            </button>
          </div>
        </div>
      </div>
    )
  }

  const expectedMove = lineData?.line[currentMoveIndex]
  const moveInfo = expectedMove ? parseMoveInfo(expectedMove, chessRef.current.fen()) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-[#2d2d2d] rounded-lg shadow-lg p-6 mb-6 border border-[#3d3d3d]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {lineData?.openingName || 'Loading...'}
              </h1>
              {lineData && (
                <p className="text-lg text-gray-300">
                  Line {lineData.lineNumber}: {lineData.description}
                </p>
              )}
            </div>
            <button
              onClick={() => router.push('/learn')}
              className="px-4 py-2 bg-[#3d3d3d] text-gray-300 rounded-lg hover:bg-[#4d4d4d] transition-colors"
            >
              Back
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
            <div className="font-semibold">{error}</div>
            {moveInfo && (
              <div className="text-sm mt-2 opacity-90">
                Hint: Move the <strong>{moveInfo.piece}</strong> from <strong>{moveInfo.from.toUpperCase()}</strong> to <strong>{moveInfo.to.toUpperCase()}</strong>
              </div>
            )}
          </div>
        )}

        {/* Turn Indicator */}
        {lineData && (
          <div className="bg-[#2d2d2d] rounded-lg shadow-lg p-6 mb-6 border border-[#3d3d3d]">
            <div className="text-center">
              {isOpponentMoving ? (
                <div className="text-lg font-semibold text-gray-400">
                  Opponent is thinking...
                </div>
              ) : isUserTurn ? (
                <div className="text-lg font-semibold text-[#7fa650]">
                  Your turn! {moveInfo && `Move the ${moveInfo.piece} to ${moveInfo.to.toUpperCase()}`}
                </div>
              ) : (
                <div className="text-lg font-semibold text-gray-400">
                  Waiting for opponent...
                </div>
              )}
              <div className="text-sm text-gray-500 mt-2">
                Move {currentMoveIndex + 1} of {lineData.line.length}
              </div>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        {lineData && (
          <div className="bg-[#2d2d2d] rounded-lg shadow-lg p-4 mb-6 border border-[#3d3d3d]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-400">Progress</span>
              <span className="text-sm font-semibold text-gray-300">
                {currentMoveIndex} / {lineData.line.length} moves
              </span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-3">
              <div
                className="h-full bg-gradient-to-r from-[#7fa650] to-[#5d7e3a] transition-all duration-300"
                style={{ width: `${(currentMoveIndex / lineData.line.length) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Chess Board */}
        <div className="bg-[#2d2d2d] rounded-lg shadow-lg p-8 mb-6 border border-[#3d3d3d]">
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <Chessboard
                position={chess.fen()}
                onPieceDrop={onDrop}
                boardOrientation="white"
                arePiecesDraggable={!!(!lineCompleted && isUserTurn && !isOpponentMoving && lineData && currentMoveIndex < lineData.line.length)}
                customPieces={getCustomPieces(userPreferences?.pieceSet || 'caliente')}
                customDarkSquareStyle={getCustomSquareStyles(userPreferences?.boardStyle || 'canvas2').dark}
                customLightSquareStyle={getCustomSquareStyles(userPreferences?.boardStyle || 'canvas2').light}
                customBoardStyle={{
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-[#2d2d2d] rounded-lg p-8 max-w-md w-full mx-4 shadow-xl border border-[#3d3d3d]">
              <div className="text-center">
                <div className="inline-block w-16 h-16 bg-gradient-to-br from-[#7fa650] to-[#5d7e3a] rounded-full flex items-center justify-center mb-4">
                  <span className="text-white text-3xl">✓</span>
                </div>
                <h2 className="text-3xl font-bold mb-2 text-white">
                  Success!
                </h2>
                <p className="text-gray-300 mb-6">
                  Line {lineData?.lineNumber} learned! 🎉
                </p>
                <button
                  onClick={handleNextVariation}
                  className="w-full bg-[#7fa650] text-white py-3 rounded-lg hover:bg-[#6d8f42] transition-colors font-medium"
                >
                  Learn Next Variation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
