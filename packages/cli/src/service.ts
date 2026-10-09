import type { App } from '@codeleagues-rpg-engine/game-service/app'
import type { Manifest } from './bundle.ts'
import type { Summary } from './summary.ts'
import { treaty } from '@elysiajs/eden'

const UNAUTHORIZED = 401
const NOT_FOUND = 404
const CONFLICT = 409

// A refusal the Author can act on, as the command prints it.
export class PublishError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'PublishError'
  }
}

// The Game Service routes Publish calls, each with the shared Publish key (adr/0036); tests run the real service behind it.
export interface PublishService {
  // The World Version live for `world` with the summary stored with it, or `undefined` for a World never Published.
  live: (world: string) => Promise<LiveVersion | undefined>

  // Every World Version of `world`, newest first, or `undefined` for a World never Published.
  versions: (world: string) => Promise<VersionInfo[] | undefined>
  missing: (keys: string[]) => Promise<string[]>
  upload: (key: string, bytes: Buffer) => Promise<void>

  // Deletes the files no kept World Version uses and returns their keys; with `version`, first retires that World Version whatever its age.
  prune: (version?: string) => Promise<string[]>
  commit: (world: string, version: { manifest: Manifest; summary: Summary }, expectedLive: string | undefined) => Promise<string>
}

export interface LiveVersion {
  id: string
  summary: unknown
}

export interface VersionInfo {
  id: string
  // Eden turns the service's ISO timestamps back into Dates.
  createdAt: Date
  retiredAt: Date | null
  live: boolean
}

interface Reply {
  data: unknown
  error?: { status: unknown; value: unknown } | null
}

// Eden answers 503 for a network failure, as the client package reads it.
const SERVICE_UNAVAILABLE = 503

// What a refusal means to the Author; the service's own text follows for anything else.
function refusal(serviceUrl: string, { status, value }: NonNullable<Reply['error']>, what: string): PublishError {
  if (status === UNAUTHORIZED) {return new PublishError('the Game Service refused the Publish key: check PUBLISH_KEY')}
  if (status === CONFLICT) {return new PublishError('another Publish went live first: run the command again to see what changed')}
  if (status === SERVICE_UNAVAILABLE) {return new PublishError(`could not reach the Game Service at ${serviceUrl}: check GAME_SERVICE_URL`)}
  return new PublishError(`the Game Service refused ${what} (${String(status)}): ${typeof value === 'string' ? value : JSON.stringify(value)}`)
}

// Plain `fetch`: Eden JSON-encodes every object body, so it can't send a file's bytes as they are.
async function putFile(serviceUrl: string, headers: Record<string, string>, { key, bytes }: { key: string; bytes: Buffer }): Promise<Reply> {
  try {
    const response = await fetch(`${serviceUrl}/api/v1/blobs/${key}`, { method: 'PUT', headers: { ...headers, 'content-type': 'application/octet-stream' }, body: new Uint8Array(bytes) })
    return { data: undefined, error: response.ok ? undefined : { status: response.status, value: await response.text() } }
  } catch {
    return { data: undefined, error: { status: SERVICE_UNAVAILABLE, value: '' } }
  }
}

export function connect(serviceUrl: string, publishKey: string): PublishService {
  const api = treaty<App>(serviceUrl).api.v1
  const headers = { authorization: `Bearer ${publishKey}` }
  function expectData<Data>(reply: Reply, what: string): Data {
    if (reply.error) {throw refusal(serviceUrl, reply.error, what)}
    return reply.data as Data
  }
  return {
    async live(world) {
      const reply = await api.worlds({ world }).versions.live.summary.get({ headers })
      return reply.error?.status === NOT_FOUND ? undefined : expectData<LiveVersion>(reply, 'the live World Version')
    },
    async versions(world) {
      const reply = await api.worlds({ world }).versions.get({ headers })
      return reply.error?.status === NOT_FOUND ? undefined : expectData<VersionInfo[]>(reply, 'the list of World Versions')
    },
    async missing(keys) {
      const reply = await api.blobs.missing.post({ keys }, { headers })
      return expectData<{ missing: string[] }>(reply, 'the list of files').missing
    },
    async upload(key, bytes) {
      expectData(await putFile(serviceUrl, headers, { key, bytes }), key)
    },
    async prune(version) {
      const reply = await api.prune.post({ version }, { headers })

      // The live World Version is the one refusal here that is not a lost Publish race (409).
      if (reply.error?.status === CONFLICT) {throw new PublishError(String(reply.error.value))}
      return expectData<{ removed: string[] }>(reply, 'the cleanup').removed
    },
    async commit(world, { manifest, summary }, expectedLive) {
      const reply = await api.worlds({ world }).versions.post({ manifest, summary: { ...summary }, expectedLive }, { headers })
      return expectData<{ id: string }>(reply, 'the World Version').id
    },
  }
}
