import { createDatabase, migrateDatabase } from './database.ts'
import { readConfig, readDatabaseUrl } from './config.ts'
import type { Env } from './config.ts'
import { S3Client } from 'bun'
import { createApp } from './app.ts'
import { pruneCommand } from './modules/prune/command.ts'

async function run(command: string, env: Env): Promise<void> {
  switch (command) {
    case 'serve': {
      const config = readConfig(env)
      const { databaseUrl, jwtSecret, corsOrigins, publishKey, s3, port, assetBaseUrl, pruneGraceDays } = config
      createApp({ db: createDatabase(databaseUrl), jwtSecret, corsOrigins, publishKey, bucket: new S3Client(s3), assetBaseUrl, pruneGraceDays }).listen(port)
      return
    }
    case 'migrate': {
      await migrateDatabase(readDatabaseUrl(env))
      return
    }
    case 'prune': {
      process.stdout.write(`${await pruneCommand(env)}\n`)
      return
    }
    default: {
      throw new Error(`Unknown command "${command}": expected serve, migrate or prune`)
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
