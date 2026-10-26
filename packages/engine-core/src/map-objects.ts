// The objects a Map places on its object layers: Entities, Zones and Portals, each tagged by its Custom Class (adr/0010, adr/0012).

interface TiledPropertyDef {
  name: string
  value: unknown
}

interface TiledObjectDef {
  name: string
  type?: string
  x: number
  y: number
  width?: number
  height?: number
  gid?: number
  properties?: TiledPropertyDef[]
}

interface TiledLayerDef {
  type: string
  objects?: TiledObjectDef[]
}

export interface TiledObjectsJson {
  layers: TiledLayerDef[]
  tilewidth: number
  tileheight: number
}

export interface EntityObject {
  entityId: string
  x: number
  y: number
  characterId?: string
  facing?: Facing
}

export type Facing = typeof FACINGS[number]

export interface PropTile {
  gid: number
  x: number
  y: number
}

export interface TileCoord {
  x: number
  y: number
}

export interface ZoneObject {
  zoneId: string
  tiles: TileCoord[]
}

// Where a Portal sends the Player: a Spawn Point, named by its `spawnId`, on another Map (adr/0046).
export interface PortalObject {
  tiles: TileCoord[]
  targetMap: string
  targetSpawn: string
}

const OBJECT_LAYER_TYPE = 'objectgroup'
const ENTITY_CLASS = 'Entity'
const ENTITY_ID_PROPERTY = 'entityId'
const CHARACTER_ID_PROPERTY = 'characterId'
const FACING_PROPERTY = 'facing'
const FACINGS = ['down', 'left', 'right', 'up'] as const
const DEFAULT_FACING: Facing = 'down'
const ZONE_CLASS = 'Zone'
const ZONE_ID_PROPERTY = 'zoneId'
const PORTAL_CLASS = 'Portal'
const TARGET_MAP_PROPERTY = 'targetMap'
const TARGET_SPAWN_PROPERTY = 'targetSpawn'

function collectFromObjects<T>(raw: TiledObjectsJson, read: (object: TiledObjectDef) => T | undefined): T[] {
  const results: T[] = []

  for (const layer of raw.layers) {
    if (layer.type === OBJECT_LAYER_TYPE) {
      for (const object of layer.objects ?? []) {
        const value = read(object)
        if (value) {
          results.push(value)
        }
      }
    }
  }

  return results
}

// The one non-blank-string-property lookup every Map object's string property shares.
function readNonBlankStringProperty(object: TiledObjectDef, name: string): string | undefined {
  const value = object.properties?.find((prop) => prop.name === name)?.value
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readFacing(object: TiledObjectDef): Facing {
  const raw = readNonBlankStringProperty(object, FACING_PROPERTY)
  return FACINGS.find((facing) => facing === raw) ?? DEFAULT_FACING
}

function readEntity(object: TiledObjectDef, tilewidth: number, tileheight: number): EntityObject | undefined {
  if (object.type !== ENTITY_CLASS) {return undefined}

  const entityId = readNonBlankStringProperty(object, ENTITY_ID_PROPERTY)
  if (!entityId) {return undefined}

  const topY = object.gid === undefined ? object.y : object.y - tileheight
  const characterId = readNonBlankStringProperty(object, CHARACTER_ID_PROPERTY)
  const facing = characterId && readFacing(object)
  return {
    entityId,
    x: Math.floor(object.x / tilewidth),
    y: Math.floor(topY / tileheight),
    ...(characterId && { characterId }),
    ...(facing && { facing }),
  }
}

export function collectEntities(raw: TiledObjectsJson): EntityObject[] {
  return collectFromObjects(raw, (object) => readEntity(object, raw.tilewidth, raw.tileheight))
}

// A Prop Entity is an Entity with no characterId; only one that carries a tile can be drawn.
export function collectPropTiles(raw: TiledObjectsJson): PropTile[] {
  return collectFromObjects(raw, (object) => {
    const entity = readEntity(object, raw.tilewidth, raw.tileheight)
    if (!entity || entity.characterId || object.gid === undefined) {return}
    return { gid: object.gid, x: entity.x, y: entity.y }
  })
}

function tilesInRect(start: TileCoord, count: TileCoord): TileCoord[] {
  const { x: startX, y: startY } = start
  const { x: countX, y: countY } = count

  const tiles: TileCoord[] = []
  for (let y = startY; y < startY + countY; y += 1) {
    for (let x = startX; x < startX + countX; x += 1) {
      tiles.push({ x, y })
    }
  }
  return tiles
}

// A Zone's or Portal's rectangle is authored pre-snapped to the grid (guide-enforced, not validated here).
function tilesCovered(object: TiledObjectDef, tilewidth: number, tileheight: number): TileCoord[] {
  const start = { x: Math.floor(object.x / tilewidth), y: Math.floor(object.y / tileheight) }
  const count = { x: Math.floor((object.width ?? 0) / tilewidth), y: Math.floor((object.height ?? 0) / tileheight) }
  return tilesInRect(start, count)
}

function readZone(object: TiledObjectDef, tilewidth: number, tileheight: number): ZoneObject | undefined {
  if (object.type !== ZONE_CLASS) {return undefined}

  const zoneId = readNonBlankStringProperty(object, ZONE_ID_PROPERTY)
  if (!zoneId) {return undefined}

  return { zoneId, tiles: tilesCovered(object, tilewidth, tileheight) }
}

export function collectZones(raw: TiledObjectsJson): ZoneObject[] {
  return collectFromObjects(raw, (object) => readZone(object, raw.tilewidth, raw.tileheight))
}

function readPortal(object: TiledObjectDef, tilewidth: number, tileheight: number): PortalObject | undefined {
  if (object.type !== PORTAL_CLASS) {return undefined}

  // A blank target is kept as `''`, so the Engine warns about the Portal instead of losing it silently.
  const targetMap = readNonBlankStringProperty(object, TARGET_MAP_PROPERTY) ?? ''
  const targetSpawn = readNonBlankStringProperty(object, TARGET_SPAWN_PROPERTY) ?? ''
  return { tiles: tilesCovered(object, tilewidth, tileheight), targetMap, targetSpawn }
}

export function collectPortals(raw: TiledObjectsJson): PortalObject[] {
  return collectFromObjects(raw, (object) => readPortal(object, raw.tilewidth, raw.tileheight))
}

function tileKey(tile: TileCoord): string {
  return `${tile.x},${tile.y}`
}

// The label of every region that shares at least one tile with another on the same Map.
function findOverlapping<Region extends { tiles: TileCoord[] }>(regions: Region[], labelOf: (region: Region) => string): string[] {
  const overlapping = new Set<string>()

  for (const [i, regionA] of regions.entries()) {
    const tilesA = new Set(regionA.tiles.map(tileKey))
    for (const regionB of regions.slice(i + 1)) {
      if (regionB.tiles.some((tile) => tilesA.has(tileKey(tile)))) {
        overlapping.add(labelOf(regionA))
        overlapping.add(labelOf(regionB))
      }
    }
  }

  return [...overlapping]
}

export function findOverlappingZoneIds(zones: ZoneObject[]): string[] {
  return findOverlapping(zones, (zone) => zone.zoneId)
}

// A Portal has no id of its own, so it is named by its target.
export function findOverlappingPortals(portals: PortalObject[]): string[] {
  return findOverlapping(portals, (portal) => `${portal.targetMap}/${portal.targetSpawn}`)
}
