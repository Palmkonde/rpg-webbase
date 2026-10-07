export type CgArtRegistry = Record<string, string>

export function resolveCgArt(frameId: string, registry: CgArtRegistry): string | undefined {
  return registry[frameId]
}
