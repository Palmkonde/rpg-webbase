'use client'

import type { EngineEvent, WorldConfig } from '@game-engine/engine-core'
import { characters, maps } from './catalogs.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CgOverlay } from '../temp-ui/cg-overlay.tsx'
import type { CgStep } from './play-cg.ts'
import { CutsceneOverlay } from '../temp-ui/cutscene-overlay.tsx'
import { DialogueOverlay } from '../temp-ui/dialogue-overlay.tsx'
import { createEngine } from '@game-engine/engine-core'
import { playCG } from './play-cg.ts'
import { resolveCg } from '../state/cg.ts'
import { useScriptPlayback } from './use-script-playback.ts'

const CANVAS_STYLE = { width: '100vw', height: '100vh' }

// A future mid-game CG reuses playCG the same way, no re-plumbing needed.
const BOOT_CG_ID = 'intro'
const bootCgFrames = resolveCg(BOOT_CG_ID)

export function GameCanvas({ worldConfig }: { worldConfig: WorldConfig }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cgStep, setCgStep] = useState<CgStep | undefined>()
  const cgHandleRef = useRef<ReturnType<typeof playCG> | null>(null)

  // oxlint-disable-next-line unicorn/no-useless-undefined -- this useRef overload requires an argument; omitting it doesn't typecheck.
  const engineRef = useRef<Awaited<ReturnType<typeof createEngine>> | undefined>(undefined)

  const advanceCg = useCallback((): void => {
    cgHandleRef.current?.advance()
  }, [])

  const skipCg = useCallback((): void => {
    cgHandleRef.current?.skip()
  }, [])

  const { dialogue, cutsceneLine, dismissDialogue, advanceCutscene, selectChoice, runInteraction } = useScriptPlayback(engineRef)

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
      if (bootCgFrames) {
        const handle = playCG(BOOT_CG_ID, (step) => {
          if (!cancelled) {setCgStep(step)}
        })
        cgHandleRef.current = handle
        await handle.done
        if (cancelled) {return}
        setCgStep(undefined)
      }
      await start(element)
    }

    boot(container)

    return (): void => {
      cancelled = true
      cgHandleRef.current?.skip()
      engineRef.current?.destroy()
      engineRef.current = undefined
    }
  }, [worldConfig, runInteraction])

  return (
    <>
      <div ref={containerRef} style={CANVAS_STYLE} />
      {cgStep && bootCgFrames && (
        <CgOverlay
          frame={bootCgFrames[cgStep.frameIndex]}
          hasMore={cgStep.hasMore}
          onAdvance={advanceCg}
          onSkip={skipCg}
        />
      )}
      {dialogue && <DialogueOverlay dialogue={dialogue} onChoose={selectChoice} onDismiss={dismissDialogue} />}
      {cutsceneLine && <CutsceneOverlay line={cutsceneLine} onAdvance={advanceCutscene} />}
    </>
  )
}
