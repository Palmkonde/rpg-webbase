'use client'

import type { Choice, Dialogue, DialogueLine } from '../scripts/script.ts'
import { useMemo, useState } from 'react'
import type { CgPlayback } from './use-cg-playback.ts'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'
import { ScriptPlayer } from './script-player.ts'

export interface ScriptPlayback {
  dialogue: Dialogue | undefined
  cutsceneLine: DialogueLine | undefined
  cutsceneChoices: Choice[] | undefined
  dismissDialogue: () => void
  advanceCutscene: () => void
  pickCutsceneChoice: (choice: Choice) => void
  selectChoice: (choice: Choice) => Promise<void>
  runInteraction: (entityId: string, isStale: () => boolean) => Promise<void>
  runZoneEntered: (zoneId: string, isStale: () => boolean) => Promise<void>
}

export function useScriptPlayback(engineRef: RefObject<EngineHandle | undefined>, playCgById: CgPlayback['playCgById']): ScriptPlayback {
  const [dialogue, setDialogue] = useState<Dialogue | undefined>()
  const [cutsceneLine, setCutsceneLine] = useState<DialogueLine | undefined>()
  const [cutsceneChoices, setCutsceneChoices] = useState<Choice[] | undefined>()

  // The player's methods are stable per instance, which game-canvas's effect deps rely on.
  const player = useMemo(
    () => new ScriptPlayer(engineRef, playCgById, { setDialogue, setCutsceneLine, setCutsceneChoices }),
    [engineRef, playCgById],
  )

  const { dismissDialogue, advanceCutscene, pickCutsceneChoice, selectChoice, runInteraction, runZoneEntered } = player
  return {
    dialogue, cutsceneLine, cutsceneChoices, dismissDialogue, advanceCutscene, pickCutsceneChoice, selectChoice, runInteraction, runZoneEntered,
  }
}
