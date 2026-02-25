// JavaScript version for socket handler: Glicko-2 rating updates
const { PrismaClient } = require('@prisma/client')
const Glicko2 = require('glicko2').Glicko2
const prisma = new PrismaClient()

function calculateNewRatings(player1, player2, result) {
  const ranking = new Glicko2({ tau: 0.5, rating: 1200, rd: 350, vol: 0.06 })
  const p1 = ranking.makePlayer(
    player1.rating,
    player1.ratingDeviation,
    player1.volatility
  )
  const p2 = ranking.makePlayer(
    player2.rating,
    player2.ratingDeviation,
    player2.volatility
  )
  ranking.updateRatings([[p1, p2, result]])
  return {
    player1: {
      rating: p1.getRating(),
      ratingDeviation: p1.getRd(),
      volatility: p1.getVol(),
    },
    player2: {
      rating: p2.getRating(),
      ratingDeviation: p2.getRd(),
      volatility: p2.getVol(),
    },
  }
}

async function processGameResult(gameId) {
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

  let whiteScore
  switch (result) {
    case 'WHITE_WIN':
      whiteScore = 1
      break
    case 'BLACK_WIN':
      whiteScore = 0
      break
    case 'DRAW':
      whiteScore = 0.5
      break
    default:
      whiteScore = 0.5
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
}

module.exports = { processGameResult }
