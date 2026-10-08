import { readConfig, readDatabaseUrl } from '../src/config.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const env = {
  DATABASE_URL: 'postgres://game:game@localhost:5432/game',
  S3_ENDPOINT: 'http://localhost:8333',
  S3_BUCKET: 'game',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_REGION: 'us-east-1',
  JWT_SECRET: 'jwt',
  PUBLISH_KEY: 'publish',
  CORS_ORIGINS: 'http://localhost:3001',
}

test('readConfig reads every required variable and defaults PORT to 3000', () => {
  assert.deepEqual(readConfig(env), {
    databaseUrl: 'postgres://game:game@localhost:5432/game',
    s3: { endpoint: 'http://localhost:8333', bucket: 'game', accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1' },
    jwtSecret: 'jwt',
    publishKey: 'publish',
    corsOrigins: ['http://localhost:3001'],
    port: 3000,
    assetBaseUrl: undefined,
  })
})

test('readConfig names every missing required variable in one error', () => {
  const { JWT_SECRET: _jwt, S3_REGION: _region, ...partial } = env
  assert.throws(() => readConfig(partial), { message: 'Missing required environment variables: S3_REGION, JWT_SECRET' })
})

test('readConfig treats an empty variable as missing', () => {
  assert.throws(() => readConfig({ ...env, PUBLISH_KEY: '' }), { message: 'Missing required environment variables: PUBLISH_KEY' })
})

test('readConfig splits CORS_ORIGINS on commas', () => {
  const config = readConfig({ ...env, CORS_ORIGINS: 'https://a.example, https://b.example' })
  assert.deepEqual(config.corsOrigins, ['https://a.example', 'https://b.example'])
})

test('readConfig reads PORT when it is set', () => {
  assert.equal(readConfig({ ...env, PORT: '8080' }).port, 8080)
})

test('readConfig rejects a PORT that is not a port number', () => {
  assert.throws(() => readConfig({ ...env, PORT: 'eighty' }), { message: 'PORT must be a port number, got "eighty"' })
})

test('readConfig reads ASSET_BASE_URL and ends it with a slash', () => {
  assert.equal(readConfig({ ...env, ASSET_BASE_URL: 'https://cdn.example/assets' }).assetBaseUrl, 'https://cdn.example/assets/')
  assert.equal(readConfig({ ...env, ASSET_BASE_URL: 'https://cdn.example/' }).assetBaseUrl, 'https://cdn.example/')
})

test('readDatabaseUrl needs only DATABASE_URL', () => {
  assert.equal(readDatabaseUrl({ DATABASE_URL: env.DATABASE_URL }), env.DATABASE_URL)
  assert.throws(() => readDatabaseUrl({}), { message: 'Missing required environment variables: DATABASE_URL' })
})
