import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

const ReviewClient = dynamic(() => import('./ReviewClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

interface Props {
  params: { gameId: string }
}

export default async function ReviewPage({ params }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  const game = await prisma.game.findUnique({
    where: { id: params.gameId },
    include: {
      whitePlayer: { select: { id: true, name: true, clerk_id: true } },
      blackPlayer: { select: { id: true, name: true, clerk_id: true } },
    },
  })

  if (!game) notFound()

  // Only allow players who participated in this game to view it
  const user = await prisma.user.findUnique({
    where: { clerk_id: userId },
    select: { id: true },
  })

  if (!user) redirect('/login')

  const isParticipant = game.whitePlayerId === user.id || game.blackPlayerId === user.id
  if (!isParticipant) notFound()

  return (
    <ReviewClient
      gameId={game.id}
      moves={game.moves ?? ''}
      whiteName={game.whitePlayer?.name ?? 'White'}
      blackName={game.blackPlayer?.name ?? 'Black'}
      result={game.result ?? null}
      playedAt={game.date.toISOString()}
      userPlayerId={user.id}
      whitePlayerId={game.whitePlayerId}
    />
  )
}
