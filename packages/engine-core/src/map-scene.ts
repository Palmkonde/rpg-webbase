import * as Phaser from 'phaser'
import type { AnimationFrame, TiledMapAssets } from './tiled-assets.ts'
import type { CharacterDefinition, EngineEvent, MapDefinition, WorldConfig } from './types.ts'
import { preloadPlayerSprite, resolvePlayerTexture } from './player-assets.ts'
import { Direction } from 'grid-engine'
import type { GridEngine } from 'grid-engine'
import { computeCameraBounds } from './util.ts'
import { stepAnimation } from './tile-animation.ts'

const PLAYER_ID = 'player'
const CAMERA_ZOOM = 2
const INTERACT_KEY = 'E'

interface AnimatedTile {
  tile: Phaser.Tilemaps.Tile
  frames: AnimationFrame[]
  frameIndex: number
  elapsedMs: number
}

export interface MapSceneConfig {
  map: MapDefinition
  character: CharacterDefinition
  worldConfig: WorldConfig
  assets: TiledMapAssets
  onEvent?: (event: EngineEvent) => void
}

export function createMapScene({ map, character, worldConfig, assets, onEvent }: MapSceneConfig): typeof Phaser.Scene {
  return class MapScene extends Phaser.Scene {
    public declare gridEngine: GridEngine
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
    private interactKey!: Phaser.Input.Keyboard.Key
    private animatedTiles: AnimatedTile[] = []

    public constructor() {
      super('MapScene')
    }

    public preload(): void {
      this.load.tilemapTiledJSON(map.id, map.tiledMapUrl)
      for (const { key, url } of assets.images) {
        this.load.image(key, url)
      }
      preloadPlayerSprite(this, character)
    }

    // Main entry
    public create(): void {
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

    private createLayers(tilemap: Phaser.Tilemaps.Tilemap): void {
      for (const [index, layerData] of tilemap.layers.entries()) {
        const layer = tilemap.createLayer(index, tilemap.tilesets, 0, 0)
        layer?.setVisible(layerData.visible)
        layer?.forEachTile((tile) => {
          MapScene.applyTileProperties(tile)
          this.registerAnimatedTile(tile)
        })
      }
    }

    private static applyTileProperties(tile: Phaser.Tilemaps.Tile): void {
      const props = assets.tileProperties.get(tile.index)
      if (props) {
        Object.assign(tile.properties, props)
      }
    }

    private registerAnimatedTile(tile: Phaser.Tilemaps.Tile): void {
      const frames = assets.tileAnimations.get(tile.index)
      if (frames && frames.length > 1) {
        const startIndex = Math.max(
          frames.findIndex((frame) => frame.gid === tile.index),
          0,
        )
        this.animatedTiles.push({ tile, frames, frameIndex: startIndex, elapsedMs: 0 })
      }
    }

    private createPlayer(tilemap: Phaser.Tilemaps.Tilemap): Phaser.GameObjects.Sprite {
      const playerTexture = resolvePlayerTexture(this, character, { width: tilemap.tileWidth, height: tilemap.tileHeight })
      const playerSprite = this.add.sprite(0, 0, playerTexture.key)

      this.gridEngine.create(tilemap, {
        characters: [
          {
            id: PLAYER_ID,
            sprite: playerSprite,
            walkingAnimationMapping: playerTexture.walkingAnimationMapping,
            startPosition: { x: worldConfig.player.spawn.x, y: worldConfig.player.spawn.y },
            charLayer: "ground",
            offsetY: -8
          },
        ],
      })

      return playerSprite
    }

    private setupCamera(tilemap: Phaser.Tilemaps.Tilemap, playerSprite: Phaser.GameObjects.Sprite): void {
      const camera = this.cameras.main
      camera.setZoom(CAMERA_ZOOM)
      camera.startFollow(playerSprite, true)
      camera.setFollowOffset(-playerSprite.width / 2, -playerSprite.height / 2)

      // Camera input boundary
      const bounds = computeCameraBounds(tilemap.widthInPixels, tilemap.heightInPixels)
      camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height)
    }

    private setupInput(): void {
      this.cursors = this.input.keyboard!.createCursorKeys()
      this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
        'W' | 'A' | 'S' | 'D',
        Phaser.Input.Keyboard.Key
      >
      this.interactKey = this.input.keyboard!.addKey(INTERACT_KEY)
    }

    public update(_time: number, delta: number): void {
      this.handleMovementInput()
      this.handleInteractInput()
      this.stepTileAnimations(delta)
    }

    private handleMovementInput(): void {
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

    // Fires only when the Player is adjacent to/facing an Entity — the tile directly ahead of the
    // That tile need class "Entity`
    private handleInteractInput(): void {
      // oxlint-disable-next-line new-cap -- Phaser.Input.Keyboard.JustDown is a static API function, not a constructor
      if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) {return}

      const facing = this.gridEngine.getFacingPosition(PLAYER_ID)
      const entity = assets.entities.find((candidate) => candidate.x === facing.x && candidate.y === facing.y)
      
      if (entity) {
        onEvent?.({ type: 'interacted', entityId: entity.entityId })
      }
    }

    private stepTileAnimations(delta: number): void {
      for (const anim of this.animatedTiles) {
        const step = stepAnimation(anim, delta)
        anim.frameIndex = step.frameIndex
        anim.elapsedMs = step.elapsedMs
        if (step.changed) {
          anim.tile.index = anim.frames[step.frameIndex].gid
        }
      }
    }
  }
}
