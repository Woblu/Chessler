'use client'

import { useState } from 'react'
import { Trophy } from 'lucide-react'
import type { LeaderboardEntry } from './page'

// ─── Rank display config ───────────────────────────────────────────────────

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
            <p className="text-slate-400 text-sm ml-[52px]">Top {entries.length} players by rating (Glicko-2)</p>
          </div>
          {userEntry && userPosition > 0 && (
            <div className="bg-chess-card border border-pawn-gold/30 rounded-xl px-4 py-3 text-sm">
              <p className="text-slate-400 text-xs mb-1">Your position</p>
              <p className="text-pawn-gold font-extrabold text-xl">#{userPosition}</p>
              <p className="text-slate-300 text-xs">{Math.round(userEntry.rating)} rating</p>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-chess-card border border-chess-border rounded-2xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 border-b border-chess-border bg-chess-bg/50">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-2 text-right">Rating</div>
            <div className="col-span-2 text-right">W / G</div>
          </div>

          <div className="divide-y divide-chess-border">
            {entries.length === 0 && (
              <div className="py-12 text-center text-slate-500">No players found</div>
            )}
            {entries.map((entry, idx) => {
              const realPos = idx + 1
              const isMe = entry.id === currentUserId

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
                  <div className="col-span-1 flex items-center justify-center">
                    {positionBadge(realPos)}
                  </div>
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full border border-chess-border bg-chess-bg flex items-center justify-center text-xs font-extrabold shrink-0 text-white">
                      {entry.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`font-semibold truncate text-sm ${isMe ? 'text-pawn-gold' : 'text-white'}`}>
                      {entry.name}
                      {isMe && <span className="text-[10px] text-pawn-gold/60 ml-1">(you)</span>}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`font-extrabold tabular-nums ${isMe ? 'text-pawn-gold' : 'text-white'}`}>
                      {Math.round(entry.rating)}
                    </span>
                  </div>
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
