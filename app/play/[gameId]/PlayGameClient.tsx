'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Chess } from 'chess.js'
import { motion } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { Wifi, WifiOff, Handshake, X, Check } from 'lucide-react'

import CustomBoard  from '@/components/CustomBoard'
import PlayerHeader from '@/components/PlayerHeader'
import dynamic from 'next/dynamic'

const GameControlPanel = dynamic(() => import('@/components/GameControlPanel'))
const EvalBar          = dynamic(() => import('@/components/EvalBar'))
const VictoryModal     = dynamic(() => import('@/components/VictoryModal'))

import { useStockfish }    from '@/hooks/useStockfish'
import { useChessSound }   from '@/hooks/useChessSound'
import { useGameAnalysis } from '@/hooks/useGameAnalysis'
import { usePremove }      from '@/hooks/usePremove'
import { useShake }        from '@/hooks/useShake'
import { useDbUser }       from '@/app/context/UserContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerInfo { id: string; name: string; rank?: string; rating?: number }

interface ServerGameState {
  fen: string
  currentTurn: 'w' | 'b'
  gameOver: boolean
  result: string | null
  yourColor: 'white' | 'black'
  whitePlayer: PlayerInfo
  blackPlayer: PlayerInfo
  whiteTimeMs: number
  blackTimeMs: number
  increment: number
  moves: string[]
}

interface MoveMadeEvent {
  from: string; to: string; san: string; fen: string
  currentTurn: 'w' | 'b'
  whiteTimeMs: number; blackTimeMs: number
  gameOver: boolean; result: string | null
  isCheck: boolean
}

interface GameOverEvent {
  result: string
  reason: 'checkmate' | 'resign' | 'timeout' | 'abandonment' | 'agreement'
  fen: string
  whiteTimeMs: number; blackTimeMs: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  checkmate:   'by Checkmate',
  resign:      'by Resignation',
  timeout:     'on Time',
  abandonment: '— Opponent abandoned',
  agreement:   'by Agreement',
}

function msToSec(ms: number) { return ms === -1 ? undefined : Math.round(ms / 1000) }

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { gameId: string }

export default function PlayGameClient({ gameId }: Props) {
  const router        = useRouter()
  const { dbUser, setDbUser } = useDbUser()
  const { isReady, getEvaluation } = useStockfish()
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound()
  const { isAnalyzing, progress: analysisProgress, result: analysisResult, analyze } = useGameAnalysis()
  const { premove, premoveFrom, handlePremoveClick, attemptPremove, clearPremove, premoveStyles } = usePremove()
  const { shakeControls, triggerShake } = useShake()

  // ── Socket ────────────────────────────────────────────────────────────────
  const socketRef     = useRef<Socket | null>(null)
  const [connected, setConnected]       = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  // ── Game state ────────────────────────────────────────────────────────────
  const [chess, setChess]           = useState(new Chess())
  const chessRef                    = useRef(chess)
  const [serverState, setServerState] = useState<ServerGameState | null>(null)
  const [displayFen, setDisplayFen] = useState(new Chess().fen())

  // Clocks (seconds; undefined = unlimited)
  const [whiteTimeSec, setWhiteTimeSec] = useState<number | undefined>(undefined)
  const [blackTimeSec, setBlackTimeSec] = useState<number | undefined>(undefined)
  const [increment, setIncrement]       = useState(0)

  // Captured pieces
  const [capturedWhite, setCapturedWhite] = useState<string[]>([])
  const [capturedBlack, setCapturedBlack] = useState<string[]>([])

  // Evaluation
  const [currentEval, setCurrentEval] = useState<{ score: number; isMate: boolean; mateIn: number | null } | null>(null)

  // Cosmetics
  const [equippedBoardUrl,  setEquippedBoardUrl]  = useState<string | null>(null)
  const [equippedPieceSet, setEquippedPieceSet]  = useState<string | null>(null)

  // ── Post-game ─────────────────────────────────────────────────────────────
  const [showVictoryModal,    setShowVictoryModal]    = useState(false)
  const [gameResult,          setGameResult]          = useState<'win' | 'loss' | 'draw' | null>(null)
  const [gameEndReason,       setGameEndReason]       = useState('')
  const [ratingBefore, setRatingBefore] = useState(0)
  const [ratingAfter,  setRatingAfter]  = useState(0)

  // ── Opponent disconnect countdown ─────────────────────────────────────────
  const [oppDisconnected,  setOppDisconnected]  = useState(false)
  const [oppCountdown,     setOppCountdown]     = useState(60)
  const oppCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Draw offer ────────────────────────────────────────────────────────────
  const [drawOfferFrom,  setDrawOfferFrom]  = useState<'sent' | 'received' | null>(null)
  const [drawDeclined,   setDrawDeclined]   = useState(false)

  const [error, setError] = useState<string | null>(null)

  // ── Derived ───────────────────────────────────────────────────────────────
  const isUserTurn = serverState
    ? chess.turn() === (serverState.yourColor === 'white' ? 'w' : 'b')
    : false
  const userColor   = serverState?.yourColor ?? 'white'
  const myPlayer    = serverState ? (userColor === 'white' ? serverState.whitePlayer : serverState.blackPlayer) : null
  const oppPlayer   = serverState ? (userColor === 'white' ? serverState.blackPlayer : serverState.whitePlayer) : null

  // ── Load cosmetics ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/user/equipped-cosmetics')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setEquippedBoardUrl(d.boardUrl); setEquippedPieceSet(d.pieceSet) } })
      .catch(() => {})
  }, [])

  // Snapshot rating before game (for post-game modal)
  useEffect(() => {
    if (dbUser?.rating != null) setRatingBefore(dbUser.rating)
  }, [dbUser?.id])

  // ── Socket lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!dbUser) return

    // Always use current origin in browser so production never connects to localhost
    let baseUrl =
      typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_SOCKET_URL || '').trim() || window.location.origin
        : 'http://localhost:3000'
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && baseUrl.includes('localhost')) {
      baseUrl = window.location.origin
    }
    const socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setReconnecting(false)
      socket.emit('join_game', { gameId, playerId: dbUser.id })
    })

    socket.on('disconnect', () => { setConnected(false); setReconnecting(true) })
    socket.on('reconnect',  () => { setReconnecting(false) })

    socket.on('error', (d: { message: string }) => setError(d.message))

    // Full game state (on join / rejoin)
    socket.on('game_state', (d: ServerGameState) => {
      const c = new Chess(d.fen)
      chessRef.current = c
      setChess(c)
      setDisplayFen(d.fen)
      setServerState(d)
      setWhiteTimeSec(msToSec(d.whiteTimeMs))
      setBlackTimeSec(msToSec(d.blackTimeMs))
      setIncrement(d.increment)
      updateCaptured(c)
    })

    // Opponent move (or our own echoed back)
    socket.on('move_made', (d: MoveMadeEvent) => {
      const next = new Chess(d.fen)
      chessRef.current = next
      setChess(next)
      setDisplayFen(d.fen)
      setWhiteTimeSec(msToSec(d.whiteTimeMs))
      setBlackTimeSec(msToSec(d.blackTimeMs))
      setServerState((prev) => prev ? { ...prev, fen: d.fen, currentTurn: d.currentTurn, gameOver: d.gameOver, result: d.result } : prev)
      updateCaptured(next)

      // Sounds & effects
      const lastMove = next.history({ verbose: true }).slice(-1)[0]
      if (lastMove?.captured) playCapture(); else playMove()
      if (d.isCheck) { playCheck(); triggerShake() }
    })

    // Game over
    socket.on('game_over', async (d: GameOverEvent) => {
      setGameEndReason(REASON_LABEL[d.reason] ?? '')
      setWhiteTimeSec(msToSec(d.whiteTimeMs))
      setBlackTimeSec(msToSec(d.blackTimeMs))
      playGameEnd()

      // Determine win/loss/draw for current player
      const result: 'win' | 'loss' | 'draw' =
        d.result === 'DRAW' ? 'draw'
        : (d.result === 'WHITE_WIN' && userColor === 'white') || (d.result === 'BLACK_WIN' && userColor === 'black')
        ? 'win' : 'loss'
      setGameResult(result)

      // Fetch updated profile (rating, pawns, etc.) after server-side processing
      try {
        const me = await fetch('/api/auth/me').then((r) => r.json())
        if (me?.user) {
          if (me.user.rating != null) setRatingAfter(me.user.rating)
          // Keep global user context (navbar) in sync with server-side changes (pawns, xp, rating, cosmetics).
          if (dbUser) {
            // Preserve fields that /api/auth/me does not return, if any, by spreading existing first.
            setDbUser({ ...dbUser, ...me.user })
          }
        }
      } catch {}

      // Start post-game analysis
      const uciMoves = chessRef.current.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''))
      analyze(uciMoves)

      setShowVictoryModal(true)
    })

    // Opponent disconnected
    socket.on('opponent_disconnected', ({ secondsLeft }: { color: string; secondsLeft: number }) => {
      setOppDisconnected(true)
      setOppCountdown(secondsLeft)
      if (oppCountdownRef.current) clearInterval(oppCountdownRef.current)
      oppCountdownRef.current = setInterval(() => {
        setOppCountdown((prev) => {
          if (prev <= 1) { clearInterval(oppCountdownRef.current!); return 0 }
          return prev - 1
        })
      }, 1000)
    })

    socket.on('opponent_reconnected', () => {
      setOppDisconnected(false)
      if (oppCountdownRef.current) clearInterval(oppCountdownRef.current)
    })

    // Draw offer events
    socket.on('draw_offered',    () => setDrawOfferFrom('received'))
    socket.on('draw_offer_sent', () => setDrawOfferFrom('sent'))
    socket.on('draw_declined',   () => {
      setDrawOfferFrom(null)
      setDrawDeclined(true)
      setTimeout(() => setDrawDeclined(false), 3000)
    })

    return () => {
      if (oppCountdownRef.current) clearInterval(oppCountdownRef.current)
      socket.disconnect()
    }
  }, [dbUser?.id, gameId])

  // ── Eval bar update ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !serverState || serverState.gameOver) return
    getEvaluation(displayFen, 8).then((ev) => ev && setCurrentEval(ev)).catch(() => {})
  }, [displayFen, isReady])

  // ── Captured pieces tracker ───────────────────────────────────────────────
  const updateCaptured = useCallback((game: Chess) => {
    const hist = game.history({ verbose: true })
    const w: string[] = [], b: string[] = []
    hist.forEach((m) => { if (m.captured) (m.color === 'w' ? w : b).push(m.captured) })
    setCapturedWhite(w)
    setCapturedBlack(b)
  }, [])

  // ── Premove attempt when user's turn starts ────────────────────────────────
  useEffect(() => {
    if (!isUserTurn || !serverState || serverState.gameOver) return
    if (!premove && !premoveFrom) return
    const result = attemptPremove(chessRef.current)
    if (result) {
      const lastMove = result.history({ verbose: true }).slice(-1)[0]
      if (lastMove?.captured) playCapture(); else playMove()
      if (result.isCheck()) { playCheck(); triggerShake() }
      socketRef.current?.emit('make_move', { from: lastMove.from, to: lastMove.to })
      // Optimistic update (server will echo back)
      chessRef.current = result
      setChess(result)
      setDisplayFen(result.fen())
    }
  }, [isUserTurn])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onDrop = (src: string, dst: string) => {
    if (!socketRef.current || !serverState || serverState.gameOver || !isUserTurn) return false
    try {
      const next = new Chess(chessRef.current.fen())
      const move = next.move({ from: src, to: dst, promotion: 'q' })
      if (!move) return false
      if (move.captured) playCapture(); else playMove()
      if (next.isCheck()) { playCheck(); triggerShake() }
      socketRef.current.emit('make_move', { from: src, to: dst })
      // Optimistic update
      chessRef.current = next
      setChess(next)
      setDisplayFen(next.fen())
      return true
    } catch { return false }
  }

  const onSquareClick = (square: string) => {
    if (!serverState || serverState.gameOver || isUserTurn) return
    handlePremoveClick(square, chessRef.current, userColor === 'white' ? 'w' : 'b')
  }

  const onResign = () => {
    if (!confirm('Are you sure you want to resign?')) return
    socketRef.current?.emit('resign')
  }

  const onDrawOffer = () => {
    if (drawOfferFrom === 'sent') return
    socketRef.current?.emit('offer_draw')
  }

  const acceptDraw  = () => socketRef.current?.emit('accept_draw')
  const declineDraw = () => { socketRef.current?.emit('decline_draw'); setDrawOfferFrom(null) }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!dbUser || !serverState) {
    return (
      <div className="min-h-screen bg-chess-bg flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">{connected ? 'Joining game…' : 'Connecting…'}</p>
      </div>
    )
  }

  const unlimited = serverState.whiteTimeMs === -1

  return (
    <div className="min-h-screen bg-chess-bg p-2 sm:p-4 lg:p-6">
      <div className="max-w-5xl mx-auto">

        {/* ── Status bar ──────────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-white truncate">
              vs <span className="text-pawn-gold">{oppPlayer?.name}</span>
              <span className="text-slate-400 text-xs sm:text-sm font-normal ml-1.5">{oppPlayer?.rating != null ? Math.round(oppPlayer.rating) : oppPlayer?.rank}</span>
            </h1>
            {gameEndReason && (
              <span className="text-slate-400 text-xs">{gameEndReason}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {reconnecting ? (
              <span className="flex items-center gap-1 text-yellow-400 text-xs"><WifiOff className="w-3 h-3" /> Reconnecting…</span>
            ) : connected ? (
              <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi className="w-3 h-3" /> Live</span>
            ) : null}
            <button onClick={() => router.push('/play')}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold h-9 px-3 rounded-lg transition-colors text-sm">
              ← Leave
            </button>
          </div>
        </div>

        {/* ── Opponent disconnected banner ─────────────────────────────────── */}
        {oppDisconnected && !serverState.gameOver && (
          <div className="mb-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-yellow-300 text-sm font-medium">
              Opponent disconnected — forfeiting in {oppCountdown}s
            </span>
            <div className="w-16 h-1.5 bg-chess-bg rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 transition-all duration-1000" style={{ width: `${(oppCountdown / 60) * 100}%` }} />
            </div>
          </div>
        )}

        {/* ── Draw offer banner ────────────────────────────────────────────── */}
        {drawOfferFrom === 'received' && (
          <div className="mb-3 bg-blue-900/30 border border-blue-700/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-blue-300 text-sm font-medium flex items-center gap-2">
              <Handshake className="w-4 h-4" /> Opponent offers a draw
            </span>
            <div className="flex gap-2">
              <button onClick={acceptDraw}  className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white text-sm font-bold h-8 px-3 rounded-lg transition-colors"><Check className="w-3.5 h-3.5" /> Accept</button>
              <button onClick={declineDraw} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold h-8 px-3 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /> Decline</button>
            </div>
          </div>
        )}
        {drawOfferFrom === 'sent' && (
          <div className="mb-3 bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-2 text-blue-400 text-xs text-center">
            Draw offer sent — waiting for response…
          </div>
        )}
        {drawDeclined && (
          <div className="mb-3 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-2 text-red-400 text-xs text-center">
            Opponent declined the draw offer
          </div>
        )}

        {error && (
          <div className="mb-3 bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-2 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-3 sm:gap-4">
          {/* ── Board column ──────────────────────────────────────────────── */}
          <div className="lg:col-span-8">
            <div className="bg-chess-card border-2 border-chess-border rounded-xl p-3 sm:p-5">
              {/* Opponent header */}
              <div className="mb-2">
                <PlayerHeader
                  playerName={oppPlayer?.name ?? 'Opponent'}
                  rank={oppPlayer?.rating != null ? `${Math.round(oppPlayer.rating)}` : oppPlayer?.rank}
                  capturedPieces={userColor === 'white' ? capturedBlack : capturedWhite}
                  isActive={!isUserTurn && !serverState.gameOver}
                  timeLeft={userColor === 'white' ? blackTimeSec : whiteTimeSec}
                  increment={increment}
                  pieceSet={dbUser?.pieceSet || 'cardinal'}
                />
              </div>

              {/* Board + eval bar */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 my-2 sm:my-4">
                {isReady && (
                  <EvalBar
                    evaluation={currentEval?.score ?? null}
                    isMate={currentEval?.isMate}
                    mateIn={currentEval?.mateIn ?? null}
                  />
                )}
                <motion.div animate={shakeControls} className="w-full aspect-square max-w-full">
                  <CustomBoard
                    position={displayFen}
                    onPieceDrop={onDrop}
                    onSquareClick={onSquareClick}
                    onSquareRightClick={() => clearPremove()}
                    arePiecesDraggable={!serverState.gameOver && isUserTurn}
                    boardOrientation={userColor}
                    equippedBoardUrl={equippedBoardUrl}
                    equippedPieceSet={equippedPieceSet}
                    fallbackPieceSet={dbUser?.pieceSet || 'cardinal'}
                    fallbackBoardStyle={dbUser?.boardStyle || 'green'}
                    customSquareStyles={premoveStyles}
                    customBoardStyle={{ borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', width: '100%' }}
                  />
                </motion.div>
              </div>

              {/* My header */}
              <div className="mt-2">
                <PlayerHeader
                  playerName={dbUser?.name ?? 'You'}
                  rank={dbUser?.rating != null ? `${Math.round(dbUser.rating)}` : undefined}
                  points={undefined}
                  capturedPieces={userColor === 'white' ? capturedWhite : capturedBlack}
                  isActive={isUserTurn && !serverState.gameOver}
                  timeLeft={userColor === 'white' ? whiteTimeSec : blackTimeSec}
                  increment={increment}
                  pieceSet={dbUser?.pieceSet || 'cardinal'}
                />
              </div>

              {/* Status line */}
              <div className="text-center mt-2 h-5">
                {serverState.gameOver ? (
                  <p className="text-white font-semibold text-sm">Game Over</p>
                ) : chess.isCheck() ? (
                  <p className="text-pawn-gold font-semibold text-sm">⚠ Check!</p>
                ) : (premove || premoveFrom) ? (
                  <p className="text-red-400 text-xs">Premove set · right-click to cancel</p>
                ) : !isUserTurn ? (
                  <p className="text-slate-500 text-xs">Waiting for {oppPlayer?.name}…</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <div className="lg:col-span-4">
            <div className="bg-chess-card border-2 border-chess-border rounded-xl lg:min-h-[500px]">
              <GameControlPanel
                chess={chess}
                onPositionChange={(fen) => setDisplayFen(fen)}
                onResign={onResign}
                onDrawOffer={onDrawOffer}
                isGameActive={!serverState.gameOver}
              />
            </div>
          </div>
        </div>

        {/* ── Victory Modal ────────────────────────────────────────────────── */}
        <VictoryModal
          isOpen={showVictoryModal}
          result={gameResult ?? 'draw'}
          botName={oppPlayer?.name ?? 'Opponent'}
          gameId={gameId}
          ratingBefore={ratingBefore}
          ratingAfter={ratingAfter}
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
          counts={analysisResult?.counts ?? null}
          onClose={() => setShowVictoryModal(false)}
          onNewGame={() => router.push('/play')}
        />
      </div>
    </div>
  )
}
