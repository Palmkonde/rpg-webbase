import { services, skipWithoutServices } from './services.ts'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'
import { createDatabase } from '../src/database.ts'
import { test } from 'node:test'

async function getHealthz(databaseUrl: string): Promise<Response> {
  const db = createDatabase(databaseUrl)
  try {
    return await createApp({ db }).handle(new Request('http://localhost/healthz'))
  } finally {
    await db.$client.close()
  }
}

test('GET /healthz answers 200 when Postgres answers', { skip: skipWithoutServices }, async () => {
  const response = await getHealthz(services!.databaseUrl)
  assert.equal(response.status, 200)
})

test('GET /healthz answers 503 when Postgres does not answer', async () => {
  const response = await getHealthz('postgres://game:game@127.0.0.1:1/game')
  assert.equal(response.status, 503)
})
