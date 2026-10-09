import { and, eq, isNotNull, lte, sql } from 'drizzle-orm'
import { deleteBlob, listKeys } from '../blobs/service.ts'
import { worldVersions, worlds } from '../../schema.ts'
import type { BlobStore } from '../blobs/service.ts'
import type { Database } from '../../database.ts'

export const DEFAULT_GRACE_DAYS = 90

export type PruneResult = { removed: string[] } | { live: true } | { unknown: true }

// A World Version is kept while it is live, and for the grace period after it stopped being live (adr/0038).
async function dropExpiredVersions(db: Database, graceDays: number): Promise<void> {
  await db.delete(worldVersions).where(and(isNotNull(worldVersions.retiredAt), lte(worldVersions.retiredAt, sql`now() - make_interval(days => ${graceDays})`)))
}

async function dropVersion(db: Database, id: string): Promise<'dropped' | 'live' | 'unknown'> {
  const [row] = await db
    .select({ live: worlds.liveVersionId })
    .from(worldVersions)
    .innerJoin(worlds, eq(worlds.id, worldVersions.worldId))
    .where(eq(worldVersions.id, id))
  if (!row) {return 'unknown'}
  if (row.live === id) {return 'live'}
  await db.delete(worldVersions).where(eq(worldVersions.id, id))
  return 'dropped'
}

// Deletes every file no remaining World Version's `files` list names, and returns the keys it deleted.
// The bucket is listed before the kept keys are read, so a file committed in between is never in the deletable set.
async function deleteUnusedFiles(db: Database, store: BlobStore): Promise<string[]> {
  const inBucket = await listKeys(store)
  const used = await db.selectDistinct({ key: sql<string>`jsonb_array_elements_text(${worldVersions.manifest} -> 'files')` }).from(worldVersions)
  const kept = new Set(used.map(({ key }) => key))
  const unused = inBucket.filter((key) => !kept.has(key))
  await Promise.all(unused.map((key) => deleteBlob(store, key)))
  return unused
}

export async function prune({ db, store, graceDays }: { db: Database; store: BlobStore; graceDays: number }, version?: string): Promise<PruneResult> {
  if (version === undefined) {
    await dropExpiredVersions(db, graceDays)
  } else {
    const outcome = await dropVersion(db, version)
    if (outcome !== 'dropped') {return outcome === 'live' ? { live: true } : { unknown: true }}
  }
  return { removed: await deleteUnusedFiles(db, store) }
}
