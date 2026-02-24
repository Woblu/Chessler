'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  Graticule,
} from 'react-simple-maps'
import { MapPin, Plane } from 'lucide-react'
import Image from 'next/image'

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface Region {
  id: string
  name: string
  order: number
  longitude: number
  latitude: number
  isCurrent: boolean
  isLocked: boolean
}

interface Props {
  initialRegions: Region[]
  initialCurrentRegionId: string | null
  pieceSet: string
}

function CampaignPageInner({ initialRegions, initialCurrentRegionId, pieceSet }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [regions, setRegions] = useState<Region[]>(initialRegions ?? [])
  const [currentRegionId, setCurrentRegionId] = useState<string | null>(initialCurrentRegionId ?? null)

  // Airplane animation state
  const [isFlying, setIsFlying] = useState(false)
  const [airplanePos, setAirplanePos] = useState<[number, number] | null>(() => {
    const current = initialRegions.find((r) => r.id === initialCurrentRegionId)
    return current ? [current.longitude, current.latitude] : null
  })
  const [flyFrom, setFlyFrom] = useState<[number, number] | null>(null)
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null)
  const pendingNavRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)

  // Arrival animation (returning from a tournament with ?unlocked=true)
  const [previousRegionId, setPreviousRegionId] = useState<string | null>(null)

  // Sync regions from API on mount (handles empty initial data or DB seeded after load)
  useEffect(() => {
    fetch('/api/campaign/regions')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.regions?.length) {
          setRegions(data.regions)
          if (data.currentRegionId != null) setCurrentRegionId(data.currentRegionId)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const justUnlocked = searchParams.get('unlocked') === 'true'
    if (justUnlocked) {
      // Re-fetch to get updated region data after unlocking
      fetch('/api/campaign/regions')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setRegions(data.regions || [])
            setCurrentRegionId(data.currentRegionId)
          }
        })
        .catch(console.error)

      const prevRegion = sessionStorage.getItem('previousRegionId')
      if (prevRegion) {
        setPreviousRegionId(prevRegion)
        sessionStorage.removeItem('previousRegionId')
        window.history.replaceState({}, '', '/campaign')
      }
    }
  }, [searchParams])

  // Animate airplane between two coordinates, then call onComplete
  const startFlight = (
    from: [number, number],
    to: [number, number],
    onComplete: () => void
  ) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    setFlyFrom(from)
    setFlyTo(to)
    setAirplanePos(from)
    setIsFlying(true)

    const duration = 1500
    const startTime = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2

      setAirplanePos([
        from[0] + (to[0] - from[0]) * eased,
        from[1] + (to[1] - from[1]) * eased,
      ])

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setIsFlying(false)
        rafRef.current = null
        onComplete()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  // Arrival animation once regions load after ?unlocked=true
  useEffect(() => {
    if (!previousRegionId || regions.length === 0) return

    const prevRegion = regions.find((r) => r.id === previousRegionId)
    const currRegion = regions.find((r) => r.id === currentRegionId)
    if (!prevRegion || !currRegion) return

    startFlight(
      [prevRegion.longitude, prevRegion.latitude],
      [currRegion.longitude, currRegion.latitude],
      () => setPreviousRegionId(null)
    )
  }, [previousRegionId, regions])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleRegionClick = (region: Region) => {
    if (region.isLocked || isFlying) return

    const currentRegion = regions.find((r) => r.id === currentRegionId)

    // If no current region tracked, navigate directly
    if (!currentRegion || region.id === currentRegionId) {
      router.push(`/campaign/${region.id}`)
      return
    }

    // Animate airplane from current position to clicked node, then navigate
    pendingNavRef.current = `/campaign/${region.id}`
    startFlight(
      [currentRegion.longitude, currentRegion.latitude],
      [region.longitude, region.latitude],
      () => {
        const url = pendingNavRef.current
        pendingNavRef.current = null
        if (url) router.push(url)
      }
    )
  }

  return (
    <div className="min-h-screen bg-chess-bg relative overflow-hidden">
      <div className="relative z-10 py-4 sm:py-8 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-4 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-1 sm:mb-2">
              World Chess Tour
            </h1>
            <p className="text-slate-300 text-sm sm:text-base">
              Compete in regional tournaments around the globe!
            </p>
          </div>

          {/* Empty state: no regions in DB (run seed-tournament) */}
          {regions.length === 0 && (
            <div className="rounded-xl bg-chess-card border-2 border-slate-600 p-6 sm:p-8 mb-6 text-center">
              <p className="text-white font-medium mb-2">No regions or tournaments are loaded yet.</p>
              <p className="text-slate-300 text-sm mb-4">
                The map, your position, and tournament cards will appear after the campaign data is seeded.
              </p>
              <p className="text-slate-400 text-xs font-mono bg-slate-800/50 rounded px-3 py-2 inline-block">
                npm run seed-tournament
              </p>
            </div>
          )}

          {/* Interactive World Map */}
          <div className="w-full aspect-[2/1] sm:aspect-video overflow-hidden rounded-xl bg-slate-900 border-2 border-slate-700 mb-4 sm:mb-8">
            <ComposableMap
              projectionConfig={{ scale: 280, center: [0, 10] }}
              style={{ width: '100%', height: '100%' }}
            >
              <Graticule stroke="#1e293b" strokeWidth={0.5} fill="none" />

              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#334155"
                      stroke="#0f172a"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', fill: '#cbd5e1' },
                        pressed: { outline: 'none', fill: '#fbbf24' },
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Dashed route lines between regions */}
              {regions.map((region, index) => {
                if (index === 0) return null
                const prev = regions[index - 1]
                if (prev.isLocked && region.isLocked) return null
                return (
                  <Line
                    key={`path-${prev.id}-${region.id}`}
                    from={[prev.longitude, prev.latitude]}
                    to={[region.longitude, region.latitude]}
                    stroke="#fbbf24"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    opacity={region.isLocked ? 0.3 : 0.6}
                  />
                )
              })}

              {/* Active flight path highlight */}
              {isFlying && flyFrom && flyTo && (
                <Line
                  from={flyFrom}
                  to={flyTo}
                  stroke="#fbbf24"
                  strokeWidth={3}
                  strokeDasharray="4 4"
                  opacity={0.9}
                />
              )}

              {/* Region markers — render non-current first so the king stays on top */}
              {[
                ...regions.filter((r) => r.id !== currentRegionId),
                ...regions.filter((r) => r.id === currentRegionId),
              ].map((region) => {
                const isCurrent = region.id === currentRegionId
                return (
                  <Marker
                    key={region.id}
                    coordinates={[region.longitude, region.latitude]}
                  >
                    <foreignObject
                      x={-14}
                      y={isCurrent ? -30 : -28}
                      width={28}
                      height={isCurrent ? 30 : 28}
                      onClick={() => handleRegionClick(region)}
                      className={
                        region.isLocked
                          ? 'cursor-not-allowed'
                          : isFlying
                          ? 'cursor-wait'
                          : 'cursor-pointer'
                      }
                    >
                      {isCurrent ? (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="w-full h-full flex items-end justify-center"
                        >
                          {/* White King piece from the user's equipped piece set */}
                          <Image
                            src={`/pieces/${pieceSet}/wK.svg`}
                            alt="Your position"
                            width={28} height={28}
                            className="drop-shadow-[0_0_6px_rgba(251,191,36,0.8)] pointer-events-none"
                            unoptimized
                          />
                        </motion.div>
                      ) : (
                        <div className="w-full h-full flex items-end justify-center">
                          <MapPin
                            className={`w-6 h-6 drop-shadow-lg transition-colors ${
                              region.isLocked
                                ? 'text-slate-600'
                                : 'text-slate-300 hover:text-amber-400'
                            }`}
                          />
                        </div>
                      )}
                    </foreignObject>
                  </Marker>
                )
              })}

              {/* Animated airplane icon */}
              {isFlying && airplanePos && (
                <Marker coordinates={airplanePos}>
                  <foreignObject x={-14} y={-14} width={28} height={28}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <Plane
                        className="w-full h-full text-amber-400 drop-shadow-lg"
                        style={{
                          filter:
                            'drop-shadow(0 0 6px rgba(251, 191, 36, 0.9))',
                          transform: flyFrom && flyTo
                            ? `rotate(${Math.atan2(
                                flyTo[1] - flyFrom[1],
                                flyTo[0] - flyFrom[0]
                              ) * (180 / Math.PI)}deg)`
                            : 'none',
                        }}
                      />
                    </motion.div>
                  </foreignObject>
                </Marker>
              )}
            </ComposableMap>
          </div>

          {/* Region cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => handleRegionClick(region)}
                disabled={region.isLocked || isFlying}
                className={`p-4 h-auto min-h-[4rem] rounded-xl border-2 transition-all text-left ${
                  region.isLocked
                    ? 'bg-chess-card border-chess-border opacity-50 cursor-not-allowed'
                    : region.isCurrent
                    ? 'bg-pawn-gold/20 border-pawn-gold shadow-lg shadow-pawn-gold/50'
                    : 'bg-chess-card border-slate-600 hover:border-pawn-gold active:scale-95'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold text-base sm:text-lg truncate">
                      {region.name}
                    </h3>
                    <p className="text-slate-300 text-xs sm:text-sm">
                      Tournament #{region.order}
                    </p>
                  </div>
                  {region.isCurrent && (
                    <div className="w-3 h-3 bg-pawn-gold rounded-full animate-pulse" />
                  )}
                  {region.isLocked && (
                    <svg
                      className="w-5 h-5 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CampaignClient(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-chess-bg flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CampaignPageInner {...props} />
    </Suspense>
  )
}
