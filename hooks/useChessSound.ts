'use client'

import { useRef, useCallback } from 'react'

const SOUNDS = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  gameEnd: '/sounds/game-end.mp3',
} as const

type SoundKey = keyof typeof SOUNDS

export function useChessSound() {
  const cache = useRef<Map<string, HTMLAudioElement>>(new Map())

  const play = useCallback((key: SoundKey) => {
    if (typeof window === 'undefined') return
    try {
      let audio = cache.current.get(key)
      if (!audio) {
        audio = new Audio(SOUNDS[key])
        audio.volume = 0.45
        cache.current.set(key, audio)
      }
      audio.currentTime = 0
      audio.play().catch(() => {}) // silently ignore if file not found
    } catch {
      // ignore
    }
  }, [])

  return {
    playMove: () => play('move'),
    playCapture: () => play('capture'),
    playCheck: () => play('check'),
    playGameEnd: () => play('gameEnd'),
  }
}
