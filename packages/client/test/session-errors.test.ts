import type { HostSession, HostSessionOptions } from '../src/session.ts'
import { consoleCalls, createFakeService, startSession } from './helpers.ts'
import type { FakeService } from './helpers.ts'
import { GameError } from '../src/game-error.ts'
import type { GameErrorKind } from '../src/game-error.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const UNAUTHORIZED = 401
const FORBIDDEN = 403
const NOT_FOUND = 404
const SERVICE_UNAVAILABLE = 503

interface Failure {
  getToken?: () => Promise<string>
  createEngine?: HostSessionOptions['createEngine']

  // Queues the fake service's answers before the session starts.
  prepare?: (fake: FakeService) => void
}

// Starts a session that fails, and returns it with every error `onError` was called with, and the service it called.
async function failSession({ getToken, createEngine, prepare }: Failure): Promise<{ session: HostSession; reported: GameError[]; fake: FakeService }> {
  const fake = createFakeService()
  prepare?.(fake)
  const reported: GameError[] = []
  let session: HostSession | undefined
  await consoleCalls('error', async () => {
    ({ session } = await startSession({
      service: fake.service,
      ...(getToken && { getToken }),
      ...(createEngine && { createEngine }),
      onError: (error) => { reported.push(error) },
    }))
  })
  assert.ok(session)
  return { session, reported, fake }
}

function assertStopped({ session, reported }: { session: HostSession; reported: GameError[] }, kind: GameErrorKind): void {
  const { status, error } = session.getSnapshot()
  assert.equal(status, 'error')
  assert.equal(error?.kind, kind)
  assert.equal(reported.length, 1)
  assert.equal(reported[0], error)
}

test('a getToken that rejects stops the session with a token error, reported once to onError', async () => {
  const failed = await failSession({ getToken: () => Promise.reject(new Error('signed out')) })

  assertStopped(failed, 'token')
  assert.equal(failed.session.getSnapshot().error?.message, 'signed out')
})

test('a getToken that rejects with a GameError keeps that error\'s kind', async () => {
  const { session } = await failSession({ getToken: () => Promise.reject(new GameError('forbidden', 'not enrolled')) })

  assert.equal(session.getSnapshot().error?.kind, 'forbidden')
})

test('a failed getToken loads nothing', async () => {
  const { fake } = await failSession({ getToken: () => Promise.reject(new Error('signed out')) })

  assert.deepEqual(fake.calls, [])
})

test('a live World Version the service refuses twice with 401 stops the session as unauthorized', async () => {
  const failed = await failSession({ prepare: (fake) => { fake.answerNext('readLiveVersion', UNAUTHORIZED, UNAUTHORIZED) } })

  assertStopped(failed, 'unauthorized')
})

test('a live World Version the service forbids stops the session as forbidden', async () => {
  const failed = await failSession({ prepare: (fake) => { fake.answerNext('readLiveVersion', FORBIDDEN) } })

  assertStopped(failed, 'forbidden')
})

test('a World never Published (404 on live) stops the session as unavailable', async () => {
  const failed = await failSession({ prepare: (fake) => { fake.answerNext('readLiveVersion', NOT_FOUND) } })

  assertStopped(failed, 'unavailable')
})

test('a live World Version that stays down through every retry stops the session as unavailable', async () => {
  const failed = await failSession({ prepare: (fake) => { fake.answerNext('readLiveVersion', SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE) } })

  assertStopped(failed, 'unavailable')
})

test('a Scripts file the service no longer holds (404) stops the session as worldUpdated', async () => {
  const failed = await failSession({ prepare: (fake) => { fake.answerNext('readFile', NOT_FOUND) } })

  assertStopped(failed, 'worldUpdated')
})

test('a Map the Engine finds gone (404) stops the session as worldUpdated', async () => {
  const gone = Object.assign(new Error('The Map answered 404'), { status: NOT_FOUND })
  const failed = await failSession({ createEngine: () => Promise.reject(gone) })

  assertStopped(failed, 'worldUpdated')
})

test('an Engine that fails any other way stops the session as unavailable, keeping its message', async () => {
  const failed = await failSession({ createEngine: () => Promise.reject(new Error('no WebGL')) })

  assertStopped(failed, 'unavailable')
  assert.equal(failed.session.getSnapshot().error?.message, 'no WebGL')
})

test('a stopped session shows nothing of the game', async () => {
  const { session } = await failSession({ prepare: (fake) => { fake.answerNext('readFile', NOT_FOUND) } })

  const { dialogue, cg, companions } = session.getSnapshot()
  assert.deepEqual({ dialogue, cg, companions }, { dialogue: undefined, cg: undefined, companions: [] })
})
