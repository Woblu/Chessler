import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUserStats } from '@/actions/profile'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { clerk_id: userId },
    select: { id: true },
  })

  if (!user) redirect('/login')

  const stats = await getUserStats(user.id)

  return <ProfileClient initialStats={stats} />
}
