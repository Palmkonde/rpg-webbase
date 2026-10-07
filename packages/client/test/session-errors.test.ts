import { consoleCalls, startSession, world } from './helpers.ts'
import { GameError } from '../src/game-error.ts'
import type { GameErrorKind } from '../src/game-error.ts'
import type { HostSession } from '../src/session.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// Starts a session that fails, and returns it with every error `onError` was called with.
async function failSession(failure: { getToken?: () => Promise<string>; loadScripts?: () => Promise<Uint8Array> }): Promise<{ session: HostSession; reported: GameError[] }> {
  const reported: GameError[] = []
  const { getToken, loadScripts = world.loadScripts } = failure
  let session: HostSession | undefined
  await consoleCalls('error', async () => {
    ({ session } = await startSession({
      ...(getToken && { getToken }),
      world: { ...world, loadScripts },
      onError: (error) => { reported.push(error) },
    }))
  })
  assert.ok(session)
  return { session, reported }
}

test('a getToken that rejects stops the session with a token error, reported once to onError', async () => {
  const { session, reported } = await failSession({ getToken: () => Promise.reject(new Error('signed out')) })

  const { status, error } = session.getSnapshot()
  assert.equal(status, 'error')
  assert.equal(error?.kind, 'token')
  assert.equal(error?.message, 'signed out')
  assert.equal(reported.length, 1)
  assert.equal(reported[0], error)
})

test('a getToken that rejects with a GameError keeps that error\'s kind', async () => {
  const { session } = await failSession({ getToken: () => Promise.reject(new GameError('forbidden', 'not enrolled')) })

  assert.equal(session.getSnapshot().error?.kind, 'forbidden')
})

for (const kind of ['unauthorized', 'forbidden', 'worldUpdated', 'unavailable'] satisfies GameErrorKind[]) {
  test(`a load failing with a ${kind} GameError stops the session with that kind, reported once to onError`, async () => {
    const { session, reported } = await failSession({ loadScripts: () => Promise.reject(new GameError(kind, 'refused')) })

    const { status, error } = session.getSnapshot()
    assert.equal(status, 'error')
    assert.equal(error?.kind, kind)
    assert.equal(reported.length, 1)
    assert.equal(reported[0], error)
  })
}

test('a load failing with any other error stops the session as unavailable, keeping its message', async () => {
  const { session, reported } = await failSession({ loadScripts: () => Promise.reject(new Error('no Scripts')) })

  const { status, dialogue, cg, companions, error } = session.getSnapshot()
  assert.deepEqual({ status, dialogue, cg, companions }, { status: 'error', dialogue: undefined, cg: undefined, companions: [] })
  assert.equal(error?.kind, 'unavailable')
  assert.equal(error?.message, 'no Scripts')
  assert.equal(reported.length, 1)
})

test('a failed getToken loads nothing', async () => {
  let loads = 0
  async function loadScripts(): Promise<Uint8Array> {
    loads += 1
    return world.loadScripts()
  }

  await failSession({ getToken: () => Promise.reject(new Error('signed out')), loadScripts })

  assert.equal(loads, 0)
})
