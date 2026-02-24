import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const users = await prisma.user.findMany({
      select: { id: true, name: true, rank: true, currentPoints: true },
      orderBy: { currentPoints: 'desc' },
      take: 5,
    })

    return NextResponse.json({ users })
  } catch (err) {
    console.error('[dashboard/leaderboard]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
