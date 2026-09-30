import type { CutsceneCallbacks, CutsceneHandle } from '../src/game/play-cutscene.ts'
import type { CutsceneRegistry } from '../src/state/cutscene.ts'
import assert from 'node:assert/strict'
import { playCutscene } from '../src/game/play-cutscene.ts'
import { test } from 'node:test'

function noop(): void {
  return undefined
}

// Records the calls these tests assert on, in order; the Dialogue/Choice rendering callbacks are ignored.
function createFakeCallbacks(overrides: Partial<CutsceneCallbacks> = {}): { callbacks: CutsceneCallbacks; log: string[] } {
  const log: string[] = []
  const callbacks: CutsceneCallbacks = {
    setPaused: (paused) => { log.push(`paused ${paused}`) },
    onLine: noop,
    onChoices: noop,
    moveTo: async (charId) => { log.push(`moveTo ${charId}`) },
    follow: (followerId, leaderId, gap) => { log.push(`follow ${followerId} ${leaderId} ${gap}`) },
    stopMovement: (charId) => { log.push(`stop ${charId}`) },
    onChoicePicked: async () => ({ handedOff: false }),
    ...overrides,
  }
  return { callbacks, log }
}

test('playCutscene starts a follow, runs the next step without waiting on it, and stops the follower before unpausing', async () => {
  const registry: CutsceneRegistry = {
    'follow-then-walk': [
      { type: 'follow', followerId: 'player', leaderId: 'Guard', gap: 1 },
      { type: 'movement', charId: 'Guard', targetPos: { x: 9, y: 10 } },
    ],
  }
  const { callbacks, log } = createFakeCallbacks()

  await playCutscene('follow-then-walk', callbacks, registry).done

  assert.deepEqual(log, ['paused true', 'follow player Guard 1', 'moveTo Guard', 'stop player', 'paused false'])
})

test('playCutscene keeps a follow running through a Choice hand-off and stops it only when the original Cutscene ends', async () => {
  const registry: CutsceneRegistry = {
    'follow-then-choose': [
      { type: 'follow', followerId: 'player', leaderId: 'Guard', gap: 1 },
      { type: 'choice', choices: [{ text: 'Go on' }] },
    ],
  }
  // The Cutscene handle only exists once playCutscene returns, after these callbacks are built.
  const picker: { pick?: CutsceneHandle['pickChoice'] } = {}
  const { callbacks, log } = createFakeCallbacks({
    onChoices: (choices) => {
      const [first] = choices ?? []
      if (first) {queueMicrotask(() => { picker.pick?.(first) })}
    },
    onChoicePicked: async () => {
      log.push('handed off')
      return { handedOff: true }
    },
  })
  const handle = playCutscene('follow-then-choose', callbacks, registry)
  picker.pick = handle.pickChoice

  await handle.done

  assert.deepEqual(log, ['paused true', 'follow player Guard 1', 'handed off', 'stop player', 'paused false'])
})

test('playCutscene still stops every follower and unpauses when a later step throws', async () => {
  const registry: CutsceneRegistry = {
    'follow-then-fail': [
      { type: 'follow', followerId: 'player', leaderId: 'Guard', gap: 1 },
      { type: 'follow', followerId: 'Guard', leaderId: 'player', gap: 0 },
      { type: 'movement', charId: 'Guard', targetPos: { x: 9, y: 10 } },
    ],
  }
  const { callbacks, log } = createFakeCallbacks({
    moveTo: async () => { throw new Error('walk failed') },
  })

  await assert.rejects(playCutscene('follow-then-fail', callbacks, registry).done, /walk failed/u)

  assert.deepEqual(log, ['paused true', 'follow player Guard 1', 'follow Guard player 0', 'stop player', 'stop Guard', 'paused false'])
})
