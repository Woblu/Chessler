'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Trophy, Lock, Swords, X, ChevronRight } from 'lucide-react'
import { useDbUser } from '@/app/context/UserContext'
import { getBotTitleByElo, getBotCategoryByElo } from '@/lib/bots'

interface TournamentNode {
  id: string
  roundName: string
  botName: string
  botElo: number
  botAvatarUrl: string
  pawnReward: number
  isCompleted: boolean
  isPlayable: boolean
  isLocked: boolean
}

interface UserProgress {
  currentRegionId: string | null
  highestRoundCleared: string | null
}

const CATEGORY_BORDER: Record<string, string> = {
  beginner: 'border-green-500',
  intermediate: 'border-blue-500',
  advanced: 'border-yellow-500',
  expert: 'border-orange-500',
  master: 'border-purple-500',
}

const CATEGORY_TEXT: Record<string, string> = {
  beginner: 'text-green-400',
  intermediate: 'text-blue-400',
  advanced: 'text-yellow-400',
  expert: 'text-orange-400',
  master: 'text-purple-400',
}

const CATEGORY_BG: Record<string, string> = {
  beginner: 'bg-green-900/40',
  intermediate: 'bg-blue-900/40',
  advanced: 'bg-yellow-900/40',
  expert: 'bg-orange-900/40',
  master: 'bg-purple-900/40',
}

export default function TournamentBracketPage() {
  const params = useParams()
  const router = useRouter()
  const { dbUser } = useDbUser()
  const regionId = params.regionId as string

  const [nodes, setNodes] = useState<TournamentNode[]>([])
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preMatchNode, setPreMatchNode] = useState<TournamentNode | null>(null)

  const userName = dbUser?.name || 'You'

  useEffect(() => {
    fetchTournamentData()
  }, [regionId])

  const fetchTournamentData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/campaign/tournaments/${regionId}`)
      if (!response.ok) {
        if (response.status === 401) { router.push('/login'); return }
        throw new Error('Failed to fetch tournament data')
      }
      const data = await response.json()
      setNodes(data.nodes || [])
      setUserProgress(data.userProgress)
    } catch (err) {
      console.error('Error fetching tournament data:', err)
      setError('Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayMatch = (node: TournamentNode) => {
    setPreMatchNode(node)
  }

  const confirmPlayMatch = () => {
    if (!preMatchNode) return
    router.push(`/play/bot?nodeId=${preMatchNode.id}`)
  }

  const roundOrder = ['Quarter-Final', 'Semi-Final', 'Final']
  const rounds = roundOrder.map((roundName) => ({
    name: roundName,
    nodes: nodes.filter((n) => n.roundName === roundName),
  }))

  if (loading) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
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

  return (
    <>
      <div className="min-h-screen bg-chess-bg py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <button
              onClick={() => router.push('/campaign')}
              className="text-pawn-gold hover:text-pawn-gold-hover mb-4 text-sm inline-flex items-center gap-1"
            >
              ← Back to World Map
            </button>
            <h1 className="text-4xl font-extrabold text-white mb-2">Tournament Bracket</h1>
            <p className="text-slate-400">Defeat every opponent to advance through the region</p>
          </div>

          {/* Bracket columns */}
          <div className="flex flex-col lg:flex-row justify-center items-start gap-8 lg:gap-12">
            {rounds.map((round, roundIndex) => (
              <div key={round.name} className="flex-1 min-w-0">
                {/* Round header */}
                <div className="text-center mb-5">
                  <span className="inline-block bg-chess-card border border-chess-border px-4 py-1.5 rounded-full text-white font-semibold text-sm">
                    {round.name}
                  </span>
                </div>

                <div className="space-y-4">
                  {round.nodes.map((node, nodeIndex) => {
                    const isPlayable = node.isPlayable && !node.isCompleted
                    const isCompleted = node.isCompleted
                    const isLocked = node.isLocked
                    const category = getBotCategoryByElo(node.botElo)
                    const catBorder = CATEGORY_BORDER[category]
                    const catText = CATEGORY_TEXT[category]
                    const catBg = CATEGORY_BG[category]

                    return (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: roundIndex * 0.1 + nodeIndex * 0.05 }}
                        className="relative"
                      >
                        <div
                          className={`p-4 rounded-xl border-2 transition-all ${
                            isLocked
                              ? 'bg-chess-card border-chess-border opacity-50'
                              : isCompleted
                              ? 'bg-green-900/20 border-green-700'
                              : isPlayable
                              ? `${catBg} ${catBorder} shadow-lg`
                              : 'bg-chess-card border-slate-600'
                          }`}
                        >
                          {/* Player vs Bot row */}
                          <div className="flex items-center justify-between gap-2">
                            {/* Player side */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-pawn-gold/20 border border-pawn-gold flex items-center justify-center text-pawn-gold font-bold text-sm shrink-0">
                                {userName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-white font-semibold text-sm truncate">{userName}</div>
                                <div className="text-slate-400 text-xs">Player</div>
                              </div>
                            </div>

                            <Swords className="text-slate-500 w-4 h-4 shrink-0" />

                            {/* Bot side */}
                            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                              <div className="min-w-0 text-right">
                                <div className="text-white font-semibold text-sm truncate">{node.botName}</div>
                                <div className={`text-xs font-medium ${catText}`}>
                                  {getBotTitleByElo(node.botElo)}
                                </div>
                              </div>
                              <div
                                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center overflow-hidden shrink-0 font-extrabold text-xs ${catBorder} ${catBg} ${catText}`}
                              >
                                {node.botAvatarUrl && !node.botAvatarUrl.startsWith('http') ? (
                                  <img
                                    src={node.botAvatarUrl}
                                    alt={node.botName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      ;(e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                  />
                                ) : (
                                  node.botName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ELO + reward + action */}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>
                                ELO{' '}
                                <span className={`font-bold ${catText}`}>{node.botElo}</span>
                              </span>
                              <span>·</span>
                              <span>
                                <span className="text-pawn-gold font-semibold">{node.pawnReward}</span> pawns
                              </span>
                            </div>

                            {isLocked ? (
                              <div className="flex items-center gap-1 text-slate-500 text-xs">
                                <Lock className="w-3 h-3" />
                                Locked
                              </div>
                            ) : isCompleted ? (
                              <div className="flex items-center gap-1 text-green-400 text-xs font-semibold">
                                <Trophy className="w-3 h-3" />
                                Completed
                              </div>
                            ) : isPlayable ? (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handlePlayMatch(node)}
                                className="flex items-center gap-1.5 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
                              >
                                <Play className="w-3 h-3" />
                                Play Match
                              </motion.button>
                            ) : (
                              <div className="text-slate-500 text-xs">Complete previous</div>
                            )}
                          </div>
                        </div>

                        {/* Vertical connector */}
                        {roundIndex < rounds.length - 1 && nodeIndex === 0 && (
                          <div className="absolute left-1/2 top-full w-px h-6 bg-slate-700 -translate-x-1/2" />
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pre-match modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {preMatchNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setPreMatchNode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-chess-card border border-chess-border rounded-2xl p-8 max-w-sm w-full shadow-2xl relative"
            >
              <button
                onClick={() => setPreMatchNode(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Round badge */}
              <p className="text-center text-pawn-gold text-xs font-bold uppercase tracking-widest mb-4">
                {preMatchNode.roundName}
              </p>

              {/* Bot avatar */}
              {(() => {
                const cat = getBotCategoryByElo(preMatchNode.botElo)
                const catBorder = CATEGORY_BORDER[cat]
                const catBg = CATEGORY_BG[cat]
                const catText = CATEGORY_TEXT[cat]
                return (
                  <>
                    <div
                      className={`w-24 h-24 rounded-full ${catBg} border-2 ${catBorder} flex items-center justify-center text-3xl font-extrabold mx-auto mb-4 overflow-hidden ${catText}`}
                    >
                      {preMatchNode.botAvatarUrl && !preMatchNode.botAvatarUrl.startsWith('http') ? (
                        <img
                          src={preMatchNode.botAvatarUrl}
                          alt={preMatchNode.botName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        preMatchNode.botName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                      )}
                    </div>

                    <p className={`text-center text-xs font-bold uppercase tracking-widest ${catText} mb-1`}>
                      {getBotTitleByElo(preMatchNode.botElo)}
                    </p>
                    <h2 className="text-3xl font-extrabold text-white text-center mb-2">
                      {preMatchNode.botName}
                    </h2>
                    <p className={`text-center text-sm font-semibold ${catText} mb-5`}>
                      ELO {preMatchNode.botElo}
                    </p>
                  </>
                )
              })()}

              {/* Match details */}
              <div className="bg-chess-bg rounded-xl p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Your name</span>
                  <span className="font-semibold text-white">{userName}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Pawn reward</span>
                  <span className="font-semibold text-pawn-gold">{preMatchNode.pawnReward} ♟</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Time control</span>
                  <span className="font-semibold">10 minutes</span>
                </div>
              </div>

              {/* CTA */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={confirmPlayMatch}
                className="w-full bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-extrabold py-3 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
              >
                Go to Battle
                <ChevronRight className="w-5 h-5" />
              </motion.button>

              <button
                onClick={() => setPreMatchNode(null)}
                className="w-full mt-3 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
