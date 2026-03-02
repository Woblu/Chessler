'use client'

import { useEffect, useState } from 'react'
import { useDbUser } from '@/app/context/UserContext'

interface User {
  id: string
  name: string
  email: string
  pieceSet: string
  boardStyle: string
}

interface Props {
  initialUser: User
  ownedPieceSets: string[]
  ownedBoardStyles: string[]
}

// Available piece sets (must match folder names in /public/Pieces/)
const PIECE_SETS = [
  { id: 'cardinal', name: 'Cardinal' },
  { id: 'pixel', name: 'Pixel' },
  { id: 'gioco', name: 'Gioco' },
  { id: 'maestro', name: 'Maestro' },
  { id: 'fresca', name: 'Fresca' },
  { id: 'tatiana', name: 'Tatiana' },
]

// Available board styles (using images from /public/Boards/)
const BOARD_STYLES = [
  { id: 'canvas2', name: 'Canvas', image: 'canvas2.jpg' },
  { id: 'green', name: 'Green', image: 'green.png' },
  { id: 'horsey', name: 'Horsey', image: 'horsey.jpg' },
  { id: 'metal', name: 'Metal', image: 'metal.jpg' },
  { id: 'olive', name: 'Olive', image: 'olive.jpg' },
  { id: 'purple-diag', name: 'Purple Diagonal', image: 'purple-diag.png' },
  { id: 'wood2', name: 'Wood 2', image: 'wood2.jpg' },
  { id: 'wood4', name: 'Wood 4', image: 'wood4.jpg' },
]

export default function SettingsPage({ initialUser, ownedPieceSets, ownedBoardStyles }: Props) {
  const { dbUser, setDbUser } = useDbUser()
  const [user, setUser] = useState<User>(initialUser)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'account' | 'appearance' | 'gameplay' | 'audio'>('account')

  const [formData, setFormData] = useState({
    name: initialUser.name,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    pieceSet: initialUser.pieceSet || 'cardinal',
    boardStyle: initialUser.boardStyle || 'green',
  })

  // Local-only preferences (persisted to localStorage)
  const [showRatingInNavbar, setShowRatingInNavbar] = useState(true)
  const [enableSoundEffects, setEnableSoundEffects] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ratingPref = window.localStorage.getItem('settings.showRatingInNavbar')
    const soundPref = window.localStorage.getItem('settings.enableSoundEffects')
    if (ratingPref != null) setShowRatingInNavbar(ratingPref === 'true')
    if (soundPref != null) setEnableSoundEffects(soundPref === 'true')
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // Validate password change if new password is provided
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setMessage({ type: 'error', text: 'New passwords do not match' })
          setSaving(false)
          return
        }
        if (formData.newPassword.length < 6) {
          setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
          setSaving(false)
          return
        }
      }

      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          currentPassword: formData.currentPassword || undefined,
          newPassword: formData.newPassword || undefined,
          pieceSet: formData.pieceSet,
          boardStyle: formData.boardStyle,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
        setFormData({
          ...formData,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        if (user) {
          setUser({ ...user, ...data.user })
        }
        // Update global user context so play/puzzle/learn use new board & piece set immediately
        if (data.user && dbUser) {
          setDbUser({ ...dbUser, ...data.user })
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving settings' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-chess-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-extrabold text-white mb-8">Settings</h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/30 border border-green-700 text-green-300'
                : 'bg-red-900/30 border border-red-700 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-6">
          {/* Left tabs */}
          <div className="w-48 shrink-0">
            <div className="bg-chess-card border border-chess-border rounded-xl p-2 space-y-1">
              {[
                { id: 'account', label: 'Account' },
                { id: 'appearance', label: 'Appearance' },
                { id: 'gameplay', label: 'Gameplay' },
                { id: 'audio', label: 'Audio' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-pawn-gold text-slate-900'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 space-y-6">
            {activeTab === 'account' && (
              <div className="bg-chess-card rounded-xl shadow-lg p-6 border border-chess-border">
                <h2 className="text-2xl font-extrabold text-white mb-4">Account Settings</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 mb-2">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 bg-chess-bg border border-chess-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pawn-gold focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full px-4 py-2 bg-chess-bg border border-chess-border rounded-lg text-slate-400 cursor-not-allowed"
                    />
                    <p className="text-sm text-slate-400 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-2">Current Password</label>
                    <input
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                      placeholder="Required only if changing password"
                      className="w-full px-4 py-2 bg-chess-bg border border-chess-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pawn-gold focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-2">New Password</label>
                    <input
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      placeholder="Leave empty to keep current password"
                      className="w-full px-4 py-2 bg-chess-bg border border-chess-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pawn-gold focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="w-full px-4 py-2 bg-chess-bg border border-chess-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pawn-gold focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <>
                <div className="bg-chess-card rounded-xl shadow-lg p-6 border border-chess-border">
                  <h2 className="text-2xl font-extrabold text-white mb-4">Chessmen</h2>
                  <p className="text-slate-300 mb-4">Choose your preferred chessmen style (must be owned)</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {PIECE_SETS.filter((set) => ownedPieceSets.includes(set.id)).map((set) => (
                      <button
                        key={set.id}
                        onClick={() => setFormData({ ...formData, pieceSet: set.id })}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.pieceSet === set.id
                            ? 'border-pawn-gold bg-pawn-gold/20'
                            : 'border-chess-border bg-chess-bg hover:border-slate-600'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 mb-2 flex items-center justify-center bg-chess-card rounded border border-chess-border">
                            <img
                              src={`/Pieces/${set.id}/wQ.svg`}
                              alt={`${set.name} Queen`}
                              className="w-full h-full object-contain"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                const target = e.target as HTMLImageElement
                                if (!target.src.includes('/default/') && !target.dataset.fallback) {
                                  target.dataset.fallback = 'true'
                                  target.src = '/Pieces/cardinal/wQ.svg'
                                } else {
                                  target.style.display = 'none'
                                }
                              }}
                            />
                          </div>
                          <span className="text-slate-300 font-semibold">{set.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-chess-card rounded-xl shadow-lg p-6 border border-chess-border">
                  <h2 className="text-2xl font-extrabold text-white mb-4">Board Style</h2>
                  <p className="text-slate-300 mb-4">Choose your preferred chess board appearance (must be owned)</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {BOARD_STYLES.filter((style) => ownedBoardStyles.includes(style.id)).map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setFormData({ ...formData, boardStyle: style.id })}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.boardStyle === style.id
                            ? 'border-pawn-gold bg-pawn-gold/20'
                            : 'border-chess-border bg-chess-bg hover:border-slate-600'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-24 h-24 mb-2 rounded overflow-hidden border-2 border-chess-border">
                            <img
                              src={`/Boards/${style.image}`}
                              alt={`${style.name} board`}
                              className="w-full h-full object-cover"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                              }}
                            />
                          </div>
                          <span className="text-[#f0d9b5] font-semibold">{style.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'gameplay' && (
              <div className="bg-chess-card rounded-xl shadow-lg p-6 border border-chess-border space-y-4">
                <h2 className="text-2xl font-extrabold text-white mb-2">Gameplay</h2>
                <p className="text-slate-300 text-sm mb-4">
                  These options adjust how information is shown while you play.
                </p>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-chess-border bg-chess-bg"
                    checked={showRatingInNavbar}
                    onChange={(e) => {
                      const next = e.target.checked
                      setShowRatingInNavbar(next)
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('settings.showRatingInNavbar', String(next))
                      }
                    }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">Show rating in top bar</div>
                    <p className="text-xs text-slate-400">
                      Toggle the rating number next to your name in the navigation bar.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="bg-chess-card rounded-xl shadow-lg p-6 border border-chess-border space-y-4">
                <h2 className="text-2xl font-extrabold text-white mb-2">Audio</h2>
                <p className="text-slate-300 text-sm mb-4">
                  Control sound effects played during games and puzzles.
                </p>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-chess-border bg-chess-bg"
                    checked={enableSoundEffects}
                    onChange={(e) => {
                      const next = e.target.checked
                      setEnableSoundEffects(next)
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('settings.enableSoundEffects', String(next))
                      }
                    }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">Enable sound effects</div>
                    <p className="text-xs text-slate-400">
                      When disabled, move, capture, check, and game end sounds are muted.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Save Button (always visible) */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-pawn-gold hover:bg-pawn-gold-hover disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
