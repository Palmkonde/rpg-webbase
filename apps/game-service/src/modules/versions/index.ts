import { commitVersion, readLiveSummary } from './service.ts'
import type { BlobStore } from '../blobs/service.ts'
import type { Database } from '../../database.ts'
import { Elysia } from 'elysia'
import { VersionsModel } from './model.ts'
import { publishKey } from '../../plugins/publish-key.ts'

const CREATED = 201
const NOT_FOUND = 404
const CONFLICT = 409
const UNPROCESSABLE = 422

// The Publish routes of a World's versions; the Student routes that read them arrive with the serving ticket.
// The return type stays inferred: it carries the routes Eden types its calls from (adr/0037).
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function versionsModule({ db, store, publishKey: key }: { db: Database; store: BlobStore; publishKey: string }) {
  return new Elysia({ name: 'versions', prefix: '/worlds/:world/versions' })
    .use(publishKey(key))
    .get('/live/summary', async ({ params: { world }, status }) => await readLiveSummary(db, world) ?? status(NOT_FOUND, 'This World was never Published'), { publish: true })
    .post('/', async ({ params: { world }, body, status }) => {
      const result = await commitVersion({ db, store }, world, body)
      if ('stale' in result) {return status(CONFLICT, 'Another Publish went live first: run it again against the new live World Version')}
      if ('unlisted' in result) {return status(UNPROCESSABLE, `The manifest names files its files list leaves out: ${result.unlisted.join(', ')}`)}
      if ('missing' in result) {return status(UNPROCESSABLE, `The bucket does not hold: ${result.missing.join(', ')}`)}
      return status(CREATED, { id: result.committed })
    }, { publish: true, body: VersionsModel.commit })
}
