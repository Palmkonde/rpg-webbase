import type { TileCoord, ZoneObject } from './map-objects.ts'
import type { EngineEvent } from './types.ts'
import type { GridEngine } from 'grid-engine'

// What the Scene gives the Zone watcher: whose steps count, on which layer, and whether they count right now.
export interface RegionWatch {
  gridEngine: GridEngine
  playerId: string
  layer: string
  isPaused: () => boolean
  emit: (event: EngineEvent) => void
}

function covers(region: { tiles: TileCoord[] }, pos: TileCoord): boolean {
  return region.tiles.some((tile) => tile.x === pos.x && tile.y === pos.y)
}

// `defer` runs the spawn-tile entry a frame later, so createEngine has resolved and the Host holds the handle before a Script can run.
export function watchZones(watch: RegionWatch, zones: ZoneObject[], defer: (fire: () => void) => void): void {
  const { gridEngine, playerId, layer, isPaused, emit } = watch
  const player = gridEngine.getPosition(playerId)
  for (const zone of zones) {

    // Only outside→inside counts; steppedOn also fires on steps between tiles inside the Zone.
    // A Cutscene-driven entry while paused is dropped, not queued (adr/0026).
    gridEngine
      .steppedOn([playerId], zone.tiles, [layer])
      .subscribe(({ exitTile }) => {
        if (!isPaused() && !covers(zone, exitTile)) {emit({ type: 'zoneEntered', zoneId: zone.zoneId })}
      })

    if (covers(zone, player)) {defer(() => { emit({ type: 'zoneEntered', zoneId: zone.zoneId }) })}
  }
}
