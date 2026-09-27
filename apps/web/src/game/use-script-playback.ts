'use client'

import type { Choice, Dialogue, DialogueLine, ScriptResult } from '../scripts/script.ts'
import { currentStudentId, flagStore } from '../state/flags.ts'
import { useCallback, useRef, useState } from 'react'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'
import { playCutscene } from './play-cutscene.ts'
import { runEntityScript } from '../scripts/run-entity-script.ts'

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

export interface ScriptPlayback {
  dialogue: Dialogue | undefined
  cutsceneLine: DialogueLine | undefined
  dismissDialogue: () => void
  advanceCutscene: () => void
  selectChoice: (choice: Choice) => Promise<void>
  runInteraction: (entityId: string, isStale: () => boolean) => Promise<void>
}

export function useScriptPlayback(engineRef: RefObject<EngineHandle | undefined>): ScriptPlayback {
  const [dialogue, setDialogue] = useState<Dialogue | undefined>()
  const [cutsceneLine, setCutsceneLine] = useState<DialogueLine | undefined>()
  const cutsceneHandleRef = useRef<ReturnType<typeof playCutscene> | null>(null)

  const dismissDialogue = useCallback((): void => {
    setDialogue(undefined)
  }, [])

  const advanceCutscene = useCallback((): void => {
    cutsceneHandleRef.current?.advance()
  }, [])

  // A CgTrigger joins this dispatch once issues #29/#30 build it (adr/0018) — until then a Script produces Dialogue or a CutsceneTrigger.
  const dispatch = useCallback(async (result: ScriptResult): Promise<void> => {
    if ('type' in result) {
      const engine = engineRef.current
      if (engine) {
        setDialogue(undefined)
        const handle = playCutscene(result.id, engine.setPaused, setCutsceneLine)
        cutsceneHandleRef.current = handle
        await handle.done
        setCutsceneLine(undefined)
      }
      return
    }
    setDialogue(result)
  }, [engineRef])

  const selectChoice = useCallback(async (choice: Choice): Promise<void> => {
    if (!(await persistChoiceFlags(choice))) {return}
    if (!choice.next) {
      setDialogue(undefined)
      return
    }

    try {
      const flags = await flagStore.getFlags(currentStudentId)
      await dispatch(choice.next({ flags }))
    } catch (error: unknown) {
      console.error('Script failed:', error)
    }
  }, [dispatch])

  // Guards against a Script's async lookup outliving the Map/effect that fired it (e.g. a worldConfig transition mid-flight).
  const runInteraction = useCallback(async (entityId: string, isStale: () => boolean): Promise<void> => {
    const flags = await flagStore.getFlags(currentStudentId)
    const result = await runEntityScript(entityId, { flags })
    if (result && !isStale()) {
      await dispatch(result)
    }
  }, [dispatch])

  return { dialogue, cutsceneLine, dismissDialogue, advanceCutscene, selectChoice, runInteraction }
}
