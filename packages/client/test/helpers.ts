import type { CreateEngineOptions, EngineEvent, EngineHandle } from '@codeleagues-rpg-engine/engine-core'
import type { EngineFactory, HostSession, HostSessionOptions } from '../src/session.ts'
import type { GameService, ServiceResponse } from '../src/game-service.ts'
import type { Flags } from '../src/flags.ts'
import type { WorldVersion } from '../src/world-version.ts'
import assert from 'node:assert/strict'
import { createHostSession } from '../src/session.ts'
import { readFile } from 'node:fs/promises'

export interface FakeEngine {
  createEngine: EngineFactory

  // Fires an Engine Event at the session, as the real Engine would.
  emit: (event: EngineEvent) => void

  // Every call the session made on the Engine, in order.
  calls: string[]

  // What the session last created the Engine with.
  created: CreateEngineOptions | undefined
}

export function createFakeEngine(): FakeEngine {
  const calls: string[] = []
  let onEvent: ((event: EngineEvent) => void) | undefined
  let created: CreateEngineOptions | undefined
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
    get created() { return created },
    createEngine: async (options) => {
      ({ onEvent } = options)
      created = options
      return handle
    },
    emit: (event) => {
      assert.ok(onEvent, 'the session started no Engine')
      onEvent(event)
    },
  }
}

export const ASSET_BASE_URL = 'https://files.test/blobs/'

// `bun run test` compiles `fixtures/scripts/` into `generated/scripts.clscb`.
async function readFixtureFiles(): Promise<Readonly<Record<string, Uint8Array>>> {
  return {
    'scripts.clscb': new Uint8Array(await readFile(new URL('generated/scripts.clscb', import.meta.url))),
    'strings.json': new TextEncoder().encode(JSON.stringify({
      locale: 'en',
      table: { en: { 'cg.vision.1': 'A light.', 'cg.vision.2': 'A door.' }, th: { 'cg.vision.1': 'แสงสว่าง' } },
    })),
  }
}

let fixtureFiles: ReturnType<typeof readFixtureFiles> | undefined

export const liveVersion: WorldVersion = {
  id: 'version-1',
  assetBaseUrl: ASSET_BASE_URL,
  manifest: {
    start: { map: 'town', spawn: { x: 2, y: 3 }, player: 'fluffy' },
    maps: { town: 'town.tmj' },
    characters: { fluffy: { key: 'fluffy.png', frameWidth: 16, frameHeight: 20, offsetY: -8 } },
    portraits: { Sage: { Happy: 'sage-happy.png' } },
    cgs: { vision: ['vision-1.png', 'vision-2.png'] },
    scripts: 'scripts.clscb',
    strings: 'strings.json',
    entities: ['Sage', 'Guard', 'Statue'],
    files: [],
  },
}

export async function getToken(): Promise<string> {
  return 'student-token'
}

const OK = 200

type Route = keyof GameService

const NOT_FOUND = 404

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

// Holds `version` as the World's live one, and the fixture files under its `assetBaseUrl`.
export function createFakeService(initial: Flags = {}, version: WorldVersion = liveVersion): FakeService {
  const stored = { ...initial }
  const calls: string[] = []
  const patches: Flags[] = []
  const queued: Record<Route, Answer[]> = { readFlags: [], patchFlags: [], readLiveVersion: [], readFile: [] }

  function answerNext(route: Route, ...answers: Answer[]): void {
    queued[route].push(...answers)
  }

  // `label` is what the call is logged with: the token, or for a file its URL.
  async function answer<Data>(route: Route, label: string, data: () => Data): Promise<ServiceResponse<Data>> {
    calls.push(`${route} ${label}`)
    const status = await (queued[route].shift() ?? OK)
    return status === OK ? { ok: true, data: data() } : { ok: false, status }
  }

  const service: GameService = {
    readFlags: (token) => answer('readFlags', token, () => ({ ...stored })),
    patchFlags: (token, patch) => {
      patches.push(patch)
      return answer('patchFlags', token, () => { Object.assign(stored, patch) })
    },
    readLiveVersion: (token) => answer('readLiveVersion', token, () => version),
    readFile: async (url) => {
      fixtureFiles ??= readFixtureFiles()
      const files = await fixtureFiles
      const file = url.startsWith(version.assetBaseUrl) ? files[url.slice(version.assetBaseUrl.length)] : undefined
      const response = await answer('readFile', url, () => file)
      return response.ok && !response.data ? { ok: false, status: NOT_FOUND } : response as ServiceResponse<Uint8Array>
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
