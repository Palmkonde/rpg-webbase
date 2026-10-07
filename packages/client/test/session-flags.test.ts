import type { FakeEngine, FakeService } from './helpers.ts'
import { consoleCalls, createFakeService, createInstantWait, deferred, settle, startSession } from './helpers.ts'
import type { Flags } from '../src/flags.ts'
import type { GameError } from '../src/game-error.ts'
import type { HostSession } from '../src/session.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const UNAUTHORIZED = 401
const FORBIDDEN = 403
const PAYLOAD_TOO_LARGE = 413
const SERVICE_UNAVAILABLE = 503

interface Played {
  session: HostSession
  engine: FakeEngine
  fake: FakeService
  reported: GameError[]
  waits: number[]
  tokensGiven: () => number
}

// Started against a fake service holding `stored`, with every error captured and each `getToken` call answering a new token.
async function play(stored: Flags = {}, prepare?: (fake: FakeService) => void): Promise<Played> {
  const fake = createFakeService(stored)
  prepare?.(fake)
  const { wait, waits } = createInstantWait()
  const reported: GameError[] = []
  let tokens = 0
  async function getToken(): Promise<string> {
    tokens += 1
    return `token-${tokens}`
  }
  let started: { session: HostSession; engine: FakeEngine } | undefined
  await consoleCalls('error', async () => {
    started = await startSession({ service: fake.service, getToken, wait, onError: (error) => { reported.push(error) } })
  })
  assert.ok(started)
  return { ...started, fake, reported, waits, tokensGiven: () => tokens }
}

// Runs `body` with the session's error logging captured, then lets what it set off finish.
async function quietly(body: () => Promise<void>): Promise<void> {
  await consoleCalls('error', async () => {
    await body()
    await settle()
  })
}

const RECRUITED = { 'companion:Guard': 'fluffy' }

test('a session reads the Student\'s Flags once at mount, with the token getToken gave', async () => {
  const { session, fake, tokensGiven } = await play(RECRUITED)
  await session.dismissCompanion('Guard')
  await settle()

  assert.deepEqual(fake.calls.filter((call) => call.startsWith('readFlags')), ['readFlags token-1'])
  assert.equal(tokensGiven(), 1)
})

test('a Companion the service holds for the Student shows once the session starts', async () => {
  const { session } = await play(RECRUITED)

  assert.deepEqual(session.getSnapshot().companions, ['Guard'])
})

test('a Flag a Script writes is saved to the service', async () => {
  const { engine, fake } = await play()

  engine.emit({ type: 'zoneEntered', zoneId: 'Gate' })
  await settle()

  assert.deepEqual(fake.stored, { Gate_seen: true })
})

test('a dismissed Companion is saved to the service as false', async () => {
  const { session, fake } = await play(RECRUITED)

  await session.dismissCompanion('Guard')
  await settle()

  assert.deepEqual(fake.stored, { 'companion:Guard': false })
})

test('a write shows before the service has answered it', async () => {
  const held = deferred<number>()
  const { session } = await play(RECRUITED, (fake) => { fake.answerNext('patchFlags', held.promise) })

  await session.dismissCompanion('Guard')

  assert.deepEqual(session.getSnapshot().companions, [])
})

// Two writes, the Zone-seen Flag and then the dismissed Companion, with the first one's PATCH held unanswered.
async function writeTwiceHoldingTheFirst(): Promise<{ fake: FakeService; release: () => void }> {
  const held = deferred<number>()
  const { session, engine, fake } = await play(RECRUITED, (service) => { service.answerNext('patchFlags', held.promise) })
  engine.emit({ type: 'zoneEntered', zoneId: 'Gate' })
  await settle()
  await session.dismissCompanion('Guard')
  await settle()
  return { fake, release: () => { held.resolve(200) } }
}

test('writes are sent one at a time, each once the one before it was answered', async () => {
  const { fake, release } = await writeTwiceHoldingTheFirst()
  const sentWhileHeld = [...fake.patches]

  release()
  await settle()

  assert.deepEqual(sentWhileHeld, [{ Gate_seen: true }])
  assert.deepEqual(fake.patches, [{ Gate_seen: true }, { 'companion:Guard': false }])
})

test('a write refused as 401 asks getToken again and retries once with the new token', async () => {
  const { session, fake, reported } = await play(RECRUITED, (service) => { service.answerNext('patchFlags', UNAUTHORIZED) })

  await session.dismissCompanion('Guard')
  await settle()

  assert.deepEqual(fake.calls.filter((call) => call.startsWith('patchFlags')), ['patchFlags token-1', 'patchFlags token-2'])
  assert.deepEqual(fake.stored, { 'companion:Guard': false })
  assert.deepEqual(reported, [])
})

test('a write refused as 401 twice stops the session as unauthorized', async () => {
  const { session, reported } = await play(RECRUITED, (fake) => { fake.answerNext('patchFlags', UNAUTHORIZED, UNAUTHORIZED) })

  await quietly(() => session.dismissCompanion('Guard'))

  assert.equal(session.getSnapshot().error?.kind, 'unauthorized')
  assert.equal(reported.length, 1)
})

test('a getToken that rejects when asked again after a 401 stops the session as a token error', async () => {
  const fake = createFakeService(RECRUITED)
  fake.answerNext('patchFlags', UNAUTHORIZED)
  let calls = 0
  async function getToken(): Promise<string> {
    calls += 1
    if (calls > 1) {throw new Error('signed out')}
    return 'token-1'
  }
  const { session } = await startSession({ service: fake.service, getToken })

  await quietly(() => session.dismissCompanion('Guard'))

  assert.equal(session.getSnapshot().error?.kind, 'token')
})

test('a write refused as 403 stops the session as forbidden, without retrying', async () => {
  const { session, fake } = await play(RECRUITED, (service) => { service.answerNext('patchFlags', FORBIDDEN) })

  await quietly(() => session.dismissCompanion('Guard'))

  assert.equal(session.getSnapshot().error?.kind, 'forbidden')
  assert.equal(fake.patches.length, 1)
})

test('a write the service refuses as too large stops the session as unavailable, without retrying', async () => {
  const { session, fake } = await play(RECRUITED, (service) => { service.answerNext('patchFlags', PAYLOAD_TOO_LARGE) })

  await quietly(() => session.dismissCompanion('Guard'))

  assert.equal(session.getSnapshot().error?.kind, 'unavailable')
  assert.equal(fake.patches.length, 1)
})

test('a write that fails twice with a 5xx or network failure is retried with backoff and saved', async () => {
  const { session, fake, waits, reported } = await play(RECRUITED, (service) => {
    service.answerNext('patchFlags', SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE)
  })

  await session.dismissCompanion('Guard')
  await settle()

  assert.deepEqual(waits, [1000, 4000])
  assert.deepEqual(fake.stored, { 'companion:Guard': false })
  assert.deepEqual(reported, [])
})

test('a write that fails all three tries stops the session as unavailable, reported once', async () => {
  const { session, fake, waits, reported } = await play(RECRUITED, (service) => {
    service.answerNext('patchFlags', SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE)
  })

  await quietly(() => session.dismissCompanion('Guard'))

  assert.equal(fake.patches.length, 3)
  assert.deepEqual(waits, [1000, 4000])
  assert.equal(session.getSnapshot().status, 'error')
  assert.deepEqual(reported.map((error) => error.kind), ['unavailable'])
})

test('a session stopped by a failed write destroys its Engine and sends no later write', async () => {
  const { session, engine, fake } = await play(RECRUITED, (service) => { service.answerNext('patchFlags', FORBIDDEN) })
  await quietly(() => session.dismissCompanion('Guard'))

  await session.dismissCompanion('Guard')
  await settle()

  assert.equal(engine.calls.at(-1), 'destroy')
  assert.equal(fake.patches.length, 1)
})

test('a read at mount that fails all three tries stops the session as unavailable, creating no Engine', async () => {
  const { session, engine } = await play({}, (fake) => {
    fake.answerNext('readFlags', SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE)
  })

  assert.equal(session.getSnapshot().error?.kind, 'unavailable')
  assert.throws(() => { engine.emit({ type: 'interacted', entityId: 'Sage' }) }, /started no Engine/u)
})
