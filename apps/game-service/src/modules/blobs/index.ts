import { Elysia, t } from 'elysia'
import { missingKeys, readBlob, storeBlob } from './service.ts'
import type { BlobStore } from './service.ts'
import { BlobsModel } from './model.ts'
import { publishKey } from '../../plugins/publish-key.ts'

const NO_CONTENT = 204
const NOT_FOUND = 404
const PAYLOAD_TOO_LARGE = 413
const UNPROCESSABLE = 422

// The return type stays inferred: it carries the routes Eden types its calls from (adr/0037).
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function blobsModule({ store, publishKey: key }: { store: BlobStore; publishKey: string }) {
  return new Elysia({ name: 'blobs', prefix: '/blobs' })
    .use(publishKey(key))
    .post('/missing', async ({ body }) => ({ missing: await missingKeys(store, body.keys) }), { publish: true, body: BlobsModel.keys })

    // No token (adr/0042): a key is a content hash, so its bytes never change and any cache may keep them forever.
    .get('/:key', async ({ params: { key: blobKey }, status }) => {
      const blob = await readBlob(store, blobKey)
      if (!blob) {return status(NOT_FOUND, 'No such file')}
      return new Response(blob.stream, {
        headers: {
          'cache-control': 'public, max-age=31536000, immutable',
          'content-length': String(blob.size),
          'content-type': blob.type,
          etag: blob.etag,
        },
      })
    }, { params: t.Object({ key: BlobsModel.key }) })
    .put('/:key', async ({ params: { key: blobKey }, request, status }) => {
      const stored = await storeBlob(store, blobKey, request.body)
      if (stored === 'tooLarge') {return status(PAYLOAD_TOO_LARGE, 'The file is over the size limit')}
      if (stored === 'hashMismatch') {return status(UNPROCESSABLE, 'The bytes do not hash to the key')}
      return status(NO_CONTENT)
    }, { publish: true, parse: 'none', params: t.Object({ key: BlobsModel.key }) })
}
