'use client'

import { useEffect } from 'react'
import { ensureStockfishEngine } from '@/lib/stockfish-engine'

/**
 * Boots the Stockfish web worker as early as possible.
 * Mounted in the root layout so the engine stays alive for the whole session.
 */
export default function StockfishWarmup() {
  useEffect(() => {
    ensureStockfishEngine()
  }, [])

  return null
}

