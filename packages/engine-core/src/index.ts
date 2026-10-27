export { createEngine } from './engine.ts'
export type { ContentCatalogs, CreateEngineOptions, EngineHandle } from './engine.ts'
export type { PlayerCharId } from './map-scene.ts'

export { resolveCharacter, resolveMap } from './world-config.ts'

export { collectEntities, collectZones, findOverlappingZoneIds } from './map-objects.ts'
export type { EntityObject, TileCoord, ZoneObject } from './map-objects.ts'

export { findDuplicates } from './util.ts'

export type {
  CharacterDefinition,
  EngineEvent,
  InteractedEvent,
  MapDefinition,
  SpawnPoint,
  TransitionedEvent,
  WorldConfig,
  WorldConfigCompanion,
  ZoneEnteredEvent,
} from './types.ts'
