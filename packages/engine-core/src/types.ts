export interface SpawnPoint {
  x: number
  y: number
}

export interface MapDefinition {
  id: string
  tiledMapUrl: string
}

export interface CharacterDefinition {
  id: string
  spriteUrl: string
  frameWidth: number
  frameHeight: number
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

export type EngineEvent = InteractedEvent | TransitionedEvent
