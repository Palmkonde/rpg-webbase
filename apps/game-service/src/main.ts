import { createDatabase, migrateDatabase } from './database.ts'
import { readConfig, readDatabaseUrl } from './config.ts'
import type { Env } from './config.ts'
import { createApp } from './app.ts'

async function run(command: string, env: Env): Promise<void> {
  switch (command) {
    case 'serve': {
      const config = readConfig(env)
      const { databaseUrl, jwtSecret, corsOrigins, port } = config
      createApp({ db: createDatabase(databaseUrl), jwtSecret, corsOrigins }).listen(port)
      return
    }
    case 'migrate': {
      await migrateDatabase(readDatabaseUrl(env))
      return
    }
    default: {
      throw new Error(`Unknown command "${command}": expected serve or migrate`)
    }
  }
}

const [command = 'serve'] = process.argv.slice(2)
try {
  // The one place the service reads its environment, from the entry point nothing ever `require`s.
  // oxlint-disable-next-line node/no-process-env, node/no-top-level-await
  await run(command, process.env)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
