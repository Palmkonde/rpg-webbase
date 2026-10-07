import type { EngineEvent, EngineHandle } from '@codeleagues-rpg-engine/engine-core'
import type { EngineFactory, HostSession, HostSessionOptions, WorldContent } from '../src/session.ts'
import assert from 'node:assert/strict'
import { createFlagStore } from '../src/flags.ts'
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
  strings: { en: { 'cg.vision.1': 'A light.', 'cg.vision.2': 'A door.' } },
  portraits: { Sage: { Happy: '/portraits/sage/happy.png' } },
  cgs: { vision: [{ art: 'vision-1', captionKey: 'cg.vision.1' }, { art: 'vision-2', captionKey: 'cg.vision.2' }] },
  cgArt: { 'vision-1': '/cg/vision/1.png', 'vision-2': '/cg/vision/2.png' },
}

// Started against a fake Engine, with empty Flags unless `options` says otherwise.
export async function startSession(options: Partial<HostSessionOptions> = {}): Promise<{ session: HostSession; engine: FakeEngine }> {
  const engine = createFakeEngine()
  const session = createHostSession({ createEngine: engine.createEngine, flags: createFlagStore(), world, locale: 'en', ...options })
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
