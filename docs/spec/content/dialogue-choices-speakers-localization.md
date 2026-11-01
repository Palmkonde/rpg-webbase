# Dialogue Scripts: Choices, Speakers & Localization

Confirmed 2026-09-20 via grilling session, following `docs/research/dialogue-and-choice-script-functionality.md`'s primary-source survey of dialogue/choice systems (Ink, Yarn Spinner, Ren'Py, RPG Maker MZ). Extends [Dialogue Scripts](dialogue-scripts.md): choices grow from a flat, single-Flag round (ticket 14's original scope) into a nested tree with multi-Flag writes, and Dialogue gains a per-line Speaker. See `GLOSSARY.md`'s "Content" vocabulary (Script, Dialogue, **Speaker**, Flag) and `adr/0013-dialogue-localization-is-a-string-table-not-a-reopened-adr-0009.md` for the localization rationale. ADR-0009 and ADR-0011 are both reaffirmed, not reopened.

## Problem Statement

Ticket 14 proves a Script can read and write one Flag through one flat round of choices — enough to show Scripts can branch and persist an outcome, but not enough to author dialogue that reads like the Undertale/visual-novel/RPG reference points this project is aiming for: a single choice rarely stands alone (it usually leads to more choices), a single Flag rarely captures a whole outcome, dialogue with more than one character has no way to say who's talking, and a designer who isn't comfortable writing TypeScript has no way to edit or translate a line of dialogue without going through a programmer.

## Solution

Four independent extensions to the existing Script/Dialogue/Flag mechanism, none of which reopen ADR-0009 (TypeScript builder, not a parsed DSL) or ADR-0011 (no Host→Engine pause channel): choices become a nested tree that can write multiple Flags per branch and can be hidden or shown-but-disabled; Dialogue lines gain an open-ended Speaker so a Script can voice more than one character; dialogue text resolves through a locale-keyed string table so non-technical authors can edit and translate lines without touching a Script's TypeScript structure (`adr/0013`); and a short list of adjacent asks (Flag arithmetic, Script→Host side effects, timed choices, portraits) are explicitly named and deferred rather than silently dropped.

## User Stories

1. As a content author, I want a choice to lead to another round of choices, so that a conversation can branch more than once instead of ending after a single pick.
2. As a content author, I want a choice to set more than one Flag at once, so that a single decision can capture a compound outcome (e.g. both "met the merchant" and "was rude to them").
3. As a Player, I want some choices to be hidden until I've met their condition, so that dialogue doesn't visibly list options I haven't earned yet.
4. As a Player, I want some choices to be visible-but-locked with a reason shown when I try to pick them, so that I know what I need to do to unlock them instead of just seeing them absent.
5. As a content author, I want to write a choice's shared "what happens next" content once as a plain TypeScript function, so that two branches that reconverge don't require me to duplicate the same dialogue lines.
6. As a Player, I want re-interacting with a Scripted Entity to always start its dialogue from the top, so that I'm never confused about where a half-finished conversation left off.
7. As a content author, I want a Dialogue line to carry who's speaking, so that a conversation with more than one character reads clearly instead of every line looking like it comes from one voice.
8. As a content author, I want a Script to attribute a line to a character other than the Entity it's attached to (including a narrator with no Entity in the world), so that a single Script can stage a scene with more than one speaker.
9. As a Player, I want an unattributed line to default to the Entity's own name, so that simple one-voice Scripts don't need to repeat the speaker on every line.
10. As a designer who doesn't write TypeScript, I want to edit and translate a line of dialogue text without touching a Script file, so that I'm not blocked on a programmer for routine content changes.
11. As a Host developer, I want dialogue text to resolve through a locale-keyed lookup instead of being hardcoded inline in a Script, so that adding a language later doesn't mean editing every Script.
12. As a Host developer, I want the locale a line resolves against to be fixture-stubbed today (mirroring how `WorldConfig` and Flags already are), so that a real backend/locale-selection mechanism can replace it later with no redesign of the Script-facing API.
13. As a future maintainer, I want it recorded that Flags stay arithmetic-free and quest/item-free even though the student-state model will eventually need both, so that I don't "helpfully" widen Flag into something `GLOSSARY.md`'s glossary already says to avoid.
14. As a future maintainer, I want the Flag store's async get/set shape to stay generic, so that a sibling Quest/Item store can be added later without changing the Script-facing `ctx` contract.
15. As a future maintainer, I want it recorded that a Script→Host side-effect channel (playing a sound, swapping a portrait, granting an item) was considered and explicitly deferred, so that I build the concrete feature's own API when it's actually needed instead of guessing at a generic hook now.
16. As a future maintainer, I want it recorded that timed/auto-advancing choices were considered and rejected, so that I don't reopen ADR-0011's declined pause channel chasing a feature nobody asked for.
17. As a future maintainer, I want it recorded that portrait/expression art is wanted but explicitly backlogged behind this work, so that it's a known future ticket, not a forgotten idea.
18. As a future maintainer, I want it recorded why the localization fix is a string table rather than a reopened ADR-0009, so that I understand the narrower, cheaper path was a deliberate choice, not an oversight (`adr/0013`).

## Implementation Decisions

- **Choice shape**: a `.choice()` step takes display text, an optional `visible` condition (Flag-based; false ⇒ the choice is omitted from the rendered list entirely), an optional `enabled` condition plus a `disabledReason` (false ⇒ the choice renders but isn't selectable; attempting to pick it surfaces the reason instead), and a set of Flag-writes to apply as its outcome — supersedes ticket 14's original single-Flag-per-choice scope.
- **Choice nesting**: a choice's outcome can itself return another set of choices via the same builder, so Dialogue is a tree, not a single flat round — supersedes the "Script authoring" bullet in [Dialogue Scripts](dialogue-scripts.md), which only demonstrated one flat "say a line"/"offer choices" step.
- **Branch reconvergence**: no dedicated "gather"/merge-point primitive is built. Two branches that need the same continuation content share it by both calling the same plain TypeScript function/closure — ADR-0009's "plain TypeScript, not a parsed DSL" already provides this for free.
- **Dialogue position on re-interact**: a Script always runs from the top on every `interacted`/`transitioned` event; no "current node" is persisted per Student per Script. A half-finished tree simply restarts.
- **Speaker**: each Dialogue line gains an optional `speaker` field (a plain string, not tied to `entityId`); when omitted, it defaults to the owning Entity's display name. A Script may set a different speaker per line, including one with no corresponding Entity (e.g. a narrator). (A Portrait/Expression is bundled onto this same per-line option — see [Dialogue Portraits & Expressions](dialogue-portraits.md).)
- **Localization**: dialogue line text resolves through a small, pure, locale-keyed lookup function (a string table) rather than being passed as an inline literal — content/translation edits happen in that table, not in a Script's TypeScript. Locale itself is fixture-stubbed for now (a hardcoded default, matching how `WorldConfig`/Flags are already stubbed) — a Player-facing language switcher is not built this round. See `adr/0013` for why this doesn't reopen ADR-0009.
- **Flags stay unchanged**: still a flat, per-Student, boolean/number/string key/value store with no arithmetic operations — reaffirmed, not widened, despite student-state eventually growing quests/items. The Flag store's existing async get/set interface already stays generic enough (mirroring `WorldConfig`'s fixture-backed pattern) for a future sibling Quest/Item store to be added without changing the Script-facing `ctx` contract.
- **No Script→Host side-effect channel**: not built this round. A Script triggering something beyond a Flag write (sound, portrait swap, granting an item) gets its own purpose-built API when that concrete feature is actually designed, rather than a speculative generic hook now.

## Testing Decisions

- Same pattern as [Dialogue Scripts](dialogue-scripts.md) (`node:test`/`node:assert/strict`, pure functions only): the extended `ScriptBuilder`'s output — a choice's Flag-writes, `visible`/`enabled` conditions, nested choice trees, and each line's resolved `speaker` — gets unit tests alongside the existing builder-output tests.
- The new locale-resolution lookup function gets its own unit tests (given a key and a locale, returns the expected text; a missing key/locale falls back predictably) — a new, small pure module tested the same way `flags.ts` already is.
- Everything past those two seams — hidden vs. disabled choices actually rendering differently in the overlay, a disabled choice's reason actually surfacing on click, a real playthrough navigating a multi-level tree, a line's speaker actually rendering distinctly per line, and restart-at-top behavior on re-interact — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: interact with a Scripted Entity offering a tree of choices, confirm hidden choices are absent and disabled ones show their reason on click, confirm two speakers in one exchange render distinctly, and confirm re-interacting restarts the conversation from the top.

## Out of Scope

- **Flag arithmetic** (increment/compare on numeric Flags) — considered and declined; Flags stay simple set/overwrite. Revisit only if a concrete counter-driven need shows up, not speculatively.
- **Quest/Item modeling** — still belongs entirely to a future, separate concept, not a widened Flag. This round only confirms the Flag store's interface won't need to change shape when that future work lands.
- **A generic Script→Host side-effect channel** — deferred; see Implementation Decisions above.
- **Timed/auto-advancing choices** — declined outright; would risk reopening ADR-0011's declined Host→Engine pause channel for no concrete benefit identified.
- **Portrait/expression art and its asset pipeline** — wanted, but explicitly backlogged behind this work; no `assets/` convention for character-expression art exists yet, and building one is its own, separate research/spec effort. (Now scoped in [Dialogue Portraits & Expressions](dialogue-portraits.md).)
- **A Player-facing locale switcher** — the string-table mechanism is built and tested; actually letting a Player choose a language is a later, separate concern.
- **Random/weighted line variation, one Script calling another, an in-script jump/goto** — considered; all three are already achievable in plain TypeScript with zero builder changes (ADR-0009's whole premise), so none get dedicated builder syntax until a concrete authoring pain point shows up.
- **Save/resume mid-dialogue** — a non-issue given restart-at-top above; nothing to resume.

## Further Notes

- See `docs/research/dialogue-and-choice-script-functionality.md` for the primary-source survey (Ink, Yarn Spinner, Ren'Py, RPG Maker MZ) this section's decisions were grilled against.
- See `adr/0013-dialogue-localization-is-a-string-table-not-a-reopened-adr-0009.md` for why localization doesn't reopen ADR-0009, and what would actually trigger reopening it (a designer needing to build/rearrange branching structure, not just edit line text).
- `GLOSSARY.md`'s "Content" section gained a new **Speaker** term as part of this round.
- This section's scope (tree-shaped choices, multi-Flag writes, Speaker, locale string table) supersedes ticket 14's original flat/single-Flag/no-Speaker assumptions for whatever ticket(s) `/to-tickets` produces from this section — ticket 14 itself, if already in flight or done, is not retroactively rewritten.
