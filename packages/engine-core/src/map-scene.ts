import * as Phaser from 'phaser'
import type { AnimationFrame, TiledMapAssets } from './tiled-assets.ts'
import { CHARACTER_COLLISION_GROUP, createCutsceneMovement } from './cutscene-movement.ts'
import type { CharacterData, GridEngine } from 'grid-engine'
import type { CharacterDefinition, EngineEvent, MapDefinition, ResolvedCompanion, WorldConfig } from './types.ts'
import type { EntityObject, Facing, TileCoord } from './map-objects.ts'
import type { RegionWatch, ResolvedPortal } from './regions.ts'
import { computeCameraBounds, firstFreeNeighbour } from './util.ts'
import { preloadCharacterSprite, resolveCharacterTexture } from './character-assets.ts'
import { watchPortals, watchZones } from './regions.ts'
import type { CutsceneMovement } from './cutscene-movement.ts'
import { Direction } from 'grid-engine'
import type { TileSize } from './character-assets.ts'
import { stepAnimation } from './tile-animation.ts'

export const PLAYER_ID = 'player'
const CAMERA_ZOOM = 2
const PLAYER_LAYER = 'ground'
const INTERACT_KEY = 'E'
export const MAP_SCENE_KEY = 'MapScene'

// Type-only export, deliberately — see the Host-side use in apps/web/src/state/player.ts for why.
export type PlayerCharId = typeof PLAYER_ID

export interface HostScene extends CutsceneMovement {
  setPaused: (paused: boolean) => void
}

export interface CharacterEntity {
  entity: EntityObject
  character: CharacterDefinition
}

const FACING_DIRECTIONS: Record<Facing, Direction> = {
  down: Direction.DOWN,
  left: Direction.LEFT,
  right: Direction.RIGHT,
  up: Direction.UP,
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
  companions: ResolvedCompanion[]
  portals: ResolvedPortal[]
  worldConfig: WorldConfig
  assets: TiledMapAssets
  onEvent?: (event: EngineEvent) => void
  // Called once create() has finished, so the Scene's HostScene calls are safe from then on.
  onCreated: () => void
}

export function createMapScene({ map, character, characterEntities, companions, portals, worldConfig, assets, onEvent, onCreated }: MapSceneConfig): typeof Phaser.Scene {
  const companionIds = new Set(worldConfig.companions.map(({ entityId }) => entityId))
  return class MapScene extends Phaser.Scene implements HostScene {
    public declare gridEngine: GridEngine
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
    private interactKey!: Phaser.Input.Keyboard.Key
    private animatedTiles: AnimatedTile[] = []
    private paused = false
    private cutsceneMovement!: CutsceneMovement
    private tileSize!: TileSize

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

    public moveTo(charId: string, targetPos: TileCoord): Promise<void> {
      return this.cutsceneMovement.moveTo(charId, targetPos)
    }

    public follow(followerId: string, leaderId: string, gap: number): void {
      this.cutsceneMovement.follow(followerId, leaderId, gap)
    }

    public stopMovement(charId: string): void {
      this.cutsceneMovement.stopMovement(charId)
    }

    public setBlocksCharacters(charId: string, blocks: boolean): void {
      this.cutsceneMovement.setBlocksCharacters(charId, blocks)
    }

    public preload(): void {
      this.load.tilemapTiledJSON(map.id, map.tiledMapUrl)
      for (const { key, url } of assets.images) {
        this.load.image(key, url)
      }
      const sheets = new Map([character, ...[...characterEntities, ...companions].map((entry) => entry.character)].map((sheet) => [sheet.id, sheet]))
      for (const sheet of sheets.values()) {
        preloadCharacterSprite(this, sheet)
      }
    }

    // Main entry
    public create(): void {
      const tilemap = this.createTilemap()
      this.createLayers(tilemap)
      this.createPropEntities(tilemap)
      this.createCharacters(tilemap)
      this.cutsceneMovement = createCutsceneMovement(this.gridEngine, PLAYER_ID)
      this.setupCamera(tilemap)
      this.setupInput()
      this.setupRegions()
      onCreated()
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

    private createCharacters(tilemap: Phaser.Tilemaps.Tilemap): void {
      this.tileSize = { width: tilemap.tileWidth, height: tilemap.tileHeight }
      const entityCharacters = characterEntities.map(({ entity, character: sheet }) => ({
        ...this.createCharacterData(entity.entityId, sheet, entity),
        facingDirection: FACING_DIRECTIONS[entity.facing!],
      }))

      this.gridEngine.create(tilemap, { characters: [this.createCharacterData(PLAYER_ID, character, worldConfig.player.spawn), ...entityCharacters] })
      this.placeCompanions()
    }

    private createCharacterData(id: string, sheet: CharacterDefinition, { x, y }: TileCoord): CharacterData {
      const texture = resolveCharacterTexture(this, sheet, this.tileSize)
      return {
        id,
        sprite: this.add.sprite(0, 0, texture.key),
        walkingAnimationMapping: texture.walkingAnimationMapping,
        startPosition: { x, y },
        charLayer: PLAYER_LAYER,
        offsetY: sheet.offsetY,
        collides: { collisionGroups: [CHARACTER_COLLISION_GROUP] },
      }
    }

    // Placed blocking, so the next Companion can't land on this one's tile until the Host's Companion sync unblocks it.
    private placeCompanions(): void {
      const isBlocked = (tile: TileCoord): boolean => this.gridEngine.isBlocked(tile, PLAYER_LAYER, [CHARACTER_COLLISION_GROUP])

      for (const { entityId, character: sheet } of companions) {
        const tile = firstFreeNeighbour(worldConfig.player.spawn, isBlocked)
        if (tile) {
          this.gridEngine.addCharacter(this.createCharacterData(entityId, sheet, tile))
        } else {
          console.warn(`[engine] Map "${map.id}" has no free tile next to the Spawn Point for Companion "${entityId}"; skipped`)
        }
      }
    }

    private setupRegions(): void {
      const watch: RegionWatch = {
        gridEngine: this.gridEngine,
        playerId: PLAYER_ID,
        layer: PLAYER_LAYER,
        portals,
        isPaused: () => this.paused,
        emit: (event) => { onEvent?.(event) },
      }
      watchZones(watch, assets.zones, (fire) => { this.events.once(Phaser.Scenes.Events.UPDATE, fire) })
      watchPortals(watch, map.id)
    }

    private setupCamera(tilemap: Phaser.Tilemaps.Tilemap): void {
      const playerSprite = this.gridEngine.getSprite(PLAYER_ID)!
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
        // A walked Character Entity is no longer at its authored tile, and a Companion's tile is never used, so a skipped one stays skipped.
        const placed = this.gridEngine.hasCharacter(candidate.entityId)
        const pos = placed ? this.gridEngine.getPosition(candidate.entityId) : candidate
        return (placed || !companionIds.has(candidate.entityId)) && pos.x === facing.x && pos.y === facing.y
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
