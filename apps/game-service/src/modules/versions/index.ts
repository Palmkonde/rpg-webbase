import { Elysia, t } from 'elysia'
import { commitVersion, listVersions, readLive, readLiveSummary, readVersion } from './service.ts'
import type { BlobStore } from '../blobs/service.ts'
import type { Database } from '../../database.ts'
import { VersionsModel } from './model.ts'
import { publishKey } from '../../plugins/publish-key.ts'
import { studentToken } from '../../plugins/student-token.ts'

const CREATED = 201
const NOT_FOUND = 404
const CONFLICT = 409
const UNPROCESSABLE = 422

// A World's versions: the Publish routes behind the Publish key, and the Student routes that serve a World Version behind a token (adr/0036).
// The return type stays inferred: it carries the routes Eden types its calls from (adr/0037).
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function versionsModule({ db, store, jwtSecret, publishKey: key, assetBaseUrl }: { db: Database; store: BlobStore; jwtSecret: string; publishKey: string; assetBaseUrl?: string }) {

  // Without `ASSET_BASE_URL` the service hands out its own `/blobs/`, on the origin the request came to (adr/0042).
  function baseUrlFor(request: Request): string {
    return assetBaseUrl ?? new URL('/api/v1/blobs/', request.url).href
  }

  return new Elysia({ name: 'versions', prefix: '/worlds/:world/versions' })
    .use(publishKey(key))
    .use(studentToken(jwtSecret))
    .get('/live', async ({ params: { world }, request, status }) => {
      const live = await readLive(db, world)
      return live ? { ...live, assetBaseUrl: baseUrlFor(request) } : status(NOT_FOUND, 'This World was never Published')
    }, { student: true })
    .get('/:id', async ({ params: { world, id }, request, status }) => {
      const version = await readVersion(db, world, id)
      return version ? { ...version, assetBaseUrl: baseUrlFor(request) } : status(NOT_FOUND, 'This World Version is gone')
    }, { student: true, params: t.Object({ world: t.String(), id: t.String({ format: 'uuid' }) }) })
    .get('/', async ({ params: { world }, status }) => await listVersions(db, world) ?? status(NOT_FOUND, 'This World was never Published'), { publish: true })
    .get('/live/summary', async ({ params: { world }, status }) => await readLiveSummary(db, world) ?? status(NOT_FOUND, 'This World was never Published'), { publish: true })
    .post('/', async ({ params: { world }, body, status }) => {
      const result = await commitVersion({ db, store }, world, body)
      if ('stale' in result) {return status(CONFLICT, 'Another Publish went live first: run it again against the new live World Version')}
      if ('unlisted' in result) {return status(UNPROCESSABLE, `The manifest names files its files list leaves out: ${result.unlisted.join(', ')}`)}
      if ('missing' in result) {return status(UNPROCESSABLE, `The bucket does not hold: ${result.missing.join(', ')}`)}
      return status(CREATED, { id: result.committed })
    }, { publish: true, body: VersionsModel.commit })
}
