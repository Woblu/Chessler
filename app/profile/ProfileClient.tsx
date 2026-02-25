'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GiVisoredHelm, GiTrophy, GiCompass, GiBrain } from 'react-icons/gi'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface UserStats {
  user: {
    id: string
    name: string
    rating: number
    pawns: number
    totalGames: number
  }
  winRate: number
  furthestRegion: string | null
  puzzlesSolved: number
  chartData: Array<{
    date: string
    points: number
  }>
}

interface Props {
  initialStats: UserStats | null
}

export default function ProfilePage({ initialStats }: Props) {
  const [stats] = useState<UserStats | null>(initialStats)

  if (!stats) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="text-white text-xl">Failed to load profile</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-chess-bg">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Top Banner */}
        <div className="bg-chess-card rounded-xl shadow-lg p-4 sm:p-8 mb-4 sm:mb-6 border border-chess-border">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-24 sm:h-24 shrink-0 bg-gradient-to-br from-pawn-gold to-pawn-gold-hover rounded-full flex items-center justify-center">
              <GiVisoredHelm className="text-4xl sm:text-6xl text-slate-900 drop-shadow-md" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-1 sm:mb-2 truncate">{stats.user.name}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="inline-block bg-gradient-to-br from-pawn-gold to-pawn-gold-hover text-slate-900 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg">
                  <div className="text-xs sm:text-sm opacity-90">Rating</div>
                  <div className="text-lg sm:text-2xl font-bold">{Math.round(stats.user.rating)}</div>
                </div>
                <div className="text-slate-300 text-sm sm:text-base">
                  <span className="font-semibold text-white">{stats.user.totalGames}</span> Total Games
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
          {/* Win Rate Card */}
          <div className="bg-chess-card rounded-xl shadow-lg p-6 border border-chess-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-slate-300 text-sm font-medium">Win Rate</div>
              <GiTrophy className="w-8 h-8 text-pawn-gold drop-shadow-md" />
            </div>
            <div className="text-3xl font-extrabold text-white mb-1">{stats.winRate}%</div>
            <div className="text-sm text-slate-400">
              {stats.user.totalGames > 0
                ? `Based on ${stats.user.totalGames} games`
                : 'No games played yet'}
            </div>
          </div>

          {/* World Tour Card */}
          <div className="bg-chess-card rounded-xl shadow-lg p-6 border border-chess-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-slate-300 text-sm font-medium">World Tour</div>
              <GiCompass className="w-8 h-8 text-pawn-gold drop-shadow-md" />
            </div>
            <div className="text-3xl font-extrabold text-white mb-1">
              {stats.furthestRegion || 'Not Started'}
            </div>
            <div className="text-sm text-slate-400">
              {stats.furthestRegion ? 'Furthest region unlocked' : 'Start your journey!'}
            </div>
          </div>

          {/* Tactics Card */}
          <div className="bg-chess-card rounded-xl shadow-lg p-6 border border-chess-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-slate-300 text-sm font-medium">Tactics</div>
              <GiBrain className="w-8 h-8 text-pawn-gold drop-shadow-md" />
            </div>
            <div className="text-3xl font-extrabold text-white mb-1">{stats.puzzlesSolved}</div>
            <div className="text-sm text-slate-400">Puzzles & challenges solved</div>
          </div>
        </div>

        {/* Progression Chart */}
        <div className="bg-chess-card rounded-xl shadow-lg p-8 mb-6 border border-chess-border">
          <h2 className="text-2xl font-extrabold text-white mb-6">Performance Progression</h2>
          {stats.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Points', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                  }}
                  labelStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="points"
                  stroke="#fbbf24"
                  strokeWidth={3}
                  fill="url(#colorPoints)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-400">
              <p>No game data available yet. Play some games to see your progression!</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-chess-card rounded-xl shadow-lg p-8 border border-chess-border">
          <h2 className="text-2xl font-extrabold text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/play"
              className="p-6 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors transform hover:scale-105"
            >
              <div className="text-xl font-bold mb-2">Play Now</div>
              <div className="text-sm opacity-90">Start a new game</div>
            </Link>
            <Link
              href="/campaign"
              className="p-6 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors transform hover:scale-105"
            >
              <div className="text-xl font-bold mb-2">World Tour</div>
              <div className="text-sm opacity-90">Continue your campaign</div>
            </Link>
          </div>
        </div>

        {/* Rating system */}
        <div className="mt-6 bg-chess-card rounded-xl shadow-lg p-8 border border-chess-border">
          <h2 className="text-2xl font-extrabold text-white mb-4">Rating (Glicko-2)</h2>
          <div className="space-y-3 text-slate-300">
            <div className="flex items-start">
              <span className="text-pawn-gold mr-3">✓</span>
              <span>Industry-standard Glicko-2 rating — same system used by Lichess and other major chess platforms.</span>
            </div>
            <div className="flex items-start">
              <span className="text-pawn-gold mr-3">✓</span>
              <span>Your rating updates after every game based on result and opponent strength.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
