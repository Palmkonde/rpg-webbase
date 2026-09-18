import * as Phaser from 'phaser'
import { GridEngine, Direction } from 'grid-engine'
import { resolveCharacter, resolveMap } from './worldConfig.ts'
import { collectTiledMapAssets, type AnimationFrame, type ImageToLoad } from './tiledAssets.ts'
import { stepAnimation } from './tileAnimation.ts'
import { preloadPlayerSprite, resolvePlayerTexture } from './playerAssets.ts'
import type { CharacterDefinition, MapDefinition, WorldConfig } from './types.ts'

const PLAYER_ID = 'player'

interface AnimatedTile {
  tile: Phaser.Tilemaps.Tile
  frames: AnimationFrame[]
  frameIndex: number
  elapsedMs: number
}

function createMapScene(
  map: MapDefinition,
  character: CharacterDefinition,
  tilesetImages: ImageToLoad[],
  worldConfig: WorldConfig,
  tileProperties: Map<number, Record<string, unknown>>,
  tileAnimations: Map<number, AnimationFrame[]>,
) {
  return class MapScene extends Phaser.Scene {
    declare gridEngine: GridEngine
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
    private animatedTiles: AnimatedTile[] = []

    constructor() {
      super('MapScene')
    }

    preload() {
      this.load.tilemapTiledJSON(map.id, map.tiledMapUrl)
      for (const { key, url } of tilesetImages) {
        this.load.image(key, url)
      }
      preloadPlayerSprite(this, character)
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
          
          // Tile properties
          const props = tileProperties.get(tile.index)
          if (props) {
            Object.assign(tile.properties, props)
          }

          // Tile animations
          const frames = tileAnimations.get(tile.index)
          if (frames && frames.length > 1) {
            const startIndex = Math.max(
              frames.findIndex((frame) => frame.gid === tile.index),
              0,
            )
            this.animatedTiles.push({ tile, frames, frameIndex: startIndex, elapsedMs: 0 })
          }
        })
      })

      // player texture
      const playerTexture = resolvePlayerTexture(this, character, tilemap.tileWidth, tilemap.tileHeight)
      const playerSprite = this.add.sprite(0, 0, playerTexture.key)

      this.gridEngine.create(tilemap, {
        characters: [
          {
            id: PLAYER_ID,
            sprite: playerSprite,
            walkingAnimationMapping: playerTexture.walkingAnimationMapping,
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

    update(_time: number, delta: number) {
      const left = this.cursors.left.isDown || this.wasd.A.isDown
      const right = this.cursors.right.isDown || this.wasd.D.isDown
      const up = this.cursors.up.isDown || this.wasd.W.isDown
      const down = this.cursors.down.isDown || this.wasd.S.isDown

      // move
      if (left) {
        this.gridEngine.move(PLAYER_ID, Direction.LEFT)
      } else if (right) {
        this.gridEngine.move(PLAYER_ID, Direction.RIGHT)
      } else if (up) {
        this.gridEngine.move(PLAYER_ID, Direction.UP)
      } else if (down) {
        this.gridEngine.move(PLAYER_ID, Direction.DOWN)
      }

      // animation
      for (const anim of this.animatedTiles) {
        const step = stepAnimation(anim.frames, anim.frameIndex, anim.elapsedMs, delta)
        anim.frameIndex = step.frameIndex
        anim.elapsedMs = step.elapsedMs
        if (step.changed) {
          anim.tile.index = anim.frames[step.frameIndex].gid
        }
      }
    }
  }
}

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
    width: container.clientWidth || 640,
    height: container.clientHeight || 480,
    pixelArt: true,
    scene: createMapScene(map, character, tilesetImages, worldConfig, tileProperties, tileAnimations),
    plugins: {
      scene: [{ key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' }],
    },
  })
}
