import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

const PlayBotClient = dynamic(() => import('./PlayBotClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

export default async function PlayBotPage() {
  const { userId } = await auth()
  if (!userId) redirect('/login')
  return <PlayBotClient />
}
