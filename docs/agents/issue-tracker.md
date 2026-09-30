# Issue tracker: GitHub

Tickets for this repo live as GitHub issues on `origin` (`Palmkonde/rpg-webbase`). Use the `gh` CLI for all operations; it infers the repo automatically when run inside this clone.

## Conventions

- The spec is a single, continuously-updated file: `docs/spec/spec.md`. Each grilling session appends/amends it in place — it is never published to the issue tracker.
- A ticket is one GitHub issue. There is no local `NN` numbering anymore — the issue number is the ticket's identifier.
- A ticket's body follows `.github/ISSUE_TEMPLATE/ticket.md` — its sections, in its order. This overrides any skill's own built-in ticket template (e.g. `/to-tickets`'s `## Parent`-first shape).
- A ticket's title is a present-tense behaviour sentence ("Walking into a Zone runs its Script, once"), with no prefix.
- One-off addenda (a dated note, why a ticket isn't ready yet) go in a comment, not the body — the body stays the template's sections only.
- Triage/completion state is the issue's own open/closed state: open = not done, closed = done. An open ticket additionally carries exactly one triage label: `ready-for-agent` once it's pickable now, `blocked` while a ticket under its `## Blocked by` is still open. The two are mutually exclusive.
- `## Blocked by` lists one `- #N — reason` bullet per blocker (GitHub auto-links `#N`), or `- None (can start immediately)` — not GitHub's native issue-dependencies API. Plain text is enough for what any skill here reads back, and it avoids resolving a database id per edge. The `blocked` label is the filterable signal; that section is still the source of truth for *which* tickets gate it.
- Hard-to-reverse architectural decisions live in `docs/adr/`, sequentially numbered, one decision per file.
- Domain vocabulary lives in `GLOSSARY.md` (see `domain.md`), kept a pure glossary.

## Operations

- **Create a ticket**: copy `.github/ISSUE_TEMPLATE/ticket.md` minus its front-matter, fill every section (dropping `## Manual verification` if unneeded, and the `<!-- -->` hints), then `gh issue create --title "..." --body-file <path>`. Apply `--label ready-for-agent` when it's pickable immediately, or `--label blocked` when its `## Blocked by` names a still-open ticket.
- **Unblock a ticket**: once every ticket under its `## Blocked by` is closed, `gh issue edit <number> --remove-label blocked --add-label ready-for-agent`.
- **Read a ticket**: `gh issue view <number> --comments`.
- **List tickets**: `gh issue list --state open --label ready-for-agent --json number,title,body,labels,comments`, adjusting filters as needed. Swap the label to `blocked` to see what's waiting on something else.
- **Comment on a ticket**: `gh issue comment <number> --body "..."`.
- **Complete a ticket**: include `Closes #<number>` in the implementing commit's message — this repo commits straight to `main`, so GitHub auto-closes the issue when that commit lands. No separate "update ticket status" commit, and no live-ticking of acceptance-criteria checkboxes as work progresses — the checklist in the issue body is the definition of done, verified before the closing commit; the issue's open/closed state is the only "is this finished" signal.

## When a skill says "publish to the issue tracker"

Create a GitHub issue (ticket-only — see spec note above).

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`. The user will normally pass the number directly.
