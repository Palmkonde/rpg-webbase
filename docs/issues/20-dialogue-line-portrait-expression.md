# 20: Dialogue lines show a Portrait by Expression

**What to build:** A Dialogue line can select a Portrait via a fixed Expression value, bundled with its Speaker — the Host-side overlay renders the matching illustration, or falls back to text-only when none exists.

**Blocked by:** 18

**Status:** ready-for-agent

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Portraits & Expressions" section and `docs/adr/0014-dialogue-portraits-are-a-standalone-asset-type.md`.

- [ ] Expression is a fixed, closed TypeScript union/enum (`Neutral | Happy | Sad | Angry | Surprised`); a Script can only request a value from this set
- [ ] A line's Portrait selection is bundled into the same per-line option as Speaker (not a separate builder step)
- [ ] Portrait art lives in its own asset location, independent of the character-spritesheet pipeline — no dependency on the Speaker having an Entity, Player character, or spritesheet
- [ ] A pure function resolves (Speaker, Expression) to a Portrait asset reference or `undefined`; `undefined` renders as text-only with no warning
- [ ] The Host-side overlay renders the resolved Portrait image alongside its line when one exists
- [ ] The `ScriptBuilder`'s portrait/Expression output and the Portrait-resolution function are both unit-tested (`node:test`)
- [ ] Manually verified: interact with a Scripted Entity whose lines cycle through a few Expressions with authored art, confirm the Portrait changes per line, and confirm a line with no matching Portrait art still renders correctly as text-only — report the result before ticking boxes or committing
