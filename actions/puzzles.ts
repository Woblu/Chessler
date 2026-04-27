'use server'

import { prisma } from '@/lib/prisma'

/**
 * Get a random puzzle by theme and rating range
 * @param theme - The puzzle theme to search for (e.g., 'mate', 'fork', 'pin')
 * @param minRating - Minimum puzzle rating
 * @param maxRating - Maximum puzzle rating
 */
export async function getRandomPuzzleByTheme(
  theme: string,
  minRating: number = 800,
  maxRating: number = 1500
): Promise<{ success: boolean; puzzle?: any; error?: string }> {
  try {
    const where = {
      themes: { contains: theme },
      rating: { gte: minRating, lte: maxRating },
    } as const

    // Avoid loading the full matching set into memory.
    // Use count + random skip to fetch exactly one record.
    const total = await prisma.puzzle.count({ where })
    if (total === 0) {
      return {
        success: false,
        error: `No puzzles found for theme: ${theme} with rating ${minRating}-${maxRating}`,
      }
    }

    const skip = Math.floor(Math.random() * total)
    const puzzle = await prisma.puzzle.findFirst({
      where,
      orderBy: { id: 'asc' },
      skip,
      select: { id: true, fen: true, moves: true, rating: true, themes: true, pawnReward: true },
    })

    if (!puzzle) {
      return { success: false, error: 'Failed to load a puzzle (unexpected empty result)' }
    }

    return {
      success: true,
      puzzle,
    }
  } catch (error) {
    console.error('Error getting random puzzle by theme:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get puzzle',
    }
  }
}
