import { jsonb, pgSchema, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Everything the service owns, its migration log too, lives in this schema, so it can share a database with other apps (adr/0045).
export const gameService = pgSchema('game_service')

export const worlds = gameService.table('worlds', {
  id: text('id').primaryKey(),
  // oxlint-disable-next-line no-use-before-define -- a World and its World Versions reference each other
  liveVersionId: uuid('live_version_id').references((): AnyPgColumn => worldVersions.id),
})

export const worldVersions = gameService.table('world_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  worldId: text('world_id').notNull().references(() => worlds.id),
  manifest: jsonb('manifest').notNull(),
  summary: jsonb('summary').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
})

// No foreign key to `worlds`: Flags are keyed by World id alone, and a Student may write them before the World is Published (adr/0038).
export const flags = gameService.table(
  'flags',
  {
    worldId: text('world_id').notNull(),
    studentId: text('student_id').notNull(),
    flags: jsonb('flags').$type<Record<string, boolean | string>>().notNull().default({}),
  },
  (table) => [primaryKey({ columns: [table.worldId, table.studentId] })],
)

// App-level relations for `db.query`; they add no SQL, so no migration.
// `world_versions.world_id` and `worlds.live_version_id` point at each other, hence the relation names.
export const worldsRelations = relations(worlds, ({ one, many }) => ({
  versions: many(worldVersions, { relationName: 'versions' }),
  liveVersion: one(worldVersions, {
    fields: [worlds.liveVersionId],
    references: [worldVersions.id],
    relationName: 'liveVersion',
  }),
  flags: many(flags),
}))

export const worldVersionsRelations = relations(worldVersions, ({ one }) => ({
  world: one(worlds, {
    fields: [worldVersions.worldId],
    references: [worlds.id],
    relationName: 'versions',
  }),
}))

// Flags have no database foreign key (adr/0038), so `world` is null until the World is Published.
export const flagsRelations = relations(flags, ({ one }) => ({
  world: one(worlds, { fields: [flags.worldId], references: [worlds.id] }),
}))
