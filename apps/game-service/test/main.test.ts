import { SQL, serve, spawn } from 'bun'
import { mkdtemp, rm } from 'node:fs/promises'
import { services, skipWithoutServices } from './services.ts'
import assert from 'node:assert/strict'
import os from 'node:os'
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
  assert.match(stderr, /Unknown command "deploy": expected serve, migrate, prune or health/u)
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

async function healthWhileServing(status: number): Promise<{ exitCode: number; stderr: string }> {
  const stub = serve({ port: 0, fetch: () => new Response('', { status }) })
  try {
    return await runMain(['health'], { PORT: String(stub.port) })
  } finally {
    await stub.stop(true)
  }
}

test('health exits 0 when /healthz answers 200', async () => {
  const { exitCode } = await healthWhileServing(200)
  assert.equal(exitCode, 0)
})

test('health exits 1 naming the status when /healthz answers 503', async () => {
  const { exitCode, stderr } = await healthWhileServing(503)
  assert.equal(exitCode, 1)
  assert.match(stderr, /503/u)
})

test('health exits 1 when nothing is listening', async () => {
  const { exitCode } = await runMain(['health'], { PORT: '1' })
  assert.equal(exitCode, 1)
})

// Catches the embedded migrations going missing before an image build does; the Dockerfile adds only the target and autoload flags.
test('the compiled binary migrates an empty database', { skip: skipWithoutServices }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'game-service-'))
  try {
    const binary = path.join(dir, 'game-service')
    const build = spawn(['bun', 'build', '--compile', '--asset', 'drizzle', '--outfile', binary, 'src/main.ts'], { cwd: path.join(import.meta.dir, '..'), stderr: 'pipe' })
    assert.equal(await build.exited, 0, await new Response(build.stderr).text())
    await withEmptyDatabase(services!.databaseUrl, async (url) => {
      const child = spawn([binary, 'migrate'], { env: { DATABASE_URL: url }, stderr: 'pipe' })
      const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
      assert.equal(exitCode, 0, stderr)
      assert.deepEqual(await listTables(url), ['flags', 'world_versions', 'worlds'])
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
