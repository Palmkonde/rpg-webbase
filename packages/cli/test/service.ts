import { S3Client, serve } from 'bun'
import { createDatabase, migrateDatabase } from '@codeleagues-rpg-engine/game-service/database'
import type { Database } from '@codeleagues-rpg-engine/game-service/database'
import type { Manifest } from '../src/bundle.ts'
import { createApp } from '@codeleagues-rpg-engine/game-service/app'

// Tests that need the real Postgres and bucket read where to find them here, and nowhere else.
// oxlint-disable-next-line node/no-process-env
const { DATABASE_URL: databaseUrl, CI: ci, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env

const s3 = S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY && S3_REGION
  ? { endpoint: S3_ENDPOINT, bucket: S3_BUCKET, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, region: S3_REGION }
  : undefined

if (ci && !(databaseUrl && s3)) {
  throw new Error('DATABASE_URL and S3_* are not set: CI must start Postgres and SeaweedFS for the Publish tests')
}
if (!databaseUrl || !s3) {
  console.warn(
    'Skipping the Publish tests that need the Game Service: DATABASE_URL or S3_* is not set.\n'
      + 'Start the services with `docker compose -f compose.dev.yaml up -d --wait`, then run `bun --env-file=../../dev.env test ./test` in packages/cli.',
  )
}

export const skipWithoutServices = databaseUrl && s3 ? false : 'DATABASE_URL or S3_* is not set'

const PUBLISH_KEY = 'cli-test-publish-key'

const JWT_SECRET = 'cli-test-jwt-secret'

// What a test can ask of the service besides running the CLI against it.
export interface Tools {
  publishKey: string

  // The id of the World Version live for `world`, or `undefined`.
  liveId: (world: string) => Promise<string | undefined>
  manifestOf: (versionId: string) => Promise<Manifest>
  blob: (key: string) => Promise<Buffer>

  // Backdates when a World Version stopped being live, to put it past the grace period.
  retireDaysAgo: (versionId: string, days: number) => Promise<void>

  // Commits `manifest` the way the CLI does, to make a Publish land first.
  commit: (world: string, body: object) => Promise<Response>
}

export interface Service extends Tools {
  url: string
  close: () => Promise<void>
}

// What a test does to the traffic between the CLI and the service.
export interface Meddling {
  // Runs before a commit reaches the service, as another Author's Publish would.
  beforeCommit?: (tools: Tools) => Promise<void>

  // Changes the bytes of every upload on the way.
  corruptUploads?: boolean
}

interface Stores {
  app: ReturnType<typeof createApp>
  db: Database
  bucket: S3Client
  prefix: string
}

function toolsFor({ app, db, bucket, prefix }: Stores): Tools {
  const authorized = { authorization: `Bearer ${PUBLISH_KEY}` }
  return {
    publishKey: PUBLISH_KEY,
    async liveId(world) {
      const response = await app.handle(new Request(`http://localhost/api/v1/worlds/${world}/versions/live/summary`, { headers: authorized }))
      const live = response.ok ? ((await response.json()) as { id: string }) : undefined
      return live?.id
    },
    async manifestOf(versionId) {
      const [row] = await db.$client`select manifest from game_service.world_versions where id = ${versionId}`
      return row.manifest as Manifest
    },
    async retireDaysAgo(versionId, days) {
      await db.$client`update game_service.world_versions set retired_at = now() - make_interval(days => ${days}) where id = ${versionId}`
    },
    async blob(key) {
      return Buffer.from(await bucket.file(`${prefix}${key}`).arrayBuffer())
    },
    commit: (world, body) => app.handle(new Request(`http://localhost/api/v1/worlds/${world}/versions`, {
      method: 'POST',
      headers: { ...authorized, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })),
  }
}

function meddle(app: ReturnType<typeof createApp>, tools: Tools, meddling: Meddling): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'POST' && request.url.endsWith('/versions')) {
      await meddling.beforeCommit?.(tools)
    }
    if (request.method === 'PUT' && meddling.corruptUploads) {
      return app.handle(new Request(request.url, { method: 'PUT', headers: request.headers, body: Buffer.from('not what was hashed') }))
    }
    return app.handle(request)
  }
}

// The real Game Service app on a port of its own, against the real Postgres and bucket, with its own key prefix so runs never see each other's files.
export async function startService(meddling: Meddling = {}): Promise<Service> {
  if (!databaseUrl || !s3) {
    throw new Error('startService needs DATABASE_URL and S3_*')
  }
  await migrateDatabase(databaseUrl)
  const db = createDatabase(databaseUrl)
  const bucket = new S3Client(s3)
  const prefix = `test-${crypto.randomUUID()}/`
  const app = createApp({ db, jwtSecret: JWT_SECRET, corsOrigins: [], publishKey: PUBLISH_KEY, bucket, blobPrefix: prefix })
  const tools = toolsFor({ app, db, bucket, prefix })

  const server = serve({ port: 0, fetch: meddle(app, tools, meddling) })
  return {
    ...tools,
    url: `http://localhost:${server.port}`,
    async close() {
      await server.stop(true)
      await db.$client.close()
    },
  }
}
