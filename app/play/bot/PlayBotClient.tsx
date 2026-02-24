'use client'

import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Chess } from 'chess.js'
import { motion } from 'framer-motion'
import CustomBoard   from '@/components/CustomBoard'
import PlayerHeader  from '@/components/PlayerHeader'
import dynamic from 'next/dynamic'

// Split heavy panel/overlay chunks — only loaded when game is active / ends
const GameControlPanel = dynamic(() => import('@/components/GameControlPanel'))
const EvalBar          = dynamic(() => import('@/components/EvalBar'))
const VictoryModal     = dynamic(() => import('@/components/VictoryModal'))
import { useStockfish } from '@/hooks/useStockfish'
import { useChessSound } from '@/hooks/useChessSound'
import { useGameAnalysis } from '@/hooks/useGameAnalysis'
import { usePremove } from '@/hooks/usePremove'
import { useShake } from '@/hooks/useShake'
import {
  BOT_PROFILES,
  BotProfile,
  setEngineDifficulty,
  getBotTitleByElo,
  getBotCategoryByElo,
} from '@/lib/bots'
import { processTournamentWin } from '@/actions/tournament'
import { useDbUser } from '@/app/context/UserContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Time controls ────────────────────────────────────────────────────────────

interface TimeControl { label: string; initial: number; increment: number }

const TIME_CONTROLS: TimeControl[] = [
  { label: '1+0',   initial: 60,   increment: 0  },
  { label: '3+2',   initial: 180,  increment: 2  },
  { label: '5+3',   initial: 300,  increment: 3  },
  { label: '10+5',  initial: 600,  increment: 5  },
  { label: '15+10', initial: 900,  increment: 10 },
  { label: '∞',     initial: -1,   increment: 0  },
]

// ─── Category styles ──────────────────────────────────────────────────────────

const CATEGORY_STYLES = {
  beginner:     { border: 'border-green-700',  selectedBorder: 'border-green-400',  selectedBg: 'bg-green-900/25',  avatarBg: 'bg-green-900/50',  label: 'text-green-400',  badge: 'bg-green-900/60 text-green-300'  },
  intermediate: { border: 'border-blue-700',   selectedBorder: 'border-blue-400',   selectedBg: 'bg-blue-900/25',   avatarBg: 'bg-blue-900/50',   label: 'text-blue-400',   badge: 'bg-blue-900/60 text-blue-300'   },
  advanced:     { border: 'border-yellow-700', selectedBorder: 'border-yellow-400', selectedBg: 'bg-yellow-900/25', avatarBg: 'bg-yellow-900/50', label: 'text-yellow-400', badge: 'bg-yellow-900/60 text-yellow-300' },
  expert:       { border: 'border-orange-700', selectedBorder: 'border-orange-400', selectedBg: 'bg-orange-900/25', avatarBg: 'bg-orange-900/50', label: 'text-orange-400', badge: 'bg-orange-900/60 text-orange-300' },
  master:       { border: 'border-purple-700', selectedBorder: 'border-purple-400', selectedBg: 'bg-purple-900/25', avatarBg: 'bg-purple-900/50', label: 'text-purple-400', badge: 'bg-purple-900/60 text-purple-300' },
} as const

// ─── Component ────────────────────────────────────────────────────────────────

function PlayBotPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dbUser, setDbUser } = useDbUser()
  const nodeId = searchParams.get('nodeId')

  // ── Core hooks ────────────────────────────────────────────────────────────
  const { isReady, isThinking, sendCommand, getBestMove, getEvaluation, error: engineError } = useStockfish()
  const { playMove, playCapture, playCheck, playGameEnd } = useChessSound()
  const { isAnalyzing, progress: analysisProgress, result: analysisResult, analyze } = useGameAnalysis()
  const { premove, premoveFrom, handlePremoveClick, attemptPremove, clearPremove, premoveStyles } = usePremove()
  const { shakeControls, triggerShake } = useShake()

  // ── Game state ────────────────────────────────────────────────────────────
  const [selectedBot, setSelectedBot]     = useState<BotProfile | null>(null)
  const [tournamentNode, setTournamentNode] = useState<{ id: string; botName: string; botElo: number; roundName: string } | null>(null)
  const [timeControl, setTimeControl]     = useState<TimeControl>(TIME_CONTROLS[3]) // default 10+5
  const [gameStarted, setGameStarted]     = useState(false)
  const [chess, setChess]                 = useState(new Chess())
  const [userColor]                       = useState<'white' | 'black'>('white')
  const [gameOver, setGameOver]           = useState(false)
  const [gameResult, setGameResult]       = useState<'win' | 'loss' | 'draw' | null>(null)
  const [showVictoryModal, setShowVictoryModal] = useState(false)
  const [gameId, setGameId]               = useState<string | null>(null)
  const [mmrBefore, setMmrBefore]         = useState(0)
  const [mmrAfter, setMmrAfter]           = useState(0)
  const [gamesInCycleBefore, setGamesInCycleBefore] = useState(0)
  const [gamesInCycleAfter, setGamesInCycleAfter]   = useState(0)
  const [equippedBoardUrl, setEquippedBoardUrl] = useState<string | null>(null)
  const [equippedPieceSet, setEquippedPieceSet] = useState<string | null>(null)
  const [capturedWhitePieces, setCapturedWhitePieces] = useState<string[]>([])
  const [capturedBlackPieces, setCapturedBlackPieces] = useState<string[]>([])
  const [whiteTime, setWhiteTime]         = useState(600)
  const [blackTime, setBlackTime]         = useState(600)
  const [displayFen, setDisplayFen]       = useState(new Chess().fen())
  const [currentEvaluation, setCurrentEvaluation] = useState<{ score: number; isMate: boolean; mateIn: number | null } | null>(null)

  // ── Selection UI ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState<'prebuilt' | 'custom'>('prebuilt')
  const [customBotElo, setCustomBotElo]   = useState(1000)
  const [customBotDepth, setCustomBotDepth] = useState(5)
  const [customBotName, setCustomBotName] = useState('')

  const chessRef              = useRef(chess)
  const botMoveInProgressRef  = useRef(false)
  const previousFenRef        = useRef(chess.fen())
  const isUserTurn            = chess.turn() === (userColor === 'white' ? 'w' : 'b')

  // ── Derived ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/user/equipped-cosmetics')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setEquippedBoardUrl(d.boardUrl); setEquippedPieceSet(d.pieceSet) } })
      .catch(() => {})
  }, [])

  useEffect(() => { chessRef.current = chess; setDisplayFen(chess.fen()) }, [chess])

  useEffect(() => {
    if (gameStarted && isReady && !isThinking && selectedBot) {
      getEvaluation(displayFen, 8)
        .then((ev) => ev && setCurrentEvaluation(ev))
        .catch(() => {})
    }
  }, [displayFen, gameStarted, isReady, isThinking])

  useEffect(() => {
    if (selectedBot && isReady && gameStarted) setEngineDifficulty(sendCommand, selectedBot)
  }, [selectedBot, isReady, gameStarted, sendCommand])

  // Fetch tournament node
  useEffect(() => {
    if (nodeId && dbUser?.id) {
      fetch(`/api/campaign/tournament-node/${nodeId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.node) {
            setTournamentNode({ id: data.node.id, botName: data.node.botName, botElo: data.node.botElo, roundName: data.node.roundName })
            setSelectedBot({ id: data.node.id, name: data.node.botName, title: getBotTitleByElo(data.node.botElo), elo: data.node.botElo, depth: Math.min(Math.max(Math.floor(data.node.botElo / 200), 1), 18), description: `Tournament opponent (${data.node.botElo} ELO)`, category: getBotCategoryByElo(data.node.botElo) })
          }
        })
        .catch(() => {})
    }
  }, [nodeId, dbUser?.id])

  // Auto-start tournament
  useEffect(() => {
    if (tournamentNode && selectedBot && !gameStarted && dbUser?.id) {
      const t = setTimeout(() => startGame(), 800)
      return () => clearTimeout(t)
    }
  }, [tournamentNode, selectedBot, gameStarted, dbUser?.id])

  // Track captured pieces
  useEffect(() => {
    const hist = chess.history({ verbose: true })
    const w: string[] = [], b: string[] = []
    hist.forEach((m) => { if (m.captured) { (m.color === 'w' ? w : b).push(m.captured.toLowerCase()) } })
    setCapturedWhitePieces(w)
    setCapturedBlackPieces(b)
  }, [chess])

  // ── Premove attempt when user's turn starts ────────────────────────────────
  useEffect(() => {
    if (!gameStarted || gameOver) return
    if (!isUserTurn) return
    if (!premove && !premoveFrom) return

    const result = attemptPremove(chessRef.current)
    if (result) {
      const m = result.history({ verbose: true }).slice(-1)[0]
      if (m?.captured) playCapture()
      else playMove()
      if (result.isCheck()) { playCheck(); triggerShake() }
      setChess(result)
      checkGameOver(result)
    }
  }, [isUserTurn, gameStarted, gameOver])

  // ── Bot move handler ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted || gameOver || !isReady || isThinking || !selectedBot || botMoveInProgressRef.current) return
    if (isUserTurn) return

    botMoveInProgressRef.current = true
    const fen = chessRef.current.fen()
    // Limit movetime on lower ELO bots to make them feel snappier
    const moveTimeMs = Math.min(3000, Math.max(300, selectedBot.elo / 3))

    getBestMove(fen, selectedBot.depth, moveTimeMs)
      .then((bestMove) => {
        botMoveInProgressRef.current = false
        if (!bestMove || gameOver || !gameStarted) return
        if (chessRef.current.turn() === (userColor === 'white' ? 'w' : 'b')) return
        try {
          const next = new Chess(chessRef.current.fen())
          const from = bestMove.slice(0, 2), to = bestMove.slice(2, 4)
          const promotion = bestMove.length > 4 ? bestMove[4] : undefined
          const move = next.move({ from, to, promotion: promotion || 'q' })
          if (move) {
            if (move.captured) playCapture(); else playMove()
            if (next.isCheck()) { playCheck(); triggerShake() }
            // Apply clock increment for user (bot just moved, now user's turn)
            if (timeControl.increment > 0 && timeControl.initial !== -1) {
              setWhiteTime((t) => t + timeControl.increment)
            }
            setChess(next)
            checkGameOver(next)
          }
        } catch (err) { console.error('Bot move error:', err, bestMove) }
      })
      .catch((err) => { botMoveInProgressRef.current = false; console.error(err) })
  }, [gameStarted, gameOver, isReady, isThinking, userColor, selectedBot, chess])

  // ── Game logic ─────────────────────────────────────────────────────────────

  const checkGameOver = useCallback((game: Chess) => {
    if (game.isCheckmate()) {
      const userWon = game.turn() !== (userColor === 'white' ? 'w' : 'b')
      endGame(userWon ? 'win' : 'loss', game)
    } else if (game.isDraw() || game.isStalemate()) {
      endGame('draw', game)
    }
  }, [userColor])

  const endGame = useCallback((result: 'win' | 'loss' | 'draw', game?: Chess) => {
    if (gameOver) return
    setGameOver(true)
    setGameResult(result)
    setShowVictoryModal(true)
    playGameEnd()
    clearPremove()
    saveGameResult(result, game)
  }, [gameOver, playGameEnd, clearPremove])

  const saveGameResult = async (result: 'win' | 'loss' | 'draw', finalGame?: Chess) => {
    if (!dbUser?.id || !selectedBot) return
    const game = finalGame ?? chessRef.current
    try {
      if (tournamentNode && result === 'win') {
        const tr = await processTournamentWin(dbUser.id, tournamentNode.id)
        if (tr.success && (tr.regionUnlocked || tr.unlocked_new_region)) {
          setTimeout(() => router.push('/campaign?unlocked=true'), 2500)
          return
        }
      }
      const uciMoves = game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''))
      const resp = await fetch('/api/games/create-bot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, botName: selectedBot.name, botElo: selectedBot.elo, botDepth: selectedBot.depth, moves: uciMoves.join(' ') }),
      })
      if (resp.ok) {
        const data = await resp.json()
        setGameId(data.gameId)
        setMmrBefore(data.mmrBefore ?? 0)
        setMmrAfter(data.mmrAfter ?? 0)
        setGamesInCycleBefore(data.gamesInCycleBefore ?? 0)
        setGamesInCycleAfter(data.gamesInCycleAfter ?? 0)
        if (setDbUser) setDbUser({ ...dbUser!, xp: data.xpAfter ?? dbUser!.xp, currentPoints: data.mmrAfter ?? dbUser!.currentPoints, gamesPlayedInCycle: data.gamesInCycleAfter ?? dbUser!.gamesPlayedInCycle })
        analyze(uciMoves)
      }
    } catch (err) { console.error('saveGameResult error:', err) }
  }

  const startGame = () => {
    if (!selectedBot) return
    const c = new Chess()
    chessRef.current = c
    previousFenRef.current = c.fen()
    setChess(c)
    setDisplayFen(c.fen())
    setGameStarted(true)
    setGameOver(false)
    setGameResult(null)
    setShowVictoryModal(false)
    setGameId(null)
    setCapturedWhitePieces([])
    setCapturedBlackPieces([])
    clearPremove()
    botMoveInProgressRef.current = false
    const t = timeControl.initial === -1 ? 99999 : timeControl.initial
    setWhiteTime(t)
    setBlackTime(t)
  }

  const onDrop = (src: string, dst: string) => {
    if (gameOver || isThinking || !isUserTurn) return false
    try {
      const next = new Chess(chessRef.current.fen())
      const move = next.move({ from: src, to: dst, promotion: 'q' })
      if (!move) return false
      if (move.captured) playCapture(); else playMove()
      if (next.isCheck()) { playCheck(); triggerShake() }
      // Apply increment to player after their move
      if (timeControl.increment > 0 && timeControl.initial !== -1) {
        setWhiteTime((t) => t + timeControl.increment)
      }
      setChess(next)
      checkGameOver(next)
      return true
    } catch { return false }
  }

  const onSquareClick = (square: string) => {
    if (gameOver || isUserTurn) return
    handlePremoveClick(square, chessRef.current, userColor === 'white' ? 'w' : 'b')
  }

  const onSquareRightClick = () => clearPremove()

  const handleNewGame = () => {
    setShowVictoryModal(false); setGameStarted(false); setGameOver(false)
    setGameResult(null); setSelectedBot(null); clearPremove()
  }

  // ── Early return ──────────────────────────────────────────────────────────

  if (!dbUser) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Selection screen ──────────────────────────────────────────────────────

  if (!gameStarted) {
    if (tournamentNode) {
      const s = CATEGORY_STYLES[getBotCategoryByElo(tournamentNode.botElo)]
      return (
        <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4">
          <div className="bg-chess-card border border-chess-border rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl">
            <div className={`w-24 h-24 rounded-full ${s.avatarBg} border-2 ${s.selectedBorder} flex items-center justify-center text-3xl font-extrabold mx-auto mb-5 ${s.label}`}>{initials(tournamentNode.botName)}</div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${s.label}`}>{tournamentNode.roundName}</p>
            <h2 className="text-3xl font-extrabold text-white mb-2">{tournamentNode.botName}</h2>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-5 ${s.badge}`}>ELO {tournamentNode.botElo} · {getBotTitleByElo(tournamentNode.botElo)}</div>
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <div className="w-4 h-4 border-2 border-pawn-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Preparing the match…</span>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-chess-bg p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">Play Against Bots</h1>
            <p className="text-slate-400 text-sm sm:text-base">Choose an opponent, pick your time control, and play</p>
          </div>

          {!isReady && !engineError && (
            <div className="bg-chess-card border border-chess-border rounded-lg p-3 mb-5 flex items-center gap-2 justify-center">
              <div className="w-4 h-4 border-2 border-pawn-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-300 text-sm">Initialising chess engine…</span>
            </div>
          )}
          {engineError && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-5 flex items-center gap-2 justify-center">
              <span className="text-red-300 text-sm">{engineError}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-6 mb-5 border-b border-chess-border">
            {(['prebuilt', 'custom'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab ? 'border-pawn-gold text-pawn-gold' : 'border-transparent text-slate-400 hover:text-white'}`}>
                {tab === 'prebuilt' ? 'Choose an Opponent' : 'Custom Bot'}
              </button>
            ))}
          </div>

          {activeTab === 'prebuilt' ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {BOT_PROFILES.map((bot) => {
                const sel = selectedBot?.id === bot.id
                const s = CATEGORY_STYLES[bot.category]
                return (
                  <button key={bot.id} onClick={() => setSelectedBot(bot)} disabled={!isReady || !!engineError}
                    className={`relative p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-150 ${sel ? `${s.selectedBg} ${s.selectedBorder} shadow-lg ring-1 ring-pawn-gold/30` : `bg-chess-card ${s.border} hover:scale-[1.02]`} ${!isReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    {sel && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-pawn-gold flex items-center justify-center text-slate-900 text-xs font-black">✓</div>}
                    <div className={`w-12 h-12 rounded-full ${s.avatarBg} border ${s.selectedBorder} flex items-center justify-center text-sm font-extrabold mb-2 mx-auto ${s.label}`}>{initials(bot.name)}</div>
                    <p className={`text-xs font-bold uppercase tracking-widest ${s.label} mb-0.5`}>{bot.title}</p>
                    <h3 className="text-white font-extrabold text-sm leading-tight mb-1">{bot.name}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-2 line-clamp-2">{bot.description}</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${s.badge}`}>ELO {bot.elo}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="max-w-lg mx-auto">
              <div className="bg-chess-card border border-chess-border rounded-xl p-6">
                <h3 className="text-white font-extrabold text-lg mb-5">Configure Custom Opponent</h3>
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-1"><label className="text-slate-300 text-sm font-medium">ELO Rating</label><span className="text-pawn-gold font-bold">{customBotElo}</span></div>
                  <input type="range" min={250} max={3200} step={50} value={customBotElo} onChange={(e) => setCustomBotElo(+e.target.value)} className="w-full accent-pawn-gold cursor-pointer" />
                </div>
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-1"><label className="text-slate-300 text-sm font-medium">Engine Depth</label><span className="text-pawn-gold font-bold">{customBotDepth}</span></div>
                  <input type="range" min={1} max={20} step={1} value={customBotDepth} onChange={(e) => setCustomBotDepth(+e.target.value)} className="w-full accent-pawn-gold cursor-pointer" />
                </div>
                <div className="mb-5">
                  <label className="text-slate-300 text-sm font-medium block mb-1">Name <span className="text-slate-500">(optional)</span></label>
                  <input type="text" value={customBotName} onChange={(e) => setCustomBotName(e.target.value)} placeholder="Custom Bot" maxLength={30} className="w-full bg-chess-bg border border-chess-border rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pawn-gold/40" />
                </div>
                <button onClick={() => setSelectedBot({ id: 'custom', name: customBotName.trim() || 'Custom Bot', title: getBotTitleByElo(customBotElo), elo: customBotElo, depth: customBotDepth, description: 'Custom configuration.', category: getBotCategoryByElo(customBotElo) })} disabled={!isReady || !!engineError}
                  className={`w-full py-2 rounded-lg font-bold transition-colors ${!isReady ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : selectedBot?.id === 'custom' ? 'bg-pawn-gold text-slate-900' : 'bg-chess-card border border-chess-border text-white hover:bg-slate-700'}`}>
                  {selectedBot?.id === 'custom' ? '✓ Configured' : 'Set as Opponent'}
                </button>
              </div>
            </div>
          )}

          {/* Time control + Start */}
          {selectedBot && isReady && !engineError && (
            <div className="mt-8 space-y-5">
              {/* Time control chips */}
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-widest text-center mb-3">Time Control</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {TIME_CONTROLS.map((tc) => (
                    <button key={tc.label} onClick={() => setTimeControl(tc)}
                      className={`px-4 h-10 rounded-lg text-sm font-bold border transition-all ${timeControl.label === tc.label ? 'bg-pawn-gold text-slate-900 border-pawn-gold' : 'bg-chess-card border-chess-border text-slate-300 hover:border-pawn-gold hover:text-white'}`}>
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-center">
                <button onClick={startGame} className="bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-extrabold py-3 px-12 rounded-xl text-lg transition-colors shadow-lg">
                  Start Game →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Active game ────────────────────────────────────────────────────────────

  const unlimitedTime = timeControl.initial === -1

  return (
    <div className="min-h-screen bg-chess-bg p-2 sm:p-4 lg:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-xl font-bold text-white truncate">
            vs <span className="text-pawn-gold">{selectedBot?.name}</span>
            {selectedBot && <span className="text-slate-400 text-xs sm:text-sm font-normal ml-1.5">ELO {selectedBot.elo} · {timeControl.label}</span>}
          </h1>
          <button onClick={() => { setGameStarted(false); setGameOver(false); setSelectedBot(null); clearPremove() }}
            className="shrink-0 bg-slate-700 hover:bg-slate-600 text-white font-bold h-10 px-3 rounded-lg transition-colors text-sm">
            ← Back
          </button>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-3 sm:gap-4">
          {/* Board column */}
          <div className="lg:col-span-8">
            <div className="bg-chess-card border-2 border-chess-border rounded-xl p-3 sm:p-5">
              <div className="mb-2">
                <PlayerHeader playerName={selectedBot?.name || 'Bot'} rank={`ELO ${selectedBot?.elo}`}
                  capturedPieces={capturedBlackPieces}
                  isActive={chess.turn() === 'b' && !gameOver}
                  timeLeft={unlimitedTime ? undefined : blackTime}
                  increment={timeControl.increment}
                  onTimeUp={() => {
                    // Check for insufficient material (draw)
                    if (chess.isInsufficientMaterial()) endGame('draw')
                    else endGame('win')
                  }}
                  pieceSet={dbUser?.pieceSet || 'cardinal'}
                />
              </div>

              <div className="flex items-center justify-center gap-2 sm:gap-3 my-2 sm:my-4">
                {gameStarted && isReady && (
                  <EvalBar evaluation={currentEvaluation?.score ?? null} isMate={currentEvaluation?.isMate} mateIn={currentEvaluation?.mateIn ?? null} />
                )}
                {/* Shakeable board wrapper */}
                <motion.div animate={shakeControls} className="w-full aspect-square max-w-full">
                  <CustomBoard
                    position={displayFen}
                    onPieceDrop={onDrop}
                    onSquareClick={onSquareClick}
                    onSquareRightClick={onSquareRightClick}
                    arePiecesDraggable={!isThinking && !gameOver && isUserTurn}
                    boardOrientation={userColor}
                    equippedBoardUrl={equippedBoardUrl}
                    equippedPieceSet={equippedPieceSet}
                    fallbackPieceSet={dbUser?.pieceSet || 'cardinal'}
                    fallbackBoardStyle={dbUser?.boardStyle || 'canvas2'}
                    customSquareStyles={premoveStyles}
                    customBoardStyle={{ borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', width: '100%' }}
                  />
                </motion.div>
              </div>

              <div className="mt-2">
                <PlayerHeader playerName={dbUser?.name || 'You'} rank={dbUser?.rank} points={dbUser?.currentPoints}
                  capturedPieces={capturedWhitePieces}
                  isActive={chess.turn() === 'w' && !gameOver}
                  timeLeft={unlimitedTime ? undefined : whiteTime}
                  increment={timeControl.increment}
                  onTimeUp={() => {
                    if (chess.isInsufficientMaterial()) endGame('draw')
                    else endGame('loss')
                  }}
                  pieceSet={dbUser?.pieceSet || 'cardinal'}
                />
              </div>

              <div className="text-center mt-2 h-5">
                {gameOver ? <p className="text-white font-semibold text-sm">Game Over</p>
                  : isThinking ? <p className="text-slate-400 text-xs">{selectedBot?.name} is thinking…</p>
                  : chess.isCheck() ? <p className="text-pawn-gold font-semibold text-sm">⚠ Check!</p>
                  : (premove || premoveFrom) ? <p className="text-red-400 text-xs">Premove set · right-click to cancel</p>
                  : null}
              </div>
            </div>
          </div>

          {/* Control panel */}
          <div className="lg:col-span-4">
            <div className="bg-chess-card border-2 border-chess-border rounded-xl lg:min-h-[500px]">
              <GameControlPanel
                chess={chess}
                onPositionChange={(fen) => setDisplayFen(fen)}
                onResign={() => { if (confirm('Resign?')) endGame('loss') }}
                onDrawOffer={() => { if (confirm('Offer a draw?')) endGame('draw') }}
                isGameActive={gameStarted && !gameOver}
              />
            </div>
          </div>
        </div>

        <VictoryModal
          isOpen={showVictoryModal}
          result={gameResult ?? 'draw'}
          botName={selectedBot?.name ?? 'Bot'}
          botElo={selectedBot?.elo}
          gameId={gameId}
          mmrBefore={mmrBefore}
          mmrAfter={mmrAfter}
          gamesInCycleBefore={gamesInCycleBefore}
          gamesInCycleAfter={gamesInCycleAfter}
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
          counts={analysisResult?.counts ?? null}
          onClose={() => setShowVictoryModal(false)}
          onNewGame={handleNewGame}
        />
      </div>
    </div>
  )
}

export default function PlayBotPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-chess-bg flex items-center justify-center"><div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" /></div>}>
      <PlayBotPageInner />
    </Suspense>
  )
}
