'use client'

import dynamic from 'next/dynamic'

export const DynamicGameCanvas = dynamic(
  async () => {
    const mod = await import('./game-canvas')
    return mod.GameCanvas
  },
  { ssr: false },
)
