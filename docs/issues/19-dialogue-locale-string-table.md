# 19: Dialogue text resolves through a locale string table

**What to build:** Dialogue line text resolves through a small, pure, locale-keyed lookup (a string table) instead of being an inline literal in a Script, so a non-technical author could edit or translate text without touching a Script's TypeScript.

**Blocked by:** 18 (sequenced behind Speaker to avoid two tickets reshaping the Dialogue line type at once — not a hard logical dependency)

**Status:** done

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts: Choices, Speakers & Localization" section (Implementation Decisions: Localization) and `docs/adr/0013-dialogue-localization-is-a-string-table-not-a-reopened-adr-0009.md`.

**Implementation notes:** `state/strings.ts`'s `resolveLine(key, locale, table = <fixture>)` is a pure lookup with a predictable fallback chain — requested locale → `en` (the hardcoded default locale) → a `[key]` placeholder — and never throws; fixture-backed via `fixtures/strings.json` (`{ locale, table }`), mirroring `student-state.json`'s shape, with `currentLocale` exported the same way `currentStudentId` already is. `ScriptContext` is unchanged (still just `{ flags }`) — `currentLocale` is imported directly by `entities/CampFire.ts`, the same way `currentStudentId` is a Host-side fixture-stubbed global that Scripts never receive via `ctx` either. `entities/CampFire.ts`'s greeting line is now authored via `resolveLine('campfire.greeting'/'campfire.greeting_returning', currentLocale)` instead of an inline literal, proving the mechanism end-to-end; other lines (e.g. `'Go away!'`) stay inline literals, since only one line needed converting per this ticket's scope.

- [x] A new pure function resolves a line's text from a key and a locale (e.g. `resolveLine(key, locale) → text`), fixture-backed the same way `WorldConfig`/Flags already are — `state/strings.ts`
- [x] The locale used is a fixture-stubbed default — no Player-facing language switcher this round — `currentLocale` in `state/strings.ts`, sourced from `fixtures/strings.json`
- [x] A missing key or locale falls back predictably (e.g. to a default locale, or a visible placeholder) rather than throwing — `resolveLine`'s fallback chain
- [x] At least one existing Script's line(s) are authored via a string-table key instead of an inline literal, proving the mechanism end-to-end — `entities/CampFire.ts`'s greeting line
- [x] The locale-resolution function is unit-tested (`node:test`): given a key and locale returns the expected text, including the missing-key/missing-locale fallback case — `strings.test.ts`
- [x] Manually verified: change the fixture's locale value and confirm the rendered dialogue text changes accordingly — report the result before ticking boxes or committing — confirmed by the user: switching `fixtures/strings.json`'s `locale` from `en` to `th` changed the CampFire greeting to the Thai text
