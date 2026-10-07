export interface CgFrame {
  art: string
  captionKey: string
}

export type CgRegistry = Record<string, CgFrame[]>

export function resolveCg(id: string, registry: CgRegistry): CgFrame[] | undefined {
  return registry[id]
}

export type CgArtRegistry = Record<string, string>

export function resolveCgArt(frameId: string, registry: CgArtRegistry): string | undefined {
  return registry[frameId]
}
