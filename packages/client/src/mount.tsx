/** @jsxImportSource preact */
import type { EngineFactory, HostSession, WorldContent } from './session.ts'
import { DEFAULT_LOCALE } from './strings.ts'
import type { Flags } from './flags.ts'
import type { GameError } from './game-error.ts'
import { Overlays } from './overlays/overlays.tsx'
import type { SlotOverrides } from './slots.ts'
import { SlotOverridesContext } from './overlays/slot.tsx'
import { createFlagStore } from './flags.ts'
import { createHostSession } from './session.ts'
import { render } from 'preact'

export interface GameOptions {
  serviceUrl: string
  worldId: string

  // Called for a Student token (adr/0036); it should reject once the Student is signed out.
  getToken: () => Promise<string>

  // Called on every error, whether or not the built-in ErrorScreen shows it (adr/0039).
  onError?: (error: GameError) => void
  locale?: string

  // Stand-ins for the World Version and the Student's Flags, until the Game Service serves them.
  world: WorldContent
  flags?: Flags
}

export interface MountOptions extends GameOptions {
  // Replaces built-in slots, nested ones included; an overridden parent draws none of its built-in children.
  slots?: SlotOverrides
}

// The headless store: what the overlays show, and the actions they call (adr/0039).
export interface GameInstance extends Pick<HostSession, 'getSnapshot' | 'subscribe' | 'advance' | 'choose' | 'dismissDialogue' | 'advanceCg' | 'skipCg' | 'dismissCompanion' | 'setLocale'> {
  // Tears down the Engine, the built-in overlays and any run in flight. Safe to call twice.
  unmount: () => void
}

const WRAPPER_STYLE = 'position: relative; width: 100%; height: 100%'

const ENGINE_STYLE = 'width: 100%; height: 100%'

const elementsWithAGame = new WeakSet<HTMLElement>()

// Phaser touches `window` as soon as it's imported, so the Engine loads only once a game mounts in a browser.
function engineFactoryFor(container: HTMLElement): EngineFactory {
  return async (options) => {
    const { createEngine } = await import('@codeleagues-rpg-engine/engine-core')
    return createEngine(container, options)
  }
}

type DrawOverlays = (session: HostSession, wrapper: HTMLElement) => () => void

function appendMountPoints(element: HTMLElement): { wrapper: HTMLElement; engineElement: HTMLElement } {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = WRAPPER_STYLE
  const engineElement = document.createElement('div')
  engineElement.style.cssText = ENGINE_STYLE
  wrapper.append(engineElement)
  element.append(wrapper)
  return { wrapper, engineElement }
}

function renderOverlays(session: HostSession, slots: SlotOverrides, root: HTMLElement): () => void {
  function draw(): void {
    render(
      <SlotOverridesContext.Provider value={slots}>
        <Overlays session={session} snapshot={session.getSnapshot()} />
      </SlotOverridesContext.Provider>,
      root,
    )
  }

  // Drawn once up front, so the Loading screen shows before the session first publishes.
  draw()
  const unsubscribe = session.subscribe(draw)
  return (): void => {
    unsubscribe()

    // Preact's documented way to unmount a root.
    // oxlint-disable-next-line unicorn/no-null
    render(null, root)
  }
}

function drawBuiltIns(slots: SlotOverrides): DrawOverlays {
  return (session, wrapper) => {
    // Its own Preact root, after the canvas so it draws on top, never touching the Platform's UI.
    const root = document.createElement('div')
    wrapper.append(root)
    return renderOverlays(session, slots, root)
  }
}

function mountGame(element: HTMLElement, options: GameOptions, drawOverlays?: DrawOverlays): GameInstance {
  if (elementsWithAGame.has(element)) {
    throw new Error('This element already holds a game: unmount it before mounting another')
  }

  const { wrapper, engineElement } = appendMountPoints(element)
  const session = createHostSession({
    createEngine: engineFactoryFor(engineElement),
    getToken: options.getToken,
    onError: options.onError,
    flags: createFlagStore(options.flags),
    world: options.world,
    locale: options.locale ?? DEFAULT_LOCALE,
  })
  const removeOverlays = drawOverlays?.(session, wrapper)
  elementsWithAGame.add(element)
  session.start()

  const { getSnapshot, subscribe, advance, choose, dismissDialogue, advanceCg, skipCg, dismissCompanion, setLocale } = session
  let unmounted = false
  return {
    getSnapshot,
    subscribe,
    advance,
    choose,
    dismissDialogue,
    advanceCg,
    skipCg,
    dismissCompanion,
    setLocale,
    unmount: (): void => {
      if (unmounted) {return}
      unmounted = true

      // Before `destroy`, so a run it ends can't re-render into a root that's going away.
      removeOverlays?.()
      session.destroy()
      wrapper.remove()
      elementsWithAGame.delete(element)
    },
  }
}

export function mount(element: HTMLElement, options: MountOptions): GameInstance {
  const { slots = {}, ...gameOptions } = options
  return mountGame(element, gameOptions, drawBuiltIns(slots))
}

// Draws no built-in at all: the Platform draws every overlay from the instance's snapshot (adr/0039).
export function mountHeadless(element: HTMLElement, options: GameOptions): GameInstance {
  return mountGame(element, options)
}
