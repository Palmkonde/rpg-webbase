export type CgArtRegistry = Record<string, string>

const REGISTRY = {
  'intro-1': '/assets/cg/intro/1.jpg',
  'intro-2': '/assets/cg/intro/2.jpg',
  'intro-3': '/assets/cg/intro/3.jpg',
} satisfies CgArtRegistry

export function resolveCgArt(frameId: string, registry: CgArtRegistry = REGISTRY): string | undefined {
  return registry[frameId]
}
