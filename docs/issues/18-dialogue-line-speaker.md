# 18: Dialogue lines carry a Speaker

**What to build:** Each Dialogue line can be attributed to a Speaker — defaulting to the owning Entity's name, but overridable to a different character or an unplaced narrator — and the Host-side overlay renders it per line.

**Blocked by:** 12

**Status:** ready-for-agent

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts: Choices, Speakers & Localization" section (Implementation Decisions: Speaker) and `CONTEXT.md`'s "Content" vocabulary (Speaker).

- [ ] A Dialogue line carries an optional `speaker` field (a plain string, not tied to `entityId`)
- [ ] When a line's `speaker` is omitted, it defaults to the owning Entity's display name
- [ ] A Script can set a different speaker per line, including a speaker with no corresponding Entity in the world (e.g. a narrator)
- [ ] The Host-side overlay renders each line's resolved speaker distinctly (e.g. a name label ahead of the line's text)
- [ ] The `ScriptBuilder`'s per-line speaker output is unit-tested (`node:test`)
- [ ] Manually verified: interact with a Scripted Entity whose Script stages two different speakers (or a narrator) across its lines, and confirm the overlay shows each one distinctly — report the result before ticking boxes or committing
