import type { CharacterDefinition, MapDefinition } from '@codeleagues-rpg-engine/engine-core'

// Players characters assets path
export const characters: CharacterDefinition[] = [
  {
    id: 'fluffy',
    spriteUrl: '/assets/sprites/characters/fluffy/fluffy.png',
    frameWidth: 16,
    frameHeight: 20,
    offsetY: -8,
  },
  {
    id: 'temmie',
    spriteUrl: '/assets/sprites/characters/temmie/temmie.png',
    frameWidth: 32,
    frameHeight: 32,
    offsetY: -8,
  },
]

export const maps: MapDefinition[] = [
  {
    id: 'main-test',
    tiledMapUrl: '/assets/maps/main_test.tmj',
  },
]
