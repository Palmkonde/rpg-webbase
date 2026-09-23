import type { Expression } from '../scripts/script.ts'

export type PortraitRegistry = Record<string, Partial<Record<Expression, string>>>

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
  expression: Expression | undefined,
  registry: PortraitRegistry = REGISTRY,
): string | undefined {
  if (speaker === undefined || expression === undefined) {
    return undefined
  }
  return registry[speaker]?.[expression]
}
