# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the shared glossary for the Engine↔Host contract (Map, Player, Entity, Transition, World Config, Engine Event, etc.). Always read this one.
- **`docs/adr/`** at the repo root: decisions, including anything about the Engine↔Host boundary or contract (e.g. ADR-0001, ADR-0004).

If either doesn't exist, **proceed silently**. `/domain-modeling` creates them lazily.

## File structure

Single context. Every term in `GLOSSARY.md` and every ADR in `docs/adr/` is shared/interface-level, split by contract-sharing rather than per-package.

```
/
├── GLOSSARY.md      ← shared Engine↔Host vocabulary
└── docs/adr/        ← decisions
```

If a term or decision ever becomes genuinely internal to `packages/engine-core` or `apps/web`, give that package its own `GLOSSARY.md`/`docs/adr/` and add a root `GLOSSARY-MAP.md` (per `/domain-modeling`'s format).

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
