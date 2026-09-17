import * as Phaser from 'phaser'
import { GridEngine, Direction } from 'grid-engine'
import { resolveMap } from './worldConfig.ts'
import { collectTiledMapAssets, type ImageToLoad } from './tiledAssets.ts'
import { loadPlayerTexture } from './playerAssets.ts'
import type { MapDefinition, WorldConfig } from './types.ts'

const PLAYER_ID = 'player'

function createMapScene(
  map: MapDefinition,
  tilesetImages: ImageToLoad[],
  worldConfig: WorldConfig,
  tileProperties: Map<number, Record<string, unknown>>,
) {
  return class MapScene extends Phaser.Scene {
    declare gridEngine: GridEngine
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>

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
        layer?.forEachTile((tile) => {
          const props = tileProperties.get(tile.index)
          if (props) {
            Object.assign(tile.properties, props)
          }
        })
      })

      const playerTextureKey = loadPlayerTexture(this, tilemap.tileWidth, tilemap.tileHeight)
      const playerSprite = this.add.sprite(0, 0, playerTextureKey)

      this.gridEngine.create(tilemap, {
        characters: [
          {
            id: PLAYER_ID,
            sprite: playerSprite,
            startPosition: { x: worldConfig.player.spawn.x, y: worldConfig.player.spawn.y },
          },
        ],
      })

      this.cursors = this.input.keyboard!.createCursorKeys()
      this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
        'W' | 'A' | 'S' | 'D',
        Phaser.Input.Keyboard.Key
      >
    }

    update() {
      const left = this.cursors.left.isDown || this.wasd.A.isDown
      const right = this.cursors.right.isDown || this.wasd.D.isDown
      const up = this.cursors.up.isDown || this.wasd.W.isDown
      const down = this.cursors.down.isDown || this.wasd.S.isDown

      if (left) {
        this.gridEngine.move(PLAYER_ID, Direction.LEFT)
      } else if (right) {
        this.gridEngine.move(PLAYER_ID, Direction.RIGHT)
      } else if (up) {
        this.gridEngine.move(PLAYER_ID, Direction.UP)
      } else if (down) {
        this.gridEngine.move(PLAYER_ID, Direction.DOWN)
      }
    }
  }
}

export async function createEngine(
  container: HTMLElement,
  worldConfig: WorldConfig,
  maps: MapDefinition[],
): Promise<Phaser.Game> {
  const map = resolveMap(worldConfig, maps)
  const { images: tilesetImages, tileProperties } = await collectTiledMapAssets(map.tiledMapUrl)

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: container.clientWidth || 640,
    height: container.clientHeight || 480,
    pixelArt: true,
    scene: createMapScene(map, tilesetImages, worldConfig, tileProperties),
    plugins: {
      scene: [{ key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' }],
    },
  })
}
