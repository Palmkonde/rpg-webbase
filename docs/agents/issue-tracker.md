# Issue tracker: GitHub

Tickets for this repo live as GitHub issues on `origin` (`Palmkonde/rpg-webbase`). Use the `gh` CLI for all operations; it infers the repo automatically when run inside this clone.

## Conventions

- The spec lives in `docs/spec/`: one file per feature, grouped by domain (`docs/spec/<domain>/<feature>.md`: `world`, `content`, `language`, `platform`), indexed by `docs/spec/README.md`, which also holds the cross-cutting decisions. A grilling session adds a new feature file or amends an existing one in place, and adds a new file to the index — the spec is never published to the issue tracker.
- A ticket is one GitHub issue. There is no local `NN` numbering anymore — the issue number is the ticket's identifier.
- A ticket's body follows `.github/ISSUE_TEMPLATE/ticket.md` — its sections, in its order. This overrides any skill's own built-in ticket template (e.g. `/to-tickets`'s `## Parent`-first shape).
- A ticket's title is a present-tense behaviour sentence ("Walking into a Zone runs its Script, once"), with no prefix.
- One-off addenda (a dated note, why a ticket isn't ready yet) go in a comment, not the body — the body stays the template's sections only.
- Triage/completion state is the issue's own open/closed state: open = not done, closed = done. Every ticket carries the `ready-for-agent` label from creation.
- Blockers are GitHub's native issue dependencies (`adr/0049`), the source of truth for which tickets gate which. A ticket is pickable now when it's open, labelled `ready-for-agent`, and has no open blocker. Closing the last blocker unblocks it, with no label to swap.
- `## Blocked by` mirrors the native edges for human readers: one `- #N — reason` bullet per blocker (GitHub auto-links `#N`), or `- None (can start immediately)`. Write it in the same step as the edges. If the two drift, the native edge wins and the body gets fixed.
- Hard-to-reverse architectural decisions live in `docs/adr/`, sequentially numbered, one decision per file.
- Domain vocabulary lives in `GLOSSARY.md` (see `domain.md`), kept a pure glossary.

## Operations

- **Create a ticket**: copy `.github/ISSUE_TEMPLATE/ticket.md` minus its front-matter, fill every section (dropping `## Manual verification` if unneeded, and the `<!-- -->` hints), then `gh issue create --title "..." --label ready-for-agent --blocked-by <n>,<n> --body-file <path>`, dropping `--blocked-by` when there are no blockers. Create blockers first so their numbers exist. To add a blocker later: `gh issue edit <number> --add-blocked-by <n>`, and add the matching `## Blocked by` bullet too.
- **Read a ticket**: `gh issue view <number> --comments` (its "Blocked by" row lists the native edges).
- **List pickable tickets**: `gh issue list --state open --label ready-for-agent --limit 200 --json number,title,body,labels,comments,blockedBy --jq '.[] | select([.blockedBy.nodes[]? | select(.state == "OPEN")] | length == 0)'`. Flip `== 0` to `> 0` to see what's waiting on something else. Filter `blockedBy` like this rather than with the `is:blocked` search qualifier, because GitHub doesn't document how that qualifier treats a closed blocker. Keep `--limit` above the open-issue count: the filtering happens after the fetch.
- **Comment on a ticket**: `gh issue comment <number> --body "..."`.
- **Complete a ticket**: work on a branch named `<issue>-<slug>`, push it, and open a PR to `main` (`gh pr create`, body written with the `/pr` skill) with `Closes #<number>` in its body or a commit message. `main` only accepts PRs that pass the `lint`, `typecheck` and `test` checks, merged by rebase so atomic commits survive; GitHub auto-closes the issue when the PR merges and deletes the branch. No separate "update ticket status" commit, and no live-ticking of acceptance-criteria checkboxes as work progresses — the checklist in the issue body is the definition of done, verified before the PR merges; the issue's open/closed state is the only "is this finished" signal.

## Feature requests

Anyone asking for something new (a Platform developer, a future adopter of this project, or the maintainer transcribing one) files it with `.github/ISSUE_TEMPLATE/feature-request.yml`. A request is not a ticket: it answers "should we, and how?"; the tickets it spawns answer "is it built?".

- **Title**: a question with a `[Request] ` prefix ("[Request] Can a Script move the Player to another Map and Spawn Point?"). This is the one exception to the no-prefix title rule above, which covers tickets.
- **Lifecycle**: filed with `enhancement` + `needs-triage` → `/triage` (to `needs-info` while waiting on the filer) → `/grill-with-docs`, which records decisions in `GLOSSARY.md` and `docs/adr/` as usual → a Decision comment, then:
  - **Accepted**: `/to-spec` → `/to-tickets`, then close the request as completed. Closed means decided, not built: the tickets listed in its Decision comment track the build from there.
  - **Declined**: label `wontfix`, write or extend `.out-of-scope/<concept>.md` (the `/triage` knowledge base, one file per concept), close as not planned.
  - **Deferred**: close as not planned, with a "Revisit when" line naming what would reopen it, and no `.out-of-scope/` entry, since it isn't rejected.
- An accepted request never takes `/triage`'s `ready-for-agent`/`ready-for-human` shortcut: it always goes through the spec and tickets.
- **Decision comment** (an agent posting it starts with `/triage`'s AI disclaimer line):

  ```markdown
  ## Decision: Accepted | Declined | Deferred

  **Why:** <one paragraph>

  **Recorded in:** ADR-00NN, docs/spec/<domain>/<feature>.md, GLOSSARY terms touched
  **Tickets:** #N, #N                          ← Accepted only
  **Revisit when:** <trigger>                  ← Deferred only
  **Out of scope:** .out-of-scope/<concept>.md ← Declined only
  ```

## Triage labels

`/triage`'s canonical roles map to these labels:

| Role              | Label             | Notes                                                    |
| ----------------- | ----------------- | -------------------------------------------------------- |
| `bug`             | `bug`             |                                                          |
| `enhancement`     | `enhancement`     | Every feature request                                    |
| `needs-triage`    | `needs-triage`    | Applied by the feature-request form                      |
| `needs-info`      | `needs-info`      | Waiting on the filer                                     |
| `ready-for-agent` | `ready-for-agent` | Tickets only (see Conventions); not used for requests    |
| `ready-for-human` | none              | Not used                                                 |
| `wontfix`         | `wontfix`         | Declined requests                                        |

Tickets (issues labelled `ready-for-agent`, with no category label) are outside `/triage`'s scope: it never re-triages them.

**PRs as a request surface: no.** A PR that proposes a new feature is pointed at the feature-request form, so the decision is grilled before code is reviewed.

## Wayfinding operations

For `/wayfinder` efforts. The rules above still hold, with these differences:

- **Map**: one issue labelled `wayfinder:map`, with the body in the wayfinder skill's map shape.
- **Child ticket**: a decision ticket, labelled one of `wayfinder:research` / `prototype` / `grilling` / `task`. Its body is `## Question` followed by `## Blocked by`, not `ticket.md`. Blocking works as above: native edges, a mirrored `## Blocked by`, and `ready-for-agent` from creation. Link it to the map as a GitHub sub-issue: `gh api -X POST repos/Palmkonde/rpg-webbase/issues/<map>/sub_issues -F sub_issue_id=$(gh api repos/Palmkonde/rpg-webbase/issues/<child> --jq .id)`.
- **Frontier**: `gh issue list --state open --label ready-for-agent --limit 200 --json number,title,labels,assignees,parent,blockedBy --jq '.[] | select(.parent.number == <map> and .assignees == [] and ([.blockedBy.nodes[]? | select(.state == "OPEN")] | length == 0)) | "#\(.number) \(.title) \([.labels[].name])"'`.
- **Claim**: `gh issue edit <n> --add-assignee @me` before any work.
- **Resolve**: post the answer with `gh issue comment`, then `gh issue close <n>`, then add a line to the map's `## Decisions so far`. Closing the issue unblocks its dependents.
- Build tickets that come out of a map (via `/to-tickets`) use `ticket.md` as usual, and are also linked as sub-issues of the map.

## When a skill says "publish to the issue tracker"

Create a GitHub issue (ticket-only — see spec note above).

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`. The user will normally pass the number directly.
