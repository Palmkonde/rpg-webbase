# 21: Dialogue lines reveal one at a time, click to advance

**What to build:** Within a Dialogue round, at most one line (Speaker + text) is visible in the overlay at a time. Clicking the dialogue box advances to the next line, replacing the current one. Once the round's last line is showing, the box's click-to-advance stops and the round's choices/Close render as they do today. A visual cue indicates when more lines remain.

**Blocked by:** 18

**Status:** ready-for-agent

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Line Pacing" section, and `docs/adr/0011-dialogue-v1-does-not-pause-the-player.md` (reaffirmed, not reopened — this stays a non-blocking, Player-click-paced overlay, no Engine involvement).

- [ ] Only one line is visible at a time; advancing replaces it — no scrollback accumulates within a round
- [ ] Clicking anywhere on the dialogue box advances to the next line while lines remain
- [ ] Once the last line is showing, box clicks do nothing further — choices (if any) and Close render in its place, using ticket 16's existing `visible`/`enabled` logic unchanged
- [ ] A single-line round shows its one line immediately, no click required
- [ ] A choices-only round (no lines) shows its choices immediately
- [ ] The visible line resets to the first whenever a new Dialogue round is shown (fresh Script run, or a choice's `next` continuation)
- [ ] Close remains visible and clickable at every point, including mid-pagination
- [ ] A visual cue shows while more lines remain, and disappears on the last line
- [ ] The click target is a real interactive element (e.g. a `<button>`), not a bare `<div onClick>` — satisfies this repo's `jsx-a11y` lint rules
- [ ] Manually verified: interact with a Scripted Entity whose round stages two different speakers (the `CampFire` narrator round from ticket 18 already fits) — confirm one-at-a-time reveal, click-to-advance, the cue's presence/absence, and choices/Close appearing only on the last line — report the result before ticking boxes or committing
