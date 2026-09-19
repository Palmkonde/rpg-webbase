import * as Phaser from 'phaser'
import { GridEngine, Direction } from 'grid-engine'
import { type AnimationFrame, type ImageToLoad } from './tiledAssets.ts'
import { stepAnimation } from './tileAnimation.ts'
import { preloadPlayerSprite, resolvePlayerTexture } from './playerAssets.ts'
import { computeCameraBounds } from './util.ts'
import type { CharacterDefinition, MapDefinition, WorldConfig } from './types.ts'

const PLAYER_ID = 'player'
const CAMERA_ZOOM = 2

interface AnimatedTile {
  tile: Phaser.Tilemaps.Tile
  frames: AnimationFrame[]
  frameIndex: number
  elapsedMs: number
}

export function createMapScene(
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

    // main entry
    create() {
      const tilemap = this.createTilemap()
      this.createLayers(tilemap)
      const playerSprite = this.createPlayer(tilemap)
      this.setupCamera(tilemap, playerSprite)
      this.setupInput()
    }

    private createTilemap(): Phaser.Tilemaps.Tilemap {
      const tilemap = this.make.tilemap({ key: map.id })

      for (const tileset of tilemap.tilesets) {
        tilemap.addTilesetImage(tileset.name, tileset.name)
      }

      return tilemap
    }

    private createLayers(tilemap: Phaser.Tilemaps.Tilemap) {
      tilemap.layers.forEach((layerData, index) => {
        const layer = tilemap.createLayer(index, tilemap.tilesets, 0, 0)
        layer?.setVisible(layerData.visible)
        layer?.forEachTile((tile) => {
          this.applyTileProperties(tile)
          this.registerAnimatedTile(tile)
        })
      })
    }

    private applyTileProperties(tile: Phaser.Tilemaps.Tile) {
      const props = tileProperties.get(tile.index)
      if (props) {
        Object.assign(tile.properties, props)
      }
    }

    private registerAnimatedTile(tile: Phaser.Tilemaps.Tile) {
      const frames = tileAnimations.get(tile.index)
      if (frames && frames.length > 1) {
        const startIndex = Math.max(
          frames.findIndex((frame) => frame.gid === tile.index),
          0,
        )
        this.animatedTiles.push({ tile, frames, frameIndex: startIndex, elapsedMs: 0 })
      }
    }

    private createPlayer(tilemap: Phaser.Tilemaps.Tilemap): Phaser.GameObjects.Sprite {
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

      return playerSprite
    }

    private setupCamera(tilemap: Phaser.Tilemaps.Tilemap, playerSprite: Phaser.GameObjects.Sprite) {
      const camera = this.cameras.main
      camera.setZoom(CAMERA_ZOOM)
      camera.startFollow(playerSprite, true)
      camera.setFollowOffset(-playerSprite.width / 2, -playerSprite.height / 2)

      // camera input boundary
      const bounds = computeCameraBounds(tilemap.widthInPixels, tilemap.heightInPixels)
      camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height)
    }

    private setupInput() {
      this.cursors = this.input.keyboard!.createCursorKeys()
      this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
        'W' | 'A' | 'S' | 'D',
        Phaser.Input.Keyboard.Key
      >
    }

    update(_time: number, delta: number) {
      this.handleMovementInput()
      this.stepTileAnimations(delta)
    }

    private handleMovementInput() {
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

    private stepTileAnimations(delta: number) {
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
