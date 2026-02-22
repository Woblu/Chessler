import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { name, rank, email } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    // Email is required by schema; use fallback for legacy callers that don't send it
    const userEmail =
      email && typeof email === 'string' && email.trim().length > 0
        ? email.trim()
        : `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}@placeholder.local`

    const user = await prisma.user.create({
      data: {
        name,
        email: userEmail,
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
