import { createDatabase, migrateDatabase } from './database.ts'
import { readConfig, readDatabaseUrl, readPort } from './config.ts'
import type { Env } from './config.ts'
import { S3Client } from 'bun'
import { createApp } from './app.ts'
import { pruneCommand } from './modules/prune/command.ts'

const HEALTH_TIMEOUT_MS = 3000

// The image has no shell or curl, so its HEALTHCHECK runs this against the service in the same container.
async function checkHealth(env: Env): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${readPort(env.PORT)}/healthz`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
  if (!response.ok) {
    throw new Error(`/healthz answered ${response.status}`)
  }
}

function serve(env: Env): void {
  const { databaseUrl, jwtSecret, corsOrigins, publishKey, s3, port, assetBaseUrl, pruneGraceDays } = readConfig(env)
  createApp({ db: createDatabase(databaseUrl), jwtSecret, corsOrigins, publishKey, bucket: new S3Client(s3), assetBaseUrl, pruneGraceDays }).listen(port)
}

async function run(command: string, env: Env): Promise<void> {
  switch (command) {
    case 'serve': {
      serve(env)
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
    case 'health': {
      await checkHealth(env)
      return
    }
    default: {
      throw new Error(`Unknown command "${command}": expected serve, migrate, prune or health`)
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
