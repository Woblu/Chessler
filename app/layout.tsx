import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import dynamic from 'next/dynamic'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { UserProvider } from '@/app/context/UserContext'
import UnregisterServiceWorker from '@/components/UnregisterServiceWorker'
import StockfishWarmup from '@/components/StockfishWarmup'

// Deferred — not needed on first paint
const SocialWidget = dynamic(() => import('@/components/SocialWidget'), { ssr: false })

const inter = Inter({ subsets: ['latin'], display: 'optional', variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Checkmate – Play & Rank Chess',
  description: 'Play chess, climb the ranks, and conquer the World Chess Tour.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Checkmate',
  },
  icons: {
    icon: '/rooklysmall.png',
    apple: '/rooklysmall.png',
  },
  openGraph: {
    title: 'Checkmate – Play & Rank Chess',
    description: 'Play chess, climb the ranks, and conquer the World Chess Tour.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <head>
          {/* PWA manifest & Apple touch icon */}
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/rooklysmall.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Checkmate" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="theme-color" content="#0f172a" />
        </head>
        <body>
          <UnregisterServiceWorker />
          <UserProvider>
            <StockfishWarmup />
            <Navbar />
            {children}
            <SocialWidget />
          </UserProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
