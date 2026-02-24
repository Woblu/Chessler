import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const THEME_DESCRIPTIONS: Record<string, string> = {
  fork:       'Master your Forks',
  pin:        'Perfect your Pins',
  skewer:     'Learn Skewers',
  discovered: 'Discover Attacks',
  backRank:   'Back Rank Tactics',
  deflection: 'Deflection Techniques',
  decoy:      'Decoy Strategies',
  clearance:  'Clearance Sacrifices',
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const puzzle = await prisma.puzzle.findFirst({
      select: { themes: true },
      orderBy: { id: 'asc' },
    })

    if (!puzzle) return NextResponse.json({ theme: 'Tactics', description: 'Master your tactical skills' })

    const themes = puzzle.themes.split(',').map((t) => t.trim())
    const theme  = themes[Math.floor(Math.random() * themes.length)] || 'Tactics'

    return NextResponse.json({ theme, description: THEME_DESCRIPTIONS[theme.toLowerCase()] ?? `Master ${theme}` })
  } catch (err) {
    console.error('[dashboard/puzzle-theme]', err)
    return NextResponse.json({ theme: 'Tactics', description: 'Master your tactical skills' })
  }
}
