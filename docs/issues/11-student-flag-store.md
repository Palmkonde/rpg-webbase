# 11: Per-Student Flag store

**What to build:** A Host-side store for small per-Student key/value Flags, backed by a local fixture shaped like a plausible future real-backend response — proving the mechanism in isolation, with no Entity/Script/Dialogue involved yet.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Architecture note:** see `CONTEXT.md`'s "Flag" definition and `docs/spec/spec.md`'s "Dialogue Scripts" section. Mirrors the existing `apps/web/src/fixtures/world-config.json` fixture pattern (`docs/spec/spec.md`'s "Playground-specific scaffolding").

- [ ] `WorldConfig` gains a Student-identity field (it currently has none)
- [ ] A per-Student Flag store (`Record<string, boolean | number | string>`) can be read and set, keyed by that Student id
- [ ] The store is backed by a local JSON fixture shaped like a plausible future real API response, behind one small module — swapping it for a real fetch later requires no change to callers
- [ ] A given Student's Flags can be inspected in one place for debugging
- [ ] Get/set behavior is unit-tested (`node:test`, matching `packages/engine-core/test/`'s existing pattern) — no Script, Dialogue, or Entity needed to exercise this ticket
