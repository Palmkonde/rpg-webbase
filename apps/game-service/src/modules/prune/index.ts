import { DEFAULT_GRACE_DAYS, prune } from './service.ts'
import type { BlobStore } from '../blobs/service.ts'
import type { Database } from '../../database.ts'
import { Elysia } from 'elysia'
import { PruneModel } from './model.ts'
import { publishKey } from '../../plugins/publish-key.ts'

const NOT_FOUND = 404
const CONFLICT = 409

// Behind the Publish key: `crpg prune` runs the operator's cleanup.
// The return type stays inferred: it carries the routes Eden types its calls from (adr/0037).
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function pruneModule({ db, store, publishKey: key, graceDays = DEFAULT_GRACE_DAYS }: { db: Database; store: BlobStore; publishKey: string; graceDays?: number }) {
  return new Elysia({ name: 'prune', prefix: '/prune' })
    .use(publishKey(key))
    .post('/', async ({ body, status }) => {
      const result = await prune({ db, store, graceDays }, body.version)
      if ('live' in result) {return status(CONFLICT, 'That is the live World Version: Publish a newer one first')}
      if ('unknown' in result) {return status(NOT_FOUND, 'No such World Version')}
      return result
    }, { publish: true, body: PruneModel.prune })
}
