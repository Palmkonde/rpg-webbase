import { jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

export const worlds = pgTable('worlds', {
  id: text('id').primaryKey(),
  // oxlint-disable-next-line no-use-before-define -- a World and its World Versions reference each other
  liveVersionId: uuid('live_version_id').references((): AnyPgColumn => worldVersions.id),
})

export const worldVersions = pgTable('world_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: text('world_id').notNull().references(() => worlds.id),
  manifest: jsonb('manifest').notNull(),
  summary: jsonb('summary').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
})

// No foreign key to `worlds`: Flags are keyed by World id alone, and a Student may write them before the World is Published (adr/0038).
export const flags = pgTable(
  'flags',
  {
    worldId: text('world_id').notNull(),
    studentId: text('student_id').notNull(),
    flags: jsonb('flags').$type<Record<string, boolean | string>>().notNull().default({}),
  },
  (table) => [primaryKey({ columns: [table.worldId, table.studentId] })],
)
