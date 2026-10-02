'use client'

import type { EngineEvent, WorldConfig } from '@game-engine/engine-core'
import { characters, maps } from './catalogs.ts'
import { useEffect, useRef } from 'react'
import { CgOverlay } from '../temp-ui/cg-overlay.tsx'
import { CompanionOverlay } from '../temp-ui/companion-overlay.tsx'
import { CutsceneOverlay } from '../temp-ui/cutscene-overlay.tsx'
import { DialogueOverlay } from '../temp-ui/dialogue-overlay.tsx'
import { ScriptOverlay } from '../temp-ui/script-overlay.tsx'
import { createEngine } from '@game-engine/engine-core'
import { useCgPlayback } from './use-cg-playback.ts'
import { useCompanions } from './use-companions.ts'

// oxlint-disable-next-line import/max-dependencies -- one over only while the TS-era Dialogue and Cutscene overlays outlive ScriptOverlay; deleting the TS Script path removes both.
import { useScriptPlayback } from './use-script-playback.ts'

const CANVAS_STYLE = { width: '100vw', height: '100vh' }

const BOOT_CG_ID = 'intro'

export function GameCanvas({ worldConfig }: { worldConfig: WorldConfig }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  // oxlint-disable-next-line unicorn/no-useless-undefined -- this useRef overload requires an argument; omitting it doesn't typecheck.
  const engineRef = useRef<Awaited<ReturnType<typeof createEngine>> | undefined>(undefined)

  const { cgFrames, cgStep, advanceCg, skipCg, playCgById, playCgOnce } = useCgPlayback()
  const { companionIds, syncCompanions, dismissCompanion } = useCompanions(engineRef)
  const {
    scriptPrompt, advanceLine, choose, endRun, dialogue, cutsceneLine, cutsceneChoices, enginePaused, dismissDialogue, advanceCutscene, pickCutsceneChoice, selectChoice, runInteraction, runZoneEntered, fetchProgram,
  } = useScriptPlayback(engineRef, playCgById, syncCompanions)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {return}

    let cancelled = false

    async function handleEvent(event: EngineEvent): Promise<void> {
      console.warn('[Engine Event]', event)
      if (event.type === 'interacted') {
        await runInteraction(event.entityId, () => cancelled)
      } else if (event.type === 'zoneEntered') {
        await runZoneEntered(event.zoneId, () => cancelled)
      }
    }

    async function start(element: HTMLElement): Promise<void> {
      try {
        await fetchProgram()
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
          await syncCompanions()
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error('Failed to start game engine:', error)
        }
      }
    }

    async function boot(element: HTMLElement): Promise<void> {
      await playCgOnce(BOOT_CG_ID, () => cancelled)
      if (cancelled) {return}
      await start(element)
    }

    boot(container)

    return (): void => {
      cancelled = true
      skipCg()

      // Before destroy, so a run aborted while frozen unpauses the Engine it paused.
      endRun()
      engineRef.current?.destroy()
      engineRef.current = undefined
    }
  }, [worldConfig, runInteraction, runZoneEntered, fetchProgram, playCgOnce, skipCg, syncCompanions, endRun])

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
      {!enginePaused && companionIds.length > 0 && <CompanionOverlay companionIds={companionIds} onDismiss={dismissCompanion} />}
      {scriptPrompt && <ScriptOverlay frozen={enginePaused} onAdvance={advanceLine} onChoose={choose} onDismiss={endRun} prompt={scriptPrompt} />}
      {dialogue && <DialogueOverlay dialogue={dialogue} onChoose={selectChoice} onDismiss={dismissDialogue} />}
      {(cutsceneLine !== undefined || cutsceneChoices !== undefined) && (
        <CutsceneOverlay choices={cutsceneChoices} line={cutsceneLine} onAdvance={advanceCutscene} onChoose={pickCutsceneChoice} />
      )}
    </>
  )
}
