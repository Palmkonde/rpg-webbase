# Map Object Authoring: Layer Flexibility & Dedicated Identity

Confirmed 2026-09-20 via grilling session, triggered while implementing ticket 05 (Entity interaction hook). Supersedes two specific calls from ADR-0010 (single shared object layer, `name`-as-id); ADR-0010's Custom Class tagging decision itself is unaffected. See `adr/0012-map-objects-any-layer-dedicated-identity-property.md` for the full rationale and rejected alternatives, and `guides/tiled-object-authoring.md` for the current how-to.

## Problem Statement

ADR-0010's original authoring rules didn't hold up once Entities were actually being authored for ticket 05: a Map author with many tile-rendering layers is still boxed into exactly one shared `objects` layer for every placed object regardless of Map complexity, and an object's free-text `name` field doubling as its `entityId` means a routine rename (for authoring clarity, reorganizing labels) silently changes the id a Script or Flag is keyed to — with nothing preventing two different objects from accidentally sharing the same id in the first place.

## Solution

Class-tagged Spawn/Entity/Portal objects can now live on any number of object layers — the Class tag alone still tells them apart, so the single-layer rule was never load-bearing. Identity for a Class-tagged object comes from a dedicated Class-member property (`entityId` for Entity) instead of `name`, so a display-label rename can never break a downstream reference. Because Tiled validates uniqueness on no property, the Engine warns (not errors) when two objects on the same Map share an id, and a standalone dev script catches the same collision across the whole Map catalog, since the Engine itself only ever loads one Map at a time (ADR-0001).

## User Stories

1. As a Map author, I want to place Spawn/Entity/Portal objects on any object layer I choose, so that I'm not forced to cram every placed object into one shared layer regardless of how many tile-rendering layers my Map uses.
2. As a Map author, I want to organize objects across multiple object layers (by area, by kind, by authoring pass) if that's clearer for my workflow, so that Map authoring scales with Map complexity.
3. As a Map author, I want an object's `name` field to stay a free, renamable display label, so that I can clean up or reorganize labels without worrying about breaking something downstream.
4. As a Map author, I want an Entity's real identity to live in its own dedicated property (`entityId`), so that it's clear at a glance, in Tiled's own property panel, which field actually matters to the Engine/Host.
5. As a content author, I want a Script/Flag tied to a specific Entity to keep working even if that Entity's display name changes later, so that routine map cleanup doesn't silently orphan content.
6. As a Map author, I want to be warned if I accidentally give two objects on the same Map the same id, so that I catch a copy-paste mistake before two Entities silently share a Script.
7. As a Host/content author, I want to catch an id reused across two different Maps, so that ticket 12+'s Script-lookup-by-`entityId` convention doesn't silently resolve two unrelated Entities to the same Script.
8. As an Engine developer, I want the per-Map duplicate check to run in the same pass that already walks every object, so that it costs nothing extra and adds no new Engine surface.
9. As an Engine developer, I want the Engine to stay stateless and single-Map-at-a-time (ADR-0001), so that a cross-Map check never becomes the Engine's own responsibility.
10. As a repo maintainer, I want cross-Map duplicate detection available as a script I run on demand, so that I can validate the whole Map catalog without it slowing down routine `bun run test`/`lint`.
11. As a future ticket-04 implementer (Portal), I want the same any-layer, dedicated-property pattern already established, so that I'm not re-deciding authoring mechanics ticket 05 already settled.
12. As a future maintainer reading ADR-0010, I want it clearly marked which parts a later decision superseded, so that I don't follow stale guidance.
13. As a Map author, I want to know that snake_case (`entity_key`-style) naming isn't this project's established convention for identity properties, so that I don't invent a third inconsistent style when a future kind needs its own.
14. As a Map author reusing existing tileset art (e.g. the campfire) for an Entity, I want to stamp it as a Tile Object with its own `entityId` and `name`, so that I get a real per-instance identity without hand-drawing an invisible marker on top of it.
15. As an Engine developer, I want the pixel→grid conversion to stay correct whether an object is a plain point/rectangle or a tile-referencing object, so that a tile-object Entity's interaction position isn't off by one row.

## Implementation Decisions

- **Identity source**: `collectEntities` (`packages/engine-core/src/tiled-assets.ts`) reads an object's `entityId` Class-member property (from its `properties` array) instead of its `name` field. This is Entity's own instance of a general pattern — a future kind's identity property gets its own dedicated name (never `name`, never a shared generic property name across kinds).
- **Layer cardinality**: objects are no longer required to live on one named `objects` layer. `collectEntities` already scanned every `objectgroup`-type layer regardless of name/count before this decision; this formalizes that as the sanctioned authoring pattern rather than a guide/ADR constraint the code silently didn't enforce.
- **Duplicate detection, shared core**: a new pure function `findDuplicates(values: string[]): string[]` in `packages/engine-core/src/util.ts` (alongside `computeCameraBounds`) returns every value appearing more than once in its input. One function, two call sites.
- **Per-Map warning**: the Engine calls `findDuplicates` over one Map's collected `entityId`s at load time; if it returns anything, `console.warn`s naming the Map and the duplicated id(s) — a warning, not a thrown error, so the Map still loads.
- **Cross-Map check**: a new standalone dev script (outside the `engine-core` package) reads every Map in the maps catalog, calls `collectEntities` per Map, concatenates every Map's `entityId`s, and calls `findDuplicates` over the combined list; for any duplicate, reports which Maps it spans. Run manually, not wired into `bun run test`/`bun run lint`.
- **ADR status**: ADR-0010 is superseded (not rewritten) by ADR-0012 for its single-layer and name-as-id specifics; its Custom Class tagging decision remains current and unaffected.

## Testing Decisions

- `collectEntities`'s extended behavior (reading `entityId` from `properties`; the existing gid/bottom-anchor tile-object handling is unaffected) gets unit tests in `tiled-assets.test.ts`, matching its existing pattern (`node:test`/`node:assert/strict`, raw Tiled-JSON-shaped literals in, `EntityObject[]` out).
- `findDuplicates` gets unit tests in `util.test.ts`, matching that file's existing pattern for `computeCameraBounds`/`resolveTilesetAssetUrl` — including the empty-input and no-duplicates edge cases.
- The Engine's `console.warn` call site and the dev script's file-reading/reporting are both thin I/O wrappers around the two tested pure functions above and get no test suite of their own, matching the existing `resolvePlayerTexture`/`pickPlayerTexture` split in `player-assets.ts`.
- Everything past those two pure-function seams (the warning actually appearing in a browser console, the dev script's CLI output) is verified manually, consistent with this repo having no e2e/browser automation (`CLAUDE.md`).

## Out of Scope

- Migrating the existing (dead/unused) `spawn_point` object's `spawn_key` property to this pattern, or wiring Tiled-authored Spawn data into the Engine at all — spawn position is driven entirely by `WorldConfig` today, and `spawn_key` is explicitly dead/temporary code, not revived by this decision.
- Portal's own dedicated identity property name/shape — this decision establishes the pattern, not ticket 04's specifics.
- Tile-Definition-level Class tagging producing an Entity with no placed object — considered and rejected (`adr/0012`): a tile layer's cells carry no per-instance identity in Tiled's data model.
- Turning the per-Map duplicate check into a hard error, or wiring the cross-Map dev script into `bun run test`/`lint` — both stay warnings/manual-run for now.
- Any change to the `EngineEvent`/`InteractedEvent` contract itself — `entityId`'s *value* now comes from a different Tiled field, but its type and meaning on the Engine↔Host boundary are unchanged.

## Further Notes

- Ticket 05's own in-flight engine-core code needs a small follow-up against this section before that ticket is done: switching `collectEntities` from `name` to the `entityId` property, and adding the `findDuplicates`-backed warning.
- See `adr/0012` for the full rationale and rejected alternatives (single-layer-only kept, tile-paint-based auto-entities, `name`-as-id kept, Engine-side cross-Map fetching).
