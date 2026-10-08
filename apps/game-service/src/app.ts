import { DEFAULT_PREFIX } from './modules/blobs/service.ts'
import type { Database } from './database.ts'
import { Elysia } from 'elysia'
import type { S3Client } from 'bun'
import { blobsModule } from './modules/blobs/index.ts'
import { cors } from '@elysiajs/cors'
import { flagsModule } from './modules/flags/index.ts'
import { sql } from 'drizzle-orm'
import { versionsModule } from './modules/versions/index.ts'

const BAD_REQUEST = 400
const SERVICE_UNAVAILABLE = 503

export interface AppOptions {
  db: Database
  jwtSecret: string
  corsOrigins: string[]
  publishKey: string
  bucket: S3Client

  // Where files live in the bucket; tests set their own so runs never see each other's files.
  blobPrefix?: string
}

// The return type stays inferred: it carries the routes Eden types its calls from (adr/0037).
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function createApp({ db, jwtSecret, corsOrigins, publishKey, bucket, blobPrefix = DEFAULT_PREFIX }: AppOptions) {
  const store = { bucket, prefix: blobPrefix }
  return new Elysia()
    // `Authorization` is named: a wildcard never admits it (Fetch spec, CORS-safelisted headers).
    .use(cors({ origin: corsOrigins, methods: ['GET', 'PATCH'], allowedHeaders: ['authorization', 'content-type'] }))

    // A body that fails its schema is malformed, so 400 rather than Elysia's default 422.
    .onError(({ code, status }) => {
      if (code === 'VALIDATION' || code === 'PARSE') {return status(BAD_REQUEST, 'Malformed request body')}
    })
    .get('/healthz', async ({ status }) => {
      try {
        await db.execute(sql`select 1`)
        return 'ok'
      } catch (error) {
        console.error('Postgres did not answer the health check:', error)
        return status(SERVICE_UNAVAILABLE, 'Postgres did not answer')
      }
    })

    // Every route but `/healthz`, which stays where container runtimes and load balancers probe it.
    .group('/api/v1', (api) => api.use(flagsModule({ db, jwtSecret })).use(blobsModule({ store, publishKey })).use(versionsModule({ db, store, publishKey })))
}

export type App = ReturnType<typeof createApp>
