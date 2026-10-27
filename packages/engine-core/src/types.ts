export interface SpawnPoint {
  x: number
  y: number
}

export interface MapDefinition {
  id: string
  tiledMapUrl: string

  // The Map's Spawn Points by `spawnId`, so a Portal on another Map resolves its target without loading this one (adr/0046).
  spawnPoints: Record<string, SpawnPoint>
}

export interface CharacterDefinition {
  id: string
  spriteUrl: string
  frameWidth: number
  frameHeight: number
  offsetY?: number
}

// A Companion the Host carries onto every Map: the Character comes from its Flag, never from another Map's Tiled file (adr/0028).
export interface WorldConfigCompanion {
  entityId: string
  characterId: string
}

export interface ResolvedCompanion {
  entityId: string
  character: CharacterDefinition
}

export interface WorldConfig {
  mapId: string
  player: {
    spawn: SpawnPoint
    characterId: string
  }
  companions: WorldConfigCompanion[]
}

export interface InteractedEvent {
  type: 'interacted'
  entityId: string
}

export interface TransitionedEvent {
  type: 'transitioned'
  fromMapId: string
  toMapId: string
  spawn: SpawnPoint
}

export interface ZoneEnteredEvent {
  type: 'zoneEntered'
  zoneId: string
}

export type EngineEvent = InteractedEvent | TransitionedEvent | ZoneEnteredEvent
