import type { Choice, Dialogue, DialogueLine, Script, ScriptResult } from '../scripts/script.ts'
import { currentStudentId, flagStore, runOnce } from '../state/flags.ts'
import type { CgPlayback } from './use-cg-playback.ts'
import type { Companions } from './use-companions.ts'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'
import type { ScriptKind } from '../scripts/run-script.ts'
import { isActiveCompanion } from '../state/companions.ts'
import { playCutscene } from './play-cutscene.ts'
import { runScript } from '../scripts/run-script.ts'

export interface ScriptPlayerUi {
  setDialogue: (dialogue: Dialogue | undefined) => void
  setCutsceneLine: (line: DialogueLine | undefined) => void
  setCutsceneChoices: (choices: Choice[] | undefined) => void
  setEnginePaused: (paused: boolean) => void

  // Re-applies Companion Flags to the Engine and refreshes the dismiss buttons.
  syncCompanions: Companions['syncCompanions']
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

// Turns a ScriptResult (Dialogue, CG, or Cutscene) into what the Player sees; owns the in-flight Cutscene handle.
export class ScriptPlayer {
  private cutscene: ReturnType<typeof playCutscene> | undefined
  private readonly engineRef: RefObject<EngineHandle | undefined>
  private readonly playCgById: CgPlayback['playCgById']
  private readonly ui: ScriptPlayerUi

  public constructor(engineRef: RefObject<EngineHandle | undefined>, playCgById: CgPlayback['playCgById'], ui: ScriptPlayerUi) {
    this.engineRef = engineRef
    this.playCgById = playCgById
    this.ui = ui
  }

  public advanceCutscene = (): void => { this.cutscene?.advance() }

  public pickCutsceneChoice = (choice: Choice): void => { this.cutscene?.pickChoice(choice) }

  public dismissDialogue = (): void => { this.ui.setDialogue(undefined) }

  public selectChoice = async (choice: Choice): Promise<void> => {
    if (!(await persistChoiceFlags(choice))) {return}
    if (!choice.next) {
      this.dismissDialogue()

      // The Choice's Flag writes may have recruited or dismissed a Companion.
      await this.ui.syncCompanions()
      return
    }
    await this.handOff(choice.next)
  }

  // Guards against a Script's async lookup outliving the Map/effect that fired it (e.g. a worldConfig transition mid-flight).
  public runInteraction = async (entityId: string, isStale: () => boolean): Promise<void> => {

    // A Companion can't be talked to (spec's "Companion").
    if (isActiveCompanion(await flagStore.getFlags(currentStudentId), entityId)) {return}
    const result = await ScriptPlayer.lookup('entities', entityId, isStale)
    if (result) {await this.play(result)}
  }

  // Looks the Script up before runOnce so a missing or stale lookup never burns the `<zoneId>_seen` Flag.
  public runZoneEntered = async (zoneId: string, isStale: () => boolean): Promise<void> => {
    const result = await ScriptPlayer.lookup('zones', zoneId, isStale)
    if (result) {
      await runOnce({ store: flagStore, studentId: currentStudentId }, zoneId, () => this.play(result))
    }
  }

  private static async lookup(kind: ScriptKind, id: string, isStale: () => boolean): Promise<ScriptResult | undefined> {
    const flags = await flagStore.getFlags(currentStudentId)
    const result = await runScript(kind, id, { flags })
    return isStale() ? undefined : result
  }

  // Returns whether the Script actually played.
  private async handOff(script: Script): Promise<boolean> {
    try {
      const flags = await flagStore.getFlags(currentStudentId)
      await this.play(script({ flags }))
      return true
    } catch (error: unknown) {
      console.error('Script failed:', error)
      return false
    }
  }

  // Re-syncs Companions afterwards, even on a throw: a Cutscene stops its Follow-step followers when it ends, which can drop a Companion's chase.
  private async play(result: ScriptResult): Promise<void> {
    try {
      if (!('type' in result)) {
        this.ui.setDialogue(result)
        return
      }
      const engine = this.engineRef.current
      if (!engine) {return}
      this.ui.setDialogue(undefined)
      await (result.type === 'cg' ? this.playCg(engine, result.id) : this.playCutscene(engine, result.id))
    } finally {
      await this.ui.syncCompanions()
    }
  }

  private setPaused(engine: EngineHandle, paused: boolean): void {
    engine.setPaused(paused)
    this.ui.setEnginePaused(paused)
  }

  private async playCg(engine: EngineHandle, id: string): Promise<void> {
    this.setPaused(engine, true)
    try {
      await this.playCgById(id, () => false)
    } finally {
      this.setPaused(engine, false)
    }
  }

  private async playCutscene(engine: EngineHandle, id: string): Promise<void> {
    // No next: continue the same Cutscene (unlike selectChoice, there's no Dialogue to dismiss).
    const onChoicePicked = async (choice: Choice): Promise<{ handedOff: boolean }> => {
      if (!(await persistChoiceFlags(choice)) || !choice.next) {return { handedOff: false }}
      return { handedOff: await this.handOff(choice.next) }
    }

    const { setCutsceneLine: onLine, setCutsceneChoices: onChoices } = this.ui
    const { moveTo, follow, stopMovement } = engine
    const setPaused = (paused: boolean): void => { this.setPaused(engine, paused) }
    this.cutscene = playCutscene(id, { setPaused, onLine, onChoices, moveTo, follow, stopMovement, onChoicePicked })
    await this.cutscene.done

    // oxlint-disable-next-line unicorn/no-useless-undefined -- onLine's/onChoices' param is required; this is the "no line"/"no choices" case, not an omission.
    onLine(undefined)

    // oxlint-disable-next-line unicorn/no-useless-undefined -- see above.
    onChoices(undefined)
  }
}
