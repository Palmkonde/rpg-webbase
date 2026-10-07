import type { CgArtRegistry, CgFrame, CgRegistry } from './cg.ts'
import type { CgHandle, CgStep } from './play-cg.ts'
import type { CgView, DialogueView, HostSnapshot } from './views.ts'
import type { ContentCatalogs, CreateEngineOptions, EngineEvent, EngineHandle, WorldConfig } from '@codeleagues-rpg-engine/engine-core'
import type { GameService, SavedFlagStore, Wait } from './game-service.ts'
import { ServiceCalls, createSavedFlagStore, waitFor } from './game-service.ts'
import { activeCompanionIds, companionFlag, syncCompanions } from './companions.ts'
import { resolveCg, resolveCgArt } from './cg.ts'
import { resolveLine, resolveText } from './strings.ts'
import type { GameError } from './game-error.ts'
import type { PortraitRegistry } from './portraits.ts'
import { ScriptPlayer } from './script-player.ts'
import type { ScriptPrompt } from './script-player.ts'
import type { StringTable } from './strings.ts'
import { playCG } from './play-cg.ts'
import { resolvePortrait } from './portraits.ts'
import { toGameError } from './game-error.ts'

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
  service: GameService
  getToken: () => Promise<string>
  onError?: (error: GameError) => void
  world: WorldContent
  locale: string

  // The backoff's timer, which tests replace so a retry takes no real time.
  wait?: Wait
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
  setLocale: (locale: string) => void
}

class Session implements HostSession {
  private readonly options: HostSessionOptions
  private readonly player: ScriptPlayer
  private readonly calls: ServiceCalls
  private readonly flags: SavedFlagStore
  private readonly listeners = new Set<() => void>()

  private snapshot: HostSnapshot = { status: 'loading', dialogue: undefined, cg: undefined, companions: [], error: undefined }
  private status: HostSnapshot['status'] = 'loading'
  private error: GameError | undefined
  private engine: EngineHandle | undefined
  private destroyed = false
  private prompt: ScriptPrompt | undefined
  private enginePaused = false
  private companionIds: string[] = []
  private cgFrames: CgFrame[] | undefined
  private cgStep: CgStep | undefined
  private cgHandle: CgHandle | undefined
  private locale: string

  public constructor(options: HostSessionOptions) {
    this.options = options
    this.locale = options.locale
    this.calls = new ServiceCalls({ service: options.service, getToken: options.getToken, wait: options.wait ?? waitFor })
    this.flags = createSavedFlagStore({
      save: this.calls.patchFlags,
      onSaveFailed: (error): void => { this.fail(error) },
    })
    this.player = new ScriptPlayer(() => this.engine, this.flags, {
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
      await this.loadFlags()
      const engine = await this.loadEngine()
      if (!engine) {return}
      this.engine = engine
      this.status = 'playing'
      this.publish()
      await this.syncCompanions()
    } catch (error: unknown) {
      this.fail(error)
    }
  }

  public destroy = (): void => {
    this.destroyed = true
    this.stop()
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
      await this.flags.setFlags({ [companionFlag(entityId)]: false })
      await this.syncCompanions()
    } catch (error: unknown) {
      console.error('Failed to dismiss Companion:', error)
    }
  }

  public setLocale = (locale: string): void => {
    this.locale = locale
    this.publish()
  }

  private readonly isDestroyed = (): boolean => this.destroyed

  // The token is asked for first (adr/0036), so a Student the Platform can't vouch for loads nothing.
  private async loadFlags(): Promise<void> {
    await this.calls.requestToken()
    this.flags.load(await this.calls.readFlags())
  }

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

  private stop(): void {
    this.skipCg()

    // Before the Engine goes, so a run aborted while frozen unpauses the Engine it paused.
    this.player.endRun()
    this.engine?.destroy()
    this.engine = undefined
  }

  // Stops the game too, so a Student never plays on progress that won't be saved. Only the first failure is reported.
  private fail(error: unknown): void {
    if (this.destroyed || this.status === 'error') {return}
    console.error('The game stopped:', error)
    this.stop()
    const gameError = toGameError(error)
    this.status = 'error'
    this.error = gameError
    this.publish()
    this.options.onError?.(gameError)
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
    const flags = await this.flags.getFlags()

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
    const { locale, options: { world: { strings, portraits } } } = this
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
    const { locale, options: { world: { strings, cgArt } } } = this
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
