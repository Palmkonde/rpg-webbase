# Tickets Are Tracked as GitHub Issues, Not Local Markdown Files

Local tickets under `docs/issues/<NN>-<slug>.md` made "is this done" only answerable by opening a file and reading a `**Status:**` line — the exact complaint that triggered this decision. We migrate ticket tracking to GitHub Issues on this repo's own `origin` (`Palmkonde/rpg-webbase`), via the `gh` CLI: `done` → closed issue, `ready-for-agent` → open issue + `ready-for-agent` label. `Blocked by:` stays a plain `#N` reference in the issue body (not GitHub's native issue-dependencies API — no UI-native chip is needed here, and it avoids resolving a database id per edge). Completing a ticket closes its issue via `Closes #NN` in the implementing commit rather than a separate ticket-file commit; acceptance criteria remain listed in the issue body but are no longer ticked box-by-box as work progresses — the issue's open/closed state alone is now the "is this finished" signal.

All 21 existing tickets migrate 1:1. The GitHub repo had zero issues and zero PRs, so migrating in ticket-number order assigns issue `#1`–`#21` matching the old `NN` numbers exactly, and every existing `Blocked by` edge already points from a higher number to a lower one, so ticket-number order is also blockers-first order. `docs/issues/` is deleted once migrated — git history retains it. The spec (`docs/spec/spec.md`) is unaffected: it stays a single continuously-updated file, never published to the issue tracker.

## Considered Options

- Kept local markdown, added a status-dashboard script — rejected, doesn't fix the root problem of tracking state living in files openable one at a time.
- GitHub's native issue-dependencies API for blocking edges — rejected as mechanical overhead (a `gh api` call per edge to resolve database ids) for no behavior difference any skill here acts on.
- Kept per-checkbox ticking as a commit-producing discipline — rejected: redundant with issue open/closed state, which is the entire point of the move.
