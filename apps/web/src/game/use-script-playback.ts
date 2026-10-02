'use client'

import type { Choice, Dialogue, DialogueLine } from '../scripts/script.ts'
import { useMemo, useState } from 'react'
import type { CgPlayback } from './use-cg-playback.ts'
import type { Companions } from './use-companions.ts'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'
import { ScriptPlayer } from './script-player.ts'
import type { ScriptPrompt } from './script-player.ts'

export interface ScriptPlayback {
  scriptPrompt: ScriptPrompt | undefined
  advanceLine: () => Promise<void>
  choose: (index: number) => Promise<void>
  endRun: () => Promise<void>
  dialogue: Dialogue | undefined
  cutsceneLine: DialogueLine | undefined
  cutsceneChoices: Choice[] | undefined
  enginePaused: boolean
  dismissDialogue: () => void
  advanceCutscene: () => void
  pickCutsceneChoice: (choice: Choice) => void
  selectChoice: (choice: Choice) => Promise<void>
  runInteraction: (entityId: string, isStale: () => boolean) => Promise<void>
  runZoneEntered: (zoneId: string, isStale: () => boolean) => Promise<void>
  fetchProgram: () => Promise<void>
}

export function useScriptPlayback(
  engineRef: RefObject<EngineHandle | undefined>,
  playCgById: CgPlayback['playCgById'],
  syncCompanions: Companions['syncCompanions'],
): ScriptPlayback {
  const [scriptPrompt, setScriptPrompt] = useState<ScriptPrompt | undefined>()
  const [dialogue, setDialogue] = useState<Dialogue | undefined>()
  const [cutsceneLine, setCutsceneLine] = useState<DialogueLine | undefined>()
  const [cutsceneChoices, setCutsceneChoices] = useState<Choice[] | undefined>()
  const [enginePaused, setEnginePaused] = useState(false)

  // The player's methods are stable per instance, which game-canvas's effect deps rely on.
  const player = useMemo(
    () => new ScriptPlayer(engineRef, playCgById, { setDialogue, setScriptPrompt, setCutsceneLine, setCutsceneChoices, setEnginePaused, syncCompanions }),
    [engineRef, playCgById, syncCompanions],
  )

  const { advanceLine, choose, endRun, dismissDialogue, advanceCutscene, pickCutsceneChoice, selectChoice, runInteraction, runZoneEntered, fetchProgram } = player
  return {
    scriptPrompt, advanceLine, choose, endRun, dialogue, cutsceneLine, cutsceneChoices, enginePaused, dismissDialogue, advanceCutscene, pickCutsceneChoice, selectChoice, runInteraction, runZoneEntered, fetchProgram,
  }
}
