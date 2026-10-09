import { DEFAULT_GRACE_DAYS } from './modules/prune/service.ts'

export type Env = Record<string, string | undefined>

export interface Config {
  databaseUrl: string
  s3: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region: string }
  jwtSecret: string
  publishKey: string
  corsOrigins: string[]
  port: number

  // Days a retired World Version's files stay after it stops being live (adr/0038).
  pruneGraceDays: number

  // Where Students fetch files from (adr/0042); absent, the service serves them itself.
  assetBaseUrl?: string
}

const DEFAULT_PORT = 3000
const MAX_PORT = 65535

const STORAGE = [
  'DATABASE_URL',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_REGION',
] as const

const REQUIRED = [
  ...STORAGE,
  'JWT_SECRET',
  'PUBLISH_KEY',
  'CORS_ORIGINS',
] as const

function requireVariables<Name extends string>(env: Env, names: readonly Name[]): Record<Name, string> {
  const missing = names.filter((name) => !env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  return Object.fromEntries(names.map((name) => [name, env[name]])) as Record<Name, string>
}

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT
  }
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`PORT must be a port number, got "${value}"`)
  }
  return port
}

function readGraceDays(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_GRACE_DAYS
  }
  const days = Number(value)
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(`PRUNE_GRACE_DAYS must be a whole number of days, got "${value}"`)
  }
  return days
}

// The client builds `assetBaseUrl + key`, so the slash that ends it is added when the operator left it off.
function readAssetBaseUrl(value: string | undefined): string | undefined {
  if (!value) {return undefined}
  return value.endsWith('/') ? value : `${value}/`
}

function storageOf(vars: Record<(typeof STORAGE)[number], string>): Pick<Config, 'databaseUrl' | 's3'> {
  return {
    databaseUrl: vars.DATABASE_URL,
    s3: {
      endpoint: vars.S3_ENDPOINT,
      bucket: vars.S3_BUCKET,
      accessKeyId: vars.S3_ACCESS_KEY_ID,
      secretAccessKey: vars.S3_SECRET_ACCESS_KEY,
      region: vars.S3_REGION,
    },
  }
}

// `prune` runs as its own scheduled container, so it asks for the database and the bucket and nothing else.
export function readPruneConfig(env: Env): Pick<Config, 'databaseUrl' | 's3' | 'pruneGraceDays'> {
  return { ...storageOf(requireVariables(env, STORAGE)), pruneGraceDays: readGraceDays(env.PRUNE_GRACE_DAYS) }
}

export function readConfig(env: Env): Config {
  const vars = requireVariables(env, REQUIRED)
  return {
    ...storageOf(vars),
    jwtSecret: vars.JWT_SECRET,
    publishKey: vars.PUBLISH_KEY,
    corsOrigins: vars.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    port: readPort(env.PORT),
    pruneGraceDays: readGraceDays(env.PRUNE_GRACE_DAYS),
    assetBaseUrl: readAssetBaseUrl(env.ASSET_BASE_URL),
  }
}

export function readDatabaseUrl(env: Env): string {
  return requireVariables(env, ['DATABASE_URL']).DATABASE_URL
}
