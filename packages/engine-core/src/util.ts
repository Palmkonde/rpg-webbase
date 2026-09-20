export function resolveTilesetAssetUrl(embeddedPath: string, tiledMapUrl: string, origin: string): string {
  const marker = 'tilesets/'
  const markerIndex = embeddedPath.lastIndexOf(marker)
  const stablePath = markerIndex === -1 ? embeddedPath : embeddedPath.slice(markerIndex)
  const mapUrl = new URL(tiledMapUrl, origin)
  return new URL(`../${stablePath}`, mapUrl).href
}

export interface CameraBounds {
  x: number
  y: number
  width: number
  height: number
}

// Camera bounds start at the map's origin — Tiled maps have no negative-coordinate content.
export function computeCameraBounds(mapWidthInPixels: number, mapHeightInPixels: number): CameraBounds {
  return { x: 0, y: 0, width: mapWidthInPixels, height: mapHeightInPixels }
}

// Every value that appears more than once in the input, each reported once.
export function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }
  return [...duplicates]
}
