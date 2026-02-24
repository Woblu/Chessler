'use client'

import { useMemo } from 'react'
import Image from 'next/image'

/**
 * Rank → frame config.
 * Frames are CSS-only ring effects — no external assets required.
 */
const RANK_FRAMES: Record<
  string,
  { ringColor: string; glowClass: string; label: string } | null
> = {
  Beginner:     null,
  Novice:       null,
  Intermediate: { ringColor: '#cd7f32', glowClass: '',                    label: 'Bronze' },
  Advanced:     { ringColor: '#cd7f32', glowClass: 'rank-glow-bronze',    label: 'Bronze' },
  Expert:       { ringColor: '#c0c0c0', glowClass: 'rank-glow-silver',    label: 'Silver' },
  Master:       { ringColor: '#ffd700', glowClass: 'rank-glow-gold',      label: 'Gold'   },
  Grandmaster:  { ringColor: '#ff6b00', glowClass: 'rank-glow-gm',        label: 'GM'     },
}

interface RankAvatarProps {
  name: string
  rank?: string
  /** Optional image src; falls back to initials */
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  sm: { outer: 'w-8 h-8',   inner: 'w-7 h-7',   text: 'text-xs' },
  md: { outer: 'w-10 h-10', inner: 'w-9 h-9',   text: 'text-sm' },
  lg: { outer: 'w-16 h-16', inner: 'w-14 h-14', text: 'text-lg' },
  xl: { outer: 'w-24 h-24', inner: 'w-20 h-20', text: 'text-2xl' },
}

export default function RankAvatar({
  name,
  rank = 'Beginner',
  src,
  size = 'md',
  className = '',
}: RankAvatarProps) {
  const frame = RANK_FRAMES[rank] ?? null
  const sizes = SIZE_MAP[size]
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${sizes.outer} ${className}`}
      title={frame ? `${frame.label} Frame` : undefined}
      style={
        frame
          ? {
              background: `conic-gradient(from 0deg, ${frame.ringColor}cc, ${frame.ringColor}22, ${frame.ringColor}cc)`,
              padding: '2px',
              borderRadius: '9999px',
              // Glow
              boxShadow:
                rank === 'Grandmaster'
                  ? `0 0 8px 3px ${frame.ringColor}88, 0 0 16px 6px ${frame.ringColor}44`
                  : `0 0 6px 2px ${frame.ringColor}55`,
            }
          : undefined
      }
    >
      {/* Inner circle */}
      <span
        className={`relative inline-flex items-center justify-center rounded-full bg-slate-700 overflow-hidden ${frame ? sizes.inner : sizes.outer}`}
      >
        {src ? (
          <Image src={src} alt={name} fill className="object-cover" sizes="96px" />
        ) : (
          <span className={`font-extrabold ${sizes.text} text-white select-none`}>{initials}</span>
        )}
      </span>

      {/* GM animated pulse ring */}
      {rank === 'Grandmaster' && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: 'transparent',
            border: '2px solid #ff6b0066',
            animationDuration: '2s',
          }}
        />
      )}
    </span>
  )
}
