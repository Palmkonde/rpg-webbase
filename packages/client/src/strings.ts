import type { Text } from '@codeleagues-rpg-engine/clsc'

export type StringTable = Record<string, Record<string, string>>

const DEFAULT_LOCALE = 'en'

export function resolveLine(key: string, locale: string, table: StringTable): string {
  return table[locale]?.[key] ?? table[DEFAULT_LOCALE]?.[key] ?? `[${key}]`
}

// A Script's text is inline or keyed (adr/0013); only a key needs the String Table.
export function resolveText(text: Text, locale: string, table: StringTable): string {
  return 'key' in text ? resolveLine(text.key, locale, table) : text.text
}
