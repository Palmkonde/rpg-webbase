export interface SpawnPoint {
  x: number
  y: number
}

export interface MapDefinition {
  id: string
  tiledMapUrl: string
}

export interface WorldConfig {
  mapId: string
  player: {
    spawn: SpawnPoint
  }
}
