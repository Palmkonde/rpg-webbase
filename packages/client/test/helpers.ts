import type { CreateEngineOptions, EngineEvent, EngineHandle } from '@codeleagues-rpg-engine/engine-core'
import type { EngineFactory, HostSession, HostSessionOptions, WorldContent } from '../src/session.ts'
import type { GameService, ServiceResponse } from '../src/game-service.ts'
import type { Flags } from '../src/flags.ts'
import assert from 'node:assert/strict'
import { createHostSession } from '../src/session.ts'
import { readFile } from 'node:fs/promises'

export interface FakeEngine {
  createEngine: EngineFactory

  // Fires an Engine Event at the session, as the real Engine would.
  emit: (event: EngineEvent) => void

  // Every call the session made on the Engine, in order.
  calls: string[]
}

export function createFakeEngine(): FakeEngine {
  const calls: string[] = []
  let onEvent: ((event: EngineEvent) => void) | undefined
  const handle: EngineHandle = {
    destroy: () => { calls.push('destroy') },
    setPaused: (paused) => { calls.push(`paused ${paused}`) },
    moveTo: async (charId, { x, y }) => { calls.push(`move ${charId} ${x},${y}`) },
    follow: (followerId, leaderId, gap) => { calls.push(`follow ${followerId} ${leaderId} ${gap}`) },
    stopMovement: (charId) => { calls.push(`stop ${charId}`) },
    setBlocksCharacters: (charId, blocks) => { calls.push(`blocks ${charId} ${blocks}`) },
  }
  return {
    calls,
    createEngine: async (options) => {
      ({ onEvent } = options)
      return handle
    },
    emit: (event) => {
      assert.ok(onEvent, 'the session started no Engine')
      onEvent(event)
    },
  }
}

// `bun run test` compiles `fixtures/scripts/` into `generated/scripts.clscb`.
export const world: WorldContent = {
  worldConfig: { mapId: 'test', player: { spawn: { x: 0, y: 0 }, characterId: 'fluffy' } },
  catalogs: { maps: [], characters: [] },
  loadScripts: async () => new Uint8Array(await readFile(new URL('generated/scripts.clscb', import.meta.url))),
  strings: { en: { 'cg.vision.1': 'A light.', 'cg.vision.2': 'A door.' }, th: { 'cg.vision.1': 'แสงสว่าง' } },
  portraits: { Sage: { Happy: '/portraits/sage/happy.png' } },
  cgs: { vision: [{ art: 'vision-1', captionKey: 'cg.vision.1' }, { art: 'vision-2', captionKey: 'cg.vision.2' }] },
  cgArt: { 'vision-1': '/cg/vision/1.png', 'vision-2': '/cg/vision/2.png' },
}

export async function getToken(): Promise<string> {
  return 'student-token'
}

const OK = 200

type Route = keyof GameService

// The status a call answers, 200 to succeed; a promise holds the call until it settles.
type Answer = number | Promise<number>

export interface FakeService {
  service: GameService

  // What the service holds for the Student, shallow-merged by each successful PATCH as the real one does.
  stored: Flags

  // Every call the session made, in order, as `<route> <token>`.
  calls: string[]

  // Every PATCH body, in the order the session sent them, whether or not it was answered yet.
  patches: Flags[]

  // Queues answers for the next calls to `route`; once they run out, every call succeeds.
  answerNext: (route: Route, ...answers: Answer[]) => void
}

export function createFakeService(initial: Flags = {}): FakeService {
  const stored = { ...initial }
  const calls: string[] = []
  const patches: Flags[] = []
  const queued: Record<Route, Answer[]> = { readFlags: [], patchFlags: [] }

  function answerNext(route: Route, ...answers: Answer[]): void {
    queued[route].push(...answers)
  }

  async function answer<Data>(route: Route, token: string, data: () => Data): Promise<ServiceResponse<Data>> {
    calls.push(`${route} ${token}`)
    const status = await (queued[route].shift() ?? OK)
    return status === OK ? { ok: true, data: data() } : { ok: false, status }
  }

  const service: GameService = {
    readFlags: (token) => answer('readFlags', token, () => ({ ...stored })),
    patchFlags: (token, patch) => {
      patches.push(patch)
      return answer('patchFlags', token, () => { Object.assign(stored, patch) })
    },
  }
  return { service, stored, calls, patches, answerNext }
}

// Every backoff resolves at once; `waits` lists how long each would have been.
export function createInstantWait(): { wait: (milliseconds: number) => Promise<void>; waits: number[] } {
  const waits: number[] = []
  return { waits, wait: async (milliseconds) => { waits.push(milliseconds) } }
}

// Built against a fake Engine and a fake service holding no Flags, unless `options` says otherwise.
export function createTestSession(options: Partial<HostSessionOptions> = {}): HostSession {
  return createHostSession({
    createEngine: createFakeEngine().createEngine,
    service: createFakeService().service,
    getToken,
    world,
    locale: 'en',
    wait: createInstantWait().wait,
    ...options,
  })
}

export async function startSession(options: Partial<HostSessionOptions> = {}): Promise<{ session: HostSession; engine: FakeEngine }> {
  const engine = createFakeEngine()
  const session = createTestSession({ createEngine: engine.createEngine, ...options })
  await session.start()
  return { session, engine }
}

// Every fake answers within microtasks, so one macrotask lets whatever an event or action set off finish.
export function settle(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new
  return new Promise((resolve) => { setTimeout(resolve, 0) })
}

// Runs `body` with `console[method]` captured, and returns each call's arguments. Swapped by hand and restored in a finally, since `bun test` shares one process across files (adr/0033).
export async function consoleCalls(method: 'error' | 'warn', body: () => Promise<void>): Promise<unknown[][]> {
  const calls: unknown[][] = []
  const original = console[method]
  console[method] = (...args: unknown[]): void => { calls.push(args) }
  try {
    await body()
  } finally {
    console[method] = original
  }
  return calls
}

// A promise and the function that resolves it, for holding a fake partway through a call.
export function deferred<Value = void>(): { promise: Promise<Value>; resolve: (value: Value) => void } {
  let release!: (value: Value) => void
  // oxlint-disable-next-line promise/avoid-new
  const promise = new Promise<Value>((resolve) => { release = resolve })
  return { promise, resolve: release }
}

// Every Engine it creates waits for `release`; `creating` resolves once one is asked for.
export function holdEngineCreation(engine: FakeEngine): { createEngine: EngineFactory; creating: Promise<void>; release: () => void } {
  const creating = deferred()
  const released = deferred()
  async function createEngine(options: CreateEngineOptions): Promise<EngineHandle> {
    creating.resolve()
    await released.promise
    return engine.createEngine(options)
  }
  return { createEngine, creating: creating.promise, release: released.resolve }
}
