import { defineConfig } from 'drizzle-kit'
import { gameService } from './src/schema.ts'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  // Only the Game Service's own schema, so a shared dev database's other tables are never diffed (adr/0045).
  schemaFilter: [gameService.schemaName],
  migrations: { schema: gameService.schemaName },
})
