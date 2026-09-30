import * as Phaser from 'phaser'
import type { AnimationFrame, EntityObject, TileCoord, TiledMapAssets, ZoneObject } from './tiled-assets.ts'
import type { CharacterDefinition, EngineEvent, MapDefinition, WorldConfig } from './types.ts'
import { preloadCharacterSprite, resolveCharacterTexture } from './character-assets.ts'
import { Direction } from 'grid-engine'
import type { GridEngine } from 'grid-engine'
import { computeCameraBounds } from './util.ts'
import { stepAnimation } from './tile-animation.ts'

const PLAYER_ID = 'player'
const CAMERA_ZOOM = 2
const PLAYER_LAYER = 'ground'
const INTERACT_KEY = 'E'
export const MAP_SCENE_KEY = 'MapScene'

// Type-only export, deliberately — see the Host-side use in apps/web/src/state/cutscene.ts for why.
export type PlayerCharId = typeof PLAYER_ID

export interface HostScene {
  setPaused: (paused: boolean) => void
  moveTo: (charId: string, targetPos: TileCoord) => Promise<void>
}

function zoneContains(zone: ZoneObject, pos: TileCoord): boolean {
  return zone.tiles.some((tile) => tile.x === pos.x && tile.y === pos.y)
}

export interface CharacterEntity {
  entity: EntityObject
  character: CharacterDefinition
}

const FACINGS: Direction[] = [Direction.DOWN, Direction.LEFT, Direction.RIGHT, Direction.UP]

function resolveFacing(entity: EntityObject): Direction {
  const facing = FACINGS.find((candidate) => candidate === entity.facing)
  if (!facing) {
    console.warn(`[engine] Entity "${entity.entityId}" has invalid facing "${entity.facing}"; using down`)
  }
  return facing ?? Direction.DOWN
}

interface AnimatedTile {
  tile: Phaser.Tilemaps.Tile
  frames: AnimationFrame[]
  frameIndex: number
  elapsedMs: number
}

export interface MapSceneConfig {
  map: MapDefinition
  character: CharacterDefinition
  characterEntities: CharacterEntity[]
  worldConfig: WorldConfig
  assets: TiledMapAssets
  onEvent?: (event: EngineEvent) => void
}

export function createMapScene({ map, character, characterEntities, worldConfig, assets, onEvent }: MapSceneConfig): typeof Phaser.Scene {
  const walkers = new Set(characterEntities.map(({ entity }) => entity.entityId))

  return class MapScene extends Phaser.Scene implements HostScene {
    public declare gridEngine: GridEngine
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
    private interactKey!: Phaser.Input.Keyboard.Key
    private animatedTiles: AnimatedTile[] = []
    private paused = false

    public constructor() {
      super(MAP_SCENE_KEY)
    }

    public setPaused(paused: boolean): void {
      this.paused = paused

      // Drains a keypress latched during the pause so it can't fire a stale interact on resume (JustDown).
      if (!paused) {
        this.interactKey.reset()
      }
    }

    // Wraps grid-engine's own moveTo/pathfinding — resolves once on its one-shot completion signal, success or not.
    public moveTo(charId: string, targetPos: TileCoord): Promise<void> {

      // oxlint-disable-next-line promise/avoid-new
      return new Promise((resolve) => {
        this.gridEngine.moveTo(charId, targetPos).subscribe(({ result }) => {
          if (result) {
            console.warn(`[engine] moveTo(${charId} -> ${targetPos.x},${targetPos.y}) did not complete: ${result}`)
          }
          resolve()
        })
      })
    }

    public preload(): void {
      this.load.tilemapTiledJSON(map.id, map.tiledMapUrl)
      for (const { key, url } of assets.images) {
        this.load.image(key, url)
      }
      const sheets = new Map([character, ...characterEntities.map((entry) => entry.character)].map((sheet) => [sheet.id, sheet]))
      for (const sheet of sheets.values()) {
        preloadCharacterSprite(this, sheet)
      }
    }

    // Main entry
    public create(): void {
      const tilemap = this.createTilemap()
      this.createLayers(tilemap)
      this.createPropEntities(tilemap)
      const playerSprite = this.createCharacters(tilemap)
      this.setupCamera(tilemap, playerSprite)
      this.setupInput()
      this.setupZones()
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

    private createPropEntities(tilemap: Phaser.Tilemaps.Tilemap): void {
      for (const { gid, x, y } of assets.propTiles) {
        const key = assets.tileImages.get(gid)
        if (key) {
          this.add.image(x * tilemap.tileWidth, (y + 1) * tilemap.tileHeight, key).setOrigin(0, 1)
        } else {
          console.warn(`[engine] Prop Entity at ${x},${y} has no drawable image for tile gid ${gid}`)
        }
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

    private createCharacters(tilemap: Phaser.Tilemaps.Tilemap): Phaser.GameObjects.Sprite {
      const tileSize = { width: tilemap.tileWidth, height: tilemap.tileHeight }
      const playerTexture = resolveCharacterTexture(this, character, tileSize)
      const playerSprite = this.add.sprite(0, 0, playerTexture.key)

      const entityCharacters = characterEntities.map(({ entity, character: sheet }) => {
        const texture = resolveCharacterTexture(this, sheet, tileSize)
        return {
          id: entity.entityId,
          sprite: this.add.sprite(0, 0, texture.key),
          walkingAnimationMapping: texture.walkingAnimationMapping,
          startPosition: { x: entity.x, y: entity.y },
          facingDirection: resolveFacing(entity),
          charLayer: PLAYER_LAYER,
          offsetY: sheet.offsetY,
        }
      })

      this.gridEngine.create(tilemap, {
        characters: [
          {
            id: PLAYER_ID,
            sprite: playerSprite,
            walkingAnimationMapping: playerTexture.walkingAnimationMapping,
            startPosition: { x: worldConfig.player.spawn.x, y: worldConfig.player.spawn.y },
            charLayer: PLAYER_LAYER,
            offsetY: character.offsetY,
          },
          ...entityCharacters,
        ],
      })

      return playerSprite
    }

    private setupZones(): void {
      const player = this.gridEngine.getPosition(PLAYER_ID)
      for (const zone of assets.zones) {
        // Only outside→inside counts; steppedOn also fires on steps between tiles inside the Zone.
        this.gridEngine
          .steppedOn([PLAYER_ID], zone.tiles, [PLAYER_LAYER])
          .subscribe(({ exitTile }) => {
            if (!zoneContains(zone, exitTile)) {onEvent?.({ type: 'zoneEntered', zoneId: zone.zoneId })}
          })

        if (zoneContains(zone, player)) {onEvent?.({ type: 'zoneEntered', zoneId: zone.zoneId })}
      }
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
      if (this.paused) {return}

      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        this.gridEngine.move(PLAYER_ID, Direction.LEFT)
      } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
        this.gridEngine.move(PLAYER_ID, Direction.RIGHT)
      } else if (this.cursors.up.isDown || this.wasd.W.isDown) {
        this.gridEngine.move(PLAYER_ID, Direction.UP)
      } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
        this.gridEngine.move(PLAYER_ID, Direction.DOWN)
      }
    }

    // Fires only when the Player is adjacent to/facing an Entity — the tile directly ahead of the
    // That tile need class "Entity`
    private handleInteractInput(): void {
      if (this.paused) {return}

      // oxlint-disable-next-line new-cap -- Phaser.Input.Keyboard.JustDown is a static API function, not a constructor
      if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) {return}

      const facing = this.gridEngine.getFacingPosition(PLAYER_ID)
      const entity = assets.entities.find((candidate) => {
        
        // A walked Character Entity is no longer at its authored tile.
        const pos = walkers.has(candidate.entityId) ? this.gridEngine.getPosition(candidate.entityId) : candidate
        return pos.x === facing.x && pos.y === facing.y
      })
      
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
