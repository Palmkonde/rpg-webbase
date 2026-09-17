import * as Phaser from 'phaser'
import { resolveMap } from './worldConfig.ts'
import { collectTilesetImages, type ImageToLoad } from './tiledAssets.ts'
import type { MapDefinition, WorldConfig } from './types.ts'

function createMapScene(map: MapDefinition, tilesetImages: ImageToLoad[]) {
  return class MapScene extends Phaser.Scene {
    constructor() {
      super('MapScene')
    }

    preload() {
      this.load.tilemapTiledJSON(map.id, map.tiledMapUrl)
      for (const { key, url } of tilesetImages) {
        this.load.image(key, url)
      }
    }

    create() {
      const tilemap = this.make.tilemap({ key: map.id })

      for (const tileset of tilemap.tilesets) {
        tilemap.addTilesetImage(tileset.name, tileset.name)
      }

      tilemap.layers.forEach((layerData, index) => {
        const layer = tilemap.createLayer(index, tilemap.tilesets, 0, 0)
        layer?.setVisible(layerData.visible)
      })
    }
  }
}

export async function createEngine(
  container: HTMLElement,
  worldConfig: WorldConfig,
  maps: MapDefinition[],
): Promise<Phaser.Game> {
  const map = resolveMap(worldConfig, maps)
  const tilesetImages = await collectTilesetImages(map.tiledMapUrl)

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: container.clientWidth || 640,
    height: container.clientHeight || 480,
    pixelArt: true,
    scene: createMapScene(map, tilesetImages),
  })
}
