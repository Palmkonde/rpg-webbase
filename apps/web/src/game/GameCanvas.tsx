'use client'

import { useEffect, useRef } from 'react'
import { createEngine } from '@game-engine/engine-core'
import type { WorldConfig } from '@game-engine/engine-core'
import { maps } from './maps'

export function GameCanvas({ worldConfig }: { worldConfig: WorldConfig }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let game: Awaited<ReturnType<typeof createEngine>> | undefined
    let cancelled = false

    createEngine(containerRef.current, worldConfig, maps)
      .then((created) => {
        if (cancelled) {
          created.destroy(true)
        } else {
          game = created
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('Failed to start game engine:', error)
        }
      })

    return () => {
      cancelled = true
      game?.destroy(true)
    }
  }, [worldConfig])

  return <div ref={containerRef} style={{ width: 640, height: 480 }} />
}
