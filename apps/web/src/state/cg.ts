export interface CgFrame {
  art: string
  captionKey: string
}

export type CgRegistry = Record<string, CgFrame[]>

// Not in scripts/: per CONTEXT.md a Script runs for an Entity/Map Event — a CG has neither.
const REGISTRY = {
  intro: [
    { art: 'intro-1', captionKey: 'cg.intro.1' },
    { art: 'intro-2', captionKey: 'cg.intro.2' },
    { art: 'intro-3', captionKey: 'cg.intro.3' },
  ],
} satisfies CgRegistry

export function resolveCg(id: string, registry: CgRegistry = REGISTRY): CgFrame[] | undefined {
  return registry[id]
}
