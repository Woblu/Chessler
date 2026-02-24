import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import dynamic from 'next/dynamic'

const CampaignClient = dynamic(() => import('./CampaignClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

export default async function CampaignPage() {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { clerk_id: userId },
    select: { id: true, pieceSet: true },
  })

  if (!user) redirect('/login')

  const regions = await prisma.region.findMany({
    orderBy: { order: 'asc' },
  })

  let userProgress = await prisma.userTourProgress.findUnique({
    where: { userId: user.id },
  })

  if (!userProgress && regions.length > 0) {
    userProgress = await prisma.userTourProgress.create({
      data: {
        userId: user.id,
        currentRegionId: regions[0].id,
      },
    })
  }

  const currentRegionId = userProgress?.currentRegionId ?? null
  const currentRegionIndex = currentRegionId
    ? regions.findIndex((r) => r.id === currentRegionId)
    : -1

  const initialRegions = regions.map((region, index) => ({
    ...region,
    isCurrent: region.id === currentRegionId,
    isLocked: index > 0 && currentRegionIndex < index,
  }))

  return (
    <CampaignClient
      initialRegions={initialRegions}
      initialCurrentRegionId={currentRegionId}
      pieceSet={user.pieceSet || 'caliente'}
    />
  )
}
