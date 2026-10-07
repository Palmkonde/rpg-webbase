import { after, before, test } from 'node:test'
import { createDatabase, migrateDatabase } from '../src/database.ts'
import { createTestApp, signStudentToken, worldRequest } from './app.ts'
import { services, skipWithoutServices } from './services.ts'
import type { Database } from '../src/database.ts'
import assert from 'node:assert/strict'

const OK = 200
const NO_CONTENT = 204
const BAD_REQUEST = 400
const PAYLOAD_TOO_LARGE = 413

const MAX_KEYS = 200
const MAX_KEY_LENGTH = 128
const MAX_DOCUMENT_BYTES = 64 * 1024

let db: Database | undefined

before(async () => {
  if (!services) {return}
  await migrateDatabase(services.databaseUrl)
  db = createDatabase(services.databaseUrl)
})

after(async () => {
  await db?.$client.close()
})

interface Student {
  world: string
  get: () => Promise<Response>
  patch: (body: string) => Promise<Response>
}

// A Student of a World no other test uses, so tests never see each other's Flags.
async function newStudent(sub = 'student-1', world = `world-${crypto.randomUUID()}`): Promise<Student> {
  assert.ok(db)
  const app = createTestApp(db)
  const token = await signStudentToken({ sub, world })
  const path = `/api/v1/worlds/${world}/flags`
  return {
    world,
    get: () => app.handle(worldRequest(path, { token })),
    patch: (body) => app.handle(worldRequest(path, { method: 'PATCH', token, body })),
  }
}

async function readFlags(student: Student): Promise<unknown> {
  const response = await student.get()
  assert.equal(response.status, OK)
  return response.json()
}

function manyFlags(count: number, prefix = 'flag'): Record<string, boolean> {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [`${prefix}_${index}`, true]))
}

test('GET answers {} for a Student who has written no Flags', { skip: skipWithoutServices }, async () => {
  const student = await newStudent()

  assert.deepEqual(await readFlags(student), {})
})

test('PATCH saves Flags that GET then answers', { skip: skipWithoutServices }, async () => {
  const student = await newStudent()

  const response = await student.patch(JSON.stringify({ guard_met: true, 'companion:Guard': 'fluffy' }))

  assert.equal(response.status, NO_CONTENT)
  assert.deepEqual(await readFlags(student), { guard_met: true, 'companion:Guard': 'fluffy' })
})

test('PATCH merges shallowly, keeping keys it doesn\'t name and replacing those it does', { skip: skipWithoutServices }, async () => {
  const student = await newStudent()
  await student.patch(JSON.stringify({ guard_met: true, 'companion:Guard': 'fluffy' }))

  await student.patch(JSON.stringify({ 'companion:Guard': false, campfire_seen: true }))

  assert.deepEqual(await readFlags(student), { guard_met: true, 'companion:Guard': false, campfire_seen: true })
})

test('each Student of a World keeps their own Flags', { skip: skipWithoutServices }, async () => {
  const student = await newStudent('student-1')
  const other = await newStudent('student-2', student.world)

  await student.patch(JSON.stringify({ guard_met: true }))

  assert.deepEqual(await readFlags(other), {})
})

test('a Student keeps separate Flags in each World', { skip: skipWithoutServices }, async () => {
  const inWorldA = await newStudent('student-1')
  const inWorldB = await newStudent('student-1')

  await inWorldA.patch(JSON.stringify({ guard_met: true }))

  assert.deepEqual(await readFlags(inWorldB), {})
})

for (const [name, body] of [
  ['not JSON', 'guard_met=true'],
  ['an array', '[true]'],
  ['null', 'null'],
  ['a number value', '{"visits":1}'],
  ['an object value', '{"guard":{"met":true}}'],
  ['a null value', '{"guard_met":null}'],
]) {
  test(`a PATCH body that is ${name} is refused as 400, saving nothing`, { skip: skipWithoutServices }, async () => {
    const student = await newStudent()

    const response = await student.patch(body)

    assert.equal(response.status, BAD_REQUEST)
    assert.deepEqual(await readFlags(student), {})
  })
}

test(`a document of ${MAX_KEYS} keys is saved`, { skip: skipWithoutServices }, async () => {
  const student = await newStudent()

  const response = await student.patch(JSON.stringify(manyFlags(MAX_KEYS)))

  assert.equal(response.status, NO_CONTENT)
})

test(`a PATCH that takes the document over ${MAX_KEYS} keys is refused as 413, saving none of it`, { skip: skipWithoutServices }, async () => {
  const student = await newStudent()
  await student.patch(JSON.stringify(manyFlags(MAX_KEYS)))

  const response = await student.patch(JSON.stringify({ one_too_many: true, flag_0: false }))

  assert.equal(response.status, PAYLOAD_TOO_LARGE)
  assert.deepEqual(await readFlags(student), manyFlags(MAX_KEYS))
})

test(`a key of ${MAX_KEY_LENGTH} characters is saved`, { skip: skipWithoutServices }, async () => {
  const student = await newStudent()

  const response = await student.patch(JSON.stringify({ ['k'.repeat(MAX_KEY_LENGTH)]: true }))

  assert.equal(response.status, NO_CONTENT)
})

test(`a key over ${MAX_KEY_LENGTH} characters is refused as 413`, { skip: skipWithoutServices }, async () => {
  const student = await newStudent()

  const response = await student.patch(JSON.stringify({ ['k'.repeat(MAX_KEY_LENGTH + 1)]: true }))

  assert.equal(response.status, PAYLOAD_TOO_LARGE)
  assert.deepEqual(await readFlags(student), {})
})

test('a PATCH that takes the document over 64 KB is refused as 413, saving none of it', { skip: skipWithoutServices }, async () => {
  const student = await newStudent()
  const half = 'x'.repeat(MAX_DOCUMENT_BYTES / 2)
  await student.patch(JSON.stringify({ first: half }))

  const response = await student.patch(JSON.stringify({ second: half }))

  assert.equal(response.status, PAYLOAD_TOO_LARGE)
  assert.deepEqual(await readFlags(student), { first: half })
})
