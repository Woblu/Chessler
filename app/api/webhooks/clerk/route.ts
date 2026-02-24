import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET env variable')
    return new NextResponse('Server misconfiguration', { status: 500 })
  }

  const headerPayload = headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse('Missing svix headers', { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  if (evt.type === 'user.created') {
    const { id, email_addresses, first_name, last_name, username } = evt.data

    const email = email_addresses[0]?.email_address
    if (!email) {
      return new NextResponse('No email address on user', { status: 400 })
    }

    const name =
      [first_name, last_name].filter(Boolean).join(' ').trim() ||
      username ||
      email

    try {
      await prisma.user.upsert({
        where: { clerk_id: id },
        update: {},
        create: {
          clerk_id: id,
          email,
          name,
        },
      })
    } catch (err) {
      console.error('Failed to upsert user in DB:', err)
      return new NextResponse('Database error', { status: 500 })
    }
  }

  if (evt.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name, username } = evt.data

    const email = email_addresses[0]?.email_address
    const name =
      [first_name, last_name].filter(Boolean).join(' ').trim() ||
      username ||
      undefined

    try {
      await prisma.user.updateMany({
        where: { clerk_id: id },
        data: {
          ...(email ? { email } : {}),
          ...(name ? { name } : {}),
        },
      })
    } catch (err) {
      console.error('Failed to update user in DB:', err)
      return new NextResponse('Database error', { status: 500 })
    }
  }

  if (evt.type === 'user.deleted') {
    const { id } = evt.data
    if (id) {
      try {
        await prisma.user.deleteMany({ where: { clerk_id: id } })
      } catch (err) {
        console.error('Failed to delete user from DB:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
