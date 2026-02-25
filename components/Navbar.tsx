'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUser, SignInButton } from '@clerk/nextjs'
import {
  GiVisoredHelm,
  GiCrossedSwords,
  GiBookCover,
  GiOpenTreasureChest,
  GiWorld,
  GiPuzzle,
  GiCoins,
} from 'react-icons/gi'
import { HiCog, HiChevronDown, HiMenuAlt3, HiX } from 'react-icons/hi'
import { Trophy } from 'lucide-react'
import { useDbUser } from '@/app/context/UserContext'
import RankAvatar from '@/components/RankAvatar'

const NAV_LINKS = [
  { href: '/profile',     label: 'Profile',     Icon: GiVisoredHelm },
  { href: '/play',        label: 'Play',        Icon: GiCrossedSwords },
  { href: '/learn',       label: 'Learn',       Icon: GiBookCover },
  { href: '/shop',        label: 'Shop',        Icon: GiOpenTreasureChest },
  { href: '/campaign',    label: 'Campaign',    Icon: GiWorld },
  { href: '/puzzles',     label: 'Puzzles',     Icon: GiPuzzle },
  { href: '/leaderboard', label: 'Leaderboard', Icon: Trophy },
  { href: '/settings',    label: 'Settings',    Icon: HiCog },
] as const

// Desktop bar shows everything except Settings (Settings is a gear icon on the right)
const DESKTOP_NAV_LINKS = NAV_LINKS.filter((l) => l.href !== '/settings')

export default function Navbar() {
  const pathname = usePathname()
  const { isSignedIn } = useUser()
  const { dbUser } = useDbUser()
  const [mounted, setMounted] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')
  const displayRating = dbUser?.rating != null ? Math.round(dbUser.rating) : null

  return (
    <nav className="bg-slate-950 border-b border-chess-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-14 sm:h-16">

          {/* ── Left: Logo + desktop links ──────────────────────────────── */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image src="/rooklysmall.png" alt="Checkmate" width={32} height={32} className="w-7 h-7 sm:w-8 sm:h-8 object-contain" priority />
              <span className="font-bold text-lg sm:text-xl">
                <span className="text-blue-400">Check</span>
                <span className="text-orange-400">mate</span>
              </span>
            </Link>

            {/* Desktop links (no Settings — that's a gear on the right) */}
            <div className="hidden lg:flex items-center gap-0.5">
              <Link href="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/') && pathname === '/' ? 'bg-pawn-gold text-slate-900' : 'text-slate-300 hover:bg-chess-card hover:text-white'
                }`}
              >
                Home
              </Link>
              {dbUser && DESKTOP_NAV_LINKS.map(({ href, label, Icon }) => (
                <Link key={href} href={href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive(href) ? 'bg-pawn-gold text-slate-900' : 'text-slate-300 hover:bg-chess-card hover:text-white'
                  }`}
                >
                  <Icon className="text-base" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* ── Right: Settings gear | Pawns | Profile dropdown (rightmost) | Hamburger ──────────────────────────── */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {dbUser ? (
              <>
                {/* Settings — gear icon only, left of pawns */}
                <Link
                  href="/settings"
                  className={`hidden lg:flex items-center justify-center w-10 h-10 rounded-lg border transition-colors shrink-0 ${
                    isActive('/settings') ? 'bg-pawn-gold text-slate-900 border-pawn-gold' : 'bg-chess-card border-chess-border text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  title="Settings"
                  aria-label="Settings"
                >
                  <HiCog className="text-xl" />
                </Link>

                {/* Pawns pill */}
                <div className="hidden sm:flex items-center gap-1.5 bg-chess-card px-3 py-1.5 rounded-full border border-chess-border shrink-0">
                  <GiCoins className="text-pawn-gold text-base" />
                  <span className="text-white font-semibold text-sm tabular-nums">{dbUser.pawns}</span>
                  <span className="text-slate-400 text-xs hidden md:inline">pawns</span>
                </div>

                {/* Profile dropdown — rightmost on desktop */}
                <div className="hidden lg:block relative shrink-0" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center gap-2 bg-chess-card px-3 py-1.5 rounded-lg border border-chess-border hover:bg-slate-700 transition-colors min-w-0 w-full max-w-full"
                  >
                    <RankAvatar name={dbUser.name} size="sm" className="shrink-0" />
                    <span className="text-white font-medium text-sm truncate min-w-0">{dbUser.name}</span>
                    {displayRating != null && <span className="text-slate-400 text-xs tabular-nums shrink-0">{displayRating}</span>}
                    <HiChevronDown className={`text-slate-400 text-sm transition-transform shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-chess-card rounded-xl border border-chess-border shadow-xl z-50">
                      <div className="p-4 space-y-3">
                        {/* Avatar + name header */}
                        <div className="flex items-center gap-3 pb-3 border-b border-chess-border">
                          <RankAvatar name={dbUser.name} size="md" />
                          <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{dbUser.name}</p>
                            {displayRating != null && <p className="text-slate-400 text-xs tabular-nums">Rating {displayRating}</p>}
                          </div>
                        </div>
                        <Link href="/profile" onClick={() => setDropdownOpen(false)}
                          className="block w-full text-center px-4 py-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors text-sm">
                          View Profile
                        </Link>
                        <Link href="/settings" onClick={() => setDropdownOpen(false)}
                          className="block w-full text-center px-4 py-2 bg-chess-bg hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm">
                          Settings
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : mounted && isSignedIn === false ? (
              <SignInButton mode="redirect">
                <button className="px-4 py-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors text-sm h-9">
                  Sign In
                </button>
              </SignInButton>
            ) : null}

            {/* Hamburger — shows below lg */}
            {dbUser && (
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-chess-card border border-chess-border text-slate-300 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <HiX className="text-xl" /> : <HiMenuAlt3 className="text-xl" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile menu ─────────────────────────────────────────────────── */}
      {mobileOpen && dbUser && (
        <div className="lg:hidden border-t border-chess-border bg-slate-950 px-4 pb-4 pt-2">
          {/* User info strip */}
          <div className="flex items-center justify-between py-3 mb-2 border-b border-chess-border/50">
            <div className="flex items-center gap-2">
              <RankAvatar name={dbUser.name} size="sm" />
              <span className="text-white font-semibold truncate max-w-[160px]">{dbUser.name}</span>
              {displayRating != null && <span className="text-slate-500 text-xs tabular-nums">· {displayRating}</span>}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <GiCoins className="text-pawn-gold" />
              <span className="text-white font-bold tabular-nums">{dbUser.pawns}</span>
            </div>
          </div>

          {/* Nav links */}
          <div className="space-y-1">
            {NAV_LINKS.map(({ href, label, Icon }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 h-12 rounded-xl text-sm font-medium transition-colors ${
                  isActive(href) ? 'bg-pawn-gold text-slate-900' : 'text-slate-300 hover:bg-chess-card hover:text-white'
                }`}
              >
                <Icon className="text-lg shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
