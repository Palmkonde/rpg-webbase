import type { Database } from '../src/database.ts'
import { S3Client } from 'bun'
import { SignJWT } from 'jose'
import { createApp } from '../src/app.ts'
import { services } from './services.ts'

export const JWT_SECRET = 'test-jwt-secret'

export const PUBLISH_KEY = 'test-publish-key'

export const PLATFORM_ORIGIN = 'http://platform.test'

// Unreachable on purpose, for tests whose request must be answered before Postgres is touched.
export const NO_DATABASE_URL = 'postgres://game:game@127.0.0.1:1/game'

const AUDIENCE = 'game-service'

// Where the bucket is not needed (no services), an unreachable one stands in.
const UNREACHABLE_BUCKET = { endpoint: 'http://127.0.0.1:1', bucket: 'game', accessKeyId: 'x', secretAccessKey: 'x', region: 'us-east-1' }

export function createTestApp(db: Database, assetBaseUrl?: string): ReturnType<typeof createApp> {
  return createApp({ db, jwtSecret: JWT_SECRET, corsOrigins: [PLATFORM_ORIGIN], publishKey: PUBLISH_KEY, bucket: new S3Client(services?.s3 ?? UNREACHABLE_BUCKET), assetBaseUrl, blobPrefix: `test-${crypto.randomUUID()}/` })
}

export interface TokenClaims {
  sub?: string
  world?: string
  aud?: string
  exp?: number | string
  secret?: string
}

// A Student token as a Platform signs it (adr/0036); each claim can be overridden, or dropped with `undefined`.
export function signStudentToken(claims: TokenClaims): Promise<string> {
  const { sub, world, aud, exp, secret } = { aud: AUDIENCE, exp: '1h', secret: JWT_SECRET, ...claims }
  const token = new SignJWT(world === undefined ? {} : { world }).setProtectedHeader({ alg: 'HS256' })
  if (sub !== undefined) {token.setSubject(sub)}
  if (aud !== undefined) {token.setAudience(aud)}
  if (exp !== undefined) {token.setExpirationTime(exp)}
  return token.sign(new TextEncoder().encode(secret))
}

export function worldRequest(path: string, init: { method?: string; token?: string; body?: string } = {}): Request {
  const { method = 'GET', token, body } = init
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== undefined) {headers.authorization = `Bearer ${token}`}
  return new Request(`http://localhost${path}`, { method, headers, body })
}
