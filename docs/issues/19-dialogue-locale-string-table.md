# 19: Dialogue text resolves through a locale string table

**What to build:** Dialogue line text resolves through a small, pure, locale-keyed lookup (a string table) instead of being an inline literal in a Script, so a non-technical author could edit or translate text without touching a Script's TypeScript.

**Blocked by:** 18 (sequenced behind Speaker to avoid two tickets reshaping the Dialogue line type at once — not a hard logical dependency)

**Status:** ready-for-agent

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts: Choices, Speakers & Localization" section (Implementation Decisions: Localization) and `docs/adr/0013-dialogue-localization-is-a-string-table-not-a-reopened-adr-0009.md`.

- [ ] A new pure function resolves a line's text from a key and a locale (e.g. `resolveLine(key, locale) → text`), fixture-backed the same way `WorldConfig`/Flags already are
- [ ] The locale used is a fixture-stubbed default — no Player-facing language switcher this round
- [ ] A missing key or locale falls back predictably (e.g. to a default locale, or a visible placeholder) rather than throwing
- [ ] At least one existing Script's line(s) are authored via a string-table key instead of an inline literal, proving the mechanism end-to-end
- [ ] The locale-resolution function is unit-tested (`node:test`): given a key and locale returns the expected text, including the missing-key/missing-locale fallback case
- [ ] Manually verified: change the fixture's locale value and confirm the rendered dialogue text changes accordingly — report the result before ticking boxes or committing
