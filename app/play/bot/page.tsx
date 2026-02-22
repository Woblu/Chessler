'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import CustomBoard from '@/components/CustomBoard'
import { Chess } from 'chess.js'
import { useStockfish } from '@/hooks/useStockfish'
import { BOT_PROFILES, BotProfile, setEngineDifficulty } from '@/lib/bots'
import PlayerHeader from '@/components/PlayerHeader'
import GameControlPanel from '@/components/GameControlPanel'
import EvalBar from '@/components/EvalBar'
import { processTournamentWin } from '@/actions/tournament'

interface GameOverModalProps {
  isOpen: boolean
  result: 'win' | 'loss' | 'draw'
  botName: string
  onClose: () => void
  onNewGame: () => void
}

function GameOverModal({
  isOpen,
  result,
  botName,
  onClose,
  onNewGame,
}: GameOverModalProps) {
  if (!isOpen) return null

  const getResultMessage = () => {
    switch (result) {
      case 'win':
        return { message: 'You Won! 🎉', points: '1.0 point' }
      case 'loss':
        return { message: 'You Lost', points: '0.0 points' }
      case 'draw':
        return { message: 'Draw', points: '0.5 points' }
    }
  }

  const { message, points } = getResultMessage()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-chess-card border-2 border-chess-border rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">
          Game Over
        </h2>
        <div className="text-center mb-6">
          <p className="text-xl text-white mb-2">{message}</p>
          <p className="text-slate-300">Against: {botName}</p>
          <p className="text-slate-300 mt-2">Points: {points}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onNewGame}
            className="flex-1 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold py-2 px-4 rounded transition-colors"
          >
            New Game
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function PlayBotPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nodeId = searchParams.get('nodeId')
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null)
  const [tournamentNode, setTournamentNode] = useState<{ id: string; botName: string; botElo: number; roundName: string } | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [chess, setChess] = useState(new Chess())
  const [userColor, setUserColor] = useState<'white' | 'black'>('white')
  const [gameOver, setGameOver] = useState(false)
  const [gameResult, setGameResult] = useState<'win' | 'loss' | 'draw' | null>(null)
  const [showGameOverModal, setShowGameOverModal] = useState(false)
  const [gameId, setGameId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<{ name: string; rank: string; currentPoints: number; pieceSet: string; boardStyle: string } | null>(null)
  const [equippedBoardUrl, setEquippedBoardUrl] = useState<string | null>(null)
  const [equippedPieceSet, setEquippedPieceSet] = useState<string | null>(null)
  const [capturedWhitePieces, setCapturedWhitePieces] = useState<string[]>([])
  const [capturedBlackPieces, setCapturedBlackPieces] = useState<string[]>([])
  const [whiteTime, setWhiteTime] = useState(600) // 10 minutes in seconds
  const [blackTime, setBlackTime] = useState(600)
  const [gameStartTime, setGameStartTime] = useState<number | null>(null)
  const [displayFen, setDisplayFen] = useState(chess.fen()) // For navigation without affecting game state

  const { isReady, isThinking, sendCommand, getBestMove, getEvaluation, error: stockfishError } = useStockfish()
  const [currentEvaluation, setCurrentEvaluation] = useState<{ score: number; isMate: boolean; mateIn: number | null } | null>(null)
  const chessRef = useRef(chess)
  const botMoveInProgressRef = useRef(false)
  const previousFenRef = useRef(chess.fen())

  // Fetch equipped cosmetics
  useEffect(() => {
    const fetchEquippedCosmetics = async () => {
      try {
        const response = await fetch('/api/user/equipped-cosmetics')
        if (response.ok) {
          const data = await response.json()
          setEquippedBoardUrl(data.boardUrl)
          setEquippedPieceSet(data.pieceSet)
        }
      } catch (error) {
        console.error('Error fetching equipped cosmetics:', error)
      }
    }
    fetchEquippedCosmetics()
  }, [])

  // Update ref when chess state changes
  useEffect(() => {
    chessRef.current = chess
    // Sync display FEN with actual game state when not navigating
    setDisplayFen(chess.fen())
  }, [chess])

  // Update evaluation when position changes
  useEffect(() => {
    if (gameStarted && isReady && !isThinking && selectedBot) {
      // Get evaluation for current position
      getEvaluation(displayFen, Math.min(selectedBot.depth, 10)) // Limit depth for faster evaluation
        .then((evaluation) => {
          if (evaluation) {
            setCurrentEvaluation(evaluation)
          }
        })
        .catch((error) => {
          console.error('Error getting evaluation:', error)
        })
    }
  }, [displayFen, gameStarted, isReady, isThinking, selectedBot, getEvaluation])

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.user && data.user.id) {
            setUserId(data.user.id)
            setUserInfo({
              name: data.user.name,
              rank: data.user.rank,
              currentPoints: data.user.currentPoints,
              pieceSet: data.user.pieceSet || 'caliente',
              boardStyle: data.user.boardStyle || 'canvas2',
            })
            
            // User preferences are now handled via equipped cosmetics
          } else {
            console.error('Invalid user data:', data)
            router.push('/login')
          }
        } else {
          router.push('/login')
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        router.push('/login')
      }
    }
    fetchUser()
  }, [router])

  // Fetch tournament node if nodeId is present
  useEffect(() => {
    if (nodeId && userId) {
      const fetchTournamentNode = async () => {
        try {
          // We need to find which region this node belongs to first
          // For now, we'll fetch it from a new API endpoint or include it in the node data
          const response = await fetch(`/api/campaign/tournament-node/${nodeId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.node) {
              setTournamentNode({
                id: data.node.id,
                botName: data.node.botName,
                botElo: data.node.botElo,
                roundName: data.node.roundName,
              })
              
              // Create a bot profile from the tournament node
              const botProfile: BotProfile = {
                id: data.node.id,
                name: data.node.botName,
                elo: data.node.botElo,
                depth: Math.min(Math.max(Math.floor(data.node.botElo / 200), 1), 15),
                skillLevel: data.node.botElo < 1200 ? 1 : data.node.botElo < 2000 ? 5 : 15,
                description: `Tournament opponent (${data.node.botElo} ELO)`,
              }
              setSelectedBot(botProfile)
            }
          }
        } catch (error) {
          console.error('Error fetching tournament node:', error)
        }
      }
      fetchTournamentNode()
    }
  }, [nodeId, userId])

  // Auto-start game when tournament bot is selected
  useEffect(() => {
    if (tournamentNode && selectedBot && !gameStarted && userId) {
      const timer = setTimeout(() => {
        if (selectedBot) {
          const newChess = new Chess()
          setChess(newChess)
          previousFenRef.current = newChess.fen()
          setGameStarted(true)
          setGameOver(false)
          setGameResult(null)
          setShowGameOverModal(false)
          setUserColor('white')
          setCapturedWhitePieces([])
          setCapturedBlackPieces([])
          setWhiteTime(600)
          setBlackTime(600)
          setGameStartTime(Date.now())
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [tournamentNode, selectedBot, gameStarted, userId])

  // Track captured pieces by analyzing move history
  useEffect(() => {
    const history = chess.history({ verbose: true })
    if (history.length === 0) {
      setCapturedWhitePieces([])
      setCapturedBlackPieces([])
      return
    }

    const whiteCaptures: string[] = []
    const blackCaptures: string[] = []

    history.forEach((move) => {
      if (move.captured) {
        const pieceNotation = move.captured.toLowerCase()
        if (move.color === 'w') {
          whiteCaptures.push(pieceNotation)
        } else {
          blackCaptures.push(pieceNotation)
        }
      }
    })

    setCapturedWhitePieces(whiteCaptures)
    setCapturedBlackPieces(blackCaptures)
  }, [chess])

  // Set engine difficulty when bot is selected and engine is ready
  useEffect(() => {
    if (selectedBot && isReady && gameStarted) {
      setEngineDifficulty(sendCommand, selectedBot)
    }
  }, [selectedBot, isReady, gameStarted, sendCommand])

  // Handle bot's turn
  useEffect(() => {
    // Only proceed if game is active and engine is ready
    if (!gameStarted || gameOver || !isReady || isThinking || !selectedBot || botMoveInProgressRef.current) {
      return
    }

    // Check if it's the bot's turn
    const currentTurn = chessRef.current.turn()
    const isUserTurn = currentTurn === (userColor === 'white' ? 'w' : 'b')

    if (isUserTurn) {
      return // It's the user's turn, don't make bot move
    }

    // It's the bot's turn - get the best move
    botMoveInProgressRef.current = true
    const currentFen = chessRef.current.fen()
    const botDepth = selectedBot.depth

    console.log('Bot turn detected, requesting move from Stockfish...', { currentFen, botDepth })

    getBestMove(currentFen, botDepth)
      .then((bestMove) => {
        botMoveInProgressRef.current = false

        // Double-check conditions before applying move
        if (!bestMove) {
          console.warn('No move returned from Stockfish')
          return
        }

        if (gameOver || !gameStarted) {
          return
        }

        // Verify it's still the bot's turn
        if (chessRef.current.turn() === (userColor === 'white' ? 'w' : 'b')) {
          console.warn('Turn changed while Stockfish was thinking, ignoring move')
          return
        }

        try {
          const gameCopy = new Chess(chessRef.current.fen())
          // Parse UCI move (e.g., "e2e4" or "e7e8q")
          const from = bestMove.substring(0, 2)
          const to = bestMove.substring(2, 4)
          const promotion = bestMove.length > 4 ? bestMove[4] : undefined
          
          const move = gameCopy.move({
            from,
            to,
            promotion: promotion || 'q',
          })

          if (move) {
            console.log('Bot move applied:', move.san, 'from', bestMove)
            setChess(gameCopy)
            checkGameOver(gameCopy)
          } else {
            console.error('Invalid move from Stockfish:', bestMove, 'Available moves:', gameCopy.moves())
          }
        } catch (error) {
          console.error('Error applying bot move:', error, bestMove)
        }
      })
      .catch((error) => {
        botMoveInProgressRef.current = false
        console.error('Error getting best move:', error)
      })
  }, [gameStarted, gameOver, isReady, isThinking, userColor, selectedBot, getBestMove, chess])

  const checkGameOver = (game: Chess) => {
    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'black' : 'white'
      const userWon = winner === (userColor === 'white' ? 'white' : 'black')
      setGameOver(true)
      setGameResult(userWon ? 'win' : 'loss')
      setShowGameOverModal(true)
      saveGameResult(userWon ? 'win' : 'loss')
    } else if (game.isDraw() || game.isStalemate()) {
      setGameOver(true)
      setGameResult('draw')
      setShowGameOverModal(true)
      saveGameResult('draw')
    }
  }

  const saveGameResult = async (result: 'win' | 'loss' | 'draw') => {
    if (!userId || !selectedBot) return

    try {
      // If this is a tournament match, process the tournament win
      if (tournamentNode && result === 'win') {
        const tournamentResult = await processTournamentWin(userId, tournamentNode.id)
        if (tournamentResult.success) {
          console.log('Tournament win processed:', tournamentResult)
          
          // If a region was unlocked, redirect to campaign with animation
          if (tournamentResult.regionUnlocked || tournamentResult.unlocked_new_region) {
            // Store the region that was just completed (before unlocking the new one)
            // We need to get the region ID from the tournament node's region
            const regionResponse = await fetch('/api/campaign/regions')
            if (regionResponse.ok) {
              const regionData = await regionResponse.json()
              const regions = regionData.regions || []
              const currentRegionIndex = regions.findIndex((r: any) => r.id === regionData.currentRegionId)
              // Previous region is the one before the new current region
              if (currentRegionIndex > 0) {
                const previousRegion = regions[currentRegionIndex - 1]
                sessionStorage.setItem('previousRegionId', previousRegion.id)
              }
            }
            
            // Redirect to campaign page with unlock flag
            setTimeout(() => {
              router.push('/campaign?unlocked=true')
            }, 2000)
            return
          }
        }
      }

      // Save regular bot game result
      const response = await fetch('/api/games/create-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          result,
          botName: selectedBot.name,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Game saved:', data.message)
      } else {
        const error = await response.json()
        console.error('Error saving game:', error)
      }
    } catch (error) {
      console.error('Error saving game result:', error)
    }
  }

  const startGame = () => {
    if (!selectedBot) return
    
    const newChess = new Chess()
    setChess(newChess)
    previousFenRef.current = newChess.fen()
    setGameStarted(true)
    setGameOver(false)
    setGameResult(null)
    setShowGameOverModal(false)
    setUserColor('white') // User always plays white
    setCapturedWhitePieces([])
    setCapturedBlackPieces([])
    setWhiteTime(600) // Reset to 10 minutes
    setBlackTime(600)
    setGameStartTime(Date.now())
    previousFenRef.current = newChess.fen()

    // User goes first, so no need to make bot move immediately
  }

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (gameOver || isThinking || chessRef.current.turn() !== (userColor === 'white' ? 'w' : 'b')) {
      return false
    }

    try {
      const gameCopy = new Chess(chessRef.current.fen())
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })

      if (!move) {
        return false
      }

      // Update timer - user (white) just moved, so their timer stops
      // Timer will continue when bot moves
      setChess(gameCopy)
      checkGameOver(gameCopy)
      return true
    } catch (error) {
      return false
    }
  }

  const handleNewGame = () => {
    setShowGameOverModal(false)
    setGameStarted(false)
    setGameOver(false)
    setGameResult(null)
    setSelectedBot(null)
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="text-slate-200">Loading...</div>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-chess-bg p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8 text-center">
            Play Against Bots
          </h1>

          {!isReady && (
            <div className="bg-chess-card border border-chess-border rounded-lg p-4 mb-6">
              <p className="text-slate-200 text-center">
                Initializing chess engine...
              </p>
            </div>
          )}

          {stockfishError && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
              <p className="text-red-200 text-center">
                Error: {stockfishError}. Make sure stockfish.js is in the /public directory.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BOT_PROFILES.map((bot) => (
              <button
                key={bot.id}
                onClick={() => setSelectedBot(bot)}
                disabled={!isReady}
                className={`p-6 rounded-lg border-2 transition-all ${
                  selectedBot?.id === bot.id
                    ? 'border-pawn-gold bg-pawn-gold/20'
                    : 'border-chess-border bg-chess-card hover:border-slate-500'
                } ${!isReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <h3 className="text-xl font-bold text-white mb-2">
                  {bot.name}
                </h3>
                <p className="text-slate-300 text-sm mb-4">{bot.description}</p>
                <div className="text-slate-400 text-xs">
                  {bot.elo ? `ELO: ${bot.elo}` : `Skill: ${bot.skillLevel}`} • Depth: {bot.depth}
                </div>
              </button>
            ))}
          </div>

          {selectedBot && isReady && (
            <div className="mt-8 text-center">
              <button
                onClick={startGame}
                className="bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold py-3 px-8 rounded-lg text-lg transition-colors"
              >
                Start Game
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-chess-bg p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">
            Playing against {selectedBot?.name}
          </h1>
          <button
            onClick={() => {
              setGameStarted(false)
              setGameOver(false)
              setSelectedBot(null)
            }}
            className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Back to Selection
          </button>
        </div>

        {/* 2-Column Layout: Board (8 cols) + Sidebar (4 cols) */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column: Board Area */}
          <div className="col-span-12 md:col-span-8">
            <div className="bg-chess-card border-2 border-chess-border rounded-lg p-6">
              {/* Top Player Header (Bot - Black) */}
              <div className="mb-4">
                <PlayerHeader
                  playerName={selectedBot?.name || 'Bot'}
                  rank="AI"
                  capturedPieces={capturedBlackPieces}
                  isActive={chess.turn() === 'b' && !gameOver}
                  timeLeft={blackTime}
                  pieceSet={userInfo?.pieceSet || 'caliente'}
                  onTimeUp={() => {
                    setGameOver(true)
                    setGameResult('win')
                    setShowGameOverModal(true)
                    saveGameResult('win')
                  }}
                />
              </div>

              {/* Chess Board with Eval Bar */}
              <div className="flex items-center justify-center mb-4 gap-2">
                {/* Evaluation Bar */}
                {gameStarted && isReady && (
                  <EvalBar
                    evaluation={currentEvaluation?.score || null}
                    isMate={currentEvaluation?.isMate}
                    mateIn={currentEvaluation?.mateIn || null}
                  />
                )}
                
                {/* Chess Board */}
                <div className="w-full max-w-md">
                  <CustomBoard
                    position={displayFen}
                    onPieceDrop={onDrop}
                    arePiecesDraggable={!isThinking && !gameOver && chess.turn() === (userColor === 'white' ? 'w' : 'b')}
                    boardOrientation={userColor}
                    equippedBoardUrl={equippedBoardUrl}
                    equippedPieceSet={equippedPieceSet}
                    customBoardStyle={{
                      borderRadius: '4px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                    }}
                  />
                </div>
              </div>

              {/* Bottom Player Header (User - White) */}
              <div className="mt-4">
                <PlayerHeader
                  playerName={userInfo?.name || 'You'}
                  rank={userInfo?.rank}
                  points={userInfo?.currentPoints}
                  capturedPieces={capturedWhitePieces}
                  isActive={chess.turn() === 'w' && !gameOver}
                  timeLeft={whiteTime}
                  pieceSet={userInfo?.pieceSet || 'caliente'}
                  onTimeUp={() => {
                    setGameOver(true)
                    setGameResult('loss')
                    setShowGameOverModal(true)
                    saveGameResult('loss')
                  }}
                />
              </div>

              {/* Game Status */}
              <div className="text-center mt-4">
                {gameOver ? (
                  <p className="text-white text-lg font-semibold">Game Over</p>
                ) : isThinking ? (
                  <p className="text-slate-200 mb-2">{selectedBot?.name} is thinking...</p>
                ) : chess.isCheck() ? (
                  <p className="text-pawn-gold font-semibold">Check!</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Column: Control Panel Sidebar */}
          <div className="col-span-12 md:col-span-4">
            <div className="bg-chess-card border-2 border-chess-border rounded-lg h-full min-h-[600px]">
              <GameControlPanel
                chess={chess}
                onPositionChange={(fen) => setDisplayFen(fen)}
                onResign={() => {
                  if (confirm('Are you sure you want to resign?')) {
                    setGameOver(true)
                    setGameResult('loss')
                    setShowGameOverModal(true)
                    saveGameResult('loss')
                  }
                }}
                onDrawOffer={() => {
                  // For bot games, we'll auto-accept draw offers
                  if (confirm('Offer a draw? The bot will accept.')) {
                    setGameOver(true)
                    setGameResult('draw')
                    setShowGameOverModal(true)
                    saveGameResult('draw')
                  }
                }}
                isGameActive={gameStarted && !gameOver}
              />
            </div>
          </div>
        </div>

        <GameOverModal
          isOpen={showGameOverModal}
          result={gameResult || 'draw'}
          botName={selectedBot?.name || 'Bot'}
          onClose={() => setShowGameOverModal(false)}
          onNewGame={handleNewGame}
        />
      </div>
    </div>
  )
}

export default function PlayBotPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#7fa650] border-t-transparent rounded-full animate-spin"></div></div>}>
      <PlayBotPageInner />
    </Suspense>
  )
}
