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

export interface WorldConfig {
  mapId: string
  player: {
    spawn: SpawnPoint
    characterId: string
  }
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
