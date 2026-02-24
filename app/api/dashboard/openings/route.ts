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
    if (!user) return NextResponse.json({ count: 0, openings: [] })

    // Only select what we need — opening id/name + learned status per node
    const openings = await prisma.opening.findMany({
      select: {
        id: true, name: true,
        moveNodes: {
          select: {
            id: true,
            userProgress: { where: { userId: user.id, isLearned: true }, select: { id: true } },
          },
        },
      },
    })

    const toReview = openings
      .filter((o) => o.moveNodes.some((n) => n.userProgress.length === 0))
      .slice(0, 5)
      .map((o) => ({ id: o.id, name: o.name }))

    return NextResponse.json({ count: toReview.length, openings: toReview })
  } catch (err) {
    console.error('[dashboard/openings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
