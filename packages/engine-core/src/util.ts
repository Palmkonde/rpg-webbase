export function resolveTilesetAssetUrl(embeddedPath: string, tiledMapUrl: string, origin: string): string {
  const marker = 'tilesets/'
  const markerIndex = embeddedPath.lastIndexOf(marker)
  const stablePath = markerIndex === -1 ? embeddedPath : embeddedPath.slice(markerIndex)
  const mapUrl = new URL(tiledMapUrl, origin)
  return new URL(`../${stablePath}`, mapUrl).href
}
