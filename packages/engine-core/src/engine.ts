import * as Phaser from 'phaser'
import type { CharacterDefinition, MapDefinition, WorldConfig } from './types.ts'
import { resolveCharacter, resolveMap } from './world-config.ts'
import { GridEngine } from 'grid-engine'
import { collectTiledMapAssets } from './tiled-assets.ts'
import { createMapScene } from './map-scene.ts'

export interface ContentCatalogs {
  maps: MapDefinition[]
  characters: CharacterDefinition[]
}

export async function createEngine(
  container: HTMLElement,
  worldConfig: WorldConfig,
  catalogs: ContentCatalogs,
): Promise<Phaser.Game> {
  const map = resolveMap(worldConfig, catalogs.maps)
  const character = resolveCharacter(worldConfig, catalogs.characters)
  const assets = await collectTiledMapAssets(map.tiledMapUrl)

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
    pixelArt: true,
    scene: createMapScene({ map, character, worldConfig, assets }),
    plugins: {
      scene: [{ key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' }],
    },
  })
}
