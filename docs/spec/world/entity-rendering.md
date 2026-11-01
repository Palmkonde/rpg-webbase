# Entity Rendering: Character Entities and Prop Entities

Confirmed 2026-09-29 via grilling session. Resolves this spec's own "NPC/Entity sprite rendering" deferral ([README.md](../README.md#explicitly-out-of-scope--deferred)) and is the prerequisite issue #28 (Cutscene Movement continuous Follow) turned out to depend on without being filed as such — #26/#28 already generalize Movement/Follow steps to target "the Player or any map Entity," but no Entity has ever been a real, moveable character for either to target. See `GLOSSARY.md`'s new **Character**, **Character Entity**, and **Prop Entity** entries, and `adr/0023-entity-rendering-splits-into-character-entities-and-prop-entities.md` / `adr/0024-character-entity-picks-its-character-in-tiled-not-world-config.md` for the two architectural calls below.

## Problem Statement

Entities have no visual representation in the live game at all today — only the Player renders. A Tiled-authored Entity like Campfire carries a `gid` (a picked tile) purely for Tiled's own editor preview; the running game draws nothing for it. This already blocks real content (a Script can trigger Dialogue/CG/Cutscene from an Entity the Player can't actually see) and blocks #26/#28's own designs, which assume a movable NPC exists to target.

## Solution

Every Entity is now either a Character Entity or a Prop Entity, decided by whether it has a Character (an animated sprite-sheet appearance) — derived from whether its Tiled object carries a `characterId` property, not a separately authored flag. A Character Entity is registered and animated exactly like the Player (a real grid-engine character, automatically eligible for a Cutscene's Movement or Follow step), authored via a new `characterId` Tiled property (an enum dropdown sourced from `catalogs.ts`) and an optional `facing` property for its idle orientation. A Prop Entity has no Character and needs none — it renders directly from its own Tiled object's picked tile, the same as any other painted tile, with no sprite-sheet prep and no grid-engine registration. Rendering for both tiers is unconditional once their Map is loaded, matching Entity/Portal/Zone's existing (not World-Config-gated) activation behavior.

## User Stories

1. As a Player, I want to see NPCs and monsters walking around the Map, so that the world feels alive rather than an empty layout with invisible interaction points.
2. As a Player, I want to see static objects like a campfire actually rendered in the game, so that Tiled-authored decoration isn't visible only to the Map's designer.
3. As a Map author, I want to place a Character Entity using the exact same Tiled convention I already use for any Entity (Class = Entity, an `entityId` property), so I don't learn a second placement convention just because this Entity happens to walk.
4. As a Map author, I want to pick a Character Entity's sprite from a dropdown of catalog ids directly in Tiled, so I don't have to hand-type a string I might get wrong or don't know the valid values for.
5. As a Map author, I want a Character Entity's idle facing direction to be something I set per-instance in Tiled, so two placements of the same NPC can face different directions without duplicating the character asset.
6. As a Map author, I want a Character Entity's facing direction to default sensibly (`'down'`) if I don't set it, so a minimal placement still looks correct without extra authoring effort.
7. As a Map author, I want a Prop Entity to need no extra properties beyond what any Entity already needs (just `entityId`, no `characterId`), so a static object like a campfire stays as simple to place as it is today.
8. As a Map author, I want the Campfire object I've already placed to just start rendering, with no re-authoring required, so this feature doesn't force me to touch every existing Map.
9. As a Content author, I want a Character Entity's Script (Dialogue/CG/Cutscene) to work completely unchanged, so adding a visible sprite to an NPC doesn't require touching its interaction logic at all.
10. As a Content author, I want a Cutscene's Movement step to actually move a Character Entity's visible sprite when it targets that Entity's `charId`, so the Movement/Follow steps #26/#28 already designed have something real to animate.
11. As a Content author, I want a Cutscene's Follow step (once #28 itself is built) to work on any Character Entity with no extra per-Entity setup, so "can this Entity be followed" isn't a separate authoring decision from "does this Entity have a Character."
12. As a Host developer, I want a Character Entity's sprite defined via the same `CharacterDefinition` catalog shape the Player already uses, so this feature adds no new asset type or authoring pipeline.
13. As a Host developer, I want a Character Entity registered into grid-engine's `characters` array the same way the Player already is, so movement/animation code needs no parallel implementation for NPCs.
14. As a Host developer, I want Prop Entity rendering to reuse the Engine's existing tile-image resolution (the same mechanism any painted tile already uses), so this feature adds no new asset-loading code for static objects.
15. As a Host developer, I want an Entity's tier (Character vs. Prop) derived from parsed Tiled data, not a second authored field, so there's no way for a `characterId`-bearing Entity to be accidentally marked as a Prop or vice versa.
16. As a Map author, I want the Entity Custom Class's `characterId` values defined in the Map's Tiled Project (not hand-typed freeform), so Tiled itself catches a typo before it ever reaches the running game.
17. As an Engine developer, I want `EntityObject`'s shape to grow optional `characterId`/`facing` fields rather than become a new parallel type, so Entity Interact's existing consumer needs no changes.
18. As an Engine developer, I want Prop Entity rendering and Character Entity registration to happen once at Scene creation, mirroring how the Player and Tiled tile-animation are already set up, so this feature needs no new per-frame Scene logic.
19. As a future maintainer, I want it recorded why Entity rendering splits into two tiers instead of forcing every Entity through the Player's four-direction sprite-sheet pipeline, so I don't "simplify" it back into one system without understanding the tradeoff (`adr/0023`).
20. As a future maintainer, I want it recorded why a Character Entity's `characterId` lives in Tiled rather than World Config (unlike the Player's own `characterId`), so I don't "fix" it to match the Player's pattern without understanding it was deliberate (`adr/0024`).
21. As a future maintainer, I want it recorded that Character Entity rendering automatically implies Movement/Follow eligibility with no separate capability flag, so I don't go looking for an opt-out mechanism that was deliberately not built.
22. As a future maintainer, I want it recorded that Entity/Prop/Character rendering is unconditional once a Map loads (not World-Config-gated), consistent with Entity/Portal/Zone's existing de facto behavior, so I don't assume this feature quietly introduced activation filtering that was never built.
23. As a QA reviewer, I want the pure Tiled-parsing seam (`readEntity`/`collectEntities`'s extension) to be the one place this feature's core logic is unit-tested, so I'm not left looking for tests of Scene-internal/grid-engine wiring that's deliberately manual-verification-only, consistent with Entity Interact and Zone detection.
24. As a Map author, I want to be warned (not blocked) if I give a Character Entity a `characterId` that doesn't match any id in the catalog, so a typo or stale reference is diagnosable without silently crashing the Map load.
25. As a Player, I want two different Entities using the same `characterId` (e.g. two guards both looking like "fluffy") to render and move independently, so reusing one catalog sprite across multiple placements just works, the same as reusing a tileset tile already does.
26. As a Host developer, I want this feature's data flow (Tiled → `EntityObject` → Scene) to require no change to the Tiled Map format's other layers (`ground`/`obstacle`/`collision`) or existing Zone/Portal objects, so this stays additive.
27. As a Map author, I want the Entity Custom Class's schema (this feature's `characterId`/`facing` additions) defined in a project-level `test_map.tiled-project` file, so opening the Map in Tiled picks the schema up automatically rather than requiring per-designer manual setup.
28. As an Engine developer, I want `collectEntities`'s existing duplicate-`entityId` warning to keep working unchanged for both Character and Prop Entities, so this feature needs no parallel duplicate-detection logic.

## Implementation Decisions

- **Terminology**: **Character**, **Character Entity**, **Prop Entity** — three new terms (`GLOSSARY.md` gains all three; see the domain glossary for exact definitions).
- **Tier derivation**: not a separately authored field. An Entity is a Character Entity if its Tiled object's `characterId` property is present and non-blank; otherwise it's a Prop Entity — mirroring how `entityId`/`zoneId` already work as the sole identity signal (ADR-0012).
- **New Tiled `Entity` Custom Class properties**, defined in a new `test_map.tiled-project` file (none exists in the repo today, despite ADR-0010 calling for one — creating it is part of this work):
  - `characterId` (optional, **enum** type, values = `catalogs.ts`'s character ids) — the designer picks a Character Entity's sprite from a dropdown rather than typing a string.
  - `facing` (optional, defaults to `'down'` if unset) — a Character Entity's idle-facing direction.
- **`EntityObject` shape** grows two optional fields (`characterId?: string`, `facing?: Direction`) rather than becoming a new parallel type — Entity Interact's existing consumer of `EntityObject` needs no changes.
- **Character Entity rendering**: registered into grid-engine's `characters` array at Scene creation exactly like the Player already is, using the same `CharacterDefinition` catalog shape (`catalogs.ts`) and the same normalized-sprite-sheet pipeline (ADR-0006) — no new asset type. This makes a Character Entity automatically eligible for a Cutscene's Movement or Follow step via its `entityId` as `charId` — no separate capability flag (#26's `moveTo`/`follow` already accept "the Player or any map Entity").
- **Prop Entity rendering**: drawn directly from its Tiled object's own tile (`gid`) at Scene creation, reusing the Engine's existing tile-image resolution — no `CharacterDefinition` entry, no sprite-sheet normalization, no grid-engine registration.
- **Activation**: unconditional once the Entity's Map is loaded, for both tiers — matching Entity/Portal/Zone's existing de facto behavior (ADR-0021), not gated by World Config.
- **Player unaffected**: the Player's own rendering, `characterId` resolution (via World Config), and spawn behavior are entirely unchanged; this feature only adds a second, Entity-side path that happens to reuse the same underlying Character asset pipeline.
- See `adr/0023` for why rendering splits into two tiers instead of one uniform pipeline, and `adr/0024` for why a Character Entity's `characterId` lives in Tiled rather than World Config.

## Testing Decisions

- Matching the existing pattern (`node:test`/`node:assert/strict`, raw Tiled-JSON-shaped literals in, typed objects out, no mocking framework): `readEntity`/`collectEntities`'s extension is the one place this feature's core logic is unit-tested, mirroring `readZone`/`collectZones`'s own test file and style.
- Given a raw Tiled `Entity`-class object with a `characterId` property, asserts the returned `EntityObject` carries it (Character Entity case); given one without, asserts it's absent (Prop Entity case).
- Given a `facing` property, asserts it's carried through unchanged; given none, asserts it resolves to `'down'`.
- Existing `readEntity`/`collectEntities` coverage (blank/missing `entityId` skipped, duplicate-`entityId` warning, non-`Entity`-class objects skipped) is unaffected and stays as-is — no regressions expected, not re-specified here.
- Everything past that seam — a Character Entity actually appearing as a grid-engine character and walking, a Prop Entity's tile actually drawing on screen, a Cutscene Movement step actually animating a Character Entity — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: place a test Character Entity (e.g. wire `fluffy` as a Guard) and confirm Campfire's existing Prop Entity object on `main_test.tmj`, confirm both actually render in the browser (not just Tiled's editor preview), confirm the Character Entity idles facing its authored `facing` direction, and confirm a Cutscene Movement step can walk it to a point.

## Out of Scope

- **Issue #28's own stop-condition design** (Follow's exact stop behavior) — this section only gives Follow something to target; the stop-condition question stays a separate, already-filed, explicitly deferred ticket. (Since resolved — see [Cutscene Follow Step & Cutscene-Driven Zone Entries](../content/cutscene-follow-step.md).)
- **World-Config-gated Entity/Portal/Zone activation** — not retrofitted here either, per ADR-0021's existing precedent; a future ticket building real activation would apply to all three kinds uniformly.
- **An explicit per-Entity movability capability flag** — considered and rejected; Character-tier already implies Movement/Follow eligibility with no opt-out, since no concrete case for one exists yet.
- **Portrait/Speaker tie-in** — a Character Entity's Character asset has no relationship to Portrait (already independent per ADR-0014); this section doesn't touch Dialogue rendering.
- **Monster-specific behavior (AI, combat, aggro)** — "monster" is mentioned only as an example of a Character Entity; no behavior beyond what any Character Entity already gets (walk/idle animation, Movement/Follow eligibility) is designed here.
- **Automatic sync between the Tiled Project's `characterId` enum and `catalogs.ts`** — kept manual, matching ADR-0006's existing precedent that new character sheets are added rarely enough not to need tooling.
- **Retroactively re-authoring every existing Map's Prop Entities** — Campfire's existing Tiled object needs no changes to start rendering; this is additive, not a migration.

## Further Notes

- Supersedes this spec's own "Explicitly out of scope / deferred" bullet on "NPC/Entity sprite rendering" in [README.md](../README.md#explicitly-out-of-scope--deferred) — updated to point here.
- `GLOSSARY.md` gained **Character**, **Character Entity**, and **Prop Entity** as part of this round; **Player**'s and **World Config**'s entries were also corrected — World Config's entry no longer claims Entity/Portal activation-gating that ADR-0021 already found was never real.
- See `adr/0023-entity-rendering-splits-into-character-entities-and-prop-entities.md` and `adr/0024-character-entity-picks-its-character-in-tiled-not-world-config.md`.
- This is the prerequisite issue #28 was blocked on without being filed as such; #28 itself still needs its own follow-up grilling pass on the stop-condition question before it's ready-for-agent. (Resolved — see [Cutscene Follow Step & Cutscene-Driven Zone Entries](../content/cutscene-follow-step.md).)
