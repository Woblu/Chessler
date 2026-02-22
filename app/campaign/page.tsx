'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  Graticule,
} from 'react-simple-maps'
import { MapPin, Crown } from 'lucide-react'

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

function CampaignPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentRegionId, setCurrentRegionId] = useState<string | null>(null)
  const [previousRegionId, setPreviousRegionId] = useState<string | null>(null)
  const [isFlying, setIsFlying] = useState(false)
  const [airplanePosition, setAirplanePosition] = useState<[number, number] | null>(null)

  useEffect(() => {
    fetchRegions()
    
    // Check if we just unlocked a region (from URL params or session)
    const justUnlocked = searchParams.get('unlocked') === 'true'
    if (justUnlocked) {
      // Trigger flight animation
      const prevRegion = sessionStorage.getItem('previousRegionId')
      if (prevRegion) {
        setPreviousRegionId(prevRegion)
        setIsFlying(true)
        sessionStorage.removeItem('previousRegionId')
        // Clean URL
        window.history.replaceState({}, '', '/campaign')
      }
    }
  }, [searchParams])

  const fetchRegions = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/campaign/regions')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to fetch regions')
      }

      const data = await response.json()
      setRegions(data.regions || [])
      setCurrentRegionId(data.currentRegionId)
      
      // Set airplane position to current region
      const currentRegion = data.regions?.find((r: Region) => r.id === data.currentRegionId)
      if (currentRegion) {
        setAirplanePosition([currentRegion.longitude, currentRegion.latitude])
      }
    } catch (err) {
      console.error('Error fetching regions:', err)
      setError('Failed to load world tour')
    } finally {
      setLoading(false)
    }
  }

  const handleRegionClick = (region: Region) => {
    if (region.isLocked) {
      return
    }
    router.push(`/campaign/${region.id}`)
  }

  const getCurrentRegion = () => {
    return regions.find(r => r.id === currentRegionId)
  }

  const getPreviousRegion = () => {
    return regions.find(r => r.id === previousRegionId)
  }

  // Get flight path coordinates for animation
  const getFlightPath = () => {
    const currentRegion = getCurrentRegion()
    const previousRegion = getPreviousRegion()
    
    if (!currentRegion || !previousRegion) return null
    
    return {
      from: [previousRegion.longitude, previousRegion.latitude] as [number, number],
      to: [currentRegion.longitude, currentRegion.latitude] as [number, number],
    }
  }

  // Animate airplane along flight path
  useEffect(() => {
    if (isFlying) {
      const path = getFlightPath()
      if (!path) return

      const duration = 2000 // 2 seconds
      const startTime = Date.now()
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Ease in-out
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2
        
        const currentLon = path.from[0] + (path.to[0] - path.from[0]) * eased
        const currentLat = path.from[1] + (path.to[1] - path.from[1]) * eased
        
        setAirplanePosition([currentLon, currentLat])
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setIsFlying(false)
          setPreviousRegionId(null)
        }
      }
      
      animate()
    }
  }, [isFlying, previousRegionId, currentRegionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    )
  }

  const currentRegion = getCurrentRegion()
  const previousRegion = getPreviousRegion()
  const flightPath = getFlightPath()

  return (
    <div className="min-h-screen bg-chess-bg relative overflow-hidden">
      <div className="relative z-10 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-white mb-2">World Chess Tour</h1>
            <p className="text-slate-300">Compete in regional tournaments around the globe!</p>
          </div>

          {/* Interactive World Map */}
          <div className="w-full aspect-video overflow-hidden rounded-xl bg-slate-900 border-2 border-slate-700 mb-8">
            <ComposableMap
              projectionConfig={{
                scale: 280,
                center: [0, 10],
              }}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Chessboard Grid Lines */}
              <Graticule
                stroke="#1e293b"
                strokeWidth={0.5}
                fill="none"
              />

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

              {/* Flight Path Lines - Curved Gold Trails */}
              {regions.map((region, index) => {
                if (index === 0) return null
                const prevRegion = regions[index - 1]
                if (prevRegion.isLocked && region.isLocked) return null
                
                // Calculate midpoint for curve
                const midLon = (prevRegion.longitude + region.longitude) / 2
                const midLat = (prevRegion.latitude + region.latitude) / 2
                const curveOffset = 5 // Adjust for curve height
                
                return (
                  <Line
                    key={`path-${prevRegion.id}-${region.id}`}
                    from={[prevRegion.longitude, prevRegion.latitude]}
                    to={[region.longitude, region.latitude]}
                    stroke="#fbbf24"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    opacity={region.isLocked ? 0.3 : 0.6}
                  />
                )
              })}

              {/* Animated Flight Path */}
              {isFlying && flightPath && (
                <Line
                  from={flightPath.from}
                  to={flightPath.to}
                  stroke="#fbbf24"
                  strokeWidth={3}
                  strokeDasharray="4 4"
                  opacity={0.8}
                />
              )}

              {/* Region Markers: render non-current first, then current so crown is on top and clickable */}
              {[...regions.filter((r) => r.id !== currentRegionId), ...regions.filter((r) => r.id === currentRegionId)].map((region) => {
                const isCurrent = region.id === currentRegionId
                const isLocked = region.isLocked

                return (
                  <Marker
                    key={region.id}
                    coordinates={[region.longitude, region.latitude]}
                  >
                    <foreignObject
                      x={-12}
                      y={-28}
                      width={24}
                      height={28}
                      onClick={() => handleRegionClick(region)}
                      className={`${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${isCurrent ? 'relative z-10' : ''}`}
                    >
                      {isCurrent ? (
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="w-full h-full flex items-end justify-center pb-0.5"
                        >
                          <Crown className="w-6 h-6 text-amber-400 drop-shadow-lg pointer-events-none" />
                        </motion.div>
                      ) : (
                        <div className="w-full h-full flex items-end justify-center pb-0.5">
                          <MapPin
                            className={`w-6 h-6 ${
                              isLocked
                                ? 'text-slate-600'
                                : 'text-slate-300 hover:text-amber-400'
                            } drop-shadow-lg transition-colors`}
                          />
                        </div>
                      )}
                    </foreignObject>
                  </Marker>
                )
              })}

              {/* Animated Airplane */}
              {isFlying && airplanePosition && (
                <Marker coordinates={airplanePosition}>
                  <foreignObject x={-12} y={-12} width={24} height={24}>
                    <motion.div
                      initial={{ scale: 0, rotate: 0 }}
                      animate={{ scale: 1, rotate: 45 }}
                      transition={{ duration: 0.3 }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        className="w-full h-full drop-shadow-lg"
                      >
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                      </svg>
                    </motion.div>
                  </foreignObject>
                </Marker>
              )}
            </ComposableMap>
          </div>

          {/* Region List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => handleRegionClick(region)}
                disabled={region.isLocked}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  region.isLocked
                    ? 'bg-chess-card border-chess-border opacity-50 cursor-not-allowed'
                    : region.isCurrent
                    ? 'bg-pawn-gold/20 border-pawn-gold shadow-lg shadow-pawn-gold/50'
                    : 'bg-chess-card border-slate-600 hover:border-pawn-gold'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{region.name}</h3>
                    <p className="text-slate-300 text-sm">Tournament #{region.order}</p>
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

export default function CampaignPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#7fa650] border-t-transparent rounded-full animate-spin"></div></div>}>
      <CampaignPageInner />
    </Suspense>
  )
}
