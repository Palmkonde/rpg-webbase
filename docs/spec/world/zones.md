# Zone: Walking Into a Region Triggers a Script

Confirmed 2026-09-27 via grilling session. Resolves the "tile/zone-entered Script trigger" item "Dialogue Scripts" Out of Scope left deferred (superseding that bullet and "CG & Cutscene"'s own matching deferral — both are updated to point here) and extends the Engine's set of Script-driving triggers with a third kind, alongside Interact (ticket 05/12) and the Map-entry `transitioned` trigger (ticket #13, since built as `on arrive` — `adr/0047`). See `GLOSSARY.md`'s new **Zone** entry and `adr/0019` through `adr/0022` for the four architectural calls below.

## Problem Statement

Every existing way a Script can run today requires either an explicit action (pressing Interact while facing an Entity) or crossing a Map's outer boundary (the `transitioned` event, driving ticket #13's Map-entry Scripts). Neither covers the reference-point beat this project is aiming for (Undertale, RPG tutorial sequences): a Player walking into a room or across a threshold *within* a Map and having a scene simply begin, with no button press and no full Map change. Content authors currently have no way to place that kind of trigger at all.

## Solution

A new Map-object kind, **Zone** — a Tiled-authored rectangular region, tagged and identified the same way Entity already is (Custom Class + a dedicated `zoneId` property) but drawn as a real multi-tile rectangle instead of a single point. The Engine emits a new `zoneEntered` Engine Event the instant the Player's grid position transitions from outside a Zone's rectangle to inside it — including the Player's very first appearance on any Map, if that spawn tile happens to fall inside one. Whatever Script is found for that `zoneId` runs exactly the same way an Entity's (or, once built, a Map's) Script does: it can produce Dialogue, a CG, or a Cutscene, gated so it plays at most once per Student via the same `runOnce`/Flag mechanism CG and Cutscene already share.

## User Stories

1. As a Player, I want walking into a specific area of a Map to start a Cutscene/CG/Dialogue automatically, so that a scene can begin the way it does in the RPGs this project is modeled on, without needing to press a button on an NPC first.
2. As a content author, I want to place a Zone the same way I already place a Spawn/Entity/Portal, so that I don't have to learn a second Map-authoring mechanism for a third trigger kind.
3. As a content author, I want a Zone's Script to be able to produce Dialogue, a CG, or a Cutscene, so that I'm not limited to only one kind of content for a walk-in trigger.
4. As a content author, I want a Zone to be findable by the same generic "look up a Script by id" mechanism Entities already use, so that authoring a Zone's Script feels identical to authoring an Entity's.
5. As a Player, I want a Zone's Cutscene/CG to only ever play once, so that walking back through the same doorway later doesn't replay the same scene.
6. As a Player, I want walking into a Zone whose Script produces a Cutscene or CG to freeze me for its duration, exactly the way an NPC-triggered Cutscene already does, so the experience is consistent regardless of what triggered it.
7. As a Map author, I want to draw a Zone as a rectangle covering more than one tile, so that a doorway-sized or room-sized trigger area doesn't require me to precisely land on a single tile.
8. As a Map author, I want a Zone's identity to come from a dedicated `zoneId` property (not its display `name`), so that renaming a Zone for authoring clarity can never silently break a Script reference, matching how Entity's `entityId` already works.
9. As a Map author, I want to be warned if I accidentally give two Zones on the same Map the same id, so that I catch a copy-paste mistake the same way Entity's duplicate-id warning already catches it.
10. As a Player, I want a Zone to trigger even if my very first appearance on a Map (right after boot's intro CG, or after walking through a Portal into a new Map) happens to land inside one, so that "the moment I arrive somewhere" can itself be a trigger, not just "the moment I walk somewhere new after already being there."
11. As a Player, I want a Zone to not trigger repeatedly while I stand still inside it, so that it behaves like a single moment, not a continuous effect.
12. As a Host developer, I want `zoneEntered` to carry only a `zoneId`, mirroring `interacted`'s own minimal `entityId`-only shape, so the Engine Event contract stays as small as ADR-0004 already established this project prefers.
13. As a Host developer, I want the same Host-side dispatch that already turns an Entity's Script result into Dialogue/CG/Cutscene to handle a Zone's Script result too, with no new dispatch logic, so that "what a Script produces" stays decoupled from "what triggered it."
14. As an Engine developer, I want Zone detection to use grid-engine's own position-tracking (`steppedOn`/`getPosition`), not a hand-rolled per-frame poll, so that detection stays as cheap and idiomatic as everything else this Engine already does with grid-engine.
15. As an Engine developer, I want a Zone's authored rectangle converted to a fixed list of grid tiles once, at Map load, so that "is the Player inside this Zone" is a plain tile-membership question, never a pixel-level collision calculation.
16. As a Map author, I want to know that a Zone's rectangle should be drawn snapped to the tile grid, so that the pixel-to-tile conversion is unambiguous and I'm not left guessing why a Zone that's a half-tile off doesn't behave as expected.
17. As a Map author, I want overlapping Zone rectangles to at least warn me at Map load, so that an accidental overlap doesn't silently produce confusing "which one fired" behavior with no diagnostic at all.
18. As a Host developer, I want a Zone's Script found via a lookup mechanism shared with Entity's (parameterized by kind/folder), not a hand-duplicated copy of the same import/try-catch logic, so that a third trigger kind later doesn't mean a third near-identical function.
19. As a future maintainer, I want it recorded that ticket #13's Map-entry Script (keyed by `transitioned`'s `toMapId`) stays a separate, already-shipped Engine Event, not folded into or replaced by Zone, so that I don't try to "simplify" two genuinely different concepts (crossing a Map's outer boundary vs. entering a region inside one) into each other.
20. As a future maintainer, I want it recorded that a Zone's activation is not gated by World Config (every Zone authored on the loaded Map is simply live), matching how Entity/Portal activation already works in practice today despite the spec's original "which are active" language, so I don't go looking for WorldConfig plumbing that was never built for Entities/Portals either.
21. As a future maintainer, I want it recorded why overlapping-Zone resolution stays undesigned beyond a load-time warning (deterministic "first match," not specially engineered), so a future contributor doesn't assume a priority/ordering system exists that was never built.
22. As a Player, I want the Player character's actual sprite size to have no bearing on whether I've "entered" a Zone, so that the trigger always matches my logical grid position, the same as every other Engine mechanic already does.
23. As a Map author, I want a guide explaining how to place and tag a Zone in Tiled, so that I'm not reverse-engineering the convention from source code.
24. As a Host developer, I want Zone's `runOnce` gating to reuse the exact seen-flag convention CG/Cutscene already use (`<id>_seen`), so that "don't replay" logic doesn't get a second, parallel implementation.
25. As a QA reviewer, I want the pure Tiled-parsing seam (`collectZones`/`readZone`) to be the one place this feature's core logic is unit-tested, so that a reviewer isn't left looking for tests of Scene-internal/grid-engine wiring that was deliberately left to manual verification, consistent with how Entity Interact already works.

## Implementation Decisions

- **Terminology**: **Zone** — a Tiled-authored, Class-tagged rectangular region on a Map, identified by a dedicated `zoneId` property. `GLOSSARY.md` gains this term.
- **Authoring**: A new Tiled Custom Class `Zone`, defined in the Map's Tiled Project alongside `Spawn`/`Entity`/`Portal`. Placed as a real rectangle object (not a point), required by authoring convention (documented in a guide, not enforced by the Engine) to be drawn snapped to the tile grid so its pixel bounds convert unambiguously to a whole-tile range.
- **Identity & duplicate detection**: A Zone's identity is its `zoneId` property, exactly mirroring Entity's `entityId` (never `name`). The existing per-Map duplicate-id warning (`findDuplicates`) extends to cover `zoneId`s the same way it already covers `entityId`s.
- **Overlap handling**: Two Zones whose rectangles overlap are not specially resolved — deterministic "first match wins" — but the Engine's per-Map load pass warns (`console.warn`) if it finds overlapping Zone rectangles, the same diagnostic-not-error treatment duplicate ids already get. Full overlap-resolution semantics stay explicitly undesigned pending a concrete need.
- **Tiled → Engine conversion**: A Zone's `x, y, width, height` (pixels) convert once, at Map load, into a fixed list of covered grid tiles — the same floor-division approach `readEntity` already uses for a point object's position, applied across the full rectangle. The resulting shape, from analysis during grilling (not a built prototype):
  ```ts
  interface ZoneObject {
    zoneId: string
    tiles: { x: number; y: number }[]
  }
  ```
- **Detection mechanism**: Uses grid-engine's own `steppedOn(charIds, tiles, layer)` observable — subscribed once per Zone at Scene creation — rather than a per-frame position poll (unlike Entity Interact's existing `getFacingPosition` check, which does poll every frame; Zone detection is push-based and doesn't touch that existing pattern). The Player's very-first-appearance case (spawn tile already inside a Zone) additionally needs one explicit `getPosition(PLAYER_ID)` check at Scene creation, since `steppedOn` only fires on an actual movement-driven entry.
- **Engine Event**: A new, minimal Engine Event, `{ type: 'zoneEntered', zoneId: string }`, mirroring `interacted`'s own minimalism (ADR-0004).
- **Fire semantics**: Edge-triggered only — fires once on the outside→inside transition (including the Player's first-ever appearance on a Map, treating "not yet spawned" as trivially outside every Zone), never continuously while the Player stands inside. Applies uniformly at every Map (re)load — boot and every subsequent Portal transition (edge-walk was later dropped, see "Portals and Named Spawn Points") — not specially cased to the very first boot. (Later narrowed: entries while the Engine is paused are dropped — see [Cutscene Follow Step & Cutscene-Driven Zone Entries](../content/cutscene-follow-step.md).)
- **Replay gating**: Reuses the existing `runOnce`/Flag mechanism unchanged (the same `<id>_seen` Flag convention CG/Cutscene already use) — a Zone's Script plays at most once per Student, exactly like a Script-triggered CG/Cutscene already does.
- **Script dispatch**: No new dispatch logic — whatever Script a `zoneId` resolves to produces the same `ScriptResult` (Dialogue | CgTrigger | CutsceneTrigger) an Entity's Script already can, handled by the same existing Host-side dispatch.
- **Script-lookup generalization**: The existing per-entityId Script lookup (dynamic import + try/catch) generalizes into one shared helper parameterized by kind (e.g. `entities/`, `zones/`), rather than either a fully duplicated parallel function per kind or a single flat cross-kind id namespace — avoiding both code duplication and cross-kind id collisions.
- **Relationship to ticket #13 (Map-entry Script)**: Zone and Map-entry stay two separate, coexisting Engine Events. Zone does not touch, generalize, or reopen the already-shipped `transitioned` Engine Event or ticket #13's own scope (since built as `on arrive` — `adr/0047`) — they share the Script-lookup pattern, not the Engine Event contract.
- **Activation**: No WorldConfig-gated filtering — every Zone authored on the currently-loaded Map is simply always live, matching the actual (not originally-aspirational) behavior Entities/Portals already have.
- **Character layer**: Fixed to this project's single existing character layer (`"ground"`) — no multi-layer/multi-floor concept exists elsewhere in the codebase to design around.

## Testing Decisions

- Matching the existing pattern (`node:test`/`node:assert/strict`, raw Tiled-JSON-shaped literals in, typed objects out, no mocking framework): the one seam this feature adds pure logic at, `collectZones`/`readZone` (mirroring `collectEntities`/`readEntity`'s existing test file and style), gets unit tests — given a raw Tiled object with Class=Zone, a `zoneId` property, and a pixel rectangle, asserts the correct `zoneId` and the correct, complete list of covered grid tiles; also covers a Zone missing/blank `zoneId` being skipped, and an object tagged with a different or no Class being skipped, mirroring `collectEntities`'s own existing test coverage exactly.
- The generalized Script-lookup helper reuses and extends `runEntityScript`'s existing test seam (`scripts.test.ts`) rather than introducing a new one — same assertions, just proven to also resolve a `zones/`-sourced Script by a `zoneId`.
- The duplicate-`zoneId` per-Map warning reuses `findDuplicates`'s existing test coverage (`util.test.ts`) as-is — no new pure function, so no new tests, just a new call site.
- Everything past those two pure-function seams — `steppedOn`/`getPosition` actually firing in a running Scene, the Player actually freezing, a Cutscene/CG/Dialogue actually appearing on walking into a Zone, the spawn-already-inside case actually firing at Map load, and the overlapping-Zone warning actually appearing in a browser console — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: place a test Zone over/near the Spawn Point, confirm walking into it from outside triggers its Script exactly once, confirm re-entering afterward does nothing (already seen), confirm a Zone placed so the Spawn Point itself falls inside it fires immediately on Map load, and confirm two overlapping test Zones produce a console warning at Map load.

## Out of Scope

- Any change to World Config, or building real "active Entities/Portals/Zones" filtering — Zones follow the existing de facto "everything authored is live" behavior; retrofitting real activation filtering is a separate, bigger change affecting Entities/Portals too.
- Reopening or restructuring the already-shipped `transitioned` Engine Event, or ticket #13's own scope — Zone is a new, separate, coexisting Engine Event.
- Deterministic priority/ordering rules for overlapping Zones beyond a load-time warning — "first match wins" stays undesigned/unspecified further.
- Non-rectangular Zone shapes (polygon, ellipse, ...) — Tiled's rectangle object only.
- Pixel-precise or sprite-bounding-box collision — the Player is always a single grid tile, matching every other Engine mechanic; a Zone's tile-membership check is the entire mechanism.
- A continuous "while standing inside" trigger mode — Zone is strictly edge-triggered, once per entry, gated to at most once ever per Student.

## Further Notes

- This is a new, permanent Engine Event type and a new Tiled Custom Class — a genuinely hard-to-reverse architectural decision per this project's own convention (`CLAUDE.md`'s "Where decisions live"). See `adr/0019` (Zone stays a separate Engine Event from `transitioned`), `adr/0020` (Script lookup-by-id generalizes to one shared, kind-parameterized helper), `adr/0021` (Zone activation isn't World Config-gated, matching Entity/Portal's actual behavior), and `adr/0022` (spawning inside a Zone counts as entering it).
- `docs/guides/tiled-object-authoring.md` is expected to gain a Zone-authoring section, extending the existing Spawn/Entity/Portal guide rather than a new file, per `CLAUDE.md`'s "one topic per file" rule.
- Verified against grid-engine's actual installed API (`steppedOn`, `getPosition`, `Position`/`CharLayer` types) during grilling, not assumed.
- See [CG & Cutscene](../content/cg-and-cutscene.md) and [CG & Cutscene as Script Output](../content/cg-and-cutscene-as-script-output.md) for the Dialogue/CG/Cutscene dispatch mechanism this reuses entirely unchanged.
