# 11: Per-Student Flag store

**What to build:** A Host-side store for small per-Student key/value Flags, backed by a local fixture shaped like a plausible future real-backend response — proving the mechanism in isolation, with no Entity/Script/Dialogue involved yet.

**Blocked by:** None (can start immediately)

**Status:** done

**Architecture note:** see `CONTEXT.md`'s "Flag" definition and `docs/spec/spec.md`'s "Dialogue Scripts" section. Mirrors the existing `apps/web/src/fixtures/world-config.json` fixture pattern (`docs/spec/spec.md`'s "Playground-specific scaffolding").

**Implementation deviation from the ticket text:** Student identity does *not* live on `engine-core`'s `WorldConfig` — the Engine has no use for it, and ADR-0001 already committed the Engine to being stateless with all state owned by the Host. It instead lives entirely Host-side, in the new `apps/web/src/fixtures/student-state.json` seed and the `flags.ts` module built on it. `WorldConfig` is untouched. (Corrected from an earlier draft of this note, which mis-cited ADR-0004 — that ADR is about `EngineEvent` union sizing, not state ownership.) `docs/spec/spec.md`'s "Dialogue Scripts" section is updated to match.

- [x] A Student-identity concept exists Host-side (in the new fixture/module, not on `WorldConfig` — see deviation note above)
- [x] A per-Student Flag store (`Record<string, boolean | number | string>`) can be read and set, keyed by that Student id — `apps/web/src/state/flags.ts`'s `createFlagStore`/`flagStore`, `getFlags`/`setFlags`
- [x] The store is backed by a local JSON fixture shaped like a plausible future real API response, behind one small module — `getFlags`/`setFlags` are async so swapping the in-memory Map for a real fetch later requires no change to callers (code review caught that a synchronous signature would have made this false)
- [x] A given Student's Flags can be inspected in one place for debugging — `getFlags(studentId)` is the single, complete read path
- [x] Get/set behavior is unit-tested (`node:test`, matching `packages/engine-core/test/`'s existing pattern) — no Script, Dialogue, or Entity needed to exercise this ticket. Also wired up `apps/web`'s first `test` script (it had none) and folded it into the root `npm test` across all workspaces.
