interface TiledTileDef {
  image?: string
}

interface TiledTilesetDef {
  name: string
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

export function resolveTilesetAssetUrl(embeddedPath: string, tiledMapUrl: string, origin: string): string {
  const marker = 'tilesets/'
  const markerIndex = embeddedPath.lastIndexOf(marker)
  const stablePath = markerIndex === -1 ? embeddedPath : embeddedPath.slice(markerIndex)
  const mapUrl = new URL(tiledMapUrl, origin)
  return new URL(`../${stablePath}`, mapUrl).href
}

export async function collectTilesetImages(tiledMapUrl: string): Promise<ImageToLoad[]> {
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

  return images
}
