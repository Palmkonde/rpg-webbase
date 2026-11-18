---
status: accepted (supersedes the blocking clause of adr/0015)
---

# Ticket blocking uses GitHub's native issue dependencies

`adr/0015` kept `Blocked by` as plain `#N` text in the issue body and rejected GitHub's native issue dependencies because each edge needed a `gh api` call to resolve the blocker's database id. `gh` 2.94+ takes issue numbers directly (`gh issue create --blocked-by N,M`, `gh issue edit --add-blocked-by N`), so that cost is gone, and the global `/to-tickets` and `/wayfinder` skills already default to native edges. A ticket's blockers are now native issue dependencies, and those edges are the source of truth.

The `blocked` label is dropped. It copied state GitHub now tracks itself, and someone had to swap it for `ready-for-agent` by hand when the last blocker closed. Every ticket now carries `ready-for-agent` from creation. "Pickable now" means `ready-for-agent` with no open blocker, so closing a blocker unblocks its dependents with no further step.

The `## Blocked by` section stays in the ticket body as a human-readable mirror (`- #N — reason`), because the native relationship can't say *why* one ticket gates another. It's written in the same step as the edges. If the two drift, the native edge wins and the body gets fixed.

Agent queries count open blockers from `gh issue list --json blockedBy`. They don't use the `is:blocked` search qualifier, because GitHub doesn't document how it treats a closed blocker.

## Considered Options

- Keep plain-text `Blocked by` plus the `blocked` label (`adr/0015`). Rejected: the reason for it no longer holds, and the manual unblock swap is the kind of step that gets forgotten.
- Native edges only, and drop the body section. Rejected: the reason a ticket is blocked is worth reading, and only the body can carry it.
- Keep `ready-for-agent` off a ticket until it's unblocked. Rejected: blocked tickets would carry no triage label at all, and the manual swap would stay.
