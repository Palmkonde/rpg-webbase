import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// Bound as text first: Bun JSON-encodes a string bound straight into a jsonb slot, storing a JSON string that `||` would append to as an array.
export function toJsonb(document: unknown): SQL {
  return sql`${JSON.stringify(document)}::text::jsonb`
}
