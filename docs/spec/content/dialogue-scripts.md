# Dialogue Scripts

Confirmed 2026-09-19 via grilling session, following investigation of overlap with `issues/05-entity-interaction-hook.md`. See `GLOSSARY.md`'s "Content" vocabulary (Script, Dialogue, Flag) and `adr/0008` through `adr/0011` for the rationale behind each architectural call below. See [Dialogue Scripts: Choices, Speakers & Localization](dialogue-choices-speakers-localization.md) for how choices, Speaker, and localization extend this.

Beyond the literal Phase 1 done-bar (Phase 1 explicitly excludes dialogue/quests/XP UI) — this is the first slice of Phase 2-ish "what happens after an Interaction" work, grilled now because ticket 05 (which it depends on) was already being pulled forward.

## Problem Statement

Ticket 05 gives the Engine a way to detect and report "the Player interacted with Entity X" (or, via ticket 03, "the Player entered Map Y"), but nothing yet lets a course/content author attach actual behavior — starting with dialogue — to that report. Without it, an Interaction or a Map-entry is an event nobody's listening to.

## Solution

A Host-side Script: ordinary TypeScript, authored per Entity (or per Map, for entry) via a naming convention, that runs when the corresponding Engine Event fires and produces Dialogue — using a small builder API rather than a new authoring language. Scripts can read and set small per-Student Flags, so future content can branch, even though this round's own Dialogue content stays static.

## User Stories

1. As a content author, I want to write a Script as plain TypeScript, so that I get full IDE/type support without learning a new authoring language.
2. As a content author, I want a Script to be found automatically from the Entity it belongs to, so that I don't have to maintain a separate lookup table for every Entity I author.
3. As a content author, I want to author an Entity in Tiled the same way Spawn points already are, so that I don't have to learn a second Map-authoring convention.
4. As a content author, I want to tag an object's kind (Spawn/Entity/Portal) from a dropdown instead of typing a string, so that a typo can't silently produce an untagged object.
5. As a Player, I want interacting with an Entity that has a Script to show me Dialogue, so that the world feels responsive instead of Entities being inert.
6. As a Player, I want entering a Map that has a Script to show me Dialogue automatically, so that a Map can introduce itself without requiring me to interact with something first.
7. As a Player, I want to pick from Dialogue choices when a Script offers them, so that my responses can matter.
8. As a Player, I want the game world to remain visible and technically walkable while Dialogue is showing in v1, so that a Dialogue box doesn't need to be dismissed through a separate control scheme (accepted rough edge — see Out of Scope).
9. As a content author, I want a Script to be able to check whether a Flag is already set, so that I can write dialogue that changes after the Player has done something once.
10. As a content author, I want a Script to be able to set a Flag as an outcome of a choice, so that the Player's decision persists.
11. As a Host developer, I want Flags stored per-Student, so that two different Students never see each other's progress.
12. As a Host developer, I want Flags modeled as a local fixture shaped like a plausible future real-backend response (mirroring how `WorldConfig` is already stubbed), so that wiring a real database in later requires no redesign of the Script-facing API.
13. As a Host developer, I want a single place to inspect a given Student's current Flags, so that debugging "why did/didn't this dialogue branch fire" is a one-place lookup, not a hunt across scattered state.
14. As an Engine developer, I want the Engine to remain completely unaware that Scripts, Dialogue, or Flags exist, so that the Engine's public surface and its statelessness (ADR-0001) stay unchanged.
15. As an Engine developer, I want Host-side tooling that needs to know which Entities exist on a Map to read the authored Tiled file directly, so that the Engine doesn't need a new entity-catalog API just to support Host tooling.
16. As a ticket-05 implementer, I want the Entity-authoring convention (Tiled Custom Class, shared `objects` layer) already decided, so that I'm not guessing at something ticket 05's own checklist left open.
17. As a future maintainer, I want it recorded that dialogue does not pause the Player in v1, so that I don't "fix" what was actually a deliberate scope cut, and know where the follow-up work (a Host→Engine pause channel) belongs.

## Implementation Decisions

- **Script authoring**: a Script is a TypeScript module built with a small builder/fluent API (e.g. chaining a "say a line" call with a "offer choices" call) — not a parsed DSL, not a data-only config format. See `adr/0009`. (Choice shape — multi-Flag writes, visible/disabled conditions, nesting into a tree — and per-line Speaker are refined in [Dialogue Scripts: Choices, Speakers & Localization](dialogue-choices-speakers-localization.md).)
- **Script location convention**: an Entity's Script is found by naming convention from its `entityId` (the Tiled object's dedicated `entityId` property — see [Map Object Authoring](../world/map-object-authoring.md), superseding an earlier draft of this line that said the object's `name` field) — no explicit id-to-path lookup table in this round.
- **Triggers**: exactly two Engine Events drive Scripts — the `interacted` event (ticket 05, keyed by `entityId`) for Entity Scripts, and the `transitioned` event's `toMapId` (ticket 03) for Map-entry Scripts. No other Engine Event drives a Script this round.
- **Script context**: a Script receives a read-only context object exposing the current Student's Flags, so the shape supports branching now even though this round's Dialogue content doesn't branch on anything yet.
- **Flags**: a flat per-Student key/value store (boolean/number/string values only — no nested structures, no quest/inventory modeling). Fixture-backed the same way `WorldConfig` already is, behind one small async read/write module (async specifically so a real backend fetch can later replace the in-memory store with no change to callers) so a real backend can later replace the fixture without changing the Script-facing context shape. Student identity for this store is Host-only and does *not* touch `WorldConfig` — the Engine has no use for it, and ADR-0001 already commits the Engine to owning no state (ticket 11's implementation note has the detail; an earlier draft of this line incorrectly said `WorldConfig` would need a new field).
- **Entity/Spawn/Portal authoring in Tiled**: each object's kind is tagged via a Tiled Custom Class (`Entity`, `Spawn`, `Portal`), not a freeform string and not a dedicated layer per kind; objects can live on any number of object layers (superseding an earlier draft of this line that required one shared `objects` layer — see [Map Object Authoring](../world/map-object-authoring.md)). Requires a Tiled Project file. See `adr/0010`, `adr/0012`, and `guides/tiled-object-authoring.md`.
- **Rendering**: Dialogue is rendered entirely by the Host (resolves the "Open" question in [the spec README](../README.md#open) in favor of a Host-side overlay, not in-canvas/Phaser rendering) as a non-blocking overlay — the Engine gains no pause/resume capability in this round. See `adr/0011`.
- **No change to ticket 05's own scope** — this feature consumes 05's `interacted` event as-is; the Tiled-authoring convention decided here fills a gap 05's checklist left implicit, rather than modifying 05's checklist itself.

## Testing Decisions

- Matching the existing pattern (`tile-animation.test.ts`, `util.test.ts`): test pure logic with `node:test`/`node:assert/strict`, not Phaser/Scene/DOM internals.
- The Flag store's get/set behavior, entityId→script-path resolution, and the Script builder API's output (does chaining produce the right internal step list) are all pure functions and get unit tests.
- Dialogue actually rendering on screen, the overlay's non-blocking behavior, and a Script firing at the right moment during real play aren't automatable here (no e2e/browser automation, per `CLAUDE.md`) — verified manually: interact with a Scripted Entity and confirm the right Dialogue/choices appear, confirm a choice's Flag persists across a second Interaction, confirm the Player can still move while Dialogue is up (the accepted v1 rough edge).

## Out of Scope

- **CG (full-screen illustration) and cutscene** (a Script taking control away from the Player) — needed a Host→Engine imperative pause/resume channel that didn't exist yet (`adr/0011`). No longer deferred: designed and scoped in [CG & Cutscene](cg-and-cutscene.md).
- **Raw per-step (`moved`) Script triggers** — no concrete need yet. (Tile/zone-entered triggers are no longer deferred — see [Zone: Walking Into a Region Triggers a Script](../world/zones.md).)
- **entityId→script lookup table** — only needed if one Script must serve multiple Entities; not built until that's a real case.
- **Full quest/variable/inventory modeling** — Flags stay a flat key/value store, matching Phase 1's existing "no quests/XP UI yet" boundary. (Reaffirmed in [Dialogue Scripts: Choices, Speakers & Localization](dialogue-choices-speakers-localization.md), including Flag arithmetic specifically.)
- **Ink language integration** — stays separately deferred (see below); this Script system is the general dispatch shell Ink could plug into later, not a replacement for it. (See also `adr/0013` — non-programmer *text editing* is solved separately via a string table; only non-programmer *branching authorship* would actually reopen this.)
- **Pausing/disabling Player movement while Dialogue is shown** — accepted v1 rough edge, not solved here.

## Further Notes

- See `adr/0008` for why this is Host-side rather than Unity-style Engine-side scripting.
- This is the first content built on top of ticket 05/03's events; the ticket-dependency shape (state-collection ticket blocking the dialogue-script ticket, which is blocked by 05 and 03) is for `/to-tickets` to formalize, not fixed here.
