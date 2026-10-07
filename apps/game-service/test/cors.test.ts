import { NO_DATABASE_URL, PLATFORM_ORIGIN, createTestApp } from './app.ts'
import assert from 'node:assert/strict'
import { createDatabase } from '../src/database.ts'
import { test } from 'node:test'

const app = createTestApp(createDatabase(NO_DATABASE_URL))

// What a browser sends before a Flag write carrying the Student token.
function preflight(origin: string): Promise<Response> {
  return app.handle(new Request('http://localhost/api/v1/worlds/world-a/flags', {
    method: 'OPTIONS',
    headers: { origin, 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'authorization, content-type' },
  }))
}

test('a Platform origin in CORS_ORIGINS may send a token-carrying PATCH', async () => {
  const response = await preflight(PLATFORM_ORIGIN)

  assert.equal(response.headers.get('access-control-allow-origin'), PLATFORM_ORIGIN)
  assert.match(response.headers.get('access-control-allow-methods') ?? '', /PATCH/u)
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /authorization/iu)
})

test('an origin not in CORS_ORIGINS is not admitted', async () => {
  const response = await preflight('http://elsewhere.test')

  assert.notEqual(response.headers.get('access-control-allow-origin'), 'http://elsewhere.test')
})
