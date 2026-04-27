import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const USER_SELECT = {
  id: true,
  clerk_id: true,
  name: true,
  email: true,
  totalGames: true,
  pieceSet: true,
  boardStyle: true,
  pawns: true,
  xp: true,
  rating: true,
  ratingDeviation: true,
  volatility: true,
} as const

function prismaConnectionHint(code?: string) {
  switch (code) {
    case 'P1000':
      return 'Database authentication failed (check user/password in DATABASE_URL).'
    case 'P1001':
      return "Can't reach database server (check host/port, networking, and sslmode=require)."
    case 'P1017':
      return 'Database connection closed unexpectedly.'
    default:
      return null
  }
}

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
  let userId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
  } catch (err) {
    console.error('Error in /api/auth/me (auth):', err)
    return NextResponse.json(
      { error: 'Could not verify session', detail: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : String(err)) : undefined },
      { status: 503 }
    )
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Fast path — already linked
    let user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: USER_SELECT,
    })
    if (user) return NextResponse.json({ user })

    // 2. Need to provision — fetch Clerk profile (can throw in some environments)
    let clerkUser
    try {
      clerkUser = await currentUser()
    } catch (err) {
      console.error('Error fetching Clerk currentUser in /api/auth/me:', err)
      return NextResponse.json({ error: 'Could not load profile' }, { status: 503 })
    }
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
      try {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { clerk_id: userId },
          select: USER_SELECT,
        })
        return NextResponse.json({ user })
      } catch (err: unknown) {
        // P2002 = unique constraint; another row may already have this clerk_id — fetch by clerk_id
        const code = (err as { code?: string })?.code
        if (code === 'P2002') {
          const byClerk = await prisma.user.findUnique({
            where: { clerk_id: userId },
            select: USER_SELECT,
          })
          if (byClerk) return NextResponse.json({ user: byClerk })
        }
        throw err
      }
    }

    // 4. Brand-new user – create row and optionally seed default cosmetics
    try {
      user = await prisma.user.create({
        data: {
          clerk_id: userId,
          email,
          name,
          pieceSet: 'cardinal',
          boardStyle: 'canvas2',
        },
        select: USER_SELECT,
      })
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'P2002') {
        // Unique constraint: e.g. race — another request created or linked this user
        const byClerk = await prisma.user.findUnique({
          where: { clerk_id: userId },
          select: USER_SELECT,
        })
        if (byClerk) return NextResponse.json({ user: byClerk })
        const byEmail = await prisma.user.findUnique({
          where: { email },
          select: USER_SELECT,
        })
        if (byEmail) {
          try {
            user = await prisma.user.update({
              where: { id: byEmail.id },
              data: { clerk_id: userId },
              select: USER_SELECT,
            })
            return NextResponse.json({ user })
          } catch {
            user = byEmail
            return NextResponse.json({ user })
          }
        }
      }
      throw err
    }

    // Seed default owned & equipped cosmetics for new users (non-blocking)
    try {
      const defaultCosmetics = await prisma.cosmetic.findMany({
        where: {
          OR: [
            { type: 'BOARD', asset_url: '/Boards/green.png' },
            { type: 'PIECES', asset_url: 'cardinal' },
          ],
        },
        select: { id: true, type: true, asset_url: true },
      })

      if (defaultCosmetics.length > 0) {
        await prisma.userCosmetic.createMany({
          data: defaultCosmetics.map((c) => ({
            userId: user.id,
            cosmeticId: c.id,
            isEquipped: true,
          })),
          skipDuplicates: true,
        })
      }
    } catch (err) {
      console.error('Error seeding default cosmetics for new user:', err)
    }
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    const message = error instanceof Error ? error.message : String(error)
    const code = error && typeof (error as { code?: string }).code === 'string' ? (error as { code: string }).code : undefined
    const hint = prismaConnectionHint(code)
    if (hint) {
      return NextResponse.json(
        {
          error: 'Database unavailable',
          ...(process.env.NODE_ENV === 'development' && { detail: message, code, hint }),
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { detail: message, code }),
      },
      { status: 500 }
    )
  }
}
