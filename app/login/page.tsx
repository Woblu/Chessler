'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Redirect to home
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-gradient-to-br from-pawn-gold to-pawn-gold-hover rounded-lg items-center justify-center mb-4">
            <span className="text-slate-900 font-bold text-3xl">♔</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Welcome Back</h1>
          <p className="text-slate-300">Sign in to continue playing chess</p>
        </div>

        <div className="bg-chess-card rounded-xl shadow-xl p-8 border border-chess-border">
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-300 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-chess-bg border border-chess-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pawn-gold focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-chess-bg border border-chess-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pawn-gold focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-300">
              Don't have an account?{' '}
              <Link href="/register" className="text-pawn-gold hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
