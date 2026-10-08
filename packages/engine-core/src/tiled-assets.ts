import { MapFileError } from './map-file-error.ts'

interface TiledTilePropertyDef {
  name: string
  value: unknown
}

interface TiledAnimationFrameDef {
  tileid: number
  duration: number
}

interface TiledTileDef {
  id: number
  image?: string
  properties?: TiledTilePropertyDef[]
  animation?: TiledAnimationFrameDef[]
}

interface TiledTilesetDef {
  name: string
  firstgid: number
  image?: string
  tiles?: TiledTileDef[]
}

interface TiledMapJson {
  tilesets: TiledTilesetDef[]
}

interface TiledObjectDef {
  name: string
  type?: string
  x: number
  y: number
  width?: number
  height?: number
  gid?: number
  properties?: TiledTilePropertyDef[]
}

interface TiledLayerDef {
  type: string
  objects?: TiledObjectDef[]
}

interface TiledObjectsJson {
  layers: TiledLayerDef[]
  tilewidth: number
  tileheight: number
}

export interface ImageToLoad {
  key: string
  url: string
}

export interface AnimationFrame {
  gid: number
  duration: number
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

export interface TiledMapAssets {
  images: ImageToLoad[]
  tileProperties: Map<number, Record<string, unknown>>
  tileAnimations: Map<number, AnimationFrame[]>
  tileImages: Map<number, string>
  entities: EntityObject[]
  propTiles: PropTile[]
  zones: ZoneObject[]
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

// The one non-blank-string-property lookup every Entity and Zone string property shares.
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

// A Zone's rectangle is authored pre-snapped to the grid (guide-enforced, not validated here).
function readZone(object: TiledObjectDef, tilewidth: number, tileheight: number): ZoneObject | undefined {
  if (object.type !== ZONE_CLASS) {return undefined}

  const zoneId = readNonBlankStringProperty(object, ZONE_ID_PROPERTY)
  if (!zoneId) {return undefined}

  const start = { x: Math.floor(object.x / tilewidth), y: Math.floor(object.y / tileheight) }
  const count = { x: Math.floor((object.width ?? 0) / tilewidth), y: Math.floor((object.height ?? 0) / tileheight) }

  return { zoneId, tiles: tilesInRect(start, count) }
}

export function collectZones(raw: TiledObjectsJson): ZoneObject[] {
  return collectFromObjects(raw, (object) => readZone(object, raw.tilewidth, raw.tileheight))
}

function tileKey(tile: TileCoord): string {
  return `${tile.x},${tile.y}`
}

// Every zoneId that shares at least one tile with another Zone on the same Map.
export function findOverlappingZoneIds(zones: ZoneObject[]): string[] {
  const overlapping = new Set<string>()

  for (const [i, zoneA] of zones.entries()) {
    const tilesA = new Set(zoneA.tiles.map(tileKey))
    for (const zoneB of zones.slice(i + 1)) {
      if (zoneB.tiles.some((tile) => tilesA.has(tileKey(tile)))) {
        overlapping.add(zoneA.zoneId)
        overlapping.add(zoneB.zoneId)
      }
    }
  }

  return [...overlapping]
}

// Build a gid-keyed Map by extracting one value per tile across all tilesets
function collectByTile<T>(
  raw: TiledMapJson,
  extract: (tile: TiledTileDef, firstgid: number) => T | undefined,
): Map<number, T> {
  const result = new Map<number, T>()

  for (const tileset of raw.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      const value = extract(tile, tileset.firstgid)
      if (value !== undefined) {
        result.set(tileset.firstgid + tile.id, value)
      }
    }
  }

  return result
}

// Extract properites from Tiled
export function collectTileProperties(raw: TiledMapJson): Map<number, Record<string, unknown>> {
  return collectByTile(raw, (tile) => {
    if (!tile.properties || tile.properties.length === 0) {return}
    const merged: Record<string, unknown> = {}
    for (const prop of tile.properties) {
      merged[prop.name] = prop.value
    }
    return merged
  })
}

// Extract per-tile animation frames from Tiled, keyed by the animated tile's own gid
export function collectTileAnimations(raw: TiledMapJson): Map<number, AnimationFrame[]> {
  return collectByTile(raw, (tile, firstgid) => {
    if (!tile.animation || tile.animation.length === 0) {return}
    return tile.animation.map((frame) => ({
      gid: firstgid + frame.tileid,
      duration: frame.duration,
    }))
  })
}

// Texture key (matching collectImages) of each image-collection tile, keyed by gid
export function collectTileImages(raw: TiledMapJson): Map<number, string> {
  return collectByTile(raw, (tile) => tile.image)
}

// Walk every tileset/tile image reference: Publish already rewrote each to a key (adr/0035), so its URL is the key under the asset base.
export function collectImages(raw: TiledMapJson, assetBaseUrl: string): ImageToLoad[] {
  return raw.tilesets.flatMap((tileset) => [
    ...(tileset.image ? [{ key: tileset.name, url: assetBaseUrl + tileset.image }] : []),
    ...(tileset.tiles ?? []).flatMap((tile) => (tile.image ? [{ key: tile.image, url: assetBaseUrl + tile.image }] : [])),
  ])
}

// Main return and entry. To debug read this function first
export async function collectTiledMapAssets(tiledMapUrl: string, assetBaseUrl: string): Promise<TiledMapAssets> {
  const response = await fetch(tiledMapUrl)
  if (!response.ok) {
    throw new MapFileError(tiledMapUrl, response.status)
  }
  const raw = (await response.json()) as TiledMapJson & TiledObjectsJson

  return {
    images: collectImages(raw, assetBaseUrl),
    tileProperties: collectTileProperties(raw),
    tileAnimations: collectTileAnimations(raw),
    tileImages: collectTileImages(raw),
    entities: collectEntities(raw),
    propTiles: collectPropTiles(raw),
    zones: collectZones(raw),
  }
}
