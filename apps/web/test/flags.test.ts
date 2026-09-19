import { createFlagStore, flagStore } from '../src/state/flags.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('getFlags returns the seed flags for an unseen studentId', async () => {
  const store = createFlagStore({ studentId: 'test-student', flags: { tutorial_seen: false } })
  const result = await store.getFlags('test-student')
  assert.deepEqual(result, { tutorial_seen: false })
})

test('setFlags then getFlags reflects the new value', async () => {
  const store = createFlagStore({ studentId: 'test-student', flags: {} })
  await store.setFlags('test-student', { talked_to_npc_1: true })
  const result = await store.getFlags('test-student')
  assert.equal(result.talked_to_npc_1, true)
})

test('two different studentIds never see each other\'s flags', async () => {
  const store = createFlagStore({ studentId: 'test-student', flags: {} })
  await store.setFlags('test-student', { seen_intro: true })
  const other = await store.getFlags('someone-else')
  assert.equal(other.seen_intro, undefined)
})

test('setFlags overwrites an existing key rather than erroring or merging around it', async () => {
  const store = createFlagStore({ studentId: 'test-student', flags: {} })
  await store.setFlags('test-student', { visits: 1 })
  await store.setFlags('test-student', { visits: 2 })
  const result = await store.getFlags('test-student')
  assert.equal(result.visits, 2)
})

test('the default flagStore singleton is wired to the real fixture', async () => {
  const result = await flagStore.getFlags('test-student')
  assert.deepEqual(result, { tutorial_seen: false })
})
