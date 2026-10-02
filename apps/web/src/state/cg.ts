export interface CgFrame {
  art: string
  captionKey: string
}

export type CgRegistry = Record<string, CgFrame[]>

const INTRO_FRAMES: CgFrame[] = [
  { art: 'intro-1', captionKey: 'cg.intro.1' },
  { art: 'intro-2', captionKey: 'cg.intro.2' },
  { art: 'intro-3', captionKey: 'cg.intro.3' },
]

// Not in scripts/: per GLOSSARY.md a Script runs for an Entity/Map Event — a CG has neither.
const REGISTRY = {
  intro: INTRO_FRAMES,

  // Declared in `campfire.clsc`, whose once-only Flag is its own, so it doesn't share intro_seen.
  campfire_vision: INTRO_FRAMES,
} satisfies CgRegistry

export function resolveCg(id: string, registry: CgRegistry = REGISTRY): CgFrame[] | undefined {
  return registry[id]
}
