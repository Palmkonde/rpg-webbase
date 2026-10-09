import { PUBLISH_KEY, createTestApp } from './app.ts'
import { createDatabase, migrateDatabase } from '../src/database.ts'
import { createHash } from 'node:crypto'
import { services } from './services.ts'

const NO_CONTENT = 204

export const db = createDatabase(services?.databaseUrl ?? 'postgres://game:game@127.0.0.1:1/game')
export const app = createTestApp(db)

export async function migrate(): Promise<void> {
  if (services) {await migrateDatabase(services.databaseUrl)}
}

// Fresh bytes per call, so no test finds a file another test (or an earlier run) already uploaded.
export function newFile(ext = 'png'): { body: Uint8Array<ArrayBuffer>; key: string } {
  const body = new TextEncoder().encode(`file ${crypto.randomUUID()}`)
  return { body, key: `${createHash('sha256').update(body).digest('hex')}.${ext}` }
}

// `false` leaves the Publish key off the request.
function withKey(publishKey: string | false): Record<string, string> {
  return publishKey === false ? {} : { authorization: `Bearer ${publishKey}` }
}

export function missing(keys: string[], publishKey: string | false = PUBLISH_KEY): Promise<Response> {
  return app.handle(new Request('http://localhost/api/v1/blobs/missing', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...withKey(publishKey) },
    body: JSON.stringify({ keys }),
  }))
}

export function upload(key: string, body: Uint8Array<ArrayBuffer>, publishKey: string | false = PUBLISH_KEY): Promise<Response> {
  return app.handle(new Request(`http://localhost/api/v1/blobs/${key}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream', ...withKey(publishKey) },
    body,
  }))
}

export async function uploaded(): Promise<string> {
  const file = newFile()
  const response = await upload(file.key, file.body)
  if (response.status !== NO_CONTENT) {throw new Error(`upload answered ${response.status}`)}
  return file.key
}

// The manifest of a World whose every file is `files`; each Map names one of them.
export function manifestOf(files: string[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    start: { map: 'start', spawn: { x: 1, y: 1 }, player: 'hero' },
    maps: { start: files[0] },
    characters: { hero: { key: files[0], frameWidth: 16, frameHeight: 20, offsetY: -8 } },
    portraits: { Sign: { Happy: files[0] } },
    cgs: { intro: [files[0]] },
    scripts: files[0],
    strings: files[0],
    entities: ['Sign'],
    files,
    ...overrides,
  }
}

export function commit(world: string, body: unknown, publishKey: string | false = PUBLISH_KEY): Promise<Response> {
  return app.handle(new Request(`http://localhost/api/v1/worlds/${world}/versions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...withKey(publishKey) },
    body: JSON.stringify(body),
  }))
}

export function liveSummary(world: string, publishKey: string | false = PUBLISH_KEY): Promise<Response> {
  return app.handle(new Request(`http://localhost/api/v1/worlds/${world}/versions/live/summary`, { headers: withKey(publishKey) }))
}

export function prune(body: unknown = {}, publishKey: string | false = PUBLISH_KEY): Promise<Response> {
  return app.handle(new Request('http://localhost/api/v1/prune', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...withKey(publishKey) },
    body: JSON.stringify(body),
  }))
}

export function versionList(world: string, publishKey: string | false = PUBLISH_KEY): Promise<Response> {
  return app.handle(new Request(`http://localhost/api/v1/worlds/${world}/versions`, { headers: withKey(publishKey) }))
}

// The Student reads: a World Version (`live` or an id) with the token's own header, a file with none.
export function version(world: string, which: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = token === undefined ? {} : { authorization: `Bearer ${token}` }
  return app.handle(new Request(`http://localhost/api/v1/worlds/${world}/versions/${which}`, { headers }))
}

export function blob(key: string): Promise<Response> {
  return app.handle(new Request(`http://localhost/api/v1/blobs/${key}`))
}
