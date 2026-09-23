import seed from '../fixtures/strings.json' with { type: 'json' }

export type StringTable = Record<string, Record<string, string>>

const DEFAULT_LOCALE = 'en'

export function resolveLine(key: string, locale: string, table: StringTable = seed.table): string {
  return table[locale]?.[key] ?? table[DEFAULT_LOCALE]?.[key] ?? `[${key}]`
}

// The Host's fixture-stubbed default locale, mirroring `currentStudentId` in `flags.ts` until a real locale-selection mechanism exists.
export const currentLocale: string = seed.locale
