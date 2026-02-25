'use client'

import { useEffect } from 'react'

/**
 * Unregister any legacy workbox service workers from the previous PWA setup.
 * Keeps the app running without Cache API errors. PWA installability now relies
 * on the web app manifest only (no service worker required for install).
 */
export default function UnregisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {})
      })
    })
  }, [])

  return null
}
