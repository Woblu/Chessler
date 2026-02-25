'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { GiCrossedSwords } from 'react-icons/gi'
import { HiChat, HiX } from 'react-icons/hi'
import { getFriends, addFriend, getMessages, sendMessage } from '@/actions/social'
import { sendChallengeEmail } from '@/actions/email'

interface Friend {
  id: string
  name: string
  email: string
  rating: number
}

interface Message {
  id: string
  senderId: string
  receiverId: string
  content: string
  createdAt: Date | string
  sender: {
    id: string
    clerk_id: string | null
    name: string
  }
  receiver: {
    id: string
    clerk_id: string | null
    name: string
  }
}

export default function SocialWidget() {
  const { user: clerkUser, isSignedIn } = useUser()
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'friends' | 'chat'>('friends')
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newFriendName, setNewFriendName] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isExpanded) {
      loadFriends()
    }
  }, [isExpanded])

  useEffect(() => {
    if (selectedFriend && activeTab === 'chat') {
      loadMessages(selectedFriend.id)
    }
  }, [selectedFriend, activeTab])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadFriends = async () => {
    setLoading(true)
    setError(null)
    const result = await getFriends()
    if (result.success) {
      setFriends(result.friends || [])
    } else {
      setError(result.error || 'Failed to load friends')
    }
    setLoading(false)
  }

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFriendName.trim()) return

    setLoading(true)
    setError(null)
    const result = await addFriend(newFriendName.trim())
    if (result.success) {
      setNewFriendName('')
      await loadFriends()
    } else {
      setError(result.error || 'Failed to add friend')
    }
    setLoading(false)
  }

  const loadMessages = async (friendId: string) => {
    setLoading(true)
    setError(null)
    const result = await getMessages(friendId)
    if (result.success) {
      setMessages(result.messages || [])
    } else {
      setError(result.error || 'Failed to load messages')
    }
    setLoading(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFriend || !messageInput.trim()) return

    const content = messageInput.trim()
    setMessageInput('')

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: clerkUser?.id || '',
      receiverId: selectedFriend.id,
      content,
      createdAt: new Date().toISOString(),
      sender: {
        id: clerkUser?.id ?? '',
        clerk_id: clerkUser?.id ?? null,
        name: clerkUser?.fullName ?? 'You',
      },
      receiver: {
        id: selectedFriend.id,
        clerk_id: null,
        name: selectedFriend.name,
      },
    }
    setMessages((prev) => [...prev, optimisticMessage])

    // Send to server
    const result = await sendMessage(selectedFriend.id, content)
    if (result.success && result.message) {
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticMessage.id ? result.message : msg
        )
      )
    } else {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id))
      setError(result.error || 'Failed to send message')
      setMessageInput(content) // Restore input
    }
  }

  const handleChallenge = async (friend: Friend) => {
    if (!friend?.id) return

    try {
      setLoading(true)
      setError(null)

      const friendUser = await fetch(`/api/user/${friend.id}`)
        .then((res) => res.json())
        .catch(() => null)

      if (!friendUser) {
        setError('Could not find friend information')
        setLoading(false)
        return
      }

      // Create a new game (use create-with-opponent so server resolves current user from auth)
      const gameResponse = await fetch('/api/games/create-with-opponent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponentId: friend.id }),
      })


      if (!gameResponse.ok) {
        throw new Error('Failed to create game')
      }

      const game = await gameResponse.json()

      // Get challenger's name (Clerk user or fallback for email/password)
      const challengerName = clerkUser?.fullName || clerkUser?.firstName || 'A player'

      // Send challenge email
      const emailResult = await sendChallengeEmail(
        challengerName,
        friendUser.email || friend.email,
        game.id
      )

      if (!emailResult.success) {
        console.error('Failed to send email:', emailResult.error)
        // Still navigate to the game even if email fails
      }

      // Navigate to the game
      window.location.href = `/play/${game.id}`
    } catch (error) {
      console.error('Error creating challenge:', error)
      setError('Failed to create challenge. Please try again.')
      setLoading(false)
    }
  }

  if (!isSignedIn) {
    return null
  }

  return (
    <>
      {/* Minimized State */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 rounded-full shadow-lg flex items-center justify-center transition-all transform hover:scale-110 z-50"
        >
          <HiChat className="text-2xl" />
        </button>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-chess-card border border-chess-border rounded-xl shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-chess-border">
            <h2 className="text-xl font-extrabold text-white">Social</h2>
            <button
              onClick={() => {
                setIsExpanded(false)
                setSelectedFriend(null)
                setActiveTab('friends')
              }}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <HiX className="text-xl" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-chess-border">
            <button
              onClick={() => {
                setActiveTab('friends')
                setSelectedFriend(null)
              }}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'friends'
                  ? 'bg-pawn-gold text-slate-900'
                  : 'text-slate-300 hover:bg-chess-bg'
              }`}
            >
              Friends
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'chat'
                  ? 'bg-pawn-gold text-slate-900'
                  : 'text-slate-300 hover:bg-chess-bg'
              }`}
            >
              Chat
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'friends' && (
              <div className="flex-1 overflow-y-auto p-4">
                {error && (
                  <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                    {error}
                  </div>
                )}

                {/* Add Friend Form */}
                <form onSubmit={handleAddFriend} className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFriendName}
                      onChange={(e) => setNewFriendName(e.target.value)}
                      placeholder="Search by username..."
                      className="flex-1 px-3 py-2 bg-chess-bg border border-chess-border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-pawn-gold"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={loading || !newFriendName.trim()}
                      className="px-4 py-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </form>

                {/* Friends List */}
                {loading && friends.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">Loading...</div>
                ) : friends.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    No friends yet. Add someone!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map((friend) => (
                      <div
                        key={friend.id}
                        className="p-3 bg-chess-bg rounded-lg border border-chess-border hover:border-pawn-gold transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-white font-semibold">{friend.name}</div>
                            <div className="text-slate-400 text-sm tabular-nums">{friend.rating != null ? Math.round(friend.rating) : '—'}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedFriend(friend)
                              setActiveTab('chat')
                            }}
                            className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition-colors flex items-center justify-center gap-1"
                          >
                            <HiChat className="text-sm" />
                            Message
                          </button>
                          <button
                            onClick={() => handleChallenge(friend)}
                            disabled={loading}
                            className="flex-1 px-3 py-1.5 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded text-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <GiCrossedSwords className="text-sm" />
                            {loading ? 'Creating...' : 'Challenge'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col">
                {!selectedFriend ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400">
                    Select a friend to start chatting
                  </div>
                ) : (
                  <>
                    {/* Chat Header */}
                    <div className="p-4 border-b border-chess-border">
                      <div className="text-white font-semibold">{selectedFriend.name}</div>
                      <div className="text-slate-400 text-sm tabular-nums">{selectedFriend.rating != null ? Math.round(selectedFriend.rating) : '—'}</div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {loading && messages.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">Loading messages...</div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        messages.map((message) => {
                          const isOwnMessage = message.senderId === clerkUser?.id
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[75%] px-4 py-2 rounded-lg ${
                                  isOwnMessage
                                    ? 'bg-pawn-gold text-slate-900'
                                    : 'bg-chess-bg text-slate-200 border border-chess-border'
                                }`}
                              >
                                <div className="text-sm">{message.content}</div>
                                <div
                                  className={`text-xs mt-1 ${
                                    isOwnMessage ? 'text-slate-700' : 'text-slate-400'
                                  }`}
                                >
                                  {new Date(message.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-chess-border">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-3 py-2 bg-chess-bg border border-chess-border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-pawn-gold"
                          disabled={loading}
                        />
                        <button
                          type="submit"
                          disabled={loading || !messageInput.trim()}
                          className="px-4 py-2 bg-pawn-gold hover:bg-pawn-gold-hover text-slate-900 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Send
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
