import type { FlagStore, Flags } from './flags.ts'
import { GameError, toGameError } from './game-error.ts'
import type { App } from '@codeleagues-rpg-engine/game-service/app'
import { treaty } from '@elysiajs/eden'

const UNAUTHORIZED = 401
const FORBIDDEN = 403
const SERVER_ERROR = 500

// Milliseconds before the second and third tries: three tries over about five seconds.
const FIRST_BACKOFF = 1000
const SECOND_BACKOFF = 4000
const BACKOFF = [FIRST_BACKOFF, SECOND_BACKOFF]

// A network failure answers 503, as Eden reports it.
export type ServiceResponse<Data> = { ok: true; data: Data } | { ok: false; status: number }

// The Game Service routes a session calls for one World, each with a Student token (adr/0036). Tests replace it with a fake.
export interface GameService {
  readFlags: (token: string) => Promise<ServiceResponse<Flags>>
  patchFlags: (token: string, patch: Flags) => Promise<ServiceResponse<void>>
}

export type Wait = (milliseconds: number) => Promise<void>

function bearer(token: string): { headers: { authorization: string } } {
  return { headers: { authorization: `Bearer ${token}` } }
}

function toResponse<Data>({ data, error, status }: { data: unknown; error: unknown; status: number }): ServiceResponse<Data> {
  return error ? { ok: false, status } : { ok: true, data: data as Data }
}

// Typed by the service's own routes (adr/0037); only `GameService` is public, so `App` never reaches the published types.
export function createGameService(serviceUrl: string, worldId: string): GameService {
  const world = treaty<App>(serviceUrl).api.v1.worlds({ world: worldId })
  return {
    readFlags: async (token) => toResponse(await world.flags.get(bearer(token))),
    patchFlags: async (token, patch) => toResponse(await world.flags.patch(patch, bearer(token))),
  }
}

export function waitFor(milliseconds: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- setTimeout has no promise form outside Node.
  return new Promise((resolve) => { setTimeout(resolve, milliseconds) })
}

function errorFor(status: number): GameError {
  const message = `The Game Service answered ${status}`
  if (status === UNAUTHORIZED) {return new GameError('unauthorized', message)}
  if (status === FORBIDDEN) {return new GameError('forbidden', message)}
  return new GameError('unavailable', message)
}

interface Attempt {
  token: string
  refreshed: boolean
  retries: number
}

// One session's calls to the Game Service, with the Student token the Platform's `getToken` last gave.
export class ServiceCalls {
  private token: string | undefined
  private readonly service: GameService
  private readonly getToken: () => Promise<string>
  private readonly wait: Wait

  public constructor({ service, getToken, wait }: { service: GameService; getToken: () => Promise<string>; wait: Wait }) {
    this.service = service
    this.getToken = getToken
    this.wait = wait
  }

  // Asked for at mount (adr/0036), and again only when the service refuses the one held.
  public async requestToken(): Promise<string> {
    try {
      this.token = await this.getToken()
      return this.token
    } catch (error: unknown) {
      throw toGameError(error, 'token')
    }
  }

  public readFlags = (): Promise<Flags> => this.call((token) => this.service.readFlags(token))

  public patchFlags = (patch: Flags): Promise<void> => this.call((token) => this.service.patchFlags(token, patch))

  private async call<Data>(request: (token: string) => Promise<ServiceResponse<Data>>): Promise<Data> {
    const attempt: Attempt = { token: this.token ?? await this.requestToken(), refreshed: false, retries: 0 }
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- each try waits on the one before it.
      const response = await request(attempt.token)
      if (response.ok) {return response.data}
      // oxlint-disable-next-line no-await-in-loop
      await this.prepareRetry(attempt, response.status)
    }
  }

  // A 401 asks for a fresh token and retries once (adr/0036); a 5xx or network failure retries with backoff. Anything else fails at once.
  private async prepareRetry(attempt: Attempt, status: number): Promise<void> {
    if (status === UNAUTHORIZED && !attempt.refreshed) {
      attempt.refreshed = true
      attempt.token = await this.requestToken()
    } else if (status >= SERVER_ERROR && attempt.retries < BACKOFF.length) {
      await this.wait(BACKOFF[attempt.retries])
      attempt.retries += 1
    } else {
      throw errorFor(status)
    }
  }
}

export interface FlagSaver {
  save: (patch: Flags) => Promise<void>

  // Called once, for the first save that fails; nothing written after it is sent.
  onSaveFailed: (error: unknown) => void
}

export interface SavedFlagStore extends FlagStore {
  // What the service stored, read once at mount; a reload reads it again.
  load: (stored: Readonly<Flags>) => void
}

// The Student's Flags kept on the Game Service, memory first: a write shows at once, and its save goes out after every earlier one, never alongside.
// `setFlags` resolves before the save does, so a Script run never waits on the network.
export function createSavedFlagStore({ save, onSaveFailed }: FlagSaver): SavedFlagStore {
  let flags: Flags = {}
  let saving: Promise<void> = Promise.resolve()
  let failed = false

  // `previous` never rejects: a failed save is caught and reported.
  async function saveAfter(previous: Promise<void>, patch: Flags): Promise<void> {
    await previous
    if (failed) {return}
    try {
      await save(patch)
    } catch (error: unknown) {
      failed = true
      onSaveFailed(error)
    }
  }

  return {
    load: (stored): void => { flags = { ...stored } },
    getFlags: async (): Promise<Flags> => ({ ...flags }),
    setFlags: async (patch): Promise<void> => {
      Object.assign(flags, patch)
      saving = saveAfter(saving, patch)
    },
  }
}
