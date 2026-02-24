import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { clerk_id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      pieceSet: true,
      boardStyle: true,
    },
  })

  if (!user) redirect('/login')

  return <SettingsClient initialUser={user} />
}
