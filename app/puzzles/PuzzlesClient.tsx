'use client'

import { useRouter } from 'next/navigation'

interface PuzzleCategory {
  name: string
  theme: string
  description: string
  icon: string
  color: string
}

const categories: PuzzleCategory[] = [
  {
    name: 'Random',
    theme: 'random',
    description: 'A new random theme every time',
    icon: '🎲',
    color: 'from-slate-600 to-slate-800',
  },
  {
    name: 'Checkmates',
    theme: 'mate',
    description: 'Find the checkmate in the position',
    icon: '♔',
    color: 'from-red-600 to-red-800',
  },
  {
    name: 'Forks',
    theme: 'fork',
    description: 'Attack multiple pieces at once',
    icon: '⚔️',
    color: 'from-blue-600 to-blue-800',
  },
  {
    name: 'Pins',
    theme: 'pin',
    description: 'Immobilize your opponent\'s pieces',
    icon: '📌',
    color: 'from-purple-600 to-purple-800',
  },
  {
    name: 'Sacrifices',
    theme: 'sacrifice',
    description: 'Give up material for a tactical advantage',
    icon: '💎',
    color: 'from-yellow-600 to-yellow-800',
  },
  {
    name: 'Endgames',
    theme: 'endgame',
    description: 'Master the final phase of the game',
    icon: '🏁',
    color: 'from-green-600 to-green-800',
  },
]

export default function PuzzlesPage() {
  const router = useRouter()

  const handleCategoryClick = (theme: string) => {
    router.push(`/puzzles/play?theme=${theme}`)
  }

  return (
    <div className="min-h-screen bg-chess-bg p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-white mb-4">Puzzle Training</h1>
          <p className="text-slate-300 text-lg">
            Improve your tactical skills by solving chess puzzles
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <button
              key={category.theme}
              onClick={() => handleCategoryClick(category.theme)}
              className="group relative bg-chess-card border-2 border-chess-border rounded-xl p-8 hover:border-pawn-gold transition-all transform hover:scale-105"
            >
              {/* Gradient Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-10 rounded-lg transition-opacity`}
              />

              {/* Content */}
              <div className="relative z-10">
                <div className="text-6xl mb-4">{category.icon}</div>
                <h2 className="text-2xl font-extrabold text-white mb-2">{category.name}</h2>
                <p className="text-slate-300 text-sm">{category.description}</p>
              </div>

              {/* Hover Arrow */}
              <div className="absolute bottom-4 right-4 text-pawn-gold opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-chess-card border border-chess-border rounded-xl p-6">
          <h3 className="text-xl font-extrabold text-white mb-4">How it works</h3>
          <ul className="space-y-2 text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-pawn-gold">•</span>
              <span>Select a puzzle category to start training</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pawn-gold">•</span>
              <span>Solve puzzles to earn pawns and improve your rating</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pawn-gold">•</span>
              <span>Each puzzle rewards 5 pawns upon completion</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
