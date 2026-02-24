import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/campaign/regions
 * Returns all regions with the user's tour progress and equipped piece set.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return new NextResponse('Unauthorized', { status: 401 })

    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: {
        id: true,
        pieceSet: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const regions = await prisma.region.findMany({
      orderBy: { order: 'asc' },
    })

    let userProgress = await prisma.userTourProgress.findUnique({
      where: { userId: user.id },
    })

    if (!userProgress && regions.length > 0) {
      userProgress = await prisma.userTourProgress.create({
        data: {
          userId: user.id,
          currentRegionId: regions[0].id,
        },
      })
    }

    const currentRegionId = userProgress?.currentRegionId ?? null
    const currentRegionIndex = currentRegionId
      ? regions.findIndex((r) => r.id === currentRegionId)
      : -1

    const regionsWithStatus = regions.map((region, index) => ({
      ...region,
      isCurrent: region.id === currentRegionId,
      isLocked: index > 0 && currentRegionIndex < index,
    }))

    return NextResponse.json({
      regions: regionsWithStatus,
      currentRegionId,
      highestRoundCleared: userProgress?.highestRoundCleared ?? null,
      pieceSet: user.pieceSet,
    })
  } catch (error) {
    console.error('Error fetching regions:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch regions',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 }
    )
  }
}
