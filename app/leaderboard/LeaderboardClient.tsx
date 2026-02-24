'use client'

import { useState } from 'react'
import { Trophy, TrendingUp, Users, Medal } from 'lucide-react'
import type { LeaderboardEntry } from './page'

// ─── Rank display config ───────────────────────────────────────────────────

const RANK_CONFIG: Record<string, { color: string; badge: string; icon: string }> = {
  Beginner:     { color: 'text-slate-400',  badge: 'bg-slate-700/60 text-slate-300',   icon: '◆' },
  Novice:       { color: 'text-green-400',  badge: 'bg-green-900/50 text-green-300',   icon: '◆' },
  Intermediate: { color: 'text-blue-400',   badge: 'bg-blue-900/50 text-blue-300',     icon: '◆◆' },
  Advanced:     { color: 'text-yellow-400', badge: 'bg-yellow-900/50 text-yellow-300', icon: '◆◆◆' },
  Expert:       { color: 'text-orange-400', badge: 'bg-orange-900/50 text-orange-300', icon: '✦✦' },
  Master:       { color: 'text-purple-400', badge: 'bg-purple-900/50 text-purple-300', icon: '★★★' },
  Grandmaster:  { color: 'text-yellow-300', badge: 'bg-amber-900/60 text-amber-200',   icon: '♛♛♛' },
}

function getRankConfig(rank: string) {
  return RANK_CONFIG[rank] ?? RANK_CONFIG['Beginner']
}

function positionBadge(pos: number) {
  if (pos === 1) return <span className="text-yellow-400 text-xl" title="1st">🥇</span>
  if (pos === 2) return <span className="text-slate-300 text-xl" title="2nd">🥈</span>
  if (pos === 3) return <span className="text-amber-600 text-xl" title="3rd">🥉</span>
  return <span className="text-slate-500 font-mono text-sm w-6 text-right inline-block">#{pos}</span>
}

// ─── Component ─────────────────────────────────────────────────────────────

interface Props {
  entries: LeaderboardEntry[]
  currentUserId: string | null
}

export default function LeaderboardClient({ entries, currentUserId }: Props) {
  const [filter, setFilter] = useState<string>('all')

  const ranks = Array.from(new Set(entries.map((e) => e.rank)))
  const visible = filter === 'all' ? entries : entries.filter((e) => e.rank === filter)

  const userEntry = entries.find((e) => e.id === currentUserId)
  const userPosition = entries.findIndex((e) => e.id === currentUserId) + 1

  return (
    <div className="min-h-screen bg-chess-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-pawn-gold/10 border border-pawn-gold/30 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-pawn-gold" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Leaderboard</h1>
            </div>
            <p className="text-slate-400 text-sm ml-[52px]">Top {entries.length} players ranked by MMR</p>
          </div>
          {userEntry && userPosition > 0 && (
            <div className="bg-chess-card border border-pawn-gold/30 rounded-xl px-4 py-3 text-sm">
              <p className="text-slate-400 text-xs mb-1">Your position</p>
              <p className="text-pawn-gold font-extrabold text-xl">#{userPosition}</p>
              <p className="text-slate-300 text-xs">{userEntry.currentPoints.toFixed(1)} MMR</p>
            </div>
          )}
        </div>

        {/* Rank filter */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button onClick={() => setFilter('all')}
            className={`px-3 h-8 rounded-full text-xs font-semibold border transition-colors ${filter === 'all' ? 'bg-pawn-gold text-slate-900 border-pawn-gold' : 'bg-chess-card border-chess-border text-slate-400 hover:text-white'}`}>
            All Ranks
          </button>
          {ranks.map((r) => {
            const cfg = getRankConfig(r)
            return (
              <button key={r} onClick={() => setFilter(r)}
                className={`px-3 h-8 rounded-full text-xs font-semibold border transition-colors ${filter === r ? `${cfg.badge} border-transparent` : 'bg-chess-card border-chess-border text-slate-400 hover:text-white'}`}>
                {r}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="bg-chess-card border border-chess-border rounded-2xl overflow-hidden shadow-xl">
          {/* Table head */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 border-b border-chess-border bg-chess-bg/50">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-2 text-center hidden sm:block">Rank</div>
            <div className="col-span-2 text-right">MMR</div>
            <div className="col-span-2 text-right">W / G</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-chess-border">
            {visible.length === 0 && (
              <div className="py-12 text-center text-slate-500">No players found</div>
            )}
            {visible.map((entry, idx) => {
              const realPos  = entries.indexOf(entry) + 1
              const cfg      = getRankConfig(entry.rank)
              const isMe     = entry.id === currentUserId
              const losses   = entry.totalGames - entry.wins

              return (
                <div key={entry.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors ${
                    isMe
                      ? 'bg-pawn-gold/10 border-l-2 border-pawn-gold'
                      : realPos <= 3
                      ? 'bg-gradient-to-r from-amber-900/10 to-transparent hover:from-amber-900/20'
                      : 'hover:bg-chess-bg/50'
                  }`}
                >
                  {/* Position */}
                  <div className="col-span-1 flex items-center justify-center">
                    {positionBadge(realPos)}
                  </div>

                  {/* Name */}
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-extrabold shrink-0 ${cfg.badge}`}>
                      {entry.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`font-semibold truncate text-sm ${isMe ? 'text-pawn-gold' : 'text-white'}`}>
                      {entry.name}
                      {isMe && <span className="text-[10px] text-pawn-gold/60 ml-1">(you)</span>}
                    </span>
                  </div>

                  {/* Rank badge */}
                  <div className="col-span-2 hidden sm:flex justify-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.badge}`}>{entry.rank}</span>
                  </div>

                  {/* MMR */}
                  <div className="col-span-2 text-right">
                    <span className={`font-extrabold tabular-nums ${isMe ? 'text-pawn-gold' : cfg.color}`}>
                      {entry.currentPoints.toFixed(1)}
                    </span>
                  </div>

                  {/* W / G */}
                  <div className="col-span-2 text-right text-sm tabular-nums">
                    <span className="text-green-400 font-semibold">{entry.wins}</span>
                    <span className="text-slate-500"> / </span>
                    <span className="text-slate-300">{entry.totalGames}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">Updated in real-time · Top 50 players shown</p>
      </div>
    </div>
  )
}
