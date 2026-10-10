# CLAUDE.md

RPG-gamification game-engine playground (Phaser + Tiled). Full spec: `docs/spec/spec.md`; domain vocab: `GLOSSARY.md`.

## Workflow

New feature work flow, in order:

1. `/grill-with-docs` — sharpen idea, write decisions into `GLOSSARY.md` and `docs/adr/`
2. `/to-spec` — collapse grilled thread into `docs/spec/spec.md`
3. `/to-tickets` — split spec into tracer-bullet tickets, published as GitHub issues (convention: `docs/agents/issue-tracker.md`)
4. `/implement` per ticket

Unsure which skill next? `/ask-matt`.

No e2e/browser automation here. Ticket needs runtime proof → ask user test manually and report result before ticking boxes or committing.

`bun run lint` must pass clean before `/code-review`. Oxlint strict here (`.oxlintrc.json`).

Run tests with `bun run test`, not `bun test`: bare `bun test` = Bun's own runner, skips `cargo test` and clsc fixture compile (`docs/adr/0033`).

## Commits

Changes reach `main` only by PR: branch `<issue>-<slug>` → PR (`Closes #N` in body) → rebase merge once CI passes, so each atomic commit lands on `main` as-is. Never commit on `main`. Details: `docs/agents/issue-tracker.md`.

After `/code-review`, user reviews diff too. Wait for go-ahead before `git commit`.

Atomic: group by logical concern (new package, new app, docs change = separate commits), not one commit per session.

## Coding standards

`CODING_STANDARDS.md` covers judgement-call rules (names, functions, boundaries, errors, comments, tests); `/code-review` enforces it.

## Where decisions live

- Hard-to-reverse architectural decisions → `docs/adr/`, sequentially numbered
- Domain vocab → `GLOSSARY.md`, pure glossary, no implementation detail
- Ticket completion → GitHub issue closes when PR merges (`Closes #NN` in PR body or commit message). No separate ticket-status commit; acceptance-criteria checkboxes not ticked live. Issue open/closed state = "is this finished" signal
- Architecture, flow, domain diagrams → `docs/mermaid/`, one fenced `mermaid` block per file. Derived views: on conflict, ADRs, `GLOSSARY.md`, `docs/spec/spec.md` and `apps/game-service/src/schema.ts` win. Update matching diagram when one changes
- Human-facing how-to reference (e.g. "what shape should this asset be") → `docs/guides/`, one topic per file. *How*, not *why* (ADR) or *what's confirmed* (spec). `.github/workflows/wiki.yml` mirrors it to GitHub wiki on merge; edit `docs/guides/`, never wiki. Add new guide to `docs/guides/README.md`, the index (and wiki Home)

## Assets

`assets/` (maintainer content folder: `library/` + `worlds/<id>/`) gitignored. Licensed third-party content. Reaches game only via `crpg publish` to Game Service; `apps/web` holds no copy.

## Agent skills

### Issue tracker

GitHub Issues on repo `origin` (`Palmkonde/rpg-webbase`), via `gh` CLI. Spec = single, continuously-updated `docs/spec/spec.md`, never published to tracker. See `docs/agents/issue-tracker.md`.

### Domain docs

Single context: Engine↔Host vocab/decisions at repo root (`GLOSSARY.md`, `docs/adr/`). Add per-package ones plus `GLOSSARY-MAP.md` only if package-internal vocab emerges. See `docs/agents/domain.md`.