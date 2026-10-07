// Keyed by Expression name as a string: a VM line's Expression comes from `prelude.clsc`, not a TS type.
export type PortraitRegistry = Record<string, Record<string, string>>

export function resolvePortrait(
  speaker: string | undefined,
  expression: string | undefined,
  registry: PortraitRegistry,
): string | undefined {
  if (speaker === undefined || expression === undefined) {
    return undefined
  }
  return registry[speaker]?.[expression]
}
