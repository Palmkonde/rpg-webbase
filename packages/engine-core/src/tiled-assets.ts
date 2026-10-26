import type { EntityObject, PortalObject, PropTile, TiledObjectsJson, ZoneObject } from './map-objects.ts'
import { collectEntities, collectPortals, collectPropTiles, collectZones } from './map-objects.ts'
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

export interface ImageToLoad {
  key: string
  url: string
}

export interface AnimationFrame {
  gid: number
  duration: number
}

export interface TiledMapAssets {
  images: ImageToLoad[]
  tileProperties: Map<number, Record<string, unknown>>
  tileAnimations: Map<number, AnimationFrame[]>
  tileImages: Map<number, string>
  entities: EntityObject[]
  propTiles: PropTile[]
  zones: ZoneObject[]
  portals: PortalObject[]
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
    portals: collectPortals(raw),
  }
}
