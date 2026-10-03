import type { Choice, Dialogue, DialogueLine, Script, ScriptResult } from '../scripts/script.ts'
import type { Output, Program, Run } from '@game-engine/clsc'
import { currentStudentId, flagStore, runOnce, seenFlag } from '../state/flags.ts'
import { isActiveCompanion, isCompanionFlag } from '../state/companions.ts'
import type { CgPlayback } from './use-cg-playback.ts'
import type { Companions } from './use-companions.ts'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'
import { ScriptCommands } from './script-commands.ts'
import type { ScriptKind } from '../scripts/run-script.ts'
import { loadProgram } from '@game-engine/clsc'
// oxlint-disable-next-line import/max-dependencies -- one over only while the TS Script path (script.ts, run-script.ts, play-cutscene.ts) outlives the VM; deleting it removes all three.
import { playCutscene } from './play-cutscene.ts'
import { runScript } from '../scripts/run-script.ts'

// What the overlay shows while a run waits for the Player.
export type ScriptPrompt = Extract<Output, { type: 'line' | 'choices' }>

export interface ScriptPlayerUi {
  setDialogue: (dialogue: Dialogue | undefined) => void
  setScriptPrompt: (prompt: ScriptPrompt | undefined) => void
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

const SCRIPTS_URL = '/generated/scripts.clscb'

// Turns a VM run or a TS ScriptResult (Dialogue, CG, or Cutscene) into what the Player sees; owns the compiled Scripts, the run in flight and the in-flight TS Cutscene handle.
export class ScriptPlayer {
  private cutscene: ReturnType<typeof playCutscene> | undefined
  private program: Program | undefined

  // Only one run exists at a time (adr/0030).
  private run: Run | undefined

  // Set only while a prompt waits for the Player, so a stray or double click while the run is busy can't skip a line or pick twice.
  private waitingFor: ScriptPrompt['type'] | undefined

  // Whether the run in flight paused the Engine, so an abort knows to unpause it.
  private frozen = false

  // The VM only checks its handlers exist; the Host calls them for each `command` output.
  private readonly commands: ScriptCommands
  private readonly engineRef: RefObject<EngineHandle | undefined>
  private readonly playCgById: CgPlayback['playCgById']
  private readonly ui: ScriptPlayerUi

  public constructor(engineRef: RefObject<EngineHandle | undefined>, playCgById: CgPlayback['playCgById'], ui: ScriptPlayerUi) {
    this.engineRef = engineRef
    this.commands = new ScriptCommands(engineRef)
    this.playCgById = playCgById
    this.ui = ui
  }

  // Called once at startup, the same way Maps are fetched (adr/0032); a missing or stale file throws, failing startup.
  public fetchProgram = async (): Promise<void> => {
    const response = await fetch(SCRIPTS_URL)
    if (!response.ok) {
      throw new Error(`Script bytecode ${SCRIPTS_URL} is missing (HTTP ${response.status}): run \`bun run dev\`, or \`bun run clsc\` in apps/web`)
    }
    this.program = loadProgram(new Uint8Array(await response.arrayBuffer()), this.commands.handlers)
  }

  public advanceCutscene = (): void => { this.cutscene?.advance() }

  public pickCutsceneChoice = (choice: Choice): void => { this.cutscene?.pickChoice(choice) }

  public dismissDialogue = (): void => { this.ui.setDialogue(undefined) }

  public advanceLine = (): Promise<void> => this.answer('line', (run) => run.next())

  // `index` is into the choices the overlay was handed, locked ones included.
  public choose = (index: number): Promise<void> => this.answer('choices', (run) => run.choose(index))

  // Aborted while frozen, the Host does the unfreeze work itself (adr/0030).
  public endRun = async (): Promise<void> => {
    const { run } = this
    if (!run) {return}
    run.abort()
    this.run = undefined
    this.waitingFor = undefined
    this.clearPrompt()
    if (this.frozen) {await this.unfreeze()}
  }

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
  // After the gates, a `.clsc` handler wins; the TS Script is the fallback while it isn't ported yet.
  // Ending the run first is safe: the Engine drops Interactions and Zone entries while paused, so only a waiting Dialogue run is ended (adr/0030).
  public runInteraction = async (entityId: string, isStale: () => boolean): Promise<void> => {
    await this.endRun()
    const flags = await flagStore.getFlags(currentStudentId)

    // A Companion can't be talked to (spec's "Companion").
    if (isActiveCompanion(flags, entityId) || isStale()) {return}
    const run = this.program?.start('interact', entityId, flags)
    if (run) {return this.startRun(run)}
    const result = await ScriptPlayer.lookup('entities', entityId, isStale)
    if (result) {await this.play(result)}
  }

  // The Zone-seen gate is the Host's, so it runs before dispatch (adr/0018 as amended by adr/0030).
  public runZoneEntered = async (zoneId: string, isStale: () => boolean): Promise<void> => {
    await this.endRun()
    const flags = await flagStore.getFlags(currentStudentId)
    if (flags[seenFlag(zoneId)] === true || isStale()) {return}
    const run = this.program?.start('enter', zoneId, flags)
    if (run) {return this.startZoneRun(zoneId, run)}

    // Looks the TS Script up before runOnce so a missing or stale lookup never burns the seen Flag.
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

  // A Zone counts as seen when its run starts (adr/0030); the caller's stale check is the last one, so a stale entry never burns the Flag.
  private async startZoneRun(zoneId: string, run: Run): Promise<void> {
    await flagStore.setFlags(currentStudentId, { [seenFlag(zoneId)]: true })
    await this.startRun(run)
  }

  // Takes the run slot before any await: endRun aborts the old run synchronously, so a second start racing this one aborts this run instead of orphaning it.
  private async startRun(run: Run): Promise<void> {
    const ending = this.endRun()
    this.run = run
    this.ui.setDialogue(undefined)
    await ending
    await this.drive(run, () => run.next())
  }

  private async answer(prompt: ScriptPrompt['type'], first: (run: Run) => Output): Promise<void> {
    const { run } = this
    if (!run || this.waitingFor !== prompt) {return}
    this.waitingFor = undefined

    // Cleared now, so an answered line doesn't linger through a Movement.
    this.clearPrompt()
    await this.drive(run, () => first(run))
  }

  // oxlint-disable-next-line unicorn/no-useless-undefined -- setScriptPrompt's param is required; this is the "no prompt" case, not an omission.
  private clearPrompt(): void { this.ui.setScriptPrompt(undefined) }

  // Hands outputs to the Player, starting with `first`, until a prompt waits or the run ends. A throw aborts the run, unfreezing it.
  private async drive(run: Run, first: () => Output): Promise<void> {
    try {
      await this.handOutputs(run, first)
    } catch (error: unknown) {
      console.error('Script failed:', error)
      if (this.run === run) {await this.endRun()}
    }
  }

  // Stops once the run is no longer the one in flight, e.g. ended during an await.
  private async handOutputs(run: Run, first: () => Output): Promise<void> {
    for (let output = first(); this.run === run; output = run.next()) {
      if (output.type === 'line' || output.type === 'choices') {
        this.waitingFor = output.type
        this.ui.setScriptPrompt(output)
        return
      }

      // A finished run has nothing left to abort, so ending it just clears the overlay.
      if (output.type === 'done') {return this.endRun()}

      // oxlint-disable-next-line no-await-in-loop -- outputs are a strict sequence; the next one waits on this one.
      await this.applyOutput(output)
    }
  }

  private async applyOutput(output: Exclude<Output, ScriptPrompt | { type: 'done' }>): Promise<void> {
    if (output.type === 'freeze') {
      this.setFrozen(true)
    } else if (output.type === 'unfreeze') {
      await this.unfreeze()
    } else if (output.type === 'command') {

      // A failed waiting command throws, aborting the run (adr/0030).
      const running = this.commands.handlers[output.name](output.args)
      if (output.waits) {await running}

    } else if (output.type === 'flag') {
      await this.saveFlag(output)
    } else {

      // The Script's own once-only marker decides whether it plays, not runOnce (adr/0030).
      await this.playCgById(output.id, () => false)
    }
  }

  private setFrozen(frozen: boolean): void {
    this.frozen = frozen
    const engine = this.engineRef.current
    if (engine) {this.setPaused(engine, frozen)}
  }

  // Saved before the run goes on, so it never gets ahead of the store; a failed save throws, aborting it (adr/0030).
  private async saveFlag({ name, value }: Extract<Output, { type: 'flag' }>): Promise<void> {
    await flagStore.setFlags(currentStudentId, { [name]: value })
    if (isCompanionFlag(name) && !this.frozen) {await this.ui.syncCompanions()}
  }

  // Synchronous up to the re-sync: game-canvas's cleanup destroys the Engine straight after calling endRun.
  private async unfreeze(): Promise<void> {
    this.commands.stopFollowers()
    this.setFrozen(false)
    await this.ui.syncCompanions()
  }

  // Re-syncs Companions afterwards, even on a throw: a Cutscene stops its Follow-step followers when it ends, which can drop a Companion's chase.
  private async play(result: ScriptResult): Promise<void> {
    await this.endRun()
    try {
      this.ui.setDialogue('type' in result ? undefined : result)
      const engine = this.engineRef.current
      if (!('type' in result) || !engine) {return}
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
