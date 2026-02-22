'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CustomBoard from '@/components/CustomBoard'
import { Chessboard } from 'react-chessboard'
import { getCustomPieces, getCustomSquareStyles } from '@/lib/chess-customization'
import { Chess } from 'chess.js'
import { io, Socket } from 'socket.io-client'

interface GameState {
  fen: string
  currentTurn: 'w' | 'b'
  gameOver: boolean
  result?: string
  yourColor?: 'white' | 'black'
  whitePlayer?: string
  blackPlayer?: string
}

interface GameOverModalProps {
  isOpen: boolean
  result: string
  yourColor: 'white' | 'black'
  whitePlayer: string
  blackPlayer: string
  onClose: () => void
}

function GameOverModal({
  isOpen,
  result,
  yourColor,
  whitePlayer,
  blackPlayer,
  onClose,
}: GameOverModalProps) {
  if (!isOpen) return null

  const getResultMessage = () => {
    if (result === 'WHITE_WIN') {
      if (yourColor === 'white') {
        return { message: 'You Won! 🎉', points: '1.0 point', bonus: 'Bonus points may apply if you beat a higher-ranked player!' }
      } else {
        return { message: 'You Lost', points: '0.0 points', bonus: '' }
      }
    } else if (result === 'BLACK_WIN') {
      if (yourColor === 'black') {
        return { message: 'You Won! 🎉', points: '1.0 point', bonus: 'Bonus points may apply if you beat a higher-ranked player!' }
      } else {
        return { message: 'You Lost', points: '0.0 points', bonus: '' }
      }
    } else {
      return { message: 'Draw', points: '0.5 points', bonus: '' }
    }
  }

  const resultInfo = getResultMessage()
  const isWin = resultInfo.message.includes('Won')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-[#2d2d2d] rounded-lg p-8 max-w-md w-full mx-4 shadow-xl border border-[#3d3d3d]">
        <div className="text-center mb-6">
          <div className="inline-block w-16 h-16 bg-gradient-to-br from-[#7fa650] to-[#5d7e3a] rounded-full flex items-center justify-center mb-4">
            <span className="text-white text-3xl">♔</span>
          </div>
          <h2 className="text-3xl font-bold mb-2 text-white">
            Game Over
          </h2>
        </div>
        <div className="text-center mb-6">
          <div className={`text-2xl font-semibold mb-2 ${isWin ? 'text-[#7fa650]' : 'text-gray-300'}`}>
            {resultInfo.message}
          </div>
          <div className="bg-gradient-to-br from-[#7fa650] to-[#5d7e3a] text-white rounded-lg p-4 mb-4">
            <div className="text-sm opacity-90 mb-1">Points Awarded</div>
            <div className="text-2xl font-bold">{resultInfo.points}</div>
          </div>
          {resultInfo.bonus && (
            <div className="text-sm text-[#7fa650] mt-2 bg-[#1a1a1a] p-2 rounded border border-[#3d3d3d]">
              {resultInfo.bonus}
            </div>
          )}
          <div className="border-t border-[#3d3d3d] pt-4 mt-4">
            <div className="text-sm text-gray-300">
              <div className="font-medium mb-1">Players:</div>
              <div>White: {whitePlayer}</div>
              <div>Black: {blackPlayer}</div>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-[#7fa650] text-white py-3 rounded-lg hover:bg-[#6d8f42] transition-colors font-medium"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default function PlayPage() {
  const params = useParams()
  const router = useRouter()
  const gameId = params.gameId as string
  const [socket, setSocket] = useState<Socket | null>(null)
  const [game, setGame] = useState(new Chess())
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showGameOver, setShowGameOver] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userPreferences, setUserPreferences] = useState<{ pieceSet: string; boardStyle: string } | null>(null)
  const gameRef = useRef(new Chess())

  // Fetch authenticated user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (!response.ok) {
          router.push('/login')
          return
        }
        const data = await response.json()
        setUser(data.user)
        // Set user preferences for chess customization
        if (data.user) {
          setUserPreferences({
            pieceSet: data.user.pieceSet || 'caliente',
            boardStyle: data.user.boardStyle || 'canvas2',
          })
        }
      } catch (error) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [router])

  useEffect(() => {
    if (!user) return

    // Initialize socket connection
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket'],
    })

    newSocket.on('connect', () => {
      console.log('Connected to server')
      setSocket(newSocket)
      // Auto-join game when connected
      newSocket.emit('join_game', { gameId, playerId: user.id })
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server')
    })

    newSocket.on('error', (data: { message: string }) => {
      setError(data.message)
    })

    newSocket.on('game_state', (data: GameState) => {
      setGameState(data)
      gameRef.current = new Chess(data.fen)
      setGame(new Chess(data.fen))
    })

    newSocket.on('move_made', (data: {
      from: string
      to: string
      fen: string
      currentTurn: 'w' | 'b'
      gameOver: boolean
      result?: string
    }) => {
      gameRef.current = new Chess(data.fen)
      setGame(new Chess(data.fen))
      setGameState((prev) => ({
        ...prev!,
        fen: data.fen,
        currentTurn: data.currentTurn,
        gameOver: data.gameOver,
        result: data.result,
      }))
    })

    newSocket.on('game_over', (data: { result: string; fen: string }) => {
      setGameState((prev) => ({
        ...prev!,
        gameOver: true,
        result: data.result,
      }))
      setShowGameOver(true)
    })

    return () => {
      newSocket.close()
    }
  }, [user, gameId])

  function onDrop(sourceSquare: string, targetSquare: string, _piece: string): boolean {
    if (!socket || !gameState) return false

    // Check if it's the player's turn
    const isPlayerTurn =
      (gameState.currentTurn === 'w' && gameState.yourColor === 'white') ||
      (gameState.currentTurn === 'b' && gameState.yourColor === 'black')

    if (!isPlayerTurn) {
      setError('Not your turn!')
      return false
    }

    if (gameState.gameOver) {
      setError('Game is over!')
      return false
    }

    // Try to make the move locally first
    const gameCopy = new Chess(gameRef.current.fen())
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    })

    if (!move) {
      setError('Invalid move')
      return false
    }

    // Send move to server
    socket.emit('make_move', {
      from: sourceSquare,
      to: targetSquare,
    })

    setError(null)
    return true
  }

  const isPlayerTurn =
    gameState &&
    ((gameState.currentTurn === 'w' && gameState.yourColor === 'white') ||
      (gameState.currentTurn === 'b' && gameState.yourColor === 'black'))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#7fa650] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Chess Game</h1>
          <p className="text-gray-300">Game ID: {gameId}</p>
        </div>

        {!gameState && (
          <div className="bg-[#2d2d2d] rounded-lg shadow-lg p-8 max-w-md mx-auto text-center border border-[#3d3d3d]">
            <div className="w-16 h-16 bg-[#7fa650] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-3xl">♔</span>
            </div>
            <div className="text-lg font-semibold text-white mb-2">Connecting to game...</div>
            <div className="text-sm text-gray-400">Please wait while we join the game</div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6 max-w-md mx-auto">
            {error}
          </div>
        )}

        {gameState && (
          <div className="bg-[#2d2d2d] rounded-lg shadow-lg p-8 border border-[#3d3d3d]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-[#1a1a1a] rounded-lg border border-[#3d3d3d]">
                <div className="text-sm text-gray-300 mb-2 font-medium">White Player</div>
                <div className="text-lg font-bold text-white">
                  {gameState.whitePlayer}
                </div>
                {gameState.yourColor === 'white' && (
                  <div className="mt-2 text-xs text-[#7fa650] font-semibold">(You)</div>
                )}
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-[#7fa650] to-[#5d7e3a] rounded-lg text-white">
                <div className="text-sm opacity-90 mb-2">Current Turn</div>
                <div className="text-xl font-bold">
                  {gameState.currentTurn === 'w' ? 'White' : 'Black'}
                </div>
                {isPlayerTurn && (
                  <div className="mt-2 text-sm bg-white/20 rounded px-2 py-1 inline-block">
                    Your turn!
                  </div>
                )}
              </div>
              <div className="text-center p-4 bg-[#1a1a1a] rounded-lg border border-[#3d3d3d]">
                <div className="text-sm text-gray-300 mb-2 font-medium">Black Player</div>
                <div className="text-lg font-bold text-white">
                  {gameState.blackPlayer}
                </div>
                {gameState.yourColor === 'black' && (
                  <div className="mt-2 text-xs text-[#7fa650] font-semibold">(You)</div>
                )}
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <div className="w-full max-w-2xl bg-[#1a1a1a] p-4 rounded-lg border border-[#3d3d3d]">
                <Chessboard
                  position={gameState.fen}
                  onPieceDrop={onDrop}
                  boardOrientation={
                    gameState.yourColor === 'black' ? 'black' : 'white'
                  }
                  arePiecesDraggable={!!(isPlayerTurn && !gameState.gameOver)}
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

            {gameState.gameOver && !showGameOver && (
              <div className="text-center p-4 bg-gradient-to-br from-[#7fa650] to-[#5d7e3a] text-white rounded-lg">
                <div className="text-xl font-semibold">
                  Game Over - {gameState.result === 'WHITE_WIN' ? 'White Wins' : gameState.result === 'BLACK_WIN' ? 'Black Wins' : 'Draw'}
                </div>
              </div>
            )}
          </div>
        )}

        <GameOverModal
          isOpen={showGameOver}
          result={gameState?.result || ''}
          yourColor={gameState?.yourColor || 'white'}
          whitePlayer={gameState?.whitePlayer || ''}
          blackPlayer={gameState?.blackPlayer || ''}
          onClose={() => setShowGameOver(false)}
        />
      </div>
    </div>
  )
}
