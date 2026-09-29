'use client'

import type { Choice, Dialogue, DialogueLine, ScriptResult } from '../scripts/script.ts'
import { currentStudentId, flagStore } from '../state/flags.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CgPlayback } from './use-cg-playback.ts'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'
import { playCutscene } from './play-cutscene.ts'
import { runEntityScript } from '../scripts/run-entity-script.ts'

async function playCgTrigger(options: { engine: EngineHandle; playCgById: CgPlayback['playCgById']; id: string }): Promise<void> {
  const { engine, playCgById, id } = options
  engine.setPaused(true)

  try {
    await playCgById(id, () => false)
  } finally {
    engine.setPaused(false)
  }
}

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

async function playCutsceneTrigger(options: {
  engine: EngineHandle
  id: string
  onLine: (line: DialogueLine | undefined) => void
  onChoices: (choices: Choice[] | undefined) => void
  handleRef: RefObject<ReturnType<typeof playCutscene> | null>
  dispatch: (result: ScriptResult) => Promise<void>
}): Promise<void> {
  const { engine, id, onLine, onChoices, handleRef, dispatch } = options

  // No next: continue the same Cutscene (unlike selectChoice, there's no Dialogue to dismiss).
  async function onChoicePicked(choice: Choice): Promise<{ handedOff: boolean }> {
    if (!(await persistChoiceFlags(choice))) {return { handedOff: false }}
    if (!choice.next) {return { handedOff: false }}
    try {
      const flags = await flagStore.getFlags(currentStudentId)
      await dispatch(choice.next({ flags }))
      return { handedOff: true }
    } catch (error: unknown) {
      console.error('Script failed:', error)
      return { handedOff: false }
    }
  }

  const handle = playCutscene(id, { setPaused: engine.setPaused, onLine, onChoices, moveTo: engine.moveTo, onChoicePicked })
  handleRef.current = handle
  await handle.done

  // oxlint-disable-next-line unicorn/no-useless-undefined -- onLine's/onChoices' param is required; this is the "no line"/"no choices" case, not an omission.
  onLine(undefined)

  // oxlint-disable-next-line unicorn/no-useless-undefined -- see above.
  onChoices(undefined)
}

export interface ScriptPlayback {
  dialogue: Dialogue | undefined
  cutsceneLine: DialogueLine | undefined
  cutsceneChoices: Choice[] | undefined
  dismissDialogue: () => void
  advanceCutscene: () => void
  pickCutsceneChoice: (choice: Choice) => void
  selectChoice: (choice: Choice) => Promise<void>
  runInteraction: (entityId: string, isStale: () => boolean) => Promise<void>
}

export function useScriptPlayback(engineRef: RefObject<EngineHandle | undefined>, playCgById: CgPlayback['playCgById']): ScriptPlayback {
  const [dialogue, setDialogue] = useState<Dialogue | undefined>()
  const [cutsceneLine, setCutsceneLine] = useState<DialogueLine | undefined>()
  const [cutsceneChoices, setCutsceneChoices] = useState<Choice[] | undefined>()
  const cutsceneHandleRef = useRef<ReturnType<typeof playCutscene> | null>(null)

  // Read via the ref, not by name, so dispatch's useCallback body never reads itself mid-init.
  const dispatchRef = useRef<(result: ScriptResult) => Promise<void>>(() => Promise.resolve())

  const dispatch = useCallback(async (result: ScriptResult): Promise<void> => {
    if (!('type' in result)) {
      setDialogue(result)
      return
    }
    const engine = engineRef.current
    if (!engine) {return}
    setDialogue(undefined)
    await (result.type === 'cg'
      ? playCgTrigger({ engine, playCgById, id: result.id })
      : playCutsceneTrigger({
        engine,
        id: result.id,
        onLine: setCutsceneLine,
        onChoices: setCutsceneChoices,
        handleRef: cutsceneHandleRef,
        dispatch: (nextResult) => dispatchRef.current(nextResult),
      }))
  }, [engineRef, playCgById])

  // No ref writes during render — see oxlint's react(refs) rule.
  useEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

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

  return {
    dialogue,
    cutsceneLine,
    cutsceneChoices,
    dismissDialogue: () => setDialogue(undefined),
    advanceCutscene: () => cutsceneHandleRef.current?.advance(),
    pickCutsceneChoice: (choice: Choice) => cutsceneHandleRef.current?.pickChoice(choice),
    selectChoice,
    runInteraction,
  }
}
