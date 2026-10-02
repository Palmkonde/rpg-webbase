'use client'

import type { Choice, Dialogue, DialogueLine } from '../scripts/script.ts'
import { useMemo, useState } from 'react'
import type { CgPlayback } from './use-cg-playback.ts'
import type { Companions } from './use-companions.ts'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'
import type { ScriptLine } from './script-player.ts'
import { ScriptPlayer } from './script-player.ts'

export interface ScriptPlayback {
  scriptLine: ScriptLine | undefined
  advanceLine: () => Promise<void>
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
  const [scriptLine, setScriptLine] = useState<ScriptLine | undefined>()
  const [dialogue, setDialogue] = useState<Dialogue | undefined>()
  const [cutsceneLine, setCutsceneLine] = useState<DialogueLine | undefined>()
  const [cutsceneChoices, setCutsceneChoices] = useState<Choice[] | undefined>()
  const [enginePaused, setEnginePaused] = useState(false)

  // The player's methods are stable per instance, which game-canvas's effect deps rely on.
  const player = useMemo(
    () => new ScriptPlayer(engineRef, playCgById, { setDialogue, setScriptLine, setCutsceneLine, setCutsceneChoices, setEnginePaused, syncCompanions }),
    [engineRef, playCgById, syncCompanions],
  )

  const { advanceLine, endRun, dismissDialogue, advanceCutscene, pickCutsceneChoice, selectChoice, runInteraction, runZoneEntered, fetchProgram } = player
  return {
    scriptLine, advanceLine, endRun, dialogue, cutsceneLine, cutsceneChoices, enginePaused, dismissDialogue, advanceCutscene, pickCutsceneChoice, selectChoice, runInteraction, runZoneEntered, fetchProgram,
  }
}
