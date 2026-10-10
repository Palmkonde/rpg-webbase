import { PUBLISH_KEY, createTestApp, signStudentToken } from './app.ts'
import { before, test } from 'node:test'
import { blob, commit, db, manifestOf, migrate, newFile, prune, uploaded, version, versionList } from './publish.ts'
import { services, skipWithoutServices } from './services.ts'
import { S3Client } from 'bun'
import assert from 'node:assert/strict'
import { pruneCommand } from '../src/modules/prune/command.ts'

const OK = 200
const UNAUTHORIZED = 401
const NOT_FOUND = 404
const CONFLICT = 409
const BAD_REQUEST = 400

const WITHIN_GRACE_DAYS = 89
const PAST_GRACE_DAYS = 91
const GRACE_DAYS = 90

before(migrate)

function newWorld(): string {
  return `world-${crypto.randomUUID()}`
}

// Publishes a World Version of exactly `files` (one fresh file when none are given).
async function publish(world: string, expectedLive?: string, files?: string[]): Promise<{ id: string; files: string[] }> {
  const named = files ?? [await uploaded()]
  const response = await commit(world, { manifest: manifestOf(named), summary: {}, expectedLive })
  return { id: ((await response.json()) as { id: string }).id, files: named }
}

// Publishes twice, so the first World Version is retired. `shared` is a file both name.
async function retiredThenLive(world: string, shared?: string): Promise<{ retired: { id: string; files: string[] }; live: { id: string; files: string[] } }> {
  const own = [await uploaded()]
  const retired = await publish(world, undefined, shared === undefined ? own : [...own, shared])
  const live = await publish(world, retired.id, shared === undefined ? undefined : [shared])
  return { retired, live }
}

async function retiredDaysAgo(id: string, days: number): Promise<void> {
  await db.$client`update game_service.world_versions set retired_at = now() - make_interval(days => ${days}) where id = ${id}`
}

async function exists(key: string): Promise<boolean> {
  const response = await blob(key)
  return response.status === OK
}

async function removed(body: unknown = {}): Promise<string[]> {
  const response = await prune(body)
  assert.equal(response.status, OK)
  return ((await response.json()) as { removed: string[] }).removed
}

async function studentSees(world: string, id: string): Promise<number> {
  const token = await signStudentToken({ sub: 'student-1', world })
  const response = await version(world, id, token)
  return response.status
}

test('a commit stamps the World Version it replaces as retired, and not the new one', { skip: skipWithoutServices }, async () => {
  const { retired, live } = await retiredThenLive(newWorld())

  const [retiredRow] = await db.$client`select retired_at from game_service.world_versions where id = ${retired.id}`
  const [liveRow] = await db.$client`select retired_at from game_service.world_versions where id = ${live.id}`

  assert.ok(retiredRow.retired_at instanceof Date)
  assert.ok(!liveRow.retired_at)
})

test('prune removes a file no World Version names and lists it', { skip: skipWithoutServices }, async () => {
  const orphan = await uploaded()

  const gone = await removed()

  assert.ok(gone.includes(orphan))
  assert.equal(await exists(orphan), false)
})

test('prune keeps the files of the live World Version', { skip: skipWithoutServices }, async () => {
  const { files } = await publish(newWorld())

  await removed()

  assert.equal(await exists(files[0]), true)
})

test('a World Version retired inside the grace period keeps its files and stays fetchable', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  const { retired } = await retiredThenLive(world)
  await retiredDaysAgo(retired.id, WITHIN_GRACE_DAYS)

  const gone = await removed()

  assert.deepEqual(gone.filter((key) => retired.files.includes(key)), [])
  assert.equal(await exists(retired.files[0]), true)
  assert.equal(await studentSees(world, retired.id), OK)
})

test('a World Version retired past the grace period loses its files and is gone', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  const { retired } = await retiredThenLive(world)
  await retiredDaysAgo(retired.id, PAST_GRACE_DAYS)

  const gone = await removed()

  assert.deepEqual(gone.filter((key) => retired.files.includes(key)), retired.files)
  assert.equal(await exists(retired.files[0]), false)
  assert.equal(await studentSees(world, retired.id), NOT_FOUND)
})

test('a file shared by a kept and a pruned World Version stays', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  const shared = await uploaded()
  const { retired } = await retiredThenLive(world, shared)
  await retiredDaysAgo(retired.id, PAST_GRACE_DAYS)

  await removed()

  assert.equal(await exists(retired.files[0]), false)
  assert.equal(await exists(shared), true)
})

test('--version retires a non-live World Version at once, whatever its age', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  const { retired, live } = await retiredThenLive(world)

  const gone = await removed({ version: retired.id })

  assert.ok(gone.includes(retired.files[0]))
  assert.equal(await studentSees(world, retired.id), NOT_FOUND)
  assert.equal(await studentSees(world, live.id), OK)
})

test('--version with the live World Version is refused and nothing is removed', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  const { live } = await retiredThenLive(world)

  const response = await prune({ version: live.id })

  assert.equal(response.status, CONFLICT)
  assert.equal(await studentSees(world, live.id), OK)
  assert.equal(await exists(live.files[0]), true)
})

test('--version with an unknown World Version is 404', { skip: skipWithoutServices }, async () => {
  const response = await prune({ version: crypto.randomUUID() })

  assert.equal(response.status, NOT_FOUND)
})

test('--version that is not an id is 400', { skip: skipWithoutServices }, async () => {
  const response = await prune({ version: 'nope' })

  assert.equal(response.status, BAD_REQUEST)
})

for (const [name, key] of [['no Publish key', false], ['the wrong Publish key', `${PUBLISH_KEY}x`]] as const) {
  test(`${name} is refused as 401 on prune`, async () => {
    const response = await prune({}, key)

    assert.equal(response.status, UNAUTHORIZED)
  })
}

test('a World Version retired exactly the grace period ago is pruned', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  const { retired } = await retiredThenLive(world)
  await retiredDaysAgo(retired.id, GRACE_DAYS)

  const gone = await removed()

  assert.deepEqual(gone.filter((key) => retired.files.includes(key)), retired.files)
  assert.equal(await studentSees(world, retired.id), NOT_FOUND)
})

// An app with a one-day grace period of its own, and what a test needs to publish through it.
function shortGraceApp(world: string): { publishVia: (expectedLive?: string) => Promise<string>; prune: () => Promise<Response> } {
  const app = createTestApp(db, undefined, 1)
  function send(path: string, init: { method: string; body: BodyInit; contentType?: string }): Promise<Response> {
    const headers = { authorization: `Bearer ${PUBLISH_KEY}`, 'content-type': init.contentType ?? 'application/json' }
    return app.handle(new Request(`http://localhost/api/v1${path}`, { method: init.method, headers, body: init.body }))
  }
  return {
    async publishVia(expectedLive) {
      const file = newFile()
      await send(`/blobs/${file.key}`, { method: 'PUT', body: file.body, contentType: 'application/octet-stream' })
      const response = await send(`/worlds/${world}/versions`, { method: 'POST', body: JSON.stringify({ manifest: manifestOf([file.key]), summary: {}, expectedLive }) })
      return ((await response.json()) as { id: string }).id
    },
    prune: () => send('/prune', { method: 'POST', body: '{}' }),
  }
}

async function versionRows(id: string): Promise<number> {
  const rows = await db.$client`select id from game_service.world_versions where id = ${id}`
  return rows.length
}

test('a configured grace period replaces the default', { skip: skipWithoutServices }, async () => {
  const { publishVia, prune: pruneVia } = shortGraceApp(newWorld())
  const retired = await publishVia()
  await publishVia(retired)
  async function rowsAfterRetiring(interval: string): Promise<number> {
    await db.$client`update game_service.world_versions set retired_at = now() - ${interval}::interval where id = ${retired}`
    await pruneVia()
    return versionRows(retired)
  }

  assert.equal(await rowsAfterRetiring('12 hours'), 1, 'twelve hours is inside a one-day grace period')
  assert.equal(await rowsAfterRetiring('2 days'), 0, 'two days is past it')
})

function environmentOf(databaseUrl: string, s3: NonNullable<typeof services>['s3']): Record<string, string> {
  return { DATABASE_URL: databaseUrl, S3_ENDPOINT: s3.endpoint, S3_BUCKET: s3.bucket, S3_ACCESS_KEY_ID: s3.accessKeyId, S3_SECRET_ACCESS_KEY: s3.secretAccessKey, S3_REGION: s3.region }
}

test('the prune command removes unused files from its prefix and lists them', { skip: skipWithoutServices }, async () => {
  const { databaseUrl, s3 } = services!
  const [bucket, prefix] = [new S3Client(s3), `test-${crypto.randomUUID()}/`]
  const orphan = newFile().key
  await bucket.write(`${prefix}${orphan}`, 'x')
  const env = environmentOf(databaseUrl, s3)

  const output = await pruneCommand(env, prefix)
  const again = await pruneCommand(env, prefix)

  assert.equal(output, `Pruned 1 file:\n${orphan}`)
  assert.equal(await bucket.exists(`${prefix}${orphan}`), false)
  assert.equal(again, 'Nothing to prune.')
})

interface Listed {
  id: string
  createdAt: string
  retiredAt: string | null
  live: boolean
}

async function listed(world: string): Promise<Listed[]> {
  const response = await versionList(world)
  assert.equal(response.status, OK)
  return (await response.json()) as Listed[]
}

test("a World's versions are listed newest first, with the live one flagged and the others' retirement times", { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  const { retired, live } = await retiredThenLive(world)

  const versions = await listed(world)

  assert.deepEqual(versions.map(({ id }) => id), [live.id, retired.id])
  assert.deepEqual(versions.map(({ live: isLive }) => isLive), [true, false])
  assert.ok(!versions[0].retiredAt)
  assert.ok(Date.parse(versions[1].retiredAt ?? '') > 0)
  assert.ok(Date.parse(versions[0].createdAt) >= Date.parse(versions[1].createdAt))
})

test("another World's versions are not listed", { skip: skipWithoutServices }, async () => {
  const [mine, theirs] = [newWorld(), newWorld()]
  await publish(mine)
  const other = await publish(theirs)

  const versions = await listed(mine)

  assert.equal(versions.length, 1)
  assert.ok(!versions.some(({ id }) => id === other.id))
})

test('a World that was never Published has no versions to list', { skip: skipWithoutServices }, async () => {
  const response = await versionList(newWorld())

  assert.equal(response.status, NOT_FOUND)
})

for (const [name, key] of [['no Publish key', false], ['the wrong Publish key', `${PUBLISH_KEY}x`]] as const) {
  test(`${name} is refused as 401 on the version list`, async () => {
    const response = await versionList(newWorld(), key)

    assert.equal(response.status, UNAUTHORIZED)
  })
}
