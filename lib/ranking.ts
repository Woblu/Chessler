import { prisma } from './prisma'
import { GameResult } from '@prisma/client'
import { evaluateQuests } from '@/actions/quests'
import { calculateNewRatings } from './rating'

/**
 * Process a game result and update both players' Glicko-2 ratings.
 */
export async function processGameResult(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      whitePlayer: true,
      blackPlayer: true,
    },
  })

  if (!game) {
    throw new Error(`Game with id ${gameId} not found`)
  }

  const { whitePlayer, blackPlayer, result } = game

  if (!result) {
    throw new Error(`Game ${gameId} does not have a result yet`)
  }

  let whiteScore: number
  switch (result) {
    case GameResult.WHITE_WIN:
      whiteScore = 1
      break
    case GameResult.BLACK_WIN:
      whiteScore = 0
      break
    case GameResult.DRAW:
      whiteScore = 0.5
      break
  }

  const updated = calculateNewRatings(
    {
      rating: whitePlayer.rating,
      ratingDeviation: whitePlayer.ratingDeviation,
      volatility: whitePlayer.volatility,
    },
    {
      rating: blackPlayer.rating,
      ratingDeviation: blackPlayer.ratingDeviation,
      volatility: blackPlayer.volatility,
    },
    whiteScore
  )

  await prisma.$transaction([
    prisma.user.update({
      where: { id: whitePlayer.id },
      data: {
        rating: updated.player1.rating,
        ratingDeviation: updated.player1.ratingDeviation,
        volatility: updated.player1.volatility,
        totalGames: whitePlayer.totalGames + 1,
      },
    }),
    prisma.user.update({
      where: { id: blackPlayer.id },
      data: {
        rating: updated.player2.rating,
        ratingDeviation: updated.player2.ratingDeviation,
        volatility: updated.player2.volatility,
        totalGames: blackPlayer.totalGames + 1,
      },
    }),
  ])

  if (whiteScore > 0.5) {
    await evaluateQuests(whitePlayer.id, 'GAME_WON', 1).catch((error) => {
      console.error('Error evaluating quests for white player:', error)
    })
  }
  if (whiteScore < 0.5) {
    await evaluateQuests(blackPlayer.id, 'GAME_WON', 1).catch((error) => {
      console.error('Error evaluating quests for black player:', error)
    })
  }
}
