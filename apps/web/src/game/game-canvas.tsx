'use client'

import type { Choice, Dialogue } from '../scripts/script.ts'
import type { EngineEvent, WorldConfig } from '@game-engine/engine-core'
import { currentStudentId, flagStore } from '../state/flags.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DialogueOverlay } from '../temp-ui/dialogue-overlay.tsx'
import { characters } from './characters'
import { createEngine } from '@game-engine/engine-core'
import { maps } from './maps'
import { runEntityScript } from '../scripts/run-entity-script.ts'

const CANVAS_STYLE = { width: '100vw', height: '100vh' }

export function GameCanvas({ worldConfig }: { worldConfig: WorldConfig }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dialogue, setDialogue] = useState<Dialogue | undefined>()

  const dismissDialogue = useCallback((): void => {
    setDialogue(undefined)
  }, [])

  const selectChoice = useCallback(async (choice: Choice): Promise<void> => {
    try {
      if (choice.flag) {
        await flagStore.setFlags(currentStudentId, { [choice.flag]: true })
      }
      setDialogue(undefined)
    } catch (error: unknown) {
      console.error('Failed to persist Flag:', error)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {return}

    let game: Awaited<ReturnType<typeof createEngine>> | undefined
    let cancelled = false

    async function handleEvent(event: EngineEvent): Promise<void> {
      console.warn('[Engine Event]', event)
      if (event.type !== 'interacted') {return}

      const flags = await flagStore.getFlags(currentStudentId)
      const result = await runEntityScript(event.entityId, { flags })
      if (!cancelled && result) {
        setDialogue(result)
      }
    }

    async function start(element: HTMLElement): Promise<void> {
      try {
        const created = await createEngine(element, {
          worldConfig,
          catalogs: { maps, characters },
          onEvent: (event: EngineEvent) => {
            handleEvent(event).catch((error: unknown) => {
              console.error('Script failed:', error)
            })
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

  return (
    <>
      <div ref={containerRef} style={CANVAS_STYLE} />
      {dialogue && <DialogueOverlay dialogue={dialogue} onChoose={selectChoice} onDismiss={dismissDialogue} />}
    </>
  )
}
