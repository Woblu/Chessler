'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'
import { GiCrossedSwords } from 'react-icons/gi'
import { Swords, Bot, Users, Clock, TrendingUp } from 'lucide-react'
import { useDbUser } from '@/app/context/UserContext'

// ─── Time controls ────────────────────────────────────────────────────────────

interface TimeControl { label: string; description: string; initial: number; increment: number }

const TIME_CONTROLS: TimeControl[] = [
  { label: '1+0',   description: 'Bullet',    initial: 60,   increment: 0  },
  { label: '3+2',   description: 'Blitz',     initial: 180,  increment: 2  },
  { label: '5+3',   description: 'Blitz',     initial: 300,  increment: 3  },
  { label: '10+5',  description: 'Rapid',     initial: 600,  increment: 5  },
  { label: '15+10', description: 'Classical', initial: 900,  increment: 10 },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlayLobbyClient() {
  const router                    = useRouter()
  const { dbUser, isUserLoading } = useDbUser()

  const [socket,   setSocket]   = useState<Socket | null>(null)
  const [inQueue,  setInQueue]  = useState(false)
  const [waitSecs, setWaitSecs] = useState(0)
  const [queueSize, setQueueSize] = useState(0)
  const [selectedTC, setSelectedTC] = useState<TimeControl>(TIME_CONTROLS[3])

  // Match-found overlay state
  const [matchInfo, setMatchInfo] = useState<{
    gameId: string; opponentName: string; opponentMmr: number; color: string; timeControl: TimeControl
  } | null>(null)
  const [countdown, setCountdown] = useState(3)

  const socketRef      = useRef<Socket | null>(null)
  const waitTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dbUser) return

    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket'],
    })
    socketRef.current = s
    setSocket(s)

    s.on('connect',    () => setSocket(s))
    s.on('disconnect', () => { setInQueue(false); setWaitSecs(0) })

    s.on('queue_status', (d: { inQueue: boolean; queueSize?: number; waitSeconds?: number }) => {
      setInQueue(d.inQueue)
      if (d.queueSize  !== undefined) setQueueSize(d.queueSize)
      if (d.waitSeconds !== undefined) setWaitSecs(d.waitSeconds)
    })

    s.on('match_found', (d: { gameId: string; opponentName: string; opponentMmr: number; color: string; timeControl: TimeControl }) => {
      setInQueue(false)
      if (waitTimerRef.current) clearInterval(waitTimerRef.current)
      setMatchInfo(d)
      setCountdown(3)

      // 3-second countdown then navigate
      let n = 3
      countdownRef.current = setInterval(() => {
        n -= 1
        setCountdown(n)
        if (n <= 0) {
          clearInterval(countdownRef.current!)
          router.push(`/play/${d.gameId}`)
        }
      }, 1000)
    })

    s.on('error', (d: { message: string }) => console.error('[lobby]', d.message))

    return () => {
      if (waitTimerRef.current)   clearInterval(waitTimerRef.current)
      if (countdownRef.current)   clearInterval(countdownRef.current)
      s.emit('leave_queue')
      s.close()
    }
  }, [dbUser?.id, router])

  // ── Wait-time local counter ────────────────────────────────────────────────
  useEffect(() => {
    if (inQueue) {
      waitTimerRef.current = setInterval(() => setWaitSecs((s) => s + 1), 1000)
    } else {
      if (waitTimerRef.current) clearInterval(waitTimerRef.current)
      setWaitSecs(0)
    }
    return () => { if (waitTimerRef.current) clearInterval(waitTimerRef.current) }
  }, [inQueue])

  // ── Queue actions ─────────────────────────────────────────────────────────
  const joinQueue = () => {
    if (!socket || !dbUser) return
    socket.emit('join_queue', {
      playerId:    dbUser.id,
      name:        dbUser.name,
      mmr:         dbUser.currentPoints,
      timeControl: { initial: selectedTC.initial, increment: selectedTC.increment },
    })
    setInQueue(true)
  }

  const leaveQueue = () => {
    socket?.emit('leave_queue')
    setInQueue(false)
    setWaitSecs(0)
  }

  const formatWait = (s: number) =>
    s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Match found overlay ───────────────────────────────────────────────────
  if (matchInfo) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4">
        <div className="bg-chess-card border-2 border-pawn-gold/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-5xl mb-3">⚔️</div>
          <h2 className="text-2xl font-extrabold text-pawn-gold mb-1">Match Found!</h2>
          <p className="text-slate-300 mb-4">
            vs <span className="text-white font-bold">{matchInfo.opponentName}</span>
            <span className="text-slate-500 text-sm ml-1">({matchInfo.opponentMmr.toFixed(0)} MMR)</span>
          </p>
          <div className="flex items-center justify-center gap-4 mb-5">
            <div className="bg-chess-bg rounded-lg px-4 py-2 text-center">
              <p className="text-slate-400 text-xs mb-0.5">You play</p>
              <p className="text-white font-extrabold capitalize">{matchInfo.color}</p>
            </div>
            <div className="bg-chess-bg rounded-lg px-4 py-2 text-center">
              <p className="text-slate-400 text-xs mb-0.5">Time control</p>
              <p className="text-white font-extrabold">
                {matchInfo.timeControl.initial / 60}+{matchInfo.timeControl.increment}
              </p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">Starting in <span className="text-pawn-gold font-extrabold text-xl">{countdown}</span>…</p>
          <div className="w-full bg-chess-bg rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="h-full bg-pawn-gold transition-all duration-1000" style={{ width: `${((3 - countdown) / 3) * 100}%` }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Main lobby ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-chess-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Play Chess</h1>
          <p className="text-slate-400 text-sm">Challenge a real opponent or practice against bots</p>
          {dbUser && (
            <div className="inline-flex items-center gap-2 mt-3 bg-chess-card border border-chess-border rounded-full px-4 py-1.5 text-sm">
              <TrendingUp className="w-3.5 h-3.5 text-pawn-gold" />
              <span className="text-pawn-gold font-bold">{dbUser.currentPoints.toFixed(1)} MMR</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">{dbUser.rank}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

          {/* ── Quick Match card ──────────────────────────────────────────── */}
          <div className="bg-chess-card border-2 border-chess-border rounded-2xl p-6 sm:p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-pawn-gold/10 border border-pawn-gold/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-pawn-gold" />
              </div>
              <h2 className="text-xl font-extrabold text-white">Quick Match</h2>
            </div>
            <p className="text-slate-400 text-sm mb-5 ml-[52px]">
              Play against a real opponent — MMR-matched
            </p>

            {/* Time control selector */}
            {!inQueue && (
              <div className="mb-5">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Time Control</p>
                <div className="flex flex-wrap gap-2">
                  {TIME_CONTROLS.map((tc) => (
                    <button key={tc.label} onClick={() => setSelectedTC(tc)}
                      className={`px-3 h-9 rounded-lg text-sm font-semibold border transition-all ${
                        selectedTC.label === tc.label
                          ? 'bg-pawn-gold text-slate-900 border-pawn-gold'
                          : 'bg-chess-bg border-chess-border text-slate-300 hover:border-pawn-gold hover:text-white'
                      }`}>
                      <span>{tc.label}</span>
                      <span className={`ml-1 text-[10px] ${selectedTC.label === tc.label ? 'text-slate-800' : 'text-slate-500'}`}>{tc.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Queue status */}
            {inQueue && (
              <div className="mb-4 bg-blue-900/20 border border-blue-700/30 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-blue-300 font-semibold text-sm">Searching for opponent…</span>
                </div>
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                  <span><Clock className="w-3 h-3 inline mr-1" />{formatWait(waitSecs)}</span>
                  {queueSize > 1 && <span><Users className="w-3 h-3 inline mr-1" />{queueSize} in queue</span>}
                  <span className="text-pawn-gold font-medium">{selectedTC.label}</span>
                </div>
              </div>
            )}

            <div className="mt-auto">
              {!socket ? (
                <div className="w-full h-12 rounded-xl bg-slate-700 flex items-center justify-center text-slate-400 text-sm">
                  Connecting…
                </div>
              ) : inQueue ? (
                <button onClick={leaveQueue}
                  className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold transition-colors text-sm">
                  Cancel Search
                </button>
              ) : (
                <button onClick={joinQueue}
                  className="w-full h-12 rounded-xl bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-extrabold transition-colors flex items-center justify-center gap-2">
                  <Swords className="w-4 h-4" />
                  Find Match
                </button>
              )}
            </div>
          </div>

          {/* ── Play vs Bots card ─────────────────────────────────────────── */}
          <Link href="/play/bot"
            className="bg-chess-card border-2 border-chess-border hover:border-pawn-gold/50 rounded-2xl p-6 sm:p-8 flex flex-col transition-colors group">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-slate-700/60 border border-slate-600/50 flex items-center justify-center group-hover:border-pawn-gold/30 transition-colors">
                <Bot className="w-5 h-5 text-slate-300" />
              </div>
              <h2 className="text-xl font-extrabold text-white">Play vs Bots</h2>
            </div>
            <p className="text-slate-400 text-sm mb-5 ml-[52px]">
              Practice against AI from Beginner to Grandmaster level
            </p>
            <div className="flex flex-wrap gap-2 mb-6 ml-[52px]">
              {['250', '800', '1600', '2400', '3200'].map((elo) => (
                <span key={elo} className="bg-chess-bg text-slate-400 text-xs px-2.5 py-1 rounded border border-chess-border">
                  ELO {elo}
                </span>
              ))}
            </div>
            <div className="mt-auto">
              <div className="w-full h-12 rounded-xl bg-chess-bg border border-chess-border group-hover:border-pawn-gold/30 text-white font-bold flex items-center justify-center gap-2 transition-colors text-sm">
                <GiCrossedSwords className="text-pawn-gold text-lg" />
                Choose Opponent →
              </div>
            </div>
          </Link>
        </div>

        {/* ── Recent games link ────────────────────────────────────────────── */}
        <div className="mt-6 text-center">
          <Link href="/profile" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            View game history & stats →
          </Link>
        </div>
      </div>
    </div>
  )
}
