import { TransactionRollbackError, and, eq, sql } from 'drizzle-orm'
import type { Database } from '../../database.ts'
import type { Flags } from './model.ts'
import { flags } from '../../schema.ts'
import { toJsonb } from '../../jsonb.ts'

const MAX_KEYS = 200
const MAX_KEY_LENGTH = 128

// 64 KB.
const MAX_DOCUMENT_BYTES = 65_536

export const LIMITS_MESSAGE = `Flags are limited to ${MAX_KEYS} keys of up to ${MAX_KEY_LENGTH} characters, ${MAX_DOCUMENT_BYTES} bytes in all`

export interface StudentInWorld {
  worldId: string
  studentId: string
}

function isOverLimit(document: Flags): boolean {
  const keys = Object.keys(document)
  return keys.length > MAX_KEYS
    || keys.some((key) => key.length > MAX_KEY_LENGTH)
    || new TextEncoder().encode(JSON.stringify(document)).byteLength > MAX_DOCUMENT_BYTES
}

export async function readFlags(db: Database, { worldId, studentId }: StudentInWorld): Promise<Flags> {
  const [row] = await db.select({ flags: flags.flags }).from(flags).where(and(eq(flags.worldId, worldId), eq(flags.studentId, studentId)))
  return row?.flags ?? {}
}

// Merged by `jsonb ||` in the upsert, so concurrent writers never lose each other's keys; the limits are checked on the merged result, rolled back if over.
export async function mergeFlags(db: Database, student: StudentInWorld, patch: Flags): Promise<'saved' | 'overLimit'> {
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(flags)
        .values({ ...student, flags: toJsonb(patch) })
        .onConflictDoUpdate({ target: [flags.worldId, flags.studentId], set: { flags: sql`${flags.flags} || excluded.flags` } })
        .returning({ flags: flags.flags })
      if (isOverLimit(row.flags)) {tx.rollback()}
    })
    return 'saved'
  } catch (error) {
    if (error instanceof TransactionRollbackError) {return 'overLimit'}
    throw error
  }
}
