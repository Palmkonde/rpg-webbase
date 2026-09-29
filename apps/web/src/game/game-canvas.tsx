'use client'

import type { EngineEvent, WorldConfig } from '@game-engine/engine-core'
import { characters, maps } from './catalogs.ts'
import { useEffect, useRef } from 'react'
import { CgOverlay } from '../temp-ui/cg-overlay.tsx'
import { CutsceneOverlay } from '../temp-ui/cutscene-overlay.tsx'
import { DialogueOverlay } from '../temp-ui/dialogue-overlay.tsx'
import { createEngine } from '@game-engine/engine-core'
import { useCgPlayback } from './use-cg-playback.ts'
import { useScriptPlayback } from './use-script-playback.ts'

const CANVAS_STYLE = { width: '100vw', height: '100vh' }

const BOOT_CG_ID = 'intro'

export function GameCanvas({ worldConfig }: { worldConfig: WorldConfig }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  // oxlint-disable-next-line unicorn/no-useless-undefined -- this useRef overload requires an argument; omitting it doesn't typecheck.
  const engineRef = useRef<Awaited<ReturnType<typeof createEngine>> | undefined>(undefined)

  const { cgFrames, cgStep, advanceCg, skipCg, playCgById } = useCgPlayback()
  const {
    dialogue, cutsceneLine, cutsceneChoices, dismissDialogue, advanceCutscene, pickCutsceneChoice, selectChoice, runInteraction,
  } = useScriptPlayback(engineRef, playCgById)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {return}

    let cancelled = false

    async function handleEvent(event: EngineEvent): Promise<void> {
      console.warn('[Engine Event]', event)
      if (event.type === 'interacted') {
        await runInteraction(event.entityId, () => cancelled)
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
          created.destroy()
        } else {
          engineRef.current = created
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error('Failed to start game engine:', error)
        }
      }
    }

    async function boot(element: HTMLElement): Promise<void> {
      await playCgById(BOOT_CG_ID, () => cancelled)
      if (cancelled) {return}
      await start(element)
    }

    boot(container)

    return (): void => {
      cancelled = true
      skipCg()
      engineRef.current?.destroy()
      engineRef.current = undefined
    }
  }, [worldConfig, runInteraction, playCgById, skipCg])

  return (
    <>
      <div ref={containerRef} style={CANVAS_STYLE} />
      {cgStep && cgFrames && (
        <CgOverlay
          frame={cgFrames[cgStep.frameIndex]}
          hasMore={cgStep.hasMore}
          onAdvance={advanceCg}
          onSkip={skipCg}
        />
      )}
      {dialogue && <DialogueOverlay dialogue={dialogue} onChoose={selectChoice} onDismiss={dismissDialogue} />}
      {(cutsceneLine !== undefined || cutsceneChoices !== undefined) && (
        <CutsceneOverlay choices={cutsceneChoices} line={cutsceneLine} onAdvance={advanceCutscene} onChoose={pickCutsceneChoice} />
      )}
    </>
  )
}
