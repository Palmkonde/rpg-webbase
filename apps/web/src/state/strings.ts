import type { Text } from '@codeleagues-rpg-engine/clsc'
import seed from '../fixtures/strings.json' with { type: 'json' }

export type StringTable = Record<string, Record<string, string>>

const DEFAULT_LOCALE = 'en'

export function resolveLine(key: string, locale: string, table: StringTable = seed.table): string {
  return table[locale]?.[key] ?? table[DEFAULT_LOCALE]?.[key] ?? `[${key}]`
}

// A Script's text is inline or keyed (adr/0013); only a key needs the String Table.
export function resolveText(text: Text, locale: string): string {
  return 'key' in text ? resolveLine(text.key, locale) : text.text
}

// The Host's fixture-stubbed default locale, mirroring `currentStudentId` in `flags.ts` until a real locale-selection mechanism exists.
export const currentLocale: string = seed.locale
