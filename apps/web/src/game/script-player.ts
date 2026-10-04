import type { Output, Program, Run } from '@game-engine/clsc'
import { currentStudentId, flagStore, seenFlag } from '../state/flags.ts'
import { isActiveCompanion, isCompanionFlag } from '../state/companions.ts'
import type { CgPlayback } from './use-cg-playback.ts'
import type { Companions } from './use-companions.ts'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'
import { ScriptCommands } from './script-commands.ts'
import { loadProgram } from '@game-engine/clsc'

// What the overlay shows while a run waits for the Player.
export type ScriptPrompt = Extract<Output, { type: 'line' | 'choices' }>

export interface ScriptPlayerUi {
  setScriptPrompt: (prompt: ScriptPrompt | undefined) => void
  setEnginePaused: (paused: boolean) => void

  // Re-applies Companion Flags to the Engine and refreshes the dismiss buttons.
  syncCompanions: Companions['syncCompanions']
}

const SCRIPTS_URL = '/generated/scripts.clscb'

// Turns a VM run into what the Player sees; owns the compiled Scripts and the run in flight.
export class ScriptPlayer {
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

  // Guards against the async Flags read outliving the Map/effect that fired it (e.g. a worldConfig transition mid-flight).
  // Ending the run first is safe: the Engine drops Interactions and Zone entries while paused, so only a waiting Dialogue run is ended (adr/0030).
  public runInteraction = async (entityId: string, isStale: () => boolean): Promise<void> => {
    await this.endRun()
    const flags = await flagStore.getFlags(currentStudentId)

    // A Companion can't be talked to (spec's "Companion").
    if (isActiveCompanion(flags, entityId) || isStale()) {return}
    const run = this.program?.start('interact', entityId, flags)
    if (run) {await this.startRun(run)}
  }

  // The Zone-seen gate is the Host's, so it runs before dispatch (adr/0018 as amended by adr/0030).
  public runZoneEntered = async (zoneId: string, isStale: () => boolean): Promise<void> => {
    await this.endRun()
    const flags = await flagStore.getFlags(currentStudentId)
    if (flags[seenFlag(zoneId)] === true || isStale()) {return}
    const run = this.program?.start('enter', zoneId, flags)
    if (run) {await this.startZoneRun(zoneId, run)}
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
    if (!engine) {return}
    engine.setPaused(frozen)
    this.ui.setEnginePaused(frozen)
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
}
