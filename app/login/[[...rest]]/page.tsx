'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SignIn, useAuth } from '@clerk/nextjs'

export default function LoginPage() {
  const { isSignedIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isSignedIn === true) router.replace('/')
  }, [isSignedIn, router])

  if (isSignedIn === true) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pawn-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center mb-4">
            <img src="/rooklysmall.png" alt="Checkmate" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold mb-2">
            <span className="text-blue-400">Check</span><span className="text-orange-400">mate</span>
          </h1>
          <p className="text-slate-300">Sign in to continue playing chess</p>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorPrimary: '#f59e0b',
              colorBackground: '#1e293b',
              colorText: '#f1f5f9',
              colorInputBackground: '#0f172a',
              colorInputText: '#f1f5f9',
              borderRadius: '0.75rem',
            },
            elements: {
              card: 'bg-chess-card border border-chess-border shadow-xl',
              headerTitle: 'text-white font-extrabold',
              headerSubtitle: 'text-slate-400',
              socialButtonsBlockButton:
                'border-chess-border text-white hover:bg-slate-700',
              formButtonPrimary:
                'bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold',
              footerActionLink: 'text-pawn-gold hover:text-pawn-gold-hover',
              formFieldInput:
                'bg-chess-bg border-chess-border text-white focus:ring-pawn-gold',
              dividerLine: 'bg-chess-border',
              dividerText: 'text-slate-400',
            },
          }}
        />
      </div>
    </div>
  )
}
