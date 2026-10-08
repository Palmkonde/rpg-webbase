import { blob, missing, newFile, upload } from './publish.ts'
import assert from 'node:assert/strict'
import { skipWithoutServices } from './services.ts'
import { test } from 'node:test'

const OK = 200
const NO_CONTENT = 204
const BAD_REQUEST = 400
const UNAUTHORIZED = 401
const NOT_FOUND = 404
const UNPROCESSABLE = 422

async function missingOf(keys: string[]): Promise<string[]> {
  const response = await missing(keys)
  assert.equal(response.status, OK)
  const body = (await response.json()) as { missing: string[] }
  return body.missing
}

test('the missing query names the keys the bucket does not hold', { skip: skipWithoutServices }, async () => {
  const held = newFile()
  const absent = newFile()
  const stored = await upload(held.key, held.body)
  assert.equal(stored.status, NO_CONTENT)

  assert.deepEqual(await missingOf([held.key, absent.key]), [absent.key])
})

test('an upload whose bytes do not hash to the key is refused and never reaches the bucket', { skip: skipWithoutServices }, async () => {
  const claimed = newFile()
  const other = newFile()

  const response = await upload(claimed.key, other.body)

  assert.equal(response.status, UNPROCESSABLE)
  assert.deepEqual(await missingOf([claimed.key]), [claimed.key])
})

test('uploading a file the bucket already holds is accepted', { skip: skipWithoutServices }, async () => {
  const file = newFile()
  await upload(file.key, file.body)

  const again = await upload(file.key, file.body)

  assert.equal(again.status, NO_CONTENT)
})

test('a key that is not <sha256>.<extension> is refused', { skip: skipWithoutServices }, async () => {
  const upped = await upload('not-a-hash.png', new Uint8Array([1]))
  const asked = await missing(['not-a-key'])

  assert.equal(upped.status, BAD_REQUEST)
  assert.equal(asked.status, BAD_REQUEST)
})

for (const [name, key] of [['no Publish key', false], ['the wrong Publish key', 'not-the-key'], ['a Student token', 'eyJhbGciOiJIUzI1NiJ9.e30.x']] as const) {
  test(`${name} is refused as 401 on the missing query`, async () => {
    const response = await missing([newFile().key], key)

    assert.equal(response.status, UNAUTHORIZED)
  })

  test(`${name} is refused as 401 on an upload`, async () => {
    const file = newFile()

    const response = await upload(file.key, file.body, key)

    assert.equal(response.status, UNAUTHORIZED)
  })
}

test('a file is streamed as a 200 with no token, cached forever, with its ETag and length', { skip: skipWithoutServices }, async () => {
  const file = newFile()
  await upload(file.key, file.body)

  const response = await blob(file.key)

  assert.equal(response.status, OK)
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.equal(response.headers.get('content-length'), String(file.body.byteLength))
  assert.ok(response.headers.get('etag'))
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), file.body)
})

test('a key the bucket does not hold is 404', { skip: skipWithoutServices }, async () => {
  const response = await blob(newFile().key)

  assert.equal(response.status, NOT_FOUND)
})
