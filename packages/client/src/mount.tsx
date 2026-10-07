/** @jsxImportSource preact */
import type { EngineFactory, HostSession, WorldContent } from './session.ts'
import { DEFAULT_LOCALE } from './strings.ts'
import type { Flags } from './flags.ts'
import type { GameError } from './game-error.ts'
import { Overlays } from './overlays/overlays.tsx'
import { createFlagStore } from './flags.ts'
import { createHostSession } from './session.ts'
import { render } from 'preact'

export interface MountOptions {
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

export interface GameInstance {
  setLocale: (locale: string) => void

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

// The overlay root comes after the canvas, so the overlays draw on top of it.
function appendMountPoints(element: HTMLElement): { wrapper: HTMLElement; engineElement: HTMLElement; overlayRoot: HTMLElement } {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = WRAPPER_STYLE
  const engineElement = document.createElement('div')
  engineElement.style.cssText = ENGINE_STYLE
  const overlayRoot = document.createElement('div')
  wrapper.append(engineElement, overlayRoot)
  element.append(wrapper)
  return { wrapper, engineElement, overlayRoot }
}

// The built-ins get their own Preact root, so they never touch the Platform's UI.
function renderOverlays(session: HostSession, root: HTMLElement): () => void {
  function draw(): void {
    render(<Overlays session={session} snapshot={session.getSnapshot()} />, root)
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

export function mount(element: HTMLElement, options: MountOptions): GameInstance {
  if (elementsWithAGame.has(element)) {
    throw new Error('This element already holds a game: unmount it before mounting another')
  }

  const { wrapper, engineElement, overlayRoot } = appendMountPoints(element)
  const session = createHostSession({
    createEngine: engineFactoryFor(engineElement),
    getToken: options.getToken,
    onError: options.onError,
    flags: createFlagStore(options.flags),
    world: options.world,
    locale: options.locale ?? DEFAULT_LOCALE,
  })
  const removeOverlays = renderOverlays(session, overlayRoot)
  elementsWithAGame.add(element)
  session.start()

  let unmounted = false
  return {
    setLocale: session.setLocale,
    unmount: (): void => {
      if (unmounted) {return}
      unmounted = true

      // Before `destroy`, so a run it ends can't re-render into a root that's going away.
      removeOverlays()
      session.destroy()
      wrapper.remove()
      elementsWithAGame.delete(element)
    },
  }
}
