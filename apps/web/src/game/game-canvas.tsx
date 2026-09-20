'use client'

import type { EngineEvent, WorldConfig } from '@game-engine/engine-core'
import { useEffect, useRef } from 'react'
import { characters } from './characters'
import { createEngine } from '@game-engine/engine-core'
import { maps } from './maps'

const CANVAS_STYLE = { width: '100vw', height: '100vh' }

export function GameCanvas({ worldConfig }: { worldConfig: WorldConfig }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {return}

    let game: Awaited<ReturnType<typeof createEngine>> | undefined
    let cancelled = false

    async function start(element: HTMLElement): Promise<void> {
      try {
        const created = await createEngine(element, {
          worldConfig,
          catalogs: { maps, characters },
          onEvent: (event: EngineEvent) => {
            console.warn('[Engine Event]', event)
          },
        })
        if (cancelled) {
          created.destroy(true)
        } else {
          game = created
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error('Failed to start game engine:', error)
        }
      }
    }

    start(container)

    return (): void => {
      cancelled = true
      game?.destroy(true)
    }
  }, [worldConfig])

  return <div ref={containerRef} style={CANVAS_STYLE} />
}
