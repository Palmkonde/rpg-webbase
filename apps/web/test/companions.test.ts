import { activeCompanionIds, isCompanionFlag, syncCompanions } from '../src/state/companions.ts'
import type { CompanionEngine } from '../src/state/companions.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// Records every call syncCompanions makes, in order.
function createFakeEngine(): { engine: CompanionEngine; log: string[] } {
  const log: string[] = []
  const engine: CompanionEngine = {
    setBlocksCharacters: (charId, blocks) => { log.push(`blocks ${charId} ${blocks}`) },
    follow: (followerId, leaderId, gap) => { log.push(`follow ${followerId} ${leaderId} ${gap}`) },
    stopMovement: (charId) => { log.push(`stop ${charId}`) },
  }
  return { engine, log }
}

test('syncCompanions makes a recruited Companion non-blocking, then follows the Player right behind', () => {
  const { engine, log } = createFakeEngine()

  syncCompanions({ 'companion:Guard': 'fluffy' }, engine)

  assert.deepEqual(log, ['blocks Guard false', 'follow Guard player 0'])
})

test('syncCompanions restores blocking and stops a dismissed Companion', () => {
  const { engine, log } = createFakeEngine()

  syncCompanions({ 'companion:Guard': false }, engine)

  assert.deepEqual(log, ['blocks Guard true', 'stop Guard'])
})

test('syncCompanions ignores Flags without the companion: prefix', () => {
  const { engine, log } = createFakeEngine()

  syncCompanions({ tutorial_seen: true, Guard: 'fluffy', 'guard-walk_seen': false }, engine)

  assert.deepEqual(log, [])
})

test('syncCompanions gives each of several Companions its own calls', () => {
  const { engine, log } = createFakeEngine()

  syncCompanions({ 'companion:Guard': 'fluffy', 'companion:Cat': 'temmie', 'companion:Old': false }, engine)

  assert.deepEqual(log, [
    'blocks Guard false', 'follow Guard player 0',
    'blocks Cat false', 'follow Cat player 0',
    'blocks Old true', 'stop Old',
  ])
})

test('syncCompanions leaves a companion: Flag alone when it is neither a Character nor false', () => {
  const { engine, log } = createFakeEngine()

  syncCompanions({ 'companion:Guard': '', 'companion:Cat': true, 'companion:Old': 3 }, engine)

  assert.deepEqual(log, [])
})

test('activeCompanionIds lists only the Companions whose Flag holds a Character', () => {
  const active = activeCompanionIds({ 'companion:Guard': 'fluffy', 'companion:Old': false, 'companion:Blank': '', tutorial_seen: true })

  assert.deepEqual(active, ['Guard'])
})

test('isCompanionFlag holds for a companion: Flag of any value, and for nothing else', () => {
  assert.deepEqual(['companion:Guard', 'Guard', 'guard-walk_seen'].map((name) => isCompanionFlag(name)), [true, false, false])
})
