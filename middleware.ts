import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/play(.*)',
  '/campaign(.*)',
  '/shop(.*)',
  '/profile(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // 1. Grab the auth state manually
    const authObject = await auth();
    
    // 2. If there is no user ID, manually redirect to bypass Clerk's buggy protect() imports
    if (!authObject.userId) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};