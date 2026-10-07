import type { CgFrame, CgRegistry } from './cg.ts'
import type { CgHandle, CgStep } from './play-cg.ts'
import type { ContentCatalogs, CreateEngineOptions, EngineEvent, EngineHandle, WorldConfig } from '@codeleagues-rpg-engine/engine-core'
import { activeCompanionIds, companionFlag, syncCompanions } from './companions.ts'
import { resolveLine, resolveText } from './strings.ts'
import type { CgArtRegistry } from './cg-art.ts'
import type { FlagStore } from './flags.ts'
import type { PortraitRegistry } from './portraits.ts'
import { ScriptPlayer } from './script-player.ts'
import type { ScriptPrompt } from './script-player.ts'
import type { StringTable } from './strings.ts'
import { playCG } from './play-cg.ts'
import { resolveCg } from './cg.ts'
import { resolveCgArt } from './cg-art.ts'
import { resolvePortrait } from './portraits.ts'

// The Engine's `createEngine`, bound to the element the game is mounted in.
export type EngineFactory = (options: CreateEngineOptions) => Promise<EngineHandle>

export interface WorldContent {
  worldConfig: WorldConfig
  catalogs: ContentCatalogs
  loadScripts: () => Promise<Uint8Array>
  strings: StringTable
  portraits: PortraitRegistry
  cgs: CgRegistry
  cgArt: CgArtRegistry
}

export interface HostSessionOptions {
  createEngine: EngineFactory
  flags: FlagStore
  world: WorldContent
  locale: string
}

export interface ChoiceView {
  text: string
  locked: string | undefined
}

// `canDismiss` is false while a Cutscene or CG has control of the Player (adr/0030).
export type DialogueView =
  | { type: 'line'; speaker: string; text: string; portrait: string | undefined; canDismiss: boolean }
  | { type: 'choices'; choices: ChoiceView[]; canDismiss: boolean }

export interface CgView {
  art: string | undefined
  caption: string
  hasMore: boolean
}

export interface HostError {
  kind: 'unavailable'
  message: string
}

export interface HostSnapshot {
  status: 'loading' | 'ready' | 'error'
  dialogue: DialogueView | undefined
  cg: CgView | undefined

  // Empty while the Engine is paused, so a dismiss can't cut off a Cutscene's Movement step (adr/0028).
  companions: readonly string[]
  error: HostError | undefined
}

// One mounted game's Host: every piece of its state lives here, so two sessions never share any.
export interface HostSession {
  start: () => Promise<void>
  destroy: () => void

  // The same object until something changes, as `useSyncExternalStore` requires.
  getSnapshot: () => HostSnapshot
  subscribe: (listener: () => void) => () => void

  advance: () => Promise<void>

  // `index` is into the shown choices, locked ones included.
  choose: (index: number) => Promise<void>
  dismissDialogue: () => Promise<void>
  advanceCg: () => void
  skipCg: () => void
  dismissCompanion: (entityId: string) => Promise<void>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

class Session implements HostSession {
  private readonly options: HostSessionOptions
  private readonly player: ScriptPlayer
  private readonly listeners = new Set<() => void>()

  private snapshot: HostSnapshot = { status: 'loading', dialogue: undefined, cg: undefined, companions: [], error: undefined }
  private status: HostSnapshot['status'] = 'loading'
  private error: HostError | undefined
  private engine: EngineHandle | undefined
  private destroyed = false
  private prompt: ScriptPrompt | undefined
  private enginePaused = false
  private companionIds: string[] = []
  private cgFrames: CgFrame[] | undefined
  private cgStep: CgStep | undefined
  private cgHandle: CgHandle | undefined

  public constructor(options: HostSessionOptions) {
    this.options = options
    this.player = new ScriptPlayer(() => this.engine, options.flags, {
      setScriptPrompt: (prompt): void => {
        this.prompt = prompt
        this.publish()
      },
      setEnginePaused: (paused): void => {
        this.enginePaused = paused
        this.publish()
      },
      syncCompanions: this.syncCompanions,
      playCg: this.playCg,
    })
  }

  public start = async (): Promise<void> => {
    try {
      const engine = await this.loadEngine()
      if (!engine) {return}
      this.engine = engine
      this.status = 'ready'
      await this.syncCompanions()
    } catch (error: unknown) {
      this.fail(error)
    }
  }

  public destroy = (): void => {
    this.destroyed = true
    this.skipCg()

    // Before the Engine goes, so a run aborted while frozen unpauses the Engine it paused.
    this.player.endRun()
    this.engine?.destroy()
    this.engine = undefined
  }

  public getSnapshot = (): HostSnapshot => this.snapshot

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return (): void => { this.listeners.delete(listener) }
  }

  public advance = (): Promise<void> => this.player.advanceLine()

  public choose = (index: number): Promise<void> => this.player.choose(index)

  public dismissDialogue = (): Promise<void> => this.player.endRun()

  public advanceCg = (): void => { this.cgHandle?.advance() }

  public skipCg = (): void => { this.cgHandle?.skip() }

  public dismissCompanion = async (entityId: string): Promise<void> => {
    try {
      await this.options.flags.setFlags({ [companionFlag(entityId)]: false })
      await this.syncCompanions()
    } catch (error: unknown) {
      console.error('Failed to dismiss Companion:', error)
    }
  }

  private readonly isDestroyed = (): boolean => this.destroyed

  // Undefined once the session is destroyed meanwhile: no Engine is created after that, and one already coming is destroyed.
  private async loadEngine(): Promise<EngineHandle | undefined> {
    const { world, createEngine } = this.options
    this.player.load(await world.loadScripts())
    if (this.destroyed) {return undefined}
    const engine = await createEngine({
      worldConfig: world.worldConfig,
      catalogs: world.catalogs,
      onEvent: (event) => { this.handleEvent(event) },
    })
    if (!this.destroyed) {return engine}
    engine.destroy()
    return undefined
  }

  private fail(error: unknown): void {
    if (this.destroyed) {return}
    console.error('Failed to start the game:', error)
    this.status = 'error'
    this.error = { kind: 'unavailable', message: errorMessage(error) }
    this.publish()
  }

  private async handleEvent(event: EngineEvent): Promise<void> {
    console.warn('[Engine Event]', event)
    try {
      if (event.type === 'interacted') {
        await this.player.runInteraction(event.entityId, this.isDestroyed)
      } else if (event.type === 'zoneEntered') {
        await this.player.runZoneEntered(event.zoneId, this.isDestroyed)
      }
    } catch (error: unknown) {
      console.error('Script failed:', error)
    }
  }

  private readonly syncCompanions = async (): Promise<void> => {
    const flags = await this.options.flags.getFlags()

    // Read after the await: the Engine may have been torn down meanwhile.
    const { engine } = this
    if (!engine) {return}
    syncCompanions(flags, engine)
    this.companionIds = activeCompanionIds(flags)
    this.publish()
  }

  private readonly playCg = async (id: string): Promise<void> => {
    const frames = resolveCg(id, this.options.world.cgs)
    if (!frames) {
      console.warn(`[host] CG "${id}" has no frames; skipped`)
      return
    }
    this.cgFrames = frames
    this.cgHandle = playCG(frames.length, this.showCgStep)
    await this.cgHandle.done
    this.cgHandle = undefined
    this.clearCg()
  }

  private readonly showCgStep = (step: CgStep): void => {
    if (this.destroyed) {return}
    this.cgStep = step
    this.publish()
  }

  private clearCg(): void {
    if (this.destroyed) {return}
    this.cgFrames = undefined
    this.cgStep = undefined
    this.publish()
  }

  private publish(): void {
    this.snapshot = {
      status: this.status,
      dialogue: this.prompt && this.dialogueView(this.prompt),
      cg: this.cgView(),
      companions: this.enginePaused ? [] : this.companionIds,
      error: this.error,
    }
    for (const listener of this.listeners) {listener()}
  }

  private dialogueView(prompt: ScriptPrompt): DialogueView {
    const { locale, world: { strings, portraits } } = this.options
    const canDismiss = !this.enginePaused
    if (prompt.type === 'choices') {
      const choices = prompt.choices.map((choice) => ({
        text: resolveText(choice, locale, strings),
        locked: choice.locked && resolveText(choice.locked, locale, strings),
      }))
      return { type: 'choices', choices, canDismiss }
    }
    return {
      type: 'line',
      speaker: prompt.speaker,
      text: resolveText(prompt, locale, strings),
      portrait: resolvePortrait(prompt.speaker, prompt.expression, portraits),
      canDismiss,
    }
  }

  private cgView(): CgView | undefined {
    const { cgFrames, cgStep } = this
    if (!cgFrames || !cgStep) {return undefined}
    const { locale, world: { strings, cgArt } } = this.options
    const frame = cgFrames[cgStep.frameIndex]
    return {
      art: resolveCgArt(frame.art, cgArt),
      caption: resolveLine(frame.captionKey, locale, strings),
      hasMore: cgStep.hasMore,
    }
  }
}

export function createHostSession(options: HostSessionOptions): HostSession {
  return new Session(options)
}
