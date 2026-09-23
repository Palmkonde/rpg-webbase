# 21: Dialogue lines reveal one at a time, click to advance

**What to build:** Within a Dialogue round, at most one line (Speaker + text) is visible in the overlay at a time. Clicking the dialogue box advances to the next line, replacing the current one. Once the round's last line is showing, the box's click-to-advance stops and the round's choices/Close render as they do today. A visual cue indicates when more lines remain.

**Blocked by:** 18

**Status:** done

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Line Pacing" section, and `docs/adr/0011-dialogue-v1-does-not-pause-the-player.md` (reaffirmed, not reopened — this stays a non-blocking, Player-click-paced overlay, no Engine involvement).

**Implementation notes:** all in `dialogue-overlay.tsx` — no `Dialogue`/`DialogueLine`/`ScriptBuilder` changes, matching the spec. A new `usePaginatedLines` hook (module-scope, unexported, single call site) owns the current-line index and resets it during render (React's documented "adjust state on prop identity change" pattern, not a `useEffect`, avoiding a flashed intermediate frame) whenever a new `Dialogue` object arrives — holds for both a fresh top-level Script run and a `choice.next(ctx)` continuation, since `ScriptBuilder.build()` always returns a new object. `hasMoreLines = index < dialogue.lines.length - 1` gates the cue, the button's `disabled` state, and (inverted) the choices/Close handoff, and correctly falls out to "show immediately" for both 0-line and 1-line rounds. The clickable line region is a real `<button>` (not a `<div onClick>`), using `<span>` instead of `<p>` for its children since `<button>`'s HTML content model only permits phrasing content — `display: block` recreates the original paragraph-like stacking. The `▼` cue is bottom-right, with `paddingRight`/`paddingBottom` reserved on the button so it doesn't crowd the line's text.

- [x] Only one line is visible at a time; advancing replaces it — no scrollback accumulates within a round
- [x] Clicking anywhere on the dialogue box advances to the next line while lines remain
- [x] Once the last line is showing, box clicks do nothing further — choices (if any) and Close render in its place, using ticket 16's existing `visible`/`enabled` logic unchanged
- [x] A single-line round shows its one line immediately, no click required
- [x] A choices-only round (no lines) shows its choices immediately
- [x] The visible line resets to the first whenever a new Dialogue round is shown (fresh Script run, or a choice's `next` continuation)
- [x] Close remains visible and clickable at every point, including mid-pagination
- [x] A visual cue shows while more lines remain, and disappears on the last line
- [x] The click target is a real interactive element (e.g. a `<button>`), not a bare `<div onClick>` — satisfies this repo's `jsx-a11y` lint rules
- [x] Manually verified: interact with a Scripted Entity whose round stages two different speakers (the `CampFire` narrator round from ticket 18 already fits) — confirm one-at-a-time reveal, click-to-advance, the cue's presence/absence, and choices/Close appearing only on the last line — report the result before ticking boxes or committing — confirmed by the user via screenshot and follow-up testing across all scenarios (single-line round, multi-speaker round, mid-pagination Close, choiceless ending)
