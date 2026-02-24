'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface PlayerHeaderProps {
  playerName: string
  rank?: string
  points?: number
  capturedPieces: string[]
  isActive: boolean
  /** Seconds remaining on the clock (controlled from parent) */
  timeLeft?: number
  /** Seconds added after each move */
  increment?: number
  /** Called when clock reaches 0 */
  onTimeUp?: () => void
  /** Called when clock ticks — parent can sync its own state */
  onTick?: (newSeconds: number) => void
  /** Called when a move is made and increment should be added */
  onIncrementApply?: (newSeconds: number) => void
  pieceSet?: string
}

export default function PlayerHeader({
  playerName,
  rank,
  points,
  capturedPieces,
  isActive,
  timeLeft,
  increment = 0,
  onTimeUp,
  onTick,
  pieceSet = 'caliente',
}: PlayerHeaderProps) {
  const [displayTime, setDisplayTime] = useState(timeLeft ?? 0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const didFireTimeUpRef = useRef(false)

  // Sync external time into local state (e.g. after increment applied by parent)
  useEffect(() => {
    if (timeLeft !== undefined) setDisplayTime(timeLeft)
  }, [timeLeft])

  // Reset flag-fall guard when new game starts
  useEffect(() => {
    didFireTimeUpRef.current = false
  }, [timeLeft])

  // Clock tick
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (isActive && (timeLeft === undefined || timeLeft > 0)) {
      intervalRef.current = setInterval(() => {
        setDisplayTime((prev) => {
          const next = prev - 1
          if (next <= 0) {
            clearInterval(intervalRef.current!)
            if (onTimeUp && !didFireTimeUpRef.current) {
              didFireTimeUpRef.current = true
              onTimeUp()
            }
            return 0
          }
          onTick?.(next)
          return next
        })
      }, 1000)
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isActive]) // intentionally only re-run when isActive changes

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const getPieceImage = useCallback((piece: string): string => {
    const ps = pieceSet?.toLowerCase() || 'caliente'
    const map: Record<string, string> = {
      p: `/pieces/${ps}/bP.svg`, r: `/pieces/${ps}/bR.svg`,
      n: `/pieces/${ps}/bN.svg`, b: `/pieces/${ps}/bB.svg`,
      q: `/pieces/${ps}/bQ.svg`, k: `/pieces/${ps}/bK.svg`,
      P: `/pieces/${ps}/wP.svg`, R: `/pieces/${ps}/wR.svg`,
      N: `/pieces/${ps}/wN.svg`, B: `/pieces/${ps}/wB.svg`,
      Q: `/pieces/${ps}/wQ.svg`, K: `/pieces/${ps}/wK.svg`,
    }
    return map[piece] ?? ''
  }, [pieceSet])

  const isLowTime = displayTime > 0 && displayTime < 30
  const isCritical = displayTime > 0 && displayTime < 10

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg border-2 transition-all duration-200 ${
        isActive
          ? 'bg-[#3a5a4a] border-[#4a7c59] shadow-lg'
          : 'bg-[#2d2d2d] border-[#3d3d3d]'
      }`}
    >
      {/* Player info */}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm sm:text-base font-bold text-[#f0d9b5] truncate">{playerName}</h3>
        {(rank || points !== undefined) && (
          <p className="text-xs text-[#b58863] truncate">
            {rank && <span>{rank}</span>}
            {rank && points !== undefined && <span> · </span>}
            {points !== undefined && <span>{points.toFixed(1)} pts</span>}
          </p>
        )}
      </div>

      {/* Captured pieces */}
      <div className="flex-1 flex flex-wrap items-center justify-center gap-0.5 mx-2 max-w-[160px] sm:max-w-xs overflow-hidden">
        {capturedPieces.slice(0, 15).map((piece, i) => (
          <img
            key={i}
            src={getPieceImage(piece)}
            alt=""
            className="w-3.5 h-3.5 opacity-60 object-contain"
            onError={(e) => {
              const t = e.target as HTMLImageElement
              if (!t.src.includes('/caliente/'))
                t.src = getPieceImage(piece).replace(`/${pieceSet}/`, '/caliente/')
              else
                t.style.display = 'none'
            }}
          />
        ))}
      </div>

      {/* Clock */}
      {timeLeft !== undefined && (
        <div
          className={`font-mono font-extrabold tabular-nums text-lg sm:text-2xl shrink-0 px-2 py-0.5 rounded transition-colors ${
            isCritical
              ? 'text-red-400 animate-pulse bg-red-900/20'
              : isLowTime
              ? 'text-orange-400'
              : isActive
              ? 'text-[#f0d9b5]'
              : 'text-[#8b8b8b]'
          }`}
        >
          {formatTime(displayTime)}
          {increment > 0 && (
            <span className="text-xs text-slate-500 ml-1 font-normal">+{increment}</span>
          )}
        </div>
      )}
    </div>
  )
}
