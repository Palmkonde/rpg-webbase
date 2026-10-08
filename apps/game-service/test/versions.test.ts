import { before, test } from 'node:test'
import { commit, db, liveSummary, manifestOf, migrate, newFile, uploaded } from './publish.ts'
import { PUBLISH_KEY } from './app.ts'
import assert from 'node:assert/strict'
import { skipWithoutServices } from './services.ts'

const OK = 200
const CREATED = 201
const BAD_REQUEST = 400
const UNAUTHORIZED = 401
const NOT_FOUND = 404
const CONFLICT = 409
const UNPROCESSABLE = 422

before(migrate)

function newWorld(): string {
  return `world-${crypto.randomUUID()}`
}

async function liveOf(world: string): Promise<{ id: string; summary: unknown }> {
  const response = await liveSummary(world)
  assert.equal(response.status, OK)
  return (await response.json()) as { id: string; summary: unknown }
}

// Commits a manifest of one fresh file. `expectedLive` is left off for a World's first Publish.
async function publish(world: string, expectedLive?: string, summary: object = {}): Promise<Response> {
  return commit(world, { manifest: manifestOf([await uploaded()]), summary, expectedLive })
}

test('a World that was never Published has no live summary', { skip: skipWithoutServices }, async () => {
  const response = await liveSummary(newWorld())

  assert.equal(response.status, NOT_FOUND)
})

test('a first commit with every file uploaded puts the World Version live', { skip: skipWithoutServices }, async () => {
  const world = newWorld()

  const response = await publish(world, undefined, { zones: ['Gate'] })

  assert.equal(response.status, CREATED)
  const created = (await response.json()) as { id: string }
  assert.deepEqual(await liveOf(world), { id: created.id, summary: { zones: ['Gate'] } })
})

test('a commit naming a file the bucket does not hold is refused and nothing goes live', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  const absent = newFile().key

  const response = await commit(world, { manifest: manifestOf([await uploaded(), absent]), summary: {} })

  assert.equal(response.status, UNPROCESSABLE)
  assert.match(await response.text(), new RegExp(absent, 'u'))
  const live = await liveSummary(world)
  assert.equal(live.status, NOT_FOUND)
})

test('a commit whose manifest names a file outside its files list is refused too', { skip: skipWithoutServices }, async () => {
  const files = [await uploaded()]
  const absent = newFile().key

  const response = await commit(newWorld(), { manifest: manifestOf(files, { scripts: absent }), summary: {} })

  assert.equal(response.status, UNPROCESSABLE)
})

test('a commit whose files list leaves out a key the manifest names is refused', { skip: skipWithoutServices }, async () => {
  const [listed, unlisted] = [await uploaded(), await uploaded()]

  const response = await commit(newWorld(), { manifest: manifestOf([listed], { scripts: unlisted }), summary: {} })

  assert.equal(response.status, UNPROCESSABLE)
  assert.match(await response.text(), new RegExp(unlisted, 'u'))
})

test('a refused commit for a World nobody Published leaves no World behind', { skip: skipWithoutServices }, async () => {
  const world = newWorld()

  const response = await publish(world, crypto.randomUUID())

  assert.equal(response.status, CONFLICT)
  const rows = await db.$client`select id from worlds where id = ${world}`
  assert.equal(rows.length, 0)
})

test('a commit made against a stale expectedLive is refused and the live version stays', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  await publish(world)
  const first = await liveOf(world)

  const notNew = await publish(world)
  const wrongId = await publish(world, crypto.randomUUID())

  assert.equal(notNew.status, CONFLICT)
  assert.equal(wrongId.status, CONFLICT)
  assert.deepEqual(await liveOf(world), first)
})

test('a commit made against the live version replaces it', { skip: skipWithoutServices }, async () => {
  const world = newWorld()
  await publish(world)
  const first = await liveOf(world)

  const response = await publish(world, first.id, { zones: ['Door'] })

  assert.equal(response.status, CREATED)
  const second = await liveOf(world)
  assert.notEqual(second.id, first.id)
  assert.deepEqual(second.summary, { zones: ['Door'] })
})

for (const [name, body] of [
  ['no manifest', { summary: {} }],
  ['a manifest without a start', { manifest: { ...manifestOf(['a']), start: undefined }, summary: {} }],
  ['a key that is not a hash', { manifest: manifestOf(['not-a-key']), summary: {} }],
  ['an expectedLive that is not an id', { manifest: manifestOf([`${'0'.repeat(64)}.png`]), summary: {}, expectedLive: 'nope' }],
] as const) {
  test(`a commit with ${name} is refused as 400`, { skip: skipWithoutServices }, async () => {
    const response = await commit(newWorld(), body)

    assert.equal(response.status, BAD_REQUEST)
  })
}

for (const [name, key] of [['no Publish key', false], ['the wrong Publish key', `${PUBLISH_KEY}x`]] as const) {
  test(`${name} is refused as 401 on the commit`, async () => {
    const response = await commit(newWorld(), { manifest: manifestOf([`${'0'.repeat(64)}.png`]), summary: {} }, key)

    assert.equal(response.status, UNAUTHORIZED)
  })

  test(`${name} is refused as 401 on the live summary`, async () => {
    const response = await liveSummary(newWorld(), key)

    assert.equal(response.status, UNAUTHORIZED)
  })
}
