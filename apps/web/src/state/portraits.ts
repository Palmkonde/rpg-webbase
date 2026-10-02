// Keyed by Expression name as a string: a VM line's Expression comes from `prelude.clsc`, not a TS type.
export type PortraitRegistry = Record<string, Record<string, string>>

const REGISTRY = {
  Campfire: {
    Neutral: '/assets/portraits/campfire/neutral.png',
    Happy: '/assets/portraits/campfire/happy.png',
    Sad: '/assets/portraits/campfire/sad.png',
  },
  Narrator: {
    Sad: '/assets/portraits/narrator/sad.png',
  },
} satisfies PortraitRegistry

export function resolvePortrait(
  speaker: string | undefined,
  expression: string | undefined,
  registry: PortraitRegistry = REGISTRY,
): string | undefined {
  if (speaker === undefined || expression === undefined) {
    return undefined
  }
  return registry[speaker]?.[expression]
}
