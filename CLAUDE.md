# CLAUDE.md

RPG-gamification game-engine playground (Phaser + Tiled). See `docs/spec/spec.md` for the full spec, `CONTEXT.md` for domain vocabulary.

## Workflow

New feature work follows this flow, in order:

1. `/grill-with-docs` — sharpen the idea, writing decisions into `CONTEXT.md` and `docs/adr/`
2. `/to-spec` — collapse the grilled thread into `docs/spec/spec.md`
3. `/to-tickets` — split the spec into tracer-bullet tickets under `docs/issues/` (see existing files there for the format)
4. `/implement` per ticket

Unsure which skill applies next? `/ask-matt`.

No e2e/browser automation exists here — when a ticket needs runtime proof, ask the user to test it manually and report the result before ticking boxes or committing.

## Commits

After `/code-review`, let the user review the diff too — wait for their go-ahead before running `git commit`.

Atomic: group by logical concern (a new package, a new app, a ticket-status update are separate commits), not one commit per session. 

## Where decisions live

- Hard-to-reverse architectural decisions → `docs/adr/`, sequentially numbered
- Domain vocabulary → `CONTEXT.md`, kept a pure glossary — no implementation detail
- Ticket completion → update the ticket file in place (tick boxes, update `Status`) as its own commit
- Human-facing how-to reference (e.g. "what shape should this asset be") → `docs/guides/`, one topic per file — this is *how*, not *why* (that's an ADR) or *what's confirmed* (that's the spec)

## Assets

`assets/` (Tiled maps + tileset images) is gitignored — licensed third-party content. `apps/web/public/assets/{maps,tilesets}` are symlinks into it, not copies, so Tiled edits show up without a manual re-sync.

## Agent skills

### Issue tracker

Local markdown under `docs/issues/<NN>-<slug>.md` (numbered sequentially, no per-feature subfolder); the spec is the single, continuously-updated `docs/spec/spec.md`. See `docs/agents/issue-tracker.md`.

### Domain docs

Multi-context: shared Engine↔Host vocabulary/decisions stay at the repo root (`CONTEXT.md`, `docs/adr/`); per-package `CONTEXT.md`/`docs/adr/` under `packages/engine-core/` and `apps/web/` are created lazily if package-internal vocabulary/decisions ever emerge. See `docs/agents/domain.md`.
