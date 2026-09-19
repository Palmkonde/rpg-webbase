'use client'

import dynamic from 'next/dynamic'

export const DynamicGameCanvas = dynamic(
  () => import('./game-canvas').then((mod) => mod.GameCanvas),
  { ssr: false },
)
