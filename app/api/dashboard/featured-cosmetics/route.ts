import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ cosmetics: [] })

    const owned = await prisma.userCosmetic.findMany({
      where: { userId: user.id },
      select: { cosmeticId: true },
    })
    const ownedIds = owned.map((uc) => uc.cosmeticId)

    const cosmetics = await prisma.cosmetic.findMany({
      where: ownedIds.length ? { id: { notIn: ownedIds } } : {},
      select: { id: true, name: true, price: true, type: true },
      take: 6,
    })

    // Fisher-Yates shuffle then take 2
    for (let i = cosmetics.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cosmetics[i], cosmetics[j]] = [cosmetics[j], cosmetics[i]]
    }

    return NextResponse.json({ cosmetics: cosmetics.slice(0, 2) })
  } catch (err) {
    console.error('[dashboard/featured-cosmetics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
