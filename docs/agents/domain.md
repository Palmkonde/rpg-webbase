# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the shared glossary for the Engine↔Host contract (Map, Player, Entity, Transition, World Config, Engine Event, etc. — vocabulary both `packages/engine-core` and `apps/web` are built around). Always read this one.
- **`CONTEXT-MAP.md`** at the repo root: points to this root file plus any per-package `CONTEXT.md` that exists.
- **`packages/engine-core/CONTEXT.md`** and **`apps/web/CONTEXT.md`**, if they exist: vocabulary genuinely internal to that one package only. Don't assume these exist.
- **`docs/adr/`** at the repo root: system-wide decisions, including anything about the Engine↔Host boundary or contract (e.g. ADR-0001, ADR-0004).
- **`packages/engine-core/docs/adr/`** and **`apps/web/docs/adr/`**, if they exist: decisions scoped to that package alone.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. `/domain-modeling` creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is multi-context, but the split is by "shared contract vs. package-internal," not a clean per-package glossary:

```
/
├── CONTEXT-MAP.md
├── CONTEXT.md                          ← shared Engine↔Host vocabulary
├── docs/adr/                           ← system-wide / cross-package decisions
├── packages/engine-core/
│   ├── CONTEXT.md                      ← only if engine-core-only vocabulary exists (lazy)
│   └── docs/adr/                       ← only if engine-core-only decisions exist (lazy)
└── apps/web/
    ├── CONTEXT.md                      ← only if web-only vocabulary exists (lazy)
    └── docs/adr/                       ← only if web-only decisions exist (lazy)
```

As of this setup, every term in the root `CONTEXT.md` and every existing ADR in `docs/adr/` is shared/interface-level — nothing has moved into per-package files, and they don't exist yet. Only create one when a term or decision is genuinely internal to a single package.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
