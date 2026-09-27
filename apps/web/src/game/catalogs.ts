import type { CharacterDefinition, MapDefinition } from '@game-engine/engine-core'

// Players characters assets path
export const characters: CharacterDefinition[] = [
  {
    id: 'fluffy',
    spriteUrl: '/assets/sprites/characters/fluffy/fluffy.png',
    frameWidth: 16,
    frameHeight: 20,
  },
  {
    id: 'temmie',
    spriteUrl: '/assets/sprites/characters/temmie/temmie.png',
    frameWidth: 32,
    frameHeight: 32,
  },
]

export const maps: MapDefinition[] = [
  {
    id: 'main-test',
    tiledMapUrl: '/assets/maps/main_test.tmj',
  },
]
