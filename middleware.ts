import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Only protect page routes — API routes handle their own auth via auth()
const isProtectedPage = createRouteMatcher([
  '/play(.*)',
  '/learn(.*)',
  '/shop(.*)',
  '/campaign(.*)',
  '/puzzles(.*)',
  '/profile(.*)',
  '/settings(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedPage(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|json)).*)',
    '/(api|trpc)(.*)',
  ],
}
