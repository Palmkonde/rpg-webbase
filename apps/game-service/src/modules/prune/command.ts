import { DEFAULT_PREFIX } from '../blobs/service.ts'
import type { Env } from '../../config.ts'
import { S3Client } from 'bun'
import { createDatabase } from '../../database.ts'
import { prune } from './service.ts'
import { readPruneConfig } from '../../config.ts'

function describe(removed: string[]): string {
  return removed.length === 0 ? 'Nothing to prune.' : `Pruned ${removed.length} file${removed.length === 1 ? '' : 's'}:\n${removed.join('\n')}`
}

// The operator's `prune`: the same cleanup, run directly against the database and bucket.
export async function pruneCommand(env: Env, prefix = DEFAULT_PREFIX): Promise<string> {
  const { databaseUrl, s3, pruneGraceDays } = readPruneConfig(env)
  const db = createDatabase(databaseUrl)
  try {
    const result = await prune({ db, store: { bucket: new S3Client(s3), prefix }, graceDays: pruneGraceDays })
    return describe('removed' in result ? result.removed : [])
  } finally {
    await db.$client.close()
  }
}
