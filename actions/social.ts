'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'

async function getCurrentUser() {
  const { userId } = await auth()
  if (!userId) return null
  return prisma.user.findUnique({
    where: { clerk_id: userId },
    select: { id: true, name: true, email: true, rank: true },
  })
}

export async function getFriends() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' }
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        friends: {
          select: {
            id: true,
            name: true,
            email: true,
            rank: true,
          },
        },
      },
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    return { success: true, friends: user.friends }
  } catch (error) {
    console.error('Error fetching friends:', error)
    return { success: false, error: 'Failed to fetch friends' }
  }
}

export async function addFriend(friendName: string) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' }
    }

    // Find the friend by name
    const friend = await prisma.user.findFirst({
      where: {
        name: {
          contains: friendName,
          mode: 'insensitive',
        },
      },
    })

    if (!friend) {
      return { success: false, error: 'User not found' }
    }

    if (friend.id === currentUser.id) {
      return { success: false, error: 'Cannot add yourself as a friend' }
    }

    // Check if already friends
    const userWithFriends = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        friends: true,
      },
    })

    if (!userWithFriends) {
      return { success: false, error: 'Current user not found' }
    }

    const isAlreadyFriend = userWithFriends.friends.some(
      (f) => f.id === friend.id
    )

    if (isAlreadyFriend) {
      return { success: false, error: 'Already friends with this user' }
    }

    // Add friend (Prisma will handle both sides of the relation)
    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        friends: {
          connect: { id: friend.id },
        },
      },
    })

    return { success: true, friend }
  } catch (error) {
    console.error('Error adding friend:', error)
    return { success: false, error: 'Failed to add friend' }
  }
}

export async function getMessages(friendId: string) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' }
    }

    const friend = await prisma.user.findFirst({
      where: {
        OR: [{ clerk_id: friendId }, { id: friendId }],
      },
      select: { id: true },
    })
    if (!friend) {
      return { success: false, error: 'Friend not found' }
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUser.id, receiverId: friend.id },
          { senderId: friend.id, receiverId: currentUser.id },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        sender: {
          select: {
            id: true,
            clerk_id: true,
            name: true,
          },
        },
        receiver: {
          select: {
            id: true,
            clerk_id: true,
            name: true,
          },
        },
      },
    })

    return { success: true, messages }
  } catch (error) {
    console.error('Error fetching messages:', error)
    return { success: false, error: 'Failed to fetch messages' }
  }
}

export async function sendMessage(receiverId: string, content: string) {
  try {
    const sender = await getCurrentUser()
    if (!sender) {
      return { success: false, error: 'Not authenticated' }
    }

    if (!content.trim()) {
      return { success: false, error: 'Message cannot be empty' }
    }

    const receiver = await prisma.user.findFirst({
      where: {
        OR: [{ clerk_id: receiverId }, { id: receiverId }],
      },
      select: { id: true },
    })
    if (!receiver) {
      return { success: false, error: 'Receiver not found' }
    }

    const message = await prisma.message.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            clerk_id: true,
            name: true,
          },
        },
        receiver: {
          select: {
            id: true,
            clerk_id: true,
            name: true,
          },
        },
      },
    })

    return { success: true, message }
  } catch (error) {
    console.error('Error sending message:', error)
    return { success: false, error: 'Failed to send message' }
  }
}
