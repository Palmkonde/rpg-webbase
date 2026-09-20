export { createEngine } from './engine.ts'
export type { ContentCatalogs, CreateEngineOptions } from './engine.ts'

export { resolveCharacter, resolveMap } from './world-config.ts'

export { collectEntities } from './tiled-assets.ts'
export type { EntityObject } from './tiled-assets.ts'

export { findDuplicates } from './util.ts'

export type {
  CharacterDefinition,
  EngineEvent,
  InteractedEvent,
  MapDefinition,
  SpawnPoint,
  TransitionedEvent,
  WorldConfig,
} from './types.ts'
