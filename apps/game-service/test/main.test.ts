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

async function withConnection<T>(url: string, run: (db: SQL) => Promise<T>): Promise<T> {
  const db = new SQL(url)
  try {
    return await run(db)
  } finally {
    await db.close()
  }
}

async function listTables(url: string, schema: string): Promise<string[]> {
  const rows: { table_name: string }[] = await withConnection(url, (db) => db`select table_name from information_schema.tables where table_schema = ${schema} order by table_name`)
  return rows.map((row) => row.table_name)
}

async function schemaExists(url: string, schema: string): Promise<boolean> {
  const rows: unknown[] = await withConnection(url, (db) => db`select 1 from information_schema.schemata where schema_name = ${schema}`)
  return rows.length > 0
}

const GAME_SERVICE_TABLES = ['__drizzle_migrations', 'flags', 'world_versions', 'worlds']

// Another Drizzle app's migration log row is dated after every committed migration, so a service that read that log would skip its own.
const OTHER_APP_SETUP_SQL = `
  create table public.worlds (name text primary key);
  create table public.world_versions (name text primary key);
  create table public.flags (name text primary key);
  insert into public.worlds values ('other app');
  insert into public.world_versions values ('other app');
  insert into public.flags values ('other app');
  create schema drizzle;
  create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
  insert into drizzle.__drizzle_migrations (hash, created_at) values ('other app', 9999999999999);
`

async function otherAppRows(url: string): Promise<unknown[]> {
  return withConnection(url, (db) => db`
    select 'worlds' as source, name as value from public.worlds
    union all select 'world_versions', name from public.world_versions
    union all select 'flags', name from public.flags
    union all select 'drizzle', hash || '@' || created_at from drizzle.__drizzle_migrations
    order by source`)
}

async function appliedMigrations(url: string): Promise<unknown[]> {
  return withConnection(url, (db) => db`select hash, created_at from game_service.__drizzle_migrations order by id`)
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

test('migrate creates everything in the game_service schema of an empty database', { skip: skipWithoutServices }, async () => {
  await withEmptyDatabase(services!.databaseUrl, async (url) => {
    const { exitCode, stderr } = await runMain(['migrate'], { DATABASE_URL: url })
    assert.equal(exitCode, 0, stderr)
    assert.deepEqual(await listTables(url, 'game_service'), GAME_SERVICE_TABLES)
    assert.deepEqual(await listTables(url, 'public'), [])
    assert.equal(await schemaExists(url, 'drizzle'), false)
  })
})

test('migrate leaves another app\'s same-named tables and Drizzle migration log untouched', { skip: skipWithoutServices }, async () => {
  await withEmptyDatabase(services!.databaseUrl, async (url) => {
    await withConnection(url, (db) => db.unsafe(OTHER_APP_SETUP_SQL))
    const before = await otherAppRows(url)
    const { exitCode, stderr } = await runMain(['migrate'], { DATABASE_URL: url })
    assert.equal(exitCode, 0, stderr)
    assert.deepEqual(await otherAppRows(url), before)
    assert.deepEqual(await listTables(url, 'game_service'), GAME_SERVICE_TABLES)
  })
})

test('a second migrate changes nothing', { skip: skipWithoutServices }, async () => {
  await withEmptyDatabase(services!.databaseUrl, async (url) => {
    const first = await runMain(['migrate'], { DATABASE_URL: url })
    assert.equal(first.exitCode, 0, first.stderr)
    const applied = await appliedMigrations(url)
    const { exitCode, stderr } = await runMain(['migrate'], { DATABASE_URL: url })
    assert.equal(exitCode, 0, stderr)
    assert.deepEqual(await appliedMigrations(url), applied)
    assert.deepEqual(await listTables(url, 'game_service'), GAME_SERVICE_TABLES)
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
      assert.deepEqual(await listTables(url, 'game_service'), GAME_SERVICE_TABLES)
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
