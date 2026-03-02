'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { purchaseCosmetic, equipCosmetic } from '@/actions/economy'
import { useDbUser } from '@/app/context/UserContext'
import { GiCoins, GiChessPawn } from 'react-icons/gi'

interface Cosmetic {
  id: string
  name: string
  type: 'BOARD' | 'PIECES'
  price: number
  asset_url: string
}

interface CosmeticCardProps {
  cosmetic: Cosmetic
  isOwned: boolean
  isEquipped: boolean
  userPawns: number
  userId: string
}

export default function CosmeticCard({
  cosmetic,
  isOwned,
  isEquipped,
  userPawns,
  userId,
}: CosmeticCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { dbUser, setDbUser } = useDbUser()

  const handlePurchase = async () => {
    try {
      setLoading(true)
      setMessage(null)

      const result = await purchaseCosmetic(userId, cosmetic.id)

      if (result.success) {
        setMessage('Purchase successful!')
        // Refresh top-bar pawns immediately by refetching the latest user profile
        try {
          const me = await fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null))
          if (me?.user && dbUser) {
            setDbUser({ ...dbUser, ...me.user })
          }
        } catch {
          // ignore
        }
        setTimeout(() => {
          router.refresh()
        }, 1000)
      } else {
        setMessage(result.error || 'Failed to purchase')
      }
    } catch (error) {
      setMessage('Failed to purchase cosmetic')
    } finally {
      setLoading(false)
    }
  }

  const handleEquip = async () => {
    try {
      setLoading(true)
      setMessage(null)

      const result = await equipCosmetic(userId, cosmetic.id)

      if (result.success) {
        setMessage('Equipped!')
        setTimeout(() => {
          router.refresh()
        }, 1000)
      } else {
        setMessage(result.error || 'Failed to equip')
      }
    } catch (error) {
      setMessage('Failed to equip cosmetic')
    } finally {
      setLoading(false)
    }
  }

  const canAfford = userPawns >= cosmetic.price

  return (
    <div className="bg-chess-card rounded-xl p-6 border border-chess-border hover:border-pawn-gold transition-colors">
      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-2 rounded text-sm text-center ${
            message.includes('successful') || message.includes('Equipped')
              ? 'bg-green-900/30 text-green-300 border border-green-500/50'
              : 'bg-red-900/30 text-red-300 border border-red-500/50'
          }`}
        >
          {message}
        </div>
      )}

      {/* Preview */}
      <div className="w-full h-32 bg-chess-bg rounded-lg border border-chess-border mb-4 flex items-center justify-center overflow-hidden">
        {cosmetic.type === 'PIECES' ? (
          <Image
            src={`/Pieces/${cosmetic.asset_url.toLowerCase()}/wQ.svg`}
            alt={cosmetic.name}
            width={96} height={96}
            className="max-w-full max-h-full object-contain"
            unoptimized
          />
        ) : cosmetic.asset_url?.startsWith('/') ? (
          <Image
            src={cosmetic.asset_url}
            alt={cosmetic.name}
            width={128} height={96}
            className="max-w-full max-h-full object-contain"
            unoptimized
          />
        ) : (
          <div className="text-slate-500 text-sm">Preview</div>
        )}
      </div>

      {/* Name and Price */}
      <h3 className="text-xl font-extrabold text-white mb-2">{cosmetic.name}</h3>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-1">
          <GiCoins className="w-5 h-5 text-pawn-gold drop-shadow-md" />
          <span className="text-pawn-gold font-bold">{cosmetic.price}</span>
          <span className="text-slate-300 text-sm">pawns</span>
        </div>
        {isOwned && (
          <span className="text-green-400 text-sm font-semibold">
            {isEquipped ? '✓ Equipped' : 'Owned'}
          </span>
        )}
      </div>

      {/* Button */}
      {isEquipped ? (
        <button
          disabled
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-semibold cursor-not-allowed opacity-75"
        >
          Equipped
        </button>
      ) : isOwned ? (
        <button
          onClick={handleEquip}
          disabled={loading}
          className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Equipping...' : 'Equip'}
        </button>
      ) : canAfford ? (
        <button
          onClick={handlePurchase}
          disabled={loading}
          className="w-full px-4 py-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Purchasing...' : `Buy for ${cosmetic.price} Pawns`}
        </button>
      ) : (
        <button
          disabled
          className="w-full px-4 py-2 bg-slate-700 text-slate-400 rounded-lg font-medium cursor-not-allowed"
        >
          Not enough Pawns
        </button>
      )}
    </div>
  )
}
