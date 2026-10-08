# CLAUDE.md

RPG-gamification game-engine playground (Phaser + Tiled). See `docs/spec/spec.md` for the full spec, `GLOSSARY.md` for domain vocabulary.

## Workflow

New feature work follows this flow, in order:

1. `/grill-with-docs` — sharpen the idea, writing decisions into `GLOSSARY.md` and `docs/adr/`
2. `/to-spec` — collapse the grilled thread into `docs/spec/spec.md`
3. `/to-tickets` — split the spec into tracer-bullet tickets, published as GitHub issues (see `docs/agents/issue-tracker.md` for the convention)
4. `/implement` per ticket

Unsure which skill applies next? `/ask-matt`.

No e2e/browser automation exists here — when a ticket needs runtime proof, ask the user to test it manually and report the result before ticking boxes or committing.

`bun run lint` must pass clean before `/code-review` — oxlint is configured strict here (`.oxlintrc.json`).

Run tests with `bun run test`, not `bun test`: the bare `bun test` is Bun's own runner and skips `cargo test` and the clsc fixture compile (`docs/adr/0033`).

## Commits

Changes reach `main` only by PR: branch `<issue>-<slug>` → PR (`Closes #N` in its body) → rebase merge once CI passes, so each atomic commit lands on `main` as-is. Never commit on `main` itself. Details in `docs/agents/issue-tracker.md`.

After `/code-review`, let the user review the diff too — wait for their go-ahead before running `git commit`.

Atomic: group by logical concern (a new package, a new app, a docs change are separate commits), not one commit per session.

## Coding standards

`CODING_STANDARDS.md` covers the judgement-call rules (names, functions, boundaries, errors, comments, tests); `/code-review` enforces it.

## Where decisions live

- Hard-to-reverse architectural decisions → `docs/adr/`, sequentially numbered
- Domain vocabulary → `GLOSSARY.md`, kept a pure glossary — no implementation detail
- Ticket completion → the GitHub issue closes when its PR merges (`Closes #NN` in the PR body or a commit message); no separate ticket-status commit, and acceptance-criteria checkboxes aren't ticked live — the issue's open/closed state is the "is this finished" signal
- Architecture, flow and domain diagrams → `docs/mermaid/`, one fenced `mermaid` block per file. These are derived views: on any conflict the ADRs, `GLOSSARY.md`, `docs/spec/spec.md` and `apps/game-service/src/schema.ts` win, so update the matching diagram when one of them changes
- Human-facing how-to reference (e.g. "what shape should this asset be") → `docs/guides/`, one topic per file — this is *how*, not *why* (that's an ADR) or *what's confirmed* (that's the spec)

## Assets

`assets/` (the maintainer's content folder: `library/` + `worlds/<id>/`) is gitignored — licensed third-party content. It reaches the game only through `crpg publish` to the Game Service; `apps/web` holds no copy of it.

## Agent skills

### Issue tracker

GitHub Issues on this repo's `origin` (`Palmkonde/rpg-webbase`), via the `gh` CLI; the spec is the single, continuously-updated `docs/spec/spec.md`, never published to the tracker. See `docs/agents/issue-tracker.md`.

### Domain docs

Single context: Engine↔Host vocabulary/decisions live at the repo root (`GLOSSARY.md`, `docs/adr/`); add per-package ones plus a `GLOSSARY-MAP.md` only if package-internal vocabulary ever emerges. See `docs/agents/domain.md`.
