import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const USER_SELECT = {
  id: true,
  clerk_id: true,
  name: true,
  email: true,
  rank: true,
  currentPoints: true,
  gamesPlayedInCycle: true,
  totalGames: true,
  pieceSet: true,
  boardStyle: true,
  pawns: true,
  xp: true,
} as const

/**
 * GET /api/auth/me
 * Returns the current user's profile.
 *
 * Auto-provisioning strategy (handles all migration scenarios):
 *  1. Look up by clerk_id  → found: return immediately.
 *  2. Fetch Clerk profile to get email.
 *  3. Look up by email     → found: link clerk_id to that row, return.
 *  4. Otherwise            → create a brand-new row.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fast path — already linked
    let user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: USER_SELECT,
    })
    if (user) return NextResponse.json({ user })

    // 2. Need to provision — fetch Clerk profile
    const clerkUser = await currentUser()
    if (!clerkUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
      return NextResponse.json(
        { error: 'No email address on Clerk account' },
        { status: 400 }
      )
    }

    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
      clerkUser.username ||
      email

    // 3. Existing row with same email (pre-Clerk account) → link it
    const existingByEmail = await prisma.user.findUnique({ where: { email } })
    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerk_id: userId },
        select: USER_SELECT,
      })
      return NextResponse.json({ user })
    }

    // 4. Brand-new user
    user = await prisma.user.create({
      data: { clerk_id: userId, email, name },
      select: USER_SELECT,
    })
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
