import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import LeaderboardClient from './LeaderboardClient'

// Revalidate every 2 minutes — leaderboard is high-traffic but doesn't need real-time precision
export const revalidate = 120

export interface LeaderboardEntry {
  id: string
  name: string
  rating: number
  totalGames: number
  wins: number
}

export default async function LeaderboardPage() {
  const { userId } = await auth()

  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      name: string
      rating: number
      totalGames: number
      wins: bigint
    }>
  >`
    SELECT
      u.id,
      u.name,
      u.rating,
      u."totalGames",
      COALESCE(SUM(
        CASE
          WHEN g."whitePlayerId" = u.id AND g.result = 'WHITE_WIN' THEN 1
          WHEN g."blackPlayerId" = u.id AND g.result = 'BLACK_WIN' THEN 1
          ELSE 0
        END
      ), 0)::int AS wins
    FROM users u
    LEFT JOIN games g ON g."whitePlayerId" = u.id OR g."blackPlayerId" = u.id
    GROUP BY u.id
    ORDER BY u.rating DESC NULLS LAST, u."totalGames" DESC
    LIMIT 50
  `

  const entries: LeaderboardEntry[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    rating: r.rating,
    totalGames: r.totalGames,
    wins: Number(r.wins),
  }))

  const currentDbUser = userId
    ? await prisma.user.findUnique({ where: { clerk_id: userId }, select: { id: true } })
    : null

  return <LeaderboardClient entries={entries} currentUserId={currentDbUser?.id ?? null} />
}
