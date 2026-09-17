'use client'

import dynamic from 'next/dynamic'

export const DynamicGameCanvas = dynamic(
  () => import('./GameCanvas').then((mod) => mod.GameCanvas),
  { ssr: false },
)
