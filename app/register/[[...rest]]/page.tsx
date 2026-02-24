import { SignUp } from '@clerk/nextjs'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center mb-4">
            <img src="/rooklysmall.png" alt="Rookly" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold mb-2">
            Join <span className="text-blue-400">Rook</span><span className="text-pawn-gold">ly</span>
          </h1>
          <p className="text-slate-300">Create your account and start playing</p>
        </div>
        <SignUp
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
