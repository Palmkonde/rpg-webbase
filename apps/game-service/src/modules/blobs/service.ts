import { CryptoHasher } from 'bun'
import type { S3Client } from 'bun'

// 64 MiB. A file is held in memory until its hash is known, so this is also the most a request can cost.
// Buffered, because the S3 subset every provider shares can't retract a streamed upload; stage under a temporary key if World art outgrows the limit.
const MAX_BLOB_BYTES = 67_108_864

// Where files live in the bucket: `blobs/` (adr/0034), or another prefix when tests share one bucket.
export interface BlobStore {
  bucket: S3Client
  prefix: string
}

const KEY = /^[0-9a-f]{64}\.[a-z0-9]{1,16}$/u

// The most keys S3 lists per request.
const MAX_PAGE_SIZE = 1000

export const DEFAULT_PREFIX = 'blobs/'

// Every file key in the bucket under the store's prefix; anything else under it is not ours and is left out.
export async function listKeys({ bucket, prefix }: BlobStore, pageSize = MAX_PAGE_SIZE): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined
  do {
    // oxlint-disable-next-line no-await-in-loop -- each page names the next.
    const page = await bucket.list({ prefix, continuationToken, maxKeys: pageSize })
    keys.push(...(page.contents ?? []).map(({ key }) => key.slice(prefix.length)).filter((key) => KEY.test(key)))
    continuationToken = page.isTruncated ? page.nextContinuationToken : undefined
  } while (continuationToken)
  return keys
}

export async function deleteBlob({ bucket, prefix }: BlobStore, key: string): Promise<void> {
  await bucket.delete(`${prefix}${key}`)
}

export async function missingKeys({ bucket, prefix }: BlobStore, keys: string[]): Promise<string[]> {
  const unique = [...new Set(keys)]
  const present = await Promise.all(unique.map((key) => bucket.exists(`${prefix}${key}`)))
  return unique.filter((_, index) => !present[index])
}

// The bytes of `body` once their hash is known; `undefined` when they are over the limit.
async function readHashed(body: ReadableStream<Uint8Array> | null): Promise<{ bytes: Buffer; sha256: string } | undefined> {
  const hasher = new CryptoHasher('sha256')
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of body ?? []) {
    size += chunk.byteLength
    if (size > MAX_BLOB_BYTES) {return undefined}
    hasher.update(chunk)
    chunks.push(chunk)
  }
  return { bytes: Buffer.concat(chunks), sha256: hasher.digest('hex') }
}

// A mismatch is refused before anything is written, so a key in the bucket always holds the bytes that hash to it.
export async function storeBlob({ bucket, prefix }: BlobStore, key: string, body: ReadableStream<Uint8Array> | null): Promise<'stored' | 'hashMismatch' | 'tooLarge'> {
  const received = await readHashed(body)
  if (received === undefined) {return 'tooLarge'}
  if (received.sha256 !== key.slice(0, key.indexOf('.'))) {return 'hashMismatch'}
  await bucket.write(`${prefix}${key}`, received.bytes)
  return 'stored'
}

export interface StoredBlob {
  stream: ReadableStream<Uint8Array>
  etag: string
  size: number
  type: string
}

// `stat()` first, so a missing key is told apart before any bytes stream; `ETag` and the length come from it.
export async function readBlob({ bucket, prefix }: BlobStore, key: string): Promise<StoredBlob | undefined> {
  const file = bucket.file(`${prefix}${key}`)
  try {
    const { etag, size, type } = await file.stat()
    return { stream: file.stream(), etag, size, type }
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error.code === 'NoSuchKey' || error.code === 'NotFound')) {return undefined}
    throw error
  }
}
