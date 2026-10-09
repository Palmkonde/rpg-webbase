import { SQL, spawn } from 'bun'
import { services, skipWithoutServices } from './services.ts'
import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'

const MAIN = path.join(import.meta.dir, '../src/main.ts')

async function runMain(args: string[], env: Record<string, string>): Promise<{ exitCode: number; stderr: string }> {
  // `--no-env-file`: a contributor's own apps/game-service/.env must not fill in what the test leaves out.
  const child = spawn([process.execPath, '--no-env-file', MAIN, ...args], { env, stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  return { exitCode, stderr }
}

async function withEmptyDatabase(serverUrl: string, run: (url: string) => Promise<void>): Promise<void> {
  const admin = new SQL(serverUrl)
  const name = `migrate_test_${crypto.randomUUID().replaceAll('-', '')}`
  await admin.unsafe(`create database ${name}`)
  try {
    const url = new URL(serverUrl)
    url.pathname = `/${name}`
    await run(url.href)
  } finally {
    await admin.unsafe(`drop database ${name} with (force)`)
    await admin.close()
  }
}

async function listTables(url: string): Promise<string[]> {
  const db = new SQL(url)
  try {
    const rows: { table_name: string }[] = await db`select table_name from information_schema.tables where table_schema = 'public' order by table_name`
    return rows.map((row) => row.table_name)
  } finally {
    await db.close()
  }
}

test('serve exits naming every missing required variable', async () => {
  const { exitCode, stderr } = await runMain(['serve'], { S3_BUCKET: 'game', S3_REGION: 'us-east-1' })
  assert.equal(exitCode, 1)
  assert.match(
    stderr,
    /Missing required environment variables: DATABASE_URL, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, JWT_SECRET, PUBLISH_KEY, CORS_ORIGINS/u,
  )
})

test('an unknown command exits naming the commands there are', async () => {
  const { exitCode, stderr } = await runMain(['deploy'], {})
  assert.equal(exitCode, 1)
  assert.match(stderr, /Unknown command "deploy": expected serve, migrate or prune/u)
})

test('migrate applies the committed SQL to an empty database and exits', { skip: skipWithoutServices }, async () => {
  await withEmptyDatabase(services!.databaseUrl, async (url) => {
    const { exitCode } = await runMain(['migrate'], { DATABASE_URL: url })
    assert.equal(exitCode, 0)
    assert.deepEqual(await listTables(url), ['flags', 'world_versions', 'worlds'])
  })
})

test('prune exits naming the database and bucket variables it needs', async () => {
  const { exitCode, stderr } = await runMain(['prune'], { JWT_SECRET: 'not needed' })
  assert.equal(exitCode, 1)
  assert.match(stderr, /Missing required environment variables: DATABASE_URL, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION/u)
})
