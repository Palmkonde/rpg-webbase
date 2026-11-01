# Dialogue Line Pacing

Confirmed 2026-09-23 via grilling session, following up on ticket 18's Speaker work (see [Dialogue Scripts: Choices, Speakers & Localization](dialogue-choices-speakers-localization.md)). This section is Host-side overlay rendering/interaction only: no `GLOSSARY.md` vocabulary changes and no `docs/adr/` changes accompany it — evaluated explicitly during grilling and found unnecessary, since this isn't a new cross-cutting Script/Dialogue/Speaker/Flag domain concept, nor does it touch the Engine. `adr/0011-dialogue-v1-does-not-pause-the-player.md` is reaffirmed, not reopened: Dialogue still never blocks the Player, it simply paces its own reveal at the Player's click.

## Problem Statement

Ticket 18 gave a Dialogue round's lines a distinct Speaker, but the Host overlay still renders every line in a round all at once, stacked in one box — a multi-speaker exchange (e.g. a narrator aside followed by the Entity's own line) reads as a wall of simultaneous text rather than the turn-by-turn back-and-forth of visual-novel-style dialogue. There's also no way for a Player to control their own reading pace through a round; they see everything at once or nothing.

## Solution

A Dialogue round's lines reveal one at a time instead of all at once: at any moment, at most one line (its Speaker and text) is visible in the overlay. Clicking anywhere on the dialogue box advances from the current line to the next, replacing it outright — there is no persistent scrollback of previously-shown lines within a round. Once the round's last line is showing, the box's click-to-advance stops, and the round's choices (if any) and the always-present Close control render exactly as they do today. A small visual cue indicates when more lines remain to be revealed.

## User Stories

1. As a Player, I want a Dialogue round's lines to appear one at a time, so that a multi-speaker exchange reads like a real back-and-forth conversation instead of a wall of simultaneous text.
2. As a Player, I want to control when the next line appears by clicking, so that I can read at my own pace instead of everything being dumped on me at once.
3. As a Player, I want clicking anywhere on the dialogue box to advance the line, so that I don't have to aim for a small dedicated button.
4. As a Player, I want the previous line to disappear once the next one appears, so that the box stays focused on who's talking right now instead of accumulating into a growing wall of text.
5. As a Player, I want a visual cue telling me more lines are coming, so that I know to click instead of assuming the conversation has ended.
6. As a Player, I want the round's choices to appear only once I've read every line, so that I'm not asked to decide before I've heard the whole exchange.
7. As a Player, I want to still be able to close the dialogue at any point, including partway through a round's lines, so that I'm never trapped reading something I want to back out of (reaffirms ADR-0011's non-blocking precedent).
8. As a Player, when I click while the round's choices are showing, I want that click to do nothing unless it lands on an actual choice, so that I don't accidentally pick an option or skip past something by clicking in the wrong place.
9. As a content author, I want this pacing to apply automatically to every Dialogue round without any per-Script opt-in, so that I don't have to remember a flag to get the VN-style presentation ticket 18 was building toward.
10. As a content author, I want a single-line round to behave exactly as it does today — the one line shows immediately, no click required — so that simple Scripts aren't penalized with an extra click for content that was never multi-line to begin with.
11. As a content author, I want a choiceless round's last line to just sit there once shown (Close is the only way out), so that a round with nothing to decide doesn't need any special end-of-round affordance beyond what already exists.
12. As a Host developer, I want this feature to require no changes to `Dialogue`/`DialogueLine`'s shape or to `ScriptBuilder`'s output, so that ticket 18's data model and its tests stay untouched — this is purely a rendering/interaction change to the overlay.
13. As a Host developer, I want the "click advances" behavior implemented as a real interactive element (not a bare `<div onClick>`), so that it satisfies this repo's `jsx-a11y` lint rules without a dedicated keyboard-handling feature having to be built.
14. As a future maintainer, I want it recorded that typewriter-style animated text reveal was considered and declined for this round, so that "line pacing" isn't conflated with "character-by-character text animation" if it comes up later.
15. As a future maintainer, I want it recorded that a dedicated keyboard-advance (Space/Enter) binding was considered and deferred, not forgotten, so that it's a known possible follow-up rather than a silently-dropped idea.
16. As a future maintainer, I want it recorded that this feature needed no `GLOSSARY.md` or ADR changes, so that a future reader doesn't go looking for a Speaker/Dialogue vocabulary shift or an Engine-contract decision that doesn't exist here.
17. As a future maintainer, I want it recorded that manual verification (not a new automated seam) covers this feature end to end, consistent with tickets 16-18's treatment of overlay rendering/interaction, so that a reviewer doesn't go looking for unit tests that were deliberately not written.

## Implementation Decisions

- **Pacing model**: the overlay tracks a current line index into the active round's `dialogue.lines`, rendering only the line at that index (Speaker + text) — never a slice or accumulation of prior lines.
- **Advance trigger**: the dialogue box itself is the click target, not a dedicated "Next" button. Implemented as a real `<button>` (styled to match the box, not a raw `<div>` with a click handler), so `jsx-a11y`'s interactive-element rules are satisfied without a dedicated keyboard feature — Enter/Space activation comes along as a side effect of correct semantic HTML.
- **Gating**: the box's click-to-advance is only active while the current index is before the round's last line. Once the last line is showing, box clicks do nothing further — the round's choices (if any) and Close render in the box's action area per ticket 16's existing `visible`/`enabled` logic, unchanged.
- **Reveal style**: instant full-line swap — no character-by-character/typewriter animation.
- **Reset on new round**: the current line index resets to the first line whenever a new `Dialogue` object is handed to the overlay (a fresh top-level Script run on re-interact, or a `choice.next(ctx)` continuation) — the same "always starts from the top, no position persisted" precedent ticket 17 established at the round level, applied here at the line level within a round.
- **Zero-line rounds**: a round with no lines at all (choices only) shows its choices immediately — nothing to paginate through, so this is the natural base case, not a special one.
- **Close availability**: unchanged — Close renders and remains clickable at every point, including mid-pagination, per ADR-0011's non-blocking precedent.
- **Visual cue**: a small Host-side-only indicator shows while the current index is before the last line, and disappears once the last line is showing. Its exact visual treatment is a UI-polish detail, not a data/interaction decision this section fixes.
- **No `Dialogue`/`DialogueLine`/`ScriptBuilder` changes**: this section touches only the Host overlay's rendering/interaction logic — the data `ScriptBuilder` produces (per ticket 18) is unchanged.

## Testing Decisions

- No new automated-test seam. The pagination index, click-gating logic, and line-swap rendering are all interactive, DOM-driven overlay behavior — the same category as ticket 16/17's `visible`/`enabled` choice filtering and `handleChoiceClick`, none of which are unit-tested (this repo has no e2e/browser automation and no jsdom/React Testing Library installed, per `CLAUDE.md`).
- Manually verified: interact with a Scripted Entity whose round stages at least two lines with different Speakers (`CampFire.ts`'s narrator-staged round from ticket 18 already fits), and confirm: (a) only one line is visible at a time, (b) clicking the box advances to the next line and the previous one disappears, (c) the visual cue is present while more lines remain and gone on the last line, (d) the round's choices/Close appear only once the last line is showing, (e) Close remains clickable at every step, and (f) a single-line round shows its one line immediately with no click required.

## Out of Scope

- **Typewriter/character-by-character text animation** — considered and declined for this round; instant full-line swap only. Revisit only if a concrete request for it shows up, not speculatively.
- **Dedicated keyboard-advance handling (Space/Enter)** — deferred; using a real `<button>` for the click target already gives this for free as an implementation detail, but no bespoke keyboard feature (e.g. a global keydown listener) is built.
- **Visual cue's exact styling/animation** — this section confirms a cue exists and when it shows/hides, not its specific look.
- **Any relationship to Portrait/Expression rendering** — this section is pacing only; how a Portrait renders alongside a paced line is "Dialogue Portraits & Expressions"'s concern, not reopened here.
- **Timed/auto-advancing lines** — still declined, per "Dialogue Scripts: Choices, Speakers & Localization"'s existing Out of Scope note; pacing here is always Player-click-driven, never a clock.

## Further Notes

- Builds directly on ticket 18's `Dialogue`/`DialogueLine`/Speaker work — no changes to that data shape.
- See `docs/research/dialogue-and-choice-script-functionality.md`: this section's specific concern (line-by-line reveal pacing) isn't covered by that survey's table, since Ink/Yarn Spinner/Ren'Py/RPG Maker MZ all treat one-line-at-a-time text-box advancement as baseline engine behavior rather than a documented authoring decision worth surveying.
- No `GLOSSARY.md` or `docs/adr/` changes accompany this section — evaluated during grilling and found unnecessary (see this section's opening note).
