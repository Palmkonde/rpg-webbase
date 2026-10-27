import * as Phaser from 'phaser'
import type { CharacterDefinition, EngineEvent, MapDefinition, WorldConfig } from './types.ts'
import type { CharacterEntity, HostScene, MapSceneConfig } from './map-scene.ts'
import type { EntityObject, PortalObject, TileCoord } from './map-objects.ts'
import { MAP_SCENE_KEY, PLAYER_ID, createMapScene } from './map-scene.ts'
import { findOverlappingPortals, findOverlappingZoneIds } from './map-objects.ts'
import { resolveCharacter, resolveCompanions, resolveMap } from './world-config.ts'
import { GridEngine } from 'grid-engine'
import type { ResolvedPortal } from './regions.ts'
import type { TiledMapAssets } from './tiled-assets.ts'
import { collectTiledMapAssets } from './tiled-assets.ts'
import { findDuplicates } from './util.ts'

export interface EngineHandle {
  destroy: () => void
  setPaused: (paused: boolean) => void
  moveTo: (charId: string, targetPos: TileCoord) => Promise<void>
  follow: (followerId: string, leaderId: string, gap: number) => void
  stopMovement: (charId: string) => void
  setBlocksCharacters: (charId: string, blocks: boolean) => void
}

export interface ContentCatalogs {
  maps: MapDefinition[]
  characters: CharacterDefinition[]
}

export interface CreateEngineOptions {
  worldConfig: WorldConfig
  catalogs: ContentCatalogs

  // Where a Map's tileset images are: each is a key under it, as Publish wrote them (adr/0035).
  assetBaseUrl: string
  onEvent?: (event: EngineEvent) => void
}

// Two objects on the same Map sharing an id (entityId, zoneId, ...) is an authoring mistake the Engine catches itself.
function warnDuplicateIds(mapId: string, kind: string, ids: string[]): void {
  const duplicates = findDuplicates(ids)
  if (duplicates.length > 0) {
    console.warn(`[engine] Map "${mapId}" has duplicate ${kind}(s): ${duplicates.join(', ')}`)
  }
}

// Overlapping Zones or Portals aren't specially resolved (first match wins) but are worth flagging.
function warnOverlapping(mapId: string, kind: string, overlapping: string[]): void {
  if (overlapping.length > 0) {
    console.warn(`[engine] Map "${mapId}" has overlapping ${kind}(s): ${overlapping.join(', ')}`)
  }
}

function warnAuthoringMistakes(mapId: string, { entities, zones, portals }: TiledMapAssets): void {
  warnDuplicateIds(mapId, 'entityId', entities.map((entity) => entity.entityId))
  warnDuplicateIds(mapId, 'zoneId', zones.map((zone) => zone.zoneId))
  warnOverlapping(mapId, 'Zone', findOverlappingZoneIds(zones))
  warnOverlapping(mapId, 'Portal', findOverlappingPortals(portals))
}

// Resolved from the catalog, never by loading the target Map (adr/0046).
function resolvePortals(mapId: string, portals: PortalObject[], maps: MapDefinition[]): ResolvedPortal[] {
  return portals.flatMap(({ tiles, targetMap, targetSpawn }) => {
    const spawnPoints = maps.find((candidate) => candidate.id === targetMap)?.spawnPoints
    if (!spawnPoints || !Object.hasOwn(spawnPoints, targetSpawn)) {
      console.warn(`[engine] Map "${mapId}" has a Portal to "${targetMap}/${targetSpawn}", which leads nowhere; skipped`)
      return []
    }
    return [{ tiles, toMapId: targetMap, spawn: spawnPoints[targetSpawn] }]
  })
}

// A Companion's own Tiled placement is skipped, since it appears beside the Player instead (adr/0028, provisional).
function withoutCompanions(entities: EntityObject[], { companions }: WorldConfig): EntityObject[] {
  const companionIds = new Set(companions.map(({ entityId }) => entityId))
  return entities.filter(({ entityId }) => !companionIds.has(entityId))
}

// An unknown characterId is an authoring mistake: warn and skip that Entity rather than fail the whole Map load.
function resolveCharacterEntities(mapId: string, entities: EntityObject[], catalog: CharacterDefinition[]): CharacterEntity[] {
  const resolved: CharacterEntity[] = []
  const takenIds = new Set([PLAYER_ID])
  for (const entity of entities.filter(({ characterId }) => characterId)) {
    const character = catalog.find((candidate) => candidate.id === entity.characterId)
    if (!character) {
      console.warn(`[engine] Map "${mapId}" Entity "${entity.entityId}" has unknown characterId "${entity.characterId}"`)
    } else if (takenIds.has(entity.entityId)) {
      // A repeated id silently replaces the earlier grid-engine character, hijacking the Player or orphaning a sprite.
      console.warn(`[engine] Map "${mapId}" Character Entity "${entity.entityId}" reuses a character id; skipped`)
    } else {
      takenIds.add(entity.entityId)
      resolved.push({ entity, character })
    }
  }
  return resolved
}

// Resolves only once the Map Scene's create() has run, so no handle call can reach grid-engine before it exists.
function startGame(container: HTMLElement, sceneConfig: Omit<MapSceneConfig, 'onCreated'>): Promise<Phaser.Game> {
  // oxlint-disable-next-line promise/avoid-new
  return new Promise((resolve) => {
    const game: Phaser.Game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,

      // The files come from the Game Service or a CDN, not the Platform's own origin: without this the browser taints their textures.
      loader: { crossOrigin: 'anonymous' },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 960,
        height: 540,
      },
      pixelArt: true,
      scene: createMapScene({ ...sceneConfig, onCreated: () => { resolve(game) } }),
      plugins: {
        scene: [{ key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' }],
      },
    })
  })
}

function getMapScene(game: Phaser.Game): Phaser.Scene & HostScene {
  return game.scene.getScene<Phaser.Scene & HostScene>(MAP_SCENE_KEY)
}

export async function createEngine(container: HTMLElement, options: CreateEngineOptions): Promise<EngineHandle> {
  const { worldConfig, catalogs, assetBaseUrl, onEvent } = options
  const map = resolveMap(worldConfig, catalogs.maps)
  const character = resolveCharacter(worldConfig, catalogs.characters)
  const assets = await collectTiledMapAssets(map.tiledMapUrl, assetBaseUrl)

  const characterEntities = resolveCharacterEntities(map.id, withoutCompanions(assets.entities, worldConfig), catalogs.characters)
  const companions = resolveCompanions(worldConfig, catalogs.characters)
  warnAuthoringMistakes(map.id, assets)

  const portals = resolvePortals(map.id, assets.portals, catalogs.maps)
  const game = await startGame(container, { map, character, characterEntities, companions, portals, worldConfig, assets, onEvent })

  return {
    destroy: () => {game.destroy(true)},
    setPaused: (paused: boolean) => {getMapScene(game).setPaused(paused)},
    moveTo: (charId: string, targetPos: TileCoord) => getMapScene(game).moveTo(charId, targetPos),
    follow: (followerId: string, leaderId: string, gap: number) => {getMapScene(game).follow(followerId, leaderId, gap)},
    stopMovement: (charId: string) => {getMapScene(game).stopMovement(charId)},
    setBlocksCharacters: (charId: string, blocks: boolean) => {getMapScene(game).setBlocksCharacters(charId, blocks)},
  }
}
