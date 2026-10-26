import type { TileCoord, ZoneObject } from './map-objects.ts'
import type { EngineEvent } from './types.ts'
import type { GridEngine } from 'grid-engine'

// A Portal with its target already resolved to a tile on the target Map (adr/0046).
export interface ResolvedPortal {
  tiles: TileCoord[]
  toMapId: string
  spawn: TileCoord
}

// What the Scene gives the Zone and Portal watchers: whose steps count, on which layer, and whether they count right now.
export interface RegionWatch {
  gridEngine: GridEngine
  playerId: string
  layer: string
  portals: ResolvedPortal[]
  isPaused: () => boolean
  emit: (event: EngineEvent) => void
}

function covers(region: { tiles: TileCoord[] }, pos: TileCoord): boolean {
  return region.tiles.some((tile) => tile.x === pos.x && tile.y === pos.y)
}

// The first Portal a step enters from outside it.
function portalEntered(portals: ResolvedPortal[], step: { enterTile: TileCoord; exitTile: TileCoord }): ResolvedPortal | undefined {
  return portals.find((portal) => covers(portal, step.enterTile) && !covers(portal, step.exitTile))
}

// `defer` runs the spawn-tile entry a frame later, so createEngine has resolved and the Host holds the handle before a Script can run.
export function watchZones(watch: RegionWatch, zones: ZoneObject[], defer: (fire: () => void) => void): void {
  const { gridEngine, playerId, layer, portals, isPaused, emit } = watch
  const player = gridEngine.getPosition(playerId)
  for (const zone of zones) {

    // Outside→inside only, unpaused (adr/0026), and not a step that fires a Portal and leaves the Map (adr/0046).
    gridEngine
      .steppedOn([playerId], zone.tiles, [layer])
      .subscribe((step) => {
        if (!isPaused() && !covers(zone, step.exitTile) && !portalEntered(portals, step)) {emit({ type: 'zoneEntered', zoneId: zone.zoneId })}
      })

    if (covers(zone, player)) {defer(() => { emit({ type: 'zoneEntered', zoneId: zone.zoneId }) })}
  }
}

// Unlike a Zone, arriving on a Portal never fires it: only the Player's own unpaused step does (adr/0046).
export function watchPortals(watch: RegionWatch, mapId: string): void {
  const { gridEngine, playerId, layer, portals, isPaused, emit } = watch
  const tiles = portals.flatMap((portal) => portal.tiles)
  if (tiles.length === 0) {return}

  gridEngine
    .steppedOn([playerId], tiles, [layer])
    .subscribe((step) => {
      const portal = portalEntered(portals, step)
      if (isPaused() || !portal) {return}
      emit({ type: 'transitioned', fromMapId: mapId, toMapId: portal.toMapId, spawn: portal.spawn })
    })
}
