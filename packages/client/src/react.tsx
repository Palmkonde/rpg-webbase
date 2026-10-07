/** @jsxImportSource react */
import type { Dispatch, ReactNode, RefCallback, SetStateAction } from 'react'
import type { GameInstance, GameOptions } from './mount.tsx'
import type { SlotName, SlotOverrides, SlotProps, SlotRenderer } from './slots.ts'
import { createElement, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { mount, mountHeadless } from './mount.tsx'
import type { HostSnapshot } from './views.ts'
import { createPortal } from 'react-dom'

export type SlotComponent<Name extends SlotName> = (props: SlotProps[Name]) => ReactNode

export type SlotComponents = { [Name in SlotName]?: SlotComponent<Name> }

export interface GameProps extends GameOptions {
  components?: SlotComponents
}

export interface UseGame {
  // Attach to the element the game mounts into.
  ref: RefCallback<HTMLElement>
  snapshot: HostSnapshot

  // Undefined until the game has mounted.
  game: GameInstance | undefined
}

type MountInto = (element: HTMLElement, options: GameOptions) => GameInstance

interface Portal<Name extends SlotName = SlotName> {
  key: string
  element: HTMLElement
  name: Name
  props: SlotProps[Name]
}

type SetPortals = Dispatch<SetStateAction<readonly Portal[]>>

// Fills its parent, so the Platform sizes the game by sizing that.
const GAME_ELEMENT_STYLE = { width: '100%', height: '100%' } as const

const NO_COMPONENTS: SlotComponents = {}

const NOT_MOUNTED: HostSnapshot = { status: 'loading', dialogue: undefined, cg: undefined, companions: [], error: undefined }

// Module-wide, so a remount's portals never reuse a key a torn-down mount's late `destroy` still removes.
let lastPortalKey = 0

// `useSyncExternalStore` needs an unsubscribe even before there's a game to subscribe to.
// oxlint-disable-next-line eslint/no-empty-function
function noUnsubscribe(): void {}

// Mounts once per World on a service; every other option is read at mount, or through the latest render for callbacks.
function useMountedGame(options: GameOptions, mountInto: MountInto): { ref: RefCallback<HTMLElement>; game: GameInstance | undefined } {
  const [element, setElement] = useState<HTMLElement>()
  const [game, setGame] = useState<GameInstance>()
  const latestOptions = useRef(options)
  const latestMountInto = useRef(mountInto)
  const { serviceUrl, worldId, locale } = options

  useLayoutEffect(() => {
    latestOptions.current = options
    latestMountInto.current = mountInto
  })

  useEffect(() => {
    if (!element) {return}
    const instance = latestMountInto.current(element, {
      ...latestOptions.current,
      serviceUrl,
      worldId,
      getToken: () => latestOptions.current.getToken(),
      onError: (error) => { latestOptions.current.onError?.(error) },
    })
    setGame(instance)
    return (): void => {
      setGame(undefined)
      instance.unmount()
    }
  }, [element, serviceUrl, worldId])

  useEffect(() => {
    if (game && locale !== undefined) {game.setLocale(locale)}
  }, [game, locale])

  const ref = useCallback((attached: HTMLElement | null) => { setElement(attached ?? undefined) }, [])
  return { ref, game }
}

function createPortalRenderer<Name extends SlotName>(name: Name, setPortals: SetPortals): SlotRenderer<SlotProps[Name]> {
  return (element, props) => {
    lastPortalKey += 1
    const key = String(lastPortalKey)
    setPortals((portals) => [...portals, { key, element, name, props }])
    return {
      update: (next): void => {
        setPortals((portals) => portals.map((portal) => (portal.key === key ? { ...portal, props: next } : portal)))
      },
      destroy: (): void => {
        setPortals((portals) => portals.filter((portal) => portal.key !== key))
      },
    }
  }
}

function createPortalSlots(names: readonly SlotName[], setPortals: SetPortals): SlotOverrides {
  return Object.fromEntries(names.map((name) => [name, createPortalRenderer(name, setPortals)]))
}

// Inside `<Game>`'s own tree, so the Platform's React context reaches the component (adr/0039).
function renderPortal<Name extends SlotName>({ key, element, name, props }: Portal<Name>, components: SlotComponents): ReactNode {
  const Component: SlotComponent<Name> | undefined = components[name]
  return Component && createPortal(createElement(Component, props), element, key)
}

// The game with its built-ins, any of them replaced by a React component; which slots are replaced is read at mount.
export function Game({ components = NO_COMPONENTS, ...options }: GameProps): ReactNode {
  const [portals, setPortals] = useState<readonly Portal[]>([])
  const slotNames = Object.keys(components) as SlotName[]
  const { ref } = useMountedGame(options, (element, gameOptions) => mount(element, { ...gameOptions, slots: createPortalSlots(slotNames, setPortals) }))

  // The portals are siblings of the mount element, never children: `mount` owns everything inside it.
  return (
    <>
      <div ref={ref} style={GAME_ELEMENT_STYLE} />
      {portals.map((portal) => renderPortal(portal, components))}
    </>
  )
}

// The game with no built-ins at all: the Platform draws every overlay from `snapshot` and the actions on `game` (adr/0039).
export function useGame(options: GameOptions): UseGame {
  const { ref, game } = useMountedGame(options, mountHeadless)
  const subscribe = useCallback((listener: () => void) => game?.subscribe(listener) ?? noUnsubscribe, [game])
  const getSnapshot = useCallback(() => game?.getSnapshot() ?? NOT_MOUNTED, [game])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { ref, snapshot, game }
}
