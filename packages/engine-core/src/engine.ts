import * as Phaser from 'phaser'
import type { CharacterDefinition, EngineEvent, MapDefinition, WorldConfig } from './types.ts'
import { resolveCharacter, resolveMap } from './world-config.ts'
import type { EntityObject } from './tiled-assets.ts'
import { GridEngine } from 'grid-engine'
import { collectTiledMapAssets } from './tiled-assets.ts'
import { createMapScene } from './map-scene.ts'
import { findDuplicates } from './util.ts'

export interface ContentCatalogs {
  maps: MapDefinition[]
  characters: CharacterDefinition[]
}

export interface CreateEngineOptions {
  worldConfig: WorldConfig
  catalogs: ContentCatalogs
  onEvent?: (event: EngineEvent) => void
}

// Two objects on the same Map sharing an entityId is an authoring mistake the Engine catches itself.
function warnDuplicateEntityIds(mapId: string, entities: EntityObject[]): void {
  const duplicates = findDuplicates(entities.map((entity) => entity.entityId))
  if (duplicates.length > 0) {
    console.warn(`[engine] Map "${mapId}" has duplicate entityId(s): ${duplicates.join(', ')}`)
  }
}

export async function createEngine(container: HTMLElement, options: CreateEngineOptions): Promise<Phaser.Game> {
  const { worldConfig, catalogs, onEvent } = options
  const map = resolveMap(worldConfig, catalogs.maps)
  const character = resolveCharacter(worldConfig, catalogs.characters)
  const assets = await collectTiledMapAssets(map.tiledMapUrl)
  warnDuplicateEntityIds(map.id, assets.entities)

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
    scene: createMapScene({ map, character, worldConfig, assets, onEvent }),
    plugins: {
      scene: [{ key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' }],
    },
  })
}
