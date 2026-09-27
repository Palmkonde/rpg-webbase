'use client'

import type { Choice, Dialogue } from '../scripts/script.ts'
import type { EngineEvent, WorldConfig } from '@game-engine/engine-core'
import { characters, maps } from './catalogs.ts'
import { currentStudentId, flagStore } from '../state/flags.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CgOverlay } from '../temp-ui/cg-overlay.tsx'
import { DialogueOverlay } from '../temp-ui/dialogue-overlay.tsx'
import { createEngine } from '@game-engine/engine-core'
import { playCG } from './play-cg.ts'
import { resolveCg } from '../state/cg.ts'
import { runEntityScript } from '../scripts/run-entity-script.ts'

const CANVAS_STYLE = { width: '100vw', height: '100vh' }

// A future mid-game CG reuses playCG the same way, no re-plumbing needed.
const BOOT_CG_ID = 'intro'
const bootCgFrames = resolveCg(BOOT_CG_ID)

async function persistChoiceFlags(choice: Choice): Promise<boolean> {
  if (!choice.flags) {return true}
  try {
    await flagStore.setFlags(currentStudentId, choice.flags)
    return true
  } catch (error: unknown) {
    console.error('Failed to persist Flags:', error)
    return false
  }
}

export function GameCanvas({ worldConfig }: { worldConfig: WorldConfig }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dialogue, setDialogue] = useState<Dialogue | undefined>()
  const [cgFrameIndex, setCgFrameIndex] = useState<number | undefined>()
  const cgHandleRef = useRef<ReturnType<typeof playCG> | null>(null)

  const dismissDialogue = useCallback((): void => {
    setDialogue(undefined)
  }, [])

  const advanceCg = useCallback((): void => {
    cgHandleRef.current?.advance()
  }, [])

  const skipCg = useCallback((): void => {
    cgHandleRef.current?.skip()
  }, [])

  const selectChoice = useCallback(async (choice: Choice): Promise<void> => {
    if (!(await persistChoiceFlags(choice))) {return}
    if (!choice.next) {
      setDialogue(undefined)
      return
    }

    try {
      const flags = await flagStore.getFlags(currentStudentId)
      setDialogue(choice.next({ flags }))
    } catch (error: unknown) {
      console.error('Script failed:', error)
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

    async function boot(element: HTMLElement): Promise<void> {
      if (bootCgFrames) {
        const handle = playCG(BOOT_CG_ID, (frameIndex) => {
          if (!cancelled) {setCgFrameIndex(frameIndex)}
        })
        cgHandleRef.current = handle
        await handle.done
        if (cancelled) {return}
      }
      await start(element)
    }

    boot(container)

    return (): void => {
      cancelled = true
      cgHandleRef.current?.skip()
      game?.destroy(true)
    }
  }, [worldConfig])

  return (
    <>
      <div ref={containerRef} style={CANVAS_STYLE} />
      {cgFrameIndex !== undefined && bootCgFrames && cgFrameIndex < bootCgFrames.length && (
        <CgOverlay
          frame={bootCgFrames[cgFrameIndex]}
          hasMore={cgFrameIndex < bootCgFrames.length - 1}
          onAdvance={advanceCg}
          onSkip={skipCg}
        />
      )}
      {dialogue && <DialogueOverlay dialogue={dialogue} onChoose={selectChoice} onDismiss={dismissDialogue} />}
    </>
  )
}
