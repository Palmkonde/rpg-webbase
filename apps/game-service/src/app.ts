import type { Database } from './database.ts'
import { Elysia } from 'elysia'
import { sql } from 'drizzle-orm'

const SERVICE_UNAVAILABLE = 503

// The return type stays inferred: it carries the routes Eden types its calls from (adr/0037).
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function createApp({ db }: { db: Database }) {
  return new Elysia().get('/healthz', async ({ status }) => {
    try {
      await db.execute(sql`select 1`)
      return 'ok'
    } catch (error) {
      console.error('Postgres did not answer the health check:', error)
      return status(SERVICE_UNAVAILABLE, 'Postgres did not answer')
    }
  })
}
