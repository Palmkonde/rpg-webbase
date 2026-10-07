import assert from 'node:assert/strict'
import { createFlagStore } from '../src/flags.ts'
import { test } from 'node:test'

test('getFlags returns the initial flags', async () => {
  const store = createFlagStore({ tutorial_seen: false })
  const result = await store.getFlags()
  assert.deepEqual(result, { tutorial_seen: false })
})

test('setFlags then getFlags reflects the new value', async () => {
  const store = createFlagStore()
  await store.setFlags({ talked_to_npc_1: true })
  const result = await store.getFlags()
  assert.equal(result.talked_to_npc_1, true)
})

test('two stores never see each other\'s flags, even from the same initial flags', async () => {
  const initial = { tutorial_seen: false }
  const store = createFlagStore(initial)
  await store.setFlags({ seen_intro: true })
  const other = await createFlagStore(initial).getFlags()
  assert.deepEqual(other, { tutorial_seen: false })
})

test('setFlags overwrites an existing key rather than erroring or merging around it', async () => {
  const store = createFlagStore()
  await store.setFlags({ visits: 1 })
  await store.setFlags({ visits: 2 })
  const result = await store.getFlags()
  assert.equal(result.visits, 2)
})
