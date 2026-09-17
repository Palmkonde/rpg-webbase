interface TiledTilePropertyDef {
  name: string
  value: unknown
}

interface TiledTileDef {
  id: number
  image?: string
  properties?: TiledTilePropertyDef[]
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

export interface TiledMapAssets {
  images: ImageToLoad[]
  tileProperties: Map<number, Record<string, unknown>>
}

// Extract properites from Tiled
export function collectTileProperties(raw: TiledMapJson): Map<number, Record<string, unknown>> {
  const properties = new Map<number, Record<string, unknown>>()

  for (const tileset of raw.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (!tile.properties || tile.properties.length === 0) continue
      const gid = tileset.firstgid + tile.id
      const merged: Record<string, unknown> = {}
      for (const prop of tile.properties) {
        merged[prop.name] = prop.value
      }
      properties.set(gid, merged)
    }
  }

  return properties
}

export function resolveTilesetAssetUrl(embeddedPath: string, tiledMapUrl: string, origin: string): string {
  const marker = 'tilesets/'
  const markerIndex = embeddedPath.lastIndexOf(marker)
  const stablePath = markerIndex === -1 ? embeddedPath : embeddedPath.slice(markerIndex)
  const mapUrl = new URL(tiledMapUrl, origin)
  return new URL(`../${stablePath}`, mapUrl).href
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

  return { images, tileProperties: collectTileProperties(raw) }
}
