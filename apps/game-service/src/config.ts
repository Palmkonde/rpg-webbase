export type Env = Record<string, string | undefined>

export interface Config {
  databaseUrl: string
  s3: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region: string }
  jwtSecret: string
  publishKey: string
  corsOrigins: string[]
  port: number
}

const DEFAULT_PORT = 3000
const MAX_PORT = 65535

const REQUIRED = [
  'DATABASE_URL',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_REGION',
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

export function readConfig(env: Env): Config {
  const vars = requireVariables(env, REQUIRED)
  return {
    databaseUrl: vars.DATABASE_URL,
    s3: {
      endpoint: vars.S3_ENDPOINT,
      bucket: vars.S3_BUCKET,
      accessKeyId: vars.S3_ACCESS_KEY_ID,
      secretAccessKey: vars.S3_SECRET_ACCESS_KEY,
      region: vars.S3_REGION,
    },
    jwtSecret: vars.JWT_SECRET,
    publishKey: vars.PUBLISH_KEY,
    corsOrigins: vars.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    port: readPort(env.PORT),
  }
}

export function readDatabaseUrl(env: Env): string {
  return requireVariables(env, ['DATABASE_URL']).DATABASE_URL
}
