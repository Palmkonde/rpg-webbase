# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files under `docs/`.

## Conventions

- The spec is a single, continuously-updated file: `docs/spec/spec.md`. Each grilling session appends/amends it in place — there's no per-feature spec file.
- Implementation issues are one file per ticket at `docs/issues/<NN>-<slug>.md`, numbered sequentially across the whole repo, never a single combined tickets file.
- Triage/completion state is recorded as a `**Status:**` line near the top of each issue file (e.g. `ready-for-agent`, `done`).
- Hard-to-reverse architectural decisions live in `docs/adr/`, sequentially numbered, one decision per file.
- Domain vocabulary lives in `CONTEXT.md` (see `domain.md`), kept a pure glossary.

## When a skill says "publish to the issue tracker"

Create a new file at `docs/issues/<NN>-<slug>.md`, where `NN` is one greater than the highest existing ticket number in `docs/issues/`.

## When a skill says "fetch the relevant ticket"

Read the file at `docs/issues/<NN>-<slug>.md`. The user will normally pass the number or slug directly.

## Ticket completion

Per `CLAUDE.md`: update the ticket file in place (tick its boxes, update `**Status:**`) as its own commit — there's no external tracker to close anything on.
