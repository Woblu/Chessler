'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, useClerk } from '@clerk/nextjs'
import { GiCrossedSwords, GiBookCover, GiPuzzle, GiOpenTreasureChest, GiWorld, GiTrophy } from 'react-icons/gi'
import { assignDailyQuests } from '@/actions/quests'
import { useDbUser } from '@/app/context/UserContext'

interface Boss {
  name: string
  elo: number
  regionName: string
}

interface Opening {
  id: string
  name: string
}

interface PuzzleTheme {
  theme: string
  description: string
}

interface LeaderboardUser {
  id: string
  name: string
  rating: number
}

interface Cosmetic {
  id: string
  name: string
  price: number
  type: string
}

export default function HomePage() {
  const { isSignedIn } = useUser()
  const { signOut } = useClerk()
  const { dbUser, isUserLoading, loadError, loadErrorDetail, refetchUser } = useDbUser()
  const [boss, setBoss] = useState<Boss | null>(null)
  const [openings, setOpenings] = useState<Opening[]>([])
  const [puzzleTheme, setPuzzleTheme] = useState<PuzzleTheme | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [featuredCosmetics, setFeaturedCosmetics] = useState<Cosmetic[]>([])

  useEffect(() => {
    if (dbUser?.id) {
      fetchDashboardData()
      assignDailyQuests(dbUser.id).catch((error) => {
        console.error('Error assigning daily quests:', error)
      })
    }
  }, [dbUser?.id])

  const fetchDashboardData = async () => {
    try {
      const [bossRes, openingsRes, puzzleRes, leaderboardRes, cosmeticsRes] = await Promise.all([
        fetch('/api/dashboard/current-boss'),
        fetch('/api/dashboard/openings'),
        fetch('/api/dashboard/puzzle-theme'),
        fetch('/api/dashboard/leaderboard'),
        fetch('/api/dashboard/featured-cosmetics'),
      ])

      if (bossRes.ok) {
        const bossData = await bossRes.json()
        setBoss(bossData.boss)
      }

      if (openingsRes.ok) {
        const openingsData = await openingsRes.json()
        setOpenings(openingsData.openings || [])
      }

      if (puzzleRes.ok) {
        const puzzleData = await puzzleRes.json()
        setPuzzleTheme(puzzleData)
      }

      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json()
        setLeaderboard(leaderboardData.users || [])
      }

      if (cosmeticsRes.ok) {
        const cosmeticsData = await cosmeticsRes.json()
        setFeaturedCosmetics(cosmeticsData.cosmetics || [])
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Signed in with Clerk but app profile failed to load — show retry so we don't loop to /login
  if (isSignedIn && !dbUser) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4">
        <div className="bg-chess-card border border-chess-border rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Couldn’t load your profile</h1>
          <p className="text-slate-400 text-sm mb-6">
            Try again or sign out and sign back in to fix the issue.
          </p>
          {loadErrorDetail && (
            <p className="text-amber-200/90 text-xs mb-4 font-mono max-h-24 overflow-y-auto text-left">
              {loadErrorDetail}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => refetchUser()}
              className="px-5 py-2.5 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => signOut?.({ redirectUrl: '/' })}
              className="px-5 py-2.5 bg-chess-bg border border-chess-border text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Not logged in - show landing page
  if (!dbUser) {
    return (
      <div className="min-h-screen bg-chess-bg">
        <div className="bg-gradient-to-br from-pawn-gold to-pawn-gold-hover text-slate-900 py-20">
          <div className="max-w-7xl mx-auto px-4 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm shrink-0">
              <Image src="/rooklysmall.png" alt="" width={56} height={56} className="w-14 h-14 object-contain" />
            </div>
            <h1 className="text-5xl font-extrabold mb-4">
              Welcome to <span className="text-blue-600">Check</span><span className="text-orange-500">mate</span>
            </h1>
            <p className="text-xl mb-8 text-slate-900/90">
              Play chess, climb ranks, and compete with players worldwide
            </p>
            <div className="flex justify-center space-x-4">
              <Link
                href="/register"
                className="px-8 py-3 bg-white text-slate-900 rounded-lg font-bold hover:bg-slate-100 transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="px-8 py-3 bg-white/20 text-slate-900 rounded-lg font-bold hover:bg-white/30 transition-colors backdrop-blur-sm"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-chess-bg">
      {/* Main Layout - 12 Column Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Hero Section - 8 columns */}
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-gradient-to-br from-chess-card to-slate-700 rounded-xl p-8 border border-chess-border relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                }} />
              </div>

              <div className="relative z-10">
                <h2 className="text-3xl font-extrabold text-white mb-2">World Tour Campaign</h2>
                {boss ? (
                  <>
                    <p className="text-slate-300 mb-4">
                      Next up: <span className="text-pawn-gold font-semibold">{boss.name}</span> in {boss.regionName}
                    </p>
                    <p className="text-slate-300 text-sm mb-6">Bot ELO: {boss.elo}</p>
                    <Link
                      href="/campaign"
                      className="inline-block px-6 py-3 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
                    >
                      Resume Campaign
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-slate-300 mb-6">Start your journey around the world!</p>
                    <Link
                      href="/campaign"
                      className="inline-block px-6 py-3 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
                    >
                      Start Campaign
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Play & Multiplayer - 4 columns */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Play Online */}
            <div className="bg-chess-card rounded-xl p-6 border border-chess-border">
              <h3 className="text-xl font-extrabold text-white mb-4">Play Online</h3>
              <Link
                href="/play"
                className="block w-full text-center px-4 py-3 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
              >
                Find Match
              </Link>
            </div>

            {/* Bot Arena */}
            <div className="bg-chess-card rounded-xl p-6 border border-chess-border">
              <h3 className="text-xl font-extrabold text-white mb-4">Bot Arena</h3>
              <Link
                href="/play/bot"
                className="block w-full text-center px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
              >
                Challenge Bot
              </Link>
            </div>
          </div>

          {/* Training Hub - 8 columns */}
          <div className="col-span-12 lg:col-span-8">
            <h3 className="text-2xl font-bold text-white mb-4">Daily Training</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Openings Card */}
              <div className="bg-chess-card rounded-xl p-6 border border-chess-border">
                <div className="flex items-center space-x-3 mb-4">
                  <GiBookCover className="w-8 h-8 text-pawn-gold drop-shadow-md" />
                  <h4 className="text-xl font-extrabold text-white">Openings to Review</h4>
                </div>
                <p className="text-slate-300 mb-4">
                  {openings.length > 0
                    ? `${openings.length} opening${openings.length > 1 ? 's' : ''} need practice`
                    : 'All openings mastered!'}
                </p>
                {openings.length > 0 ? (
                  <Link
                    href="/learn"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
                  >
                    <GiBookCover className="text-xl drop-shadow-md" />
                    Train Next Line
                  </Link>
                ) : (
                  <div className="text-center px-4 py-2 bg-slate-700 text-slate-400 rounded-lg">
                    All Caught Up!
                  </div>
                )}
              </div>

              {/* Puzzles Card */}
              <div className="bg-chess-card rounded-xl p-6 border border-chess-border">
                <div className="flex items-center space-x-3 mb-4">
                  <GiPuzzle className="w-8 h-8 text-pawn-gold drop-shadow-md" />
                  <h4 className="text-xl font-extrabold text-white">Puzzle Training</h4>
                </div>
                <p className="text-slate-300 mb-4">
                  {puzzleTheme ? puzzleTheme.description : 'Master your tactical skills'}
                </p>
                <Link
                  href="/puzzles"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors"
                >
                  <GiPuzzle className="text-xl drop-shadow-md" />
                  Solve for 5 Pawns
                </Link>
              </div>
            </div>
          </div>

          {/* Shop & Leaderboard Sidebar - 4 columns */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Standings */}
            <div className="bg-chess-card rounded-xl p-6 border border-chess-border">
              <div className="flex items-center space-x-2 mb-4">
                <GiTrophy className="w-6 h-6 text-pawn-gold drop-shadow-md" />
                <h3 className="text-xl font-extrabold text-white">Standings</h3>
              </div>
              <div className="space-y-3">
                {leaderboard.length > 0 ? (
                  leaderboard.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-pawn-gold font-bold">#{index + 1}</span>
                        <span className="text-white">{player.name}</span>
                      </div>
                      <span className="text-slate-300 text-sm tabular-nums">{Math.round(player.rating)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-300 text-sm">No players yet</p>
                )}
              </div>
            </div>

            {/* Featured Cosmetics */}
            <div className="bg-chess-card rounded-xl p-6 border border-chess-border">
              <div className="flex items-center space-x-2 mb-4">
                <GiOpenTreasureChest className="w-6 h-6 text-pawn-gold drop-shadow-md" />
                <h3 className="text-xl font-extrabold text-white">Featured Cosmetics</h3>
              </div>
              <div className="space-y-3">
                {featuredCosmetics.length > 0 ? (
                  featuredCosmetics.map((cosmetic) => (
                    <Link
                      key={cosmetic.id}
                      href="/shop"
                      className="block p-3 bg-chess-bg rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{cosmetic.name}</span>
                        <span className="text-pawn-gold font-semibold">{cosmetic.price} ♟</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-slate-300 text-sm">No featured items</p>
                )}
                <Link
                  href="/shop"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors mt-4"
                >
                  <GiOpenTreasureChest className="text-xl drop-shadow-md" />
                  Visit Shop
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
