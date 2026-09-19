import * as Phaser from 'phaser'
import { GridEngine } from 'grid-engine'
import { resolveCharacter, resolveMap } from './worldConfig.ts'
import { collectTiledMapAssets } from './tiledAssets.ts'
import { createMapScene } from './mapScene.ts'
import type { CharacterDefinition, MapDefinition, WorldConfig } from './types.ts'

export async function createEngine(
  container: HTMLElement,
  worldConfig: WorldConfig,
  maps: MapDefinition[],
  characters: CharacterDefinition[],
): Promise<Phaser.Game> {
  const map = resolveMap(worldConfig, maps)
  const character = resolveCharacter(worldConfig, characters)
  const { images: tilesetImages, tileProperties, tileAnimations } = await collectTiledMapAssets(map.tiledMapUrl)

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
    scene: createMapScene(map, character, tilesetImages, worldConfig, tileProperties, tileAnimations),
    plugins: {
      scene: [{ key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' }],
    },
  })
}
