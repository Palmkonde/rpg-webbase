import * as schema from './schema.ts'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql'
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import path from 'node:path'

// Seconds: `/healthz` should fail fast on an unreachable Postgres, not wait out the 30-second default.
const CONNECTION_TIMEOUT = 5

const MIGRATIONS = path.join(import.meta.dir, '../drizzle')

export type Database = BunSQLDatabase<typeof schema> & { $client: SQL }

export function createDatabase(url: string): Database {
  return drizzle({ client: new SQL({ url, connectionTimeout: CONNECTION_TIMEOUT }), schema })
}

export async function migrateDatabase(url: string): Promise<void> {
  const db = createDatabase(url)
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS })
  } finally {
    await db.$client.close()
  }
}
