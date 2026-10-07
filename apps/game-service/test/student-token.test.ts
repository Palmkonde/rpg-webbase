import { NO_DATABASE_URL, createTestApp, signStudentToken, worldRequest } from './app.ts'
import type { TokenClaims } from './app.ts'
import assert from 'node:assert/strict'
import { createDatabase } from '../src/database.ts'
import { test } from 'node:test'

const UNAUTHORIZED = 401
const NOT_FOUND = 404
const FORBIDDEN = 403

const app = createTestApp(createDatabase(NO_DATABASE_URL))

const STUDENT: TokenClaims = { sub: 'student-1', world: 'world-a' }

async function getFlags(token?: string): Promise<number> {
  const response = await app.handle(worldRequest('/api/v1/worlds/world-a/flags', { token }))
  return response.status
}

test('a request without a token is refused as unauthorized', async () => {
  assert.equal(await getFlags(), UNAUTHORIZED)
})

test('a Flag write without a token is refused as unauthorized', async () => {
  const response = await app.handle(worldRequest('/api/v1/worlds/world-a/flags', { method: 'PATCH', body: '{"guard_met":true}' }))

  assert.equal(response.status, UNAUTHORIZED)
})

test('the Flags routes answer only under /api/v1', async () => {
  const response = await app.handle(worldRequest('/worlds/world-a/flags', { token: await signStudentToken(STUDENT) }))

  assert.equal(response.status, NOT_FOUND)
})

test('a token that is not a JWT is refused as unauthorized', async () => {
  assert.equal(await getFlags('not-a-jwt'), UNAUTHORIZED)
})

test('a token signed with another secret is refused as unauthorized', async () => {
  assert.equal(await getFlags(await signStudentToken({ ...STUDENT, secret: 'another-secret' })), UNAUTHORIZED)
})

test('a token for another audience is refused as unauthorized', async () => {
  assert.equal(await getFlags(await signStudentToken({ ...STUDENT, aud: 'some-other-app' })), UNAUTHORIZED)
})

test('an expired token is refused as unauthorized', async () => {
  const aMinuteAgo = Math.floor(Date.now() / 1000) - 60

  assert.equal(await getFlags(await signStudentToken({ ...STUDENT, exp: aMinuteAgo })), UNAUTHORIZED)
})

test('a token with no expiry is refused as unauthorized', async () => {
  assert.equal(await getFlags(await signStudentToken({ ...STUDENT, exp: undefined })), UNAUTHORIZED)
})

test('a token naming no Student is refused as unauthorized', async () => {
  assert.equal(await getFlags(await signStudentToken({ ...STUDENT, sub: undefined })), UNAUTHORIZED)
})

test('a token naming no World is refused as unauthorized', async () => {
  assert.equal(await getFlags(await signStudentToken({ ...STUDENT, world: undefined })), UNAUTHORIZED)
})

test('a token for another World is refused as forbidden', async () => {
  assert.equal(await getFlags(await signStudentToken({ ...STUDENT, world: 'world-b' })), FORBIDDEN)
})
