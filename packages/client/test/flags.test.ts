import { deferred, settle } from './helpers.ts'
import type { Flags } from '../src/flags.ts'
import type { SavedFlagStore } from '../src/game-service.ts'
import assert from 'node:assert/strict'
import { createSavedFlagStore } from '../src/game-service.ts'
import { test } from 'node:test'

interface Saves {
  store: SavedFlagStore

  // Every patch handed to `save`, in order, whether or not it has settled.
  saved: Flags[]
  failures: unknown[]
}

// A store whose saves answer with `answers` in turn, then succeed.
function createStore(...answers: Promise<void>[]): Saves {
  const saved: Flags[] = []
  const failures: unknown[] = []
  const store = createSavedFlagStore({
    save: async (patch): Promise<void> => {
      saved.push(patch)
      await answers.shift()
    },
    onSaveFailed: (error): void => { failures.push(error) },
  })
  return { store, saved, failures }
}

test('getFlags answers the Flags the store was loaded with', async () => {
  const { store } = createStore()
  store.load({ tutorial_seen: false })

  assert.deepEqual(await store.getFlags(), { tutorial_seen: false })
})

test('a write shows in getFlags before its save settles', async () => {
  const held = deferred()
  const { store } = createStore(held.promise)

  await store.setFlags({ guard_met: true })

  assert.deepEqual(await store.getFlags(), { guard_met: true })
})

test('a write replaces the value of a key already held', async () => {
  const { store } = createStore()
  store.load({ 'companion:Guard': 'fluffy' })

  await store.setFlags({ 'companion:Guard': false })

  assert.deepEqual(await store.getFlags(), { 'companion:Guard': false })
})

test('each write is saved only once the one before it has been', async () => {
  const held = deferred()
  const { store, saved } = createStore(held.promise)

  await store.setFlags({ first: true })
  await store.setFlags({ second: true })
  await settle()
  const whileHeld = [...saved]
  held.resolve()
  await settle()

  assert.deepEqual(whileHeld, [{ first: true }])
  assert.deepEqual(saved, [{ first: true }, { second: true }])
})

test('a failed save is reported once, and no later write is saved', async () => {
  const failure = new Error('unavailable')
  const { store, saved, failures } = createStore(Promise.reject(failure))

  await store.setFlags({ first: true })
  await store.setFlags({ second: true })
  await settle()

  assert.deepEqual(saved, [{ first: true }])
  assert.deepEqual(failures, [failure])
})

test('two stores loaded from the same Flags never see each other\'s writes', async () => {
  const stored = { tutorial_seen: false }
  const { store } = createStore()
  const other = createStore().store
  store.load(stored)
  other.load(stored)

  await store.setFlags({ seen_intro: true })

  assert.deepEqual(await other.getFlags(), { tutorial_seen: false })
})
