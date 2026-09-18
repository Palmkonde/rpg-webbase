import type { CharacterDefinition, MapDefinition, WorldConfig } from './types.ts'

export function resolveMap(config: WorldConfig, maps: MapDefinition[]): MapDefinition {
  const map = maps.find((m) => m.id === config.mapId)
  if (!map) {
    throw new Error(`Unknown mapId in World Config: ${config.mapId}`)
  }
  return map
}

export function resolveCharacter(config: WorldConfig, characters: CharacterDefinition[]): CharacterDefinition {
  const character = characters.find((c) => c.id === config.player.characterId)
  if (!character) {
    throw new Error(`Unknown characterId in World Config: ${config.player.characterId}`)
  }
  return character
}
