import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/users/create
 * Creates a DB user record linked to the current Clerk session.
 * This is a fallback for cases where the webhook hasn't fired yet.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { clerk_id: userId },
    })
    if (existing) {
      return NextResponse.json(existing)
    }

    // Fetch Clerk profile for email / display name
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses[0]?.emailAddress
      ?? `clerk-${userId}@placeholder.local`
    const name =
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim()
      || clerkUser?.username
      || email

    const { rank } = await request.json().catch(() => ({ rank: undefined }))

    const user = await prisma.user.create({
      data: {
        clerk_id: userId,
        name,
        email,
        rank: rank || 'Beginner',
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: 500 }
    )
  }
}
