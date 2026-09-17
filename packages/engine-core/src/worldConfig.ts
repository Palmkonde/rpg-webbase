import type { MapDefinition, WorldConfig } from './types.ts'

export function resolveMap(config: WorldConfig, maps: MapDefinition[]): MapDefinition {
  const map = maps.find((m) => m.id === config.mapId)
  if (!map) {
    throw new Error(`Unknown mapId in World Config: ${config.mapId}`)
  }
  return map
}
