'use client'

import Image from 'next/image'

interface BossModalProps {
  node: {
    id: string
    bossName: string
    bossElo: number
    bossAvatarUrl: string
    pawnReward: number
    starsEarned?: number
  }
  isOpen: boolean
  onClose: () => void
  onBattle: () => void
}

export default function BossModal({
  node,
  isOpen,
  onClose,
  onBattle,
}: BossModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#2d2d2d] border-2 border-[#7fa650] rounded-lg p-8 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Boss Avatar */}
        <div className="flex justify-center mb-6">
          <div className="relative w-32 h-32 rounded-full border-4 border-[#7fa650] overflow-hidden bg-[#1a1a1a]">
            {node.bossAvatarUrl && !node.bossAvatarUrl.startsWith('http') ? (
              <Image
                src={node.bossAvatarUrl}
                alt={node.bossName}
                fill className="object-cover"
                sizes="128px"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl select-none">♔</div>
            )}
          </div>
        </div>

        {/* Boss Name */}
        <h2 className="text-3xl font-bold text-white text-center mb-4">
          {node.bossName}
        </h2>

        {/* Boss Stats */}
        <div className="space-y-4 mb-6">
          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#3d3d3d]">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">ELO Rating</span>
              <span className="text-white font-bold text-xl">{node.bossElo}</span>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#3d3d3d]">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Pawn Reward</span>
              <span className="text-[#7fa650] font-bold text-xl">
                {node.pawnReward} pawns
              </span>
            </div>
          </div>

          {/* Stars if completed */}
          {node.starsEarned !== undefined && node.starsEarned > 0 && (
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#3d3d3d]">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Best Result</span>
                <div className="flex gap-1">
                  {[1, 2, 3].map((star) => (
                    <svg
                      key={star}
                      className={`w-6 h-6 ${
                        star <= node.starsEarned!
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-600'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onBattle}
            className="flex-1 px-4 py-3 bg-[#7fa650] hover:bg-[#6d8f42] text-white rounded-lg font-semibold transition-colors"
          >
            Battle Now
          </button>
        </div>
      </div>
    </div>
  )
}
