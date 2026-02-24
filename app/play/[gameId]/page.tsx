import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

const PlayGameClient = dynamic(() => import('./PlayGameClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

export default async function GamePage({ params }: { params: { gameId: string } }) {
  const { userId } = await auth()
  if (!userId) redirect('/login')
  return <PlayGameClient gameId={params.gameId} />
}
