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
    if (!user) return NextResponse.json({ boss: null })

    const userProgress = await prisma.userTourProgress.findUnique({
      where: { userId: user.id },
      select: {
        highestRoundCleared: true,
        currentRegion: {
          select: {
            name: true, order: true,
            tournaments: { select: { botName: true, botElo: true, roundName: true }, orderBy: { roundName: 'asc' } },
          },
        },
      },
    })

    if (!userProgress?.currentRegion) {
      const firstRegion = await prisma.region.findFirst({
        orderBy: { order: 'asc' },
        select: { name: true, tournaments: { select: { botName: true, botElo: true }, orderBy: { roundName: 'asc' }, take: 1 } },
      })
      if (!firstRegion?.tournaments[0]) return NextResponse.json({ boss: null })
      return NextResponse.json({ boss: { name: firstRegion.tournaments[0].botName, elo: firstRegion.tournaments[0].botElo, regionName: firstRegion.name } })
    }

    const roundOrder = ['Quarter-Final', 'Semi-Final', 'Final']
    const highestIdx = userProgress.highestRoundCleared ? roundOrder.indexOf(userProgress.highestRoundCleared) : -1
    const nextIdx = highestIdx + 1

    if (nextIdx >= roundOrder.length) {
      const nextRegion = await prisma.region.findFirst({
        where: { order: { gt: userProgress.currentRegion.order } },
        orderBy: { order: 'asc' },
        select: { name: true, tournaments: { select: { botName: true, botElo: true }, orderBy: { roundName: 'asc' }, take: 1 } },
      })
      if (!nextRegion?.tournaments[0]) return NextResponse.json({ boss: null })
      return NextResponse.json({ boss: { name: nextRegion.tournaments[0].botName, elo: nextRegion.tournaments[0].botElo, regionName: nextRegion.name } })
    }

    const nextBoss = userProgress.currentRegion.tournaments.find((t) => t.roundName === roundOrder[nextIdx])
    if (!nextBoss) return NextResponse.json({ boss: null })

    return NextResponse.json({ boss: { name: nextBoss.botName, elo: nextBoss.botElo, regionName: userProgress.currentRegion.name } })
  } catch (err) {
    console.error('[dashboard/current-boss]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
