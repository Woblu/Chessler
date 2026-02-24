'use client'

import { useCallback } from 'react'
import { useAnimation } from 'framer-motion'
// AnimationControls is not a named export in some framer-motion v12 builds; use ReturnType instead
type AnimationControls = ReturnType<typeof useAnimation>

const SHAKE_KEYFRAMES = {
  x: [0, -10, 10, -8, 8, -5, 5, -2, 2, 0],
  y: [0,  3, -3,  2, -2,  1, -1,  0, 0, 0],
}

export interface UseShakeReturn {
  shakeControls: AnimationControls
  triggerShake: () => void
}

export function useShake(): UseShakeReturn {
  const shakeControls = useAnimation()

  const triggerShake = useCallback(() => {
    shakeControls.start({
      ...SHAKE_KEYFRAMES,
      transition: { duration: 0.45, ease: 'easeOut' },
    })
  }, [shakeControls])

  return { shakeControls, triggerShake }
}
