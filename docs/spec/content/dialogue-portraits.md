# Dialogue Portraits & Expressions

Confirmed 2026-09-20 via grilling session, following up on "Dialogue Scripts: Choices, Speakers & Localization"'s deferred Portrait/Expression item. See `GLOSSARY.md`'s "Content" vocabulary (Speaker, **Portrait**, **Expression**) and `adr/0014-dialogue-portraits-are-a-standalone-asset-type.md` for why Portrait storage is independent of the existing character-spritesheet pipeline (`adr/0006`).

## Problem Statement

A Dialogue line can now carry a Speaker, but nothing lets a Script show what that Speaker looks like — Undertale/visual-novel-style dialogue routinely pairs a line with a character illustration that changes with the character's emotional state, and this project has no path to that at all: no asset location for this kind of art, no way for a Script to select one, and no defined fallback when one doesn't exist.

## Solution

A line's presentation options grow to include an optional Portrait, selected by a fixed Expression value alongside its Speaker. Portrait art lives in its own asset location, independent of the existing per-character spritesheet/normalization pipeline (`adr/0006`, `adr/0014`) — a Speaker (including a narrator) can have Portrait art without needing an on-map character sprite at all, or vice versa. A line with no matching Portrait art simply renders text-only, exactly as it does today.

## User Stories

1. As a content author, I want to select a Portrait and Expression for a line alongside its Speaker, so that dialogue can show what a character looks like as they speak, not just their name.
2. As a Player, I want a character's Portrait to change with their Expression, so that dialogue reads with the emotional nuance Undertale/visual-novel dialogue has.
3. As a content author, I want to pick a line's Expression from a fixed, known set (Neutral, Happy, Sad, Angry, Surprised), so that I'm choosing from a real vocabulary instead of inventing an arbitrary string that might not match any art.
4. As a content author, I want a Speaker with no drawn Portrait for a given Expression to just show text, so that I'm never blocked from shipping dialogue by incomplete art.
5. As a content author, I want a narrator (a Speaker with no Entity or on-map sprite) to be able to have a Portrait too, so that scene-setting narration isn't second-class next to character dialogue.
6. As a Host developer, I want Portrait art stored independently of `assets/sprites/characters/<name>/`'s normalization pipeline, so that a static illustration isn't forced through machinery built for animated walk-cycle sheets.
7. As a Host developer, I want a Portrait's resolution (Speaker + Expression → asset) to be a pure, testable function, so that I can verify "no art for this combination" falls back correctly without a running browser.
8. As a future maintainer, I want it recorded why Portrait art doesn't reuse the character-spritesheet pipeline, so that I don't "fix" what was actually a deliberate decoupling (`adr/0014`).
9. As a future maintainer, I want the Expression vocabulary's small starting set recorded as deliberately minimal, so that extending it later (adding a member + matching art) reads as expected growth, not a missed requirement.

## Implementation Decisions

- **Expression**: a fixed, closed TypeScript union/enum — `Neutral | Happy | Sad | Angry | Surprised` — not a freeform string. A Script can only request a value from this set.
- **Portrait selection**: bundled into the same per-line presentation options as Speaker (e.g. `.say(text, { speaker, portrait: 'happy' })`), not a separate builder step — both describe how a line is presented, not what it says.
- **Portrait storage**: independent of `assets/sprites/characters/<name>/` and ADR-0006's raw/normalized pipeline. Keyed directly by whatever string a Script uses as `speaker`, with no dependency on that Speaker having an Entity, a Player character, or a spritesheet at all. See `adr/0014`.
- **Resolution/fallback**: a small pure function resolves (Speaker, Expression) to a Portrait asset reference or `undefined`; `undefined` means the line renders text-only, with no warning — a missing Portrait for a valid Expression is an expected content-authoring gap, not a bug (the closed Expression type already rules out a typo'd value).
- **No relationship to Entity/Player sprite rendering**: this is purely a Dialogue-overlay (Host-rendered, `adr/0011`) concern; it does not touch, require, or wait on the still-unbuilt NPC/Entity sprite rendering work.

## Testing Decisions

- The `ScriptBuilder`'s output gains coverage for a line's `portrait`/Expression fields, alongside its existing `speaker` coverage — same seam, same pattern (`node:test`, pure function assertions on what `build()` returns).
- The new Portrait-resolution function gets its own unit tests, modeled on the existing `resolvePlayerTexture`/`pickPlayerTexture` split in `player-assets.ts`: given a Speaker and Expression, returns the expected asset reference, or `undefined` when no matching art exists.
- Everything past those two seams — the overlay actually rendering a Portrait image, swapping it per Expression, and falling back to text-only when one is missing — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: interact with a Scripted Entity whose lines cycle through a few Expressions and confirm the Portrait changes, and confirm a line with no matching Portrait art still renders correctly as text-only.

## Out of Scope

- **An Expression beyond the initial five** (Neutral, Happy, Sad, Angry, Surprised) — extend only when a real line actually needs one; the set is deliberately minimal, not exhaustive.
- **Portrait art normalization/authoring pipeline details** (image dimensions, format, how a non-technical author adds new art) — this section confirms *where* Portrait art lives and how it's referenced, not the art-production workflow itself.
- **Portrait animation or transition effects** (fading, sliding, lip-sync-style movement) — static images only.
- **Any relationship to NPC/Entity on-map sprite rendering** — that remains its own, separately-deferred, unbuilt concern (see "Explicitly out of scope / deferred").

## Further Notes

- See `adr/0014-dialogue-portraits-are-a-standalone-asset-type.md` for the full rationale against reusing the character-spritesheet pipeline.
- `GLOSSARY.md`'s "Content" section gained **Portrait** and **Expression** as part of this round.
- This section supersedes "Dialogue Scripts: Choices, Speakers & Localization"'s Out of Scope note that backlogged Portrait/expression art — that item is now scoped here.
