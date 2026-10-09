import { deleteBlob, listKeys } from '../src/modules/blobs/service.ts'
import { services, skipWithoutServices } from './services.ts'
import { S3Client } from 'bun'
import assert from 'node:assert/strict'
import { newFile } from './publish.ts'
import { test } from 'node:test'

function newStore(): { bucket: S3Client; prefix: string } {
  return { bucket: new S3Client(services!.s3), prefix: `test-${crypto.randomUUID()}/` }
}

async function put(store: { bucket: S3Client; prefix: string }, name: string): Promise<void> {
  await store.bucket.write(`${store.prefix}${name}`, 'x')
}

test('listKeys follows every page and returns keys without the prefix', { skip: skipWithoutServices }, async () => {
  const store = newStore()
  const keys = Array.from({ length: 5 }, () => newFile().key)
  await Promise.all(keys.map((key) => put(store, key)))

  const listed = await listKeys(store, 2)

  assert.equal(listed.length, keys.length)
  assert.deepEqual(new Set(listed), new Set(keys))
})

test('listKeys leaves out anything under the prefix that is not a file key', { skip: skipWithoutServices }, async () => {
  const store = newStore()
  const { key } = newFile()
  await Promise.all([put(store, key), put(store, 'notes.txt'), put(store, `sub/${key}`)])

  assert.deepEqual(await listKeys(store), [key])
})

test('listKeys sees only its own prefix', { skip: skipWithoutServices }, async () => {
  const [mine, theirs] = [newStore(), newStore()]
  await put(theirs, newFile().key)

  assert.deepEqual(await listKeys(mine), [])
})

test('deleteBlob removes one file and leaves the rest', { skip: skipWithoutServices }, async () => {
  const store = newStore()
  const [gone, kept] = [newFile().key, newFile().key]
  await Promise.all([put(store, gone), put(store, kept)])

  await deleteBlob(store, gone)

  assert.deepEqual(await listKeys(store), [kept])
})
