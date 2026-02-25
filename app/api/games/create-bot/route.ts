import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { GameResult } from '@prisma/client'
import { calculateNewRatings } from '@/lib/rating'
import { evaluateQuests } from '@/actions/quests'
import { XP_GAIN } from '@/lib/analysis'

const BOT_RD = 50
const BOT_VOLATILITY = 0.06

/**
 * POST /api/games/create-bot
 * Records the result of a bot game, saves moves, awards XP, and updates
 * the user's Glicko-2 rating (bot is treated as fixed rating, not persisted).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: {
        id: true,
        xp: true,
        rating: true,
        ratingDeviation: true,
        volatility: true,
        totalGames: true,
      },
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

    const ratingBefore = user.rating
    const xpBefore = user.xp
    const botRating = typeof botElo === 'number' ? botElo : 1200

    // Find or create the system bot user (for game record only; we do not update its rating)
    const botEmail = 'bot@system.local'
    let botUser = await prisma.user.findUnique({ where: { email: botEmail } })
    if (!botUser) {
      botUser = await prisma.user.create({
        data: {
          clerk_id: `bot_system_${Date.now()}`,
          name: botName || 'Bot',
          email: botEmail,
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

    // White (user) score: 1 = win, 0 = loss, 0.5 = draw
    const whiteScore =
      result === 'win' ? 1 : result === 'loss' ? 0 : 0.5

    const updated = calculateNewRatings(
      {
        rating: user.rating,
        ratingDeviation: user.ratingDeviation,
        volatility: user.volatility,
      },
      {
        rating: botRating,
        ratingDeviation: BOT_RD,
        volatility: BOT_VOLATILITY,
      },
      whiteScore
    )

    const xpGain = XP_GAIN[result as 'win' | 'draw' | 'loss']

    await prisma.user.update({
      where: { id: user.id },
      data: {
        rating: updated.player1.rating,
        ratingDeviation: updated.player1.ratingDeviation,
        volatility: updated.player1.volatility,
        totalGames: user.totalGames + 1,
        xp: { increment: xpGain },
      },
    })

    if (result === 'win') {
      await evaluateQuests(user.id, 'GAME_WON', 1).catch((error) => {
        console.error('Error evaluating quests:', error)
      })
    }

    const ratingAfter = updated.player1.rating
    const opponentLabel = botName
      ? `${botName}${botElo != null ? ` (${botElo})` : ''}`
      : 'Bot'

    return NextResponse.json({
      success: true,
      gameId: game.id,
      ratingBefore,
      ratingAfter,
      xpBefore,
      xpAfter: xpBefore + xpGain,
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
