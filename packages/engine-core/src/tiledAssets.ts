import { resolveTilesetAssetUrl } from './util.ts'

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
    if (!tile.properties || tile.properties.length === 0) return undefined
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
    if (!tile.animation || tile.animation.length === 0) return undefined
    return tile.animation.map((frame) => ({
      gid: firstgid + frame.tileid,
      duration: frame.duration,
    }))
  })
}

export async function collectTiledMapAssets(tiledMapUrl: string): Promise<TiledMapAssets> {
  const response = await fetch(tiledMapUrl)
  const raw = (await response.json()) as TiledMapJson
  const origin = window.location.origin
  const images: ImageToLoad[] = []

  for (const tileset of raw.tilesets) {
    if (tileset.image) {
      images.push({ key: tileset.name, url: resolveTilesetAssetUrl(tileset.image, tiledMapUrl, origin) })
    }
    for (const tile of tileset.tiles ?? []) {
      if (tile.image) {
        images.push({ key: tile.image, url: resolveTilesetAssetUrl(tile.image, tiledMapUrl, origin) })
      }
    }
  }

  return { images, tileProperties: collectTileProperties(raw), tileAnimations: collectTileAnimations(raw) }
}
