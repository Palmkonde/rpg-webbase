import { Elysia, t } from 'elysia'
import { missingKeys, storeBlob } from './service.ts'
import type { BlobStore } from './service.ts'
import { BlobsModel } from './model.ts'
import { publishKey } from '../../plugins/publish-key.ts'

const NO_CONTENT = 204
const PAYLOAD_TOO_LARGE = 413
const UNPROCESSABLE = 422

// The return type stays inferred: it carries the routes Eden types its calls from (adr/0037).
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function blobsModule({ store, publishKey: key }: { store: BlobStore; publishKey: string }) {
  return new Elysia({ name: 'blobs', prefix: '/blobs' })
    .use(publishKey(key))
    .post('/missing', async ({ body }) => ({ missing: await missingKeys(store, body.keys) }), { publish: true, body: BlobsModel.keys })
    .put('/:key', async ({ params: { key: blobKey }, request, status }) => {
      const stored = await storeBlob(store, blobKey, request.body)
      if (stored === 'tooLarge') {return status(PAYLOAD_TOO_LARGE, 'The file is over the size limit')}
      if (stored === 'hashMismatch') {return status(UNPROCESSABLE, 'The bytes do not hash to the key')}
      return status(NO_CONTENT)
    }, { publish: true, parse: 'none', params: t.Object({ key: BlobsModel.key }) })
}
