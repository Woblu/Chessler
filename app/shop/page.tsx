import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CosmeticCard from '@/components/CosmeticCard'
import { GiCoins } from 'react-icons/gi'

// Revalidate every 5 minutes — cosmetic catalogue rarely changes
export const revalidate = 300

async function getShopData(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerk_id: clerkId },
    select: { id: true, pawns: true },
  })
  if (!user) return null

  const [cosmetics, userCosmetics] = await Promise.all([
    prisma.cosmetic.findMany({
      select: { id: true, name: true, type: true, price: true, asset_url: true },
      orderBy: [{ type: 'asc' }, { price: 'asc' }],
    }),
    prisma.userCosmetic.findMany({
      where: { userId: user.id },
      select: { cosmeticId: true, isEquipped: true },
    }),
  ])

  const ownershipMap = new Map(userCosmetics.map((uc) => [uc.cosmeticId, uc.isEquipped]))
  return { user, cosmetics, ownershipMap }
}

export default async function ShopPage() {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  const data = await getShopData(userId)
  if (!data) redirect('/login')

  const { user, cosmetics, ownershipMap } = data
  const boardCosmetics = cosmetics.filter((c) => c.type === 'BOARD')
  const pieceCosmetics = cosmetics.filter((c) => c.type === 'PIECES')

  return (
    <div className="min-h-screen bg-chess-bg p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Shop</h1>
          <div className="flex items-center gap-2 bg-chess-card px-5 py-2.5 rounded-full border border-chess-border">
            <GiCoins className="w-5 h-5 text-pawn-gold" />
            <span className="text-white font-bold">{user.pawns}</span>
            <span className="text-slate-400 text-sm">pawns</span>
          </div>
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Chess Boards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {boardCosmetics.map((c) => (
              <CosmeticCard key={c.id} cosmetic={c} isOwned={ownershipMap.has(c.id)} isEquipped={ownershipMap.get(c.id) ?? false} userPawns={user.pawns} userId={user.id} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-extrabold text-white mb-6">Piece Sets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {pieceCosmetics.map((c) => (
              <CosmeticCard key={c.id} cosmetic={c} isOwned={ownershipMap.has(c.id)} isEquipped={ownershipMap.get(c.id) ?? false} userPawns={user.pawns} userId={user.id} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
