import type { EngineHandle } from '@game-engine/engine-core'
import type { Flags } from './flags.ts'
import { PLAYER_CHAR_ID } from './player.ts'

const COMPANION_FLAG_PREFIX = 'companion:'

export type CompanionEngine = Pick<EngineHandle, 'setBlocksCharacters' | 'follow' | 'stopMovement'>

// The Flag a Script writes to recruit a Companion, e.g. a Choice's `flags: { [companionFlag('Guard')]: 'fluffy' }`.
export function companionFlag(entityId: string): string {
  return `${COMPANION_FLAG_PREFIX}${entityId}`
}

// A Companion Flag holds its characterId while active, `false` once dismissed (adr/0028).
export function isActiveCompanion(flags: Readonly<Flags>, entityId: string): boolean {
  const value = flags[companionFlag(entityId)]
  return typeof value === 'string' && value !== ''
}

// Non-blocking first, so the chase's path isn't planned around the Player.
function startChase(engine: CompanionEngine, entityId: string): void {
  engine.setBlocksCharacters(entityId, false)
  engine.follow(entityId, PLAYER_CHAR_ID, 0)
}

function endChase(engine: CompanionEngine, entityId: string): void {
  engine.setBlocksCharacters(entityId, true)
  engine.stopMovement(entityId)
}

function companionEntityIds(flags: Readonly<Flags>): string[] {
  return Object.keys(flags)
    .filter((key) => key.startsWith(COMPANION_FLAG_PREFIX))
    .map((key) => key.slice(COMPANION_FLAG_PREFIX.length))
}

export function activeCompanionIds(flags: Readonly<Flags>): string[] {
  return companionEntityIds(flags).filter((entityId) => isActiveCompanion(flags, entityId))
}

// Re-applies every Companion Flag to the Engine, since a Cutscene or remount can drop a chase. Any other value is left alone.
export function syncCompanions(flags: Readonly<Flags>, engine: CompanionEngine): void {
  for (const entityId of companionEntityIds(flags)) {
    if (isActiveCompanion(flags, entityId)) {
      startChase(engine, entityId)
    } else if (flags[companionFlag(entityId)] === false) {
      endChase(engine, entityId)
    }
  }
}
