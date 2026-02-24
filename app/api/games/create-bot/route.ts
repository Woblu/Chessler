import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { GameResult } from '@prisma/client'
import { processGameResult } from '@/lib/ranking'
import { XP_GAIN } from '@/lib/analysis'

/**
 * POST /api/games/create-bot
 * Records the result of a bot game, saves moves, awards XP, and returns
 * both the before/after MMR (currentPoints) and cycle counters.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: { id: true, xp: true, currentPoints: true, gamesPlayedInCycle: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { result, botName, botElo, botDepth, moves } = await request.json()

    if (!result || !['win', 'loss', 'draw'].includes(result)) {
      return NextResponse.json(
        { error: 'Invalid result. Must be win, loss, or draw' },
        { status: 400 }
      )
    }

    // Snapshot values BEFORE the game is processed
    const mmrBefore = user.currentPoints
    const gamesInCycleBefore = user.gamesPlayedInCycle
    const xpBefore = user.xp

    // Find or create the system bot user
    const botEmail = 'bot@system.local'
    let botUser = await prisma.user.findUnique({ where: { email: botEmail } })
    if (!botUser) {
      botUser = await prisma.user.create({
        data: {
          clerk_id: `bot_system_${Date.now()}`,
          name: botName || 'Bot',
          email: botEmail,
          rank: 'Bot',
        },
      })
    }

    let gameResult: GameResult = GameResult.DRAW
    if (result === 'win') gameResult = GameResult.WHITE_WIN
    else if (result === 'loss') gameResult = GameResult.BLACK_WIN

    const game = await prisma.game.create({
      data: {
        whitePlayerId: user.id,
        blackPlayerId: botUser.id,
        result: gameResult,
        isOnline: false,
        moves: typeof moves === 'string' ? moves : null,
      },
    })

    // Process ranking (updates currentPoints, gamesPlayedInCycle, rank)
    try {
      await processGameResult(game.id)
    } catch (err) {
      console.error('Error processing bot game result:', err)
    }

    // Award XP
    const xpGain = XP_GAIN[result as 'win' | 'draw' | 'loss']
    const [updatedUser] = await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { xp: { increment: xpGain } },
        select: { xp: true, currentPoints: true, gamesPlayedInCycle: true },
      }),
    ])

    const opponentLabel = botName
      ? `${botName}${botElo ? ` (ELO ${botElo})` : ''}`
      : 'Bot'

    return NextResponse.json({
      success: true,
      gameId: game.id,
      // Cycle / MMR
      mmrBefore,
      mmrAfter: updatedUser.currentPoints,
      gamesInCycleBefore,
      gamesInCycleAfter: updatedUser.gamesPlayedInCycle,
      // XP (kept for context)
      xpBefore,
      xpAfter: updatedUser.xp,
      xpGain,
      message: `Game saved: ${result} against ${opponentLabel}`,
    })
  } catch (err) {
    console.error('Error creating bot game:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create bot game' },
      { status: 500 }
    )
  }
}
