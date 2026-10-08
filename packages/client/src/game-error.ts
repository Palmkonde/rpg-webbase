// The kinds adr/0039 names; the built-in ErrorScreen has a default message for each.
export type GameErrorKind = 'token' | 'unauthorized' | 'forbidden' | 'worldUpdated' | 'unavailable'

export class GameError extends Error {
  public readonly kind: GameErrorKind

  public constructor(kind: GameErrorKind, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GameError'
    this.kind = kind
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// `unavailable` by default: a failure nobody classified is one the Platform can only retry later.
export function toGameError(error: unknown, kind: GameErrorKind = 'unavailable'): GameError {
  return error instanceof GameError ? error : new GameError(kind, errorMessage(error), { cause: error })
}

const NOT_FOUND = 404

// The Engine fetches the Map itself, so a Map the server no longer holds reaches the session as an error carrying the status (adr/0038).
export function toEngineLoadError(error: unknown): unknown {
  const pruned = error instanceof Error && 'status' in error && error.status === NOT_FOUND
  return pruned ? new GameError('worldUpdated', errorMessage(error), { cause: error }) : error
}
