import type { Commit, Manifest } from './model.ts'
import { TransactionRollbackError, and, desc, eq, sql } from 'drizzle-orm'
import { worldVersions, worlds } from '../../schema.ts'
import type { BlobStore } from '../blobs/service.ts'
import type { Database } from '../../database.ts'
import { missingKeys } from '../blobs/service.ts'
import { toJsonb } from '../../jsonb.ts'

// The keys the manifest names that its `files` list leaves out.
function unlistedKeys(manifest: Manifest): string[] {
  const { maps, characters, portraits, cgs, scripts, strings, files } = manifest
  const named = [
    ...Object.values(maps),
    ...Object.values(characters).map((character) => character.key),
    ...Object.values(portraits).flatMap((expressions) => Object.values(expressions)),
    ...Object.values(cgs).flat(),
    scripts,
    strings,
  ]
  return [...new Set(named.filter((key) => !files.includes(key)))]
}

export async function readLiveSummary(db: Database, worldId: string): Promise<{ id: string; summary: unknown } | undefined> {
  const [row] = await db
    .select({ id: worldVersions.id, summary: worldVersions.summary })
    .from(worlds)
    .innerJoin(worldVersions, eq(worlds.liveVersionId, worldVersions.id))
    .where(eq(worlds.id, worldId))
  return row
}

export interface ListedVersion {
  id: string
  createdAt: Date
  retiredAt: Date | null
  live: boolean
}

// Newest first, for an Author who needs a World Version's id (`prune --version`); `undefined` for a World never Published.
export async function listVersions(db: Database, worldId: string): Promise<ListedVersion[] | undefined> {
  const [world] = await db.select({ live: worlds.liveVersionId }).from(worlds).where(eq(worlds.id, worldId))
  if (!world) {return undefined}
  const rows = await db
    .select({ id: worldVersions.id, createdAt: worldVersions.createdAt, retiredAt: worldVersions.retiredAt })
    .from(worldVersions)
    .where(eq(worldVersions.worldId, worldId))
    .orderBy(desc(worldVersions.createdAt))
  return rows.map(({ id, createdAt, retiredAt }) => ({ id, createdAt, retiredAt, live: id === world.live }))
}

export interface StoredVersion {
  id: string
  manifest: Manifest
}

export async function readLive(db: Database, worldId: string): Promise<StoredVersion | undefined> {
  const [row] = await db
    .select({ id: worldVersions.id, manifest: worldVersions.manifest })
    .from(worlds)
    .innerJoin(worldVersions, eq(worlds.liveVersionId, worldVersions.id))
    .where(eq(worlds.id, worldId))
  return row as StoredVersion | undefined
}

// Scoped to the World, so a token for one World never reads another's World Version by id (adr/0042).
export async function readVersion(db: Database, worldId: string, id: string): Promise<StoredVersion | undefined> {
  const [row] = await db
    .select({ id: worldVersions.id, manifest: worldVersions.manifest })
    .from(worldVersions)
    .where(and(eq(worldVersions.id, id), eq(worldVersions.worldId, worldId)))
  return row as StoredVersion | undefined
}

export type CommitResult = { committed: string } | { stale: true } | { unlisted: string[] } | { missing: string[] }

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

// The World's row is locked first, so two Publishes of one World take turns and the second sees what the first made live.
async function moveLive(tx: Transaction, worldId: string, { manifest, summary, expectedLive }: Commit): Promise<string> {
  await tx.insert(worlds).values({ id: worldId }).onConflictDoNothing()
  const [world] = await tx.select({ live: worlds.liveVersionId }).from(worlds).where(eq(worlds.id, worldId)).for('update')

  // Rolled back, so a refused commit for a World nobody Published leaves no row behind.
  if ((world.live ?? undefined) !== expectedLive) {tx.rollback()}

  const [version] = await tx.insert(worldVersions)
    .values({ worldId, manifest: toJsonb(manifest), summary: toJsonb(summary) })
    .returning({ id: worldVersions.id })
  if (world.live) {
    await tx.update(worldVersions).set({ retiredAt: sql`now()` }).where(eq(worldVersions.id, world.live))
  }
  await tx.update(worlds).set({ liveVersionId: version.id }).where(eq(worlds.id, worldId))
  return version.id
}

// The new World Version's id, or `{ stale: true }` when the live one is no longer `expectedLive`.
// One transaction inserts the World Version and moves the live pointer, only if it still points at `expectedLive` (adr/0040).
async function tryMoveLive(db: Database, worldId: string, commit: Commit): Promise<CommitResult> {
  try {
    return { committed: await db.transaction((tx) => moveLive(tx, worldId, commit)) }
  } catch (error) {
    if (error instanceof TransactionRollbackError) {return { stale: true }}
    throw error
  }
}

// The bucket can't join the transaction, so the files are checked just before it; none is deleted until `prune`'s grace period ends (adr/0038).
export async function commitVersion({ db, store }: { db: Database; store: BlobStore }, worldId: string, commit: Commit): Promise<CommitResult> {
  const unlisted = unlistedKeys(commit.manifest)
  if (unlisted.length > 0) {return { unlisted }}
  const missing = await missingKeys(store, commit.manifest.files)
  return missing.length > 0 ? { missing } : tryMoveLive(db, worldId, commit)
}
