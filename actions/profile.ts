'use server'

import { prisma } from '@/lib/prisma'
import { GameResult } from '@prisma/client'

interface ChartDataPoint {
  date: string
  points: number
}

interface UserStats {
  user: {
    id: string
    name: string
    rating: number
    pawns: number
    totalGames: number
  }
  winRate: number
  furthestRegion: string | null
  puzzlesSolved: number
  chartData: ChartDataPoint[]
}

export async function getUserStats(userId: string): Promise<UserStats | null> {
  try {
    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        rating: true,
        pawns: true,
        totalGames: true,
      },
    })

    if (!user) {
      return null
    }

    // Fetch UserTourProgress for furthest region
    const tourProgress = await prisma.userTourProgress.findUnique({
      where: { userId },
      include: {
        currentRegion: {
          select: {
            name: true,
          },
        },
      },
    })

    const furthestRegion = tourProgress?.currentRegion?.name || null

    // Count puzzles solved - since there's no UserPuzzle model, we'll estimate
    // based on pawn rewards from puzzles (each puzzle rewards 5 pawns)
    // We can estimate by dividing total pawns by 5, but that's not accurate
    // For now, we'll use UserCampaignProgress completed nodes as a proxy for "tactics solved"
    const campaignNodesCompleted = await prisma.userCampaignProgress.count({
      where: {
        userId,
        starsEarned: { gt: 0 },
      },
    })

    // For puzzles, we'll use campaign nodes as a proxy for now
    // In a real implementation, you'd want a UserPuzzle model to track puzzle completions
    const puzzlesSolved = campaignNodesCompleted

    // Fetch games for win rate and chart data
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { whitePlayerId: userId },
          { blackPlayerId: userId },
        ],
        result: { not: null }, // Only completed games
      },
      orderBy: {
        date: 'desc',
      },
      take: 20, // Last 20 games for chart
    })

    // Calculate win rate
    let wins = 0
    let totalCompletedGames = 0

    games.forEach((game) => {
      if (!game.result) return
      totalCompletedGames++
      
      const isWhite = game.whitePlayerId === userId
      if (
        (isWhite && game.result === GameResult.WHITE_WIN) ||
        (!isWhite && game.result === GameResult.BLACK_WIN)
      ) {
        wins++
      }
    })

    // Also get all games for total win rate
    const allGames = await prisma.game.findMany({
      where: {
        OR: [
          { whitePlayerId: userId },
          { blackPlayerId: userId },
        ],
        result: { not: null },
      },
    })

    let totalWins = 0
    allGames.forEach((game) => {
      if (!game.result) return
      const isWhite = game.whitePlayerId === userId
      if (
        (isWhite && game.result === GameResult.WHITE_WIN) ||
        (!isWhite && game.result === GameResult.BLACK_WIN)
      ) {
        totalWins++
      }
    })

    const winRate = allGames.length > 0 ? (totalWins / allGames.length) * 100 : 0

    // Build chart data - running total of points over last 20 games
    // We need to calculate points based on game results
    const chartData: ChartDataPoint[] = []
    let runningTotal = 0

    // Sort games by date ascending for chart
    const sortedGames = [...games].reverse()

    sortedGames.forEach((game) => {
      if (!game.result) return

      const isWhite = game.whitePlayerId === userId
      let points = 0

      if (
        (isWhite && game.result === GameResult.WHITE_WIN) ||
        (!isWhite && game.result === GameResult.BLACK_WIN)
      ) {
        points = 1 // Win
      } else if (game.result === GameResult.DRAW) {
        points = 0.5 // Draw
      } else {
        points = 0 // Loss
      }

      runningTotal += points

      // Format date as MM/DD
      const date = new Date(game.date)
      const formattedDate = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`

      chartData.push({
        date: formattedDate,
        points: runningTotal,
      })
    })

    return {
      user,
      winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
      furthestRegion,
      puzzlesSolved: campaignNodesCompleted, // Using campaign nodes as proxy for now
      chartData,
    }
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return null
  }
}
