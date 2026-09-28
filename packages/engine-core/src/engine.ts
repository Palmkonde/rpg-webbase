import * as Phaser from 'phaser'
import type { CharacterDefinition, EngineEvent, MapDefinition, WorldConfig } from './types.ts'
import { MAP_SCENE_KEY, createMapScene } from './map-scene.ts'
import { collectTiledMapAssets, findOverlappingZoneIds } from './tiled-assets.ts'
import { resolveCharacter, resolveMap } from './world-config.ts'
import { GridEngine } from 'grid-engine'
import type { PausableScene } from './map-scene.ts'
import type { ZoneObject } from './tiled-assets.ts'
import { findDuplicates } from './util.ts'

export interface EngineHandle {
  destroy: () => void
  setPaused: (paused: boolean) => void
}

export interface ContentCatalogs {
  maps: MapDefinition[]
  characters: CharacterDefinition[]
}

export interface CreateEngineOptions {
  worldConfig: WorldConfig
  catalogs: ContentCatalogs
  onEvent?: (event: EngineEvent) => void
}

// Two objects on the same Map sharing an id (entityId, zoneId, ...) is an authoring mistake the Engine catches itself.
function warnDuplicateIds(mapId: string, kind: string, ids: string[]): void {
  const duplicates = findDuplicates(ids)
  if (duplicates.length > 0) {
    console.warn(`[engine] Map "${mapId}" has duplicate ${kind}(s): ${duplicates.join(', ')}`)
  }
}

// Overlapping Zones aren't specially resolved (first match wins) but are worth flagging.
function warnOverlappingZones(mapId: string, zones: ZoneObject[]): void {
  const overlapping = findOverlappingZoneIds(zones)
  if (overlapping.length > 0) {
    console.warn(`[engine] Map "${mapId}" has overlapping Zone(s): ${overlapping.join(', ')}`)
  }
}

export async function createEngine(container: HTMLElement, options: CreateEngineOptions): Promise<EngineHandle> {
  const { worldConfig, catalogs, onEvent } = options
  const map = resolveMap(worldConfig, catalogs.maps)
  const character = resolveCharacter(worldConfig, catalogs.characters)
  const assets = await collectTiledMapAssets(map.tiledMapUrl)

  // Warning guards
  warnDuplicateIds(map.id, 'entityId', assets.entities.map((entity) => entity.entityId))
  warnDuplicateIds(map.id, 'zoneId', assets.zones.map((zone) => zone.zoneId))
  warnOverlappingZones(map.id, assets.zones)

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
    pixelArt: true,
    scene: createMapScene({ map, character, worldConfig, assets, onEvent }),
    plugins: {
      scene: [{ key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' }],
    },
  })

  return {
    destroy: () => {game.destroy(true)},
    setPaused: (paused: boolean) => {
      game.scene.getScene<Phaser.Scene & PausableScene>(MAP_SCENE_KEY).setPaused(paused)
    },
  }
}
