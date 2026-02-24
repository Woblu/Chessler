'use client'

import { useState } from 'react'

interface User {
  id: string
  name: string
  email: string
  pieceSet: string
  boardStyle: string
}

interface Props {
  initialUser: User
}

// Available piece sets (should match folder names in /public/pieces/)
const PIECE_SETS = [
  { id: 'caliente', name: 'Caliente' },
  { id: 'cardinal', name: 'Cardinal' },
  { id: 'cburnett', name: 'Cburnett' },
  { id: 'celtic', name: 'Celtic' },
  { id: 'Drawn', name: 'Drawn' },
  { id: 'pixel', name: 'Pixel' },
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

export default function SettingsPage({ initialUser }: Props) {
  const [user, setUser] = useState<User>(initialUser)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: initialUser.name,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    pieceSet: initialUser.pieceSet || 'caliente',
    boardStyle: initialUser.boardStyle || 'canvas2',
  })

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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-extrabold text-white mb-8">Settings</h1>

        {/* Message Display */}
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

        {/* Account Settings */}
        <div className="bg-chess-card rounded-xl shadow-lg p-6 mb-6 border border-chess-border">
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

        {/* Piece Set Selection */}
        <div className="bg-chess-card rounded-xl shadow-lg p-6 mb-6 border border-chess-border">
          <h2 className="text-2xl font-extrabold text-white mb-4">Piece Set</h2>
          <p className="text-slate-300 mb-4">Choose your preferred chess piece style</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PIECE_SETS.map((set) => (
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
                      src={`/pieces/${set.id}/wQ.svg`}
                      alt={`${set.name} Queen`}
                      className="w-full h-full object-contain"
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        const target = e.target as HTMLImageElement
                        // Prevent infinite loop - only try default if not already trying default
                        if (!target.src.includes('/default/') && !target.dataset.fallback) {
                          target.dataset.fallback = 'true'
                          target.src = '/pieces/default/wQ.svg'
                        } else {
                          // If default also fails, hide the image or show placeholder
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

        {/* Board Style Selection */}
        <div className="bg-chess-card rounded-xl shadow-lg p-6 mb-6 border border-chess-border">
          <h2 className="text-2xl font-extrabold text-white mb-4">Board Style</h2>
          <p className="text-slate-300 mb-4">Choose your preferred chess board appearance</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {BOARD_STYLES.map((style) => (
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

        {/* Save Button */}
        <div className="flex justify-end">
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
  )
}
