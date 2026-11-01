# Portals and Named Spawn Points: Moving Between Maps

Confirmed 2026-10-26 via grilling session on #3. Decision record: `adr/0046`, amending `adr/0005`. Replaces this spec's earlier "edge-walk and Portal" pair with Portals alone. See `GLOSSARY.md`'s **Transition**, **Portal** and **Spawn Point** entries.

## Problem Statement

A World can hold many Maps, but a Student can never leave the first one. `world.json` names one start Map, and nothing on a Map leads anywhere else. The `transitioned` Engine Event has existed since ADR-0004, yet nothing emits it and the Host ignores it. An Author who wants a way out of a schoolyard, a door into a building, or stairs down a dungeon floor has nothing to draw in Tiled. The earlier plan, walking off a Map's edge, doesn't fit real Maps: edge tiles are walkable, so a whole edge can't mark one opening, and a Map with two ways in had only one default place to land.

## Solution

An Author draws a Portal: a rectangle on any object layer, Class `Portal`, over the opening or the door, naming a target Map and a Spawn Point on it. A Spawn Point is a point object, Class `SpawnPoint`, with a `spawnId` unique on its Map. Each way into a Map gets its own, so a Student who walks back through a Portal lands beside the one they left by. When the Student's own step takes the Player onto a Portal, the Engine reports a Transition with the target Map and the Spawn Point's tile. The Host tears the Engine down and builds it again on the new Map. `crpg` generates the two Classes for Tiled, checks every Portal's target at Publish, and puts each Map's Spawn Points in the manifest, so the Engine never has to load a Map it isn't showing.

## User Stories

1. As a Student, I want to walk through an opening at a Map's edge and arrive on the next Map, so that the World feels like one connected place.
2. As a Student, I want to step through a door, gate or stairway in the middle of a Map and arrive on another Map, so that buildings and dungeon floors can be their own Maps.
3. As a Student, I want to walk back through the way I came and land beside the Portal I left by, so that I don't lose my bearings on a Map with several ways in.
4. As a Student, I want to walk along a Map's edge without being sent anywhere, so that only the openings the Author drew lead off the Map.
5. As a Student, I want arriving on a Map to never send me straight back, even if my Spawn Point sits on a Portal, so that I can't bounce between two Maps.
6. As a Student, I want a Cutscene that walks my Player across a Portal to keep me on the current Map, so that a scene plays out where it was written.
7. As a Student, I want stepping onto a Portal while a Cutscene or CG is playing to do nothing, so that nothing yanks me out of a scene.
8. As a Student, I want walking within one wide Portal to send me only once, so that a multi-tile opening behaves like one door.
9. As a Student, I want an open Dialogue to close when I leave a Map, so that a line from the old Map never hangs over the new one.
10. As a Student, I want the camera to settle on the new Map after a Transition, so that the view never shows the old Map's bounds.
11. As an Author, I want to draw a Portal as a plain rectangle with no tile art, so that adding a way between Maps needs no new tileset.
12. As an Author, I want to pick a Portal's target Map from a dropdown in Tiled, so that I can't misspell a Map id.
13. As an Author, I want to name a Portal's target Spawn Point, so that I choose exactly where the Student arrives.
14. As an Author, I want to place Spawn Points as point objects on any object layer, so that I mark arrival tiles the same way I already place Entities.
15. As an Author, I want a `spawnId` to need only be unique on its own Map, so that every Map can have a `gate` or a `north` without clashing.
16. As an Author, I want `crpg publish` to fail when a Portal names a Map the World doesn't have, so that a broken link never reaches Students.
17. As an Author, I want `crpg publish` to fail when a Portal names a Spawn Point its target Map doesn't have, so that a Student never arrives nowhere.
18. As an Author, I want `crpg publish` to fail when two Spawn Points on one Map share a `spawnId`, so that a Portal's target is never ambiguous.
19. As an Author, I want `crpg publish` to fail when a Spawn Point lies outside its Map, so that a Student never arrives off the grid.
20. As an Author, I want each failure to name the Map file and the Portal or Spawn Point, so that I can fix it in Tiled straight away.
21. As an Author, I want `crpg tiled` to regenerate the Map dropdown when I add a Map, so that a new Map is a valid target right away.
22. As an Author, I want the Engine to warn when two Portals overlap, so that an accidental overlap doesn't silently pick one.
23. As an Author, I want the guide to tell me to keep Portals off Zones and off each other, and what happens if they do overlap, so that I don't have to guess which fires.
24. As an Author, I want the guide to show how to place a Portal and a Spawn Point, so that I don't reverse-engineer the convention.
25. As an Author, I want `world.json`'s start to keep working unchanged, so that existing Worlds publish as before.
26. As a Host developer, I want `transitioned` to keep the shape ADR-0004 sized (`fromMapId`, `toMapId`, `spawn`), so that the Host only has to remount with what the event already carries.
27. As a Host developer, I want a Transition to reuse the same create-and-destroy path as the first mount, so that there is one way an Engine comes up.
28. As a Host developer, I want a running Script stopped before the old Engine goes, so that no Script keeps acting on a destroyed Engine.
29. As a Host developer, I want Companions re-applied after the remount the same way as after the first mount, so that a Companion authored on the new Map behaves as it does today.
30. As an Engine developer, I want each Map's Spawn Points delivered through `MapDefinition`, so that the Engine resolves a Portal's target without loading the target Map.
31. As an Engine developer, I want Portal and Spawn Point parsing to sit beside Zone and Entity parsing, so that every Tiled object kind is read the same way.
32. As a future maintainer, I want it recorded why edge-walk was dropped, so that nobody adds it back as a second mechanism.

## Implementation Decisions

- **No edge-walk** (`adr/0046`). A Transition comes only from a Portal. An opening at a Map's edge is a Portal drawn over it.
- **Portal object.** A rectangle, Class `Portal`, on any object layer, snapped to the grid, as a Zone is. It has two members: `targetMap` (a Map id) and `targetSpawn` (a `spawnId` on that Map). A Portal has no identity of its own: no Script keys on it. A Portal missing either member is refused by `crpg publish`, and skipped with a warning by the Engine.
- **Spawn Point object.** A point object, Class `SpawnPoint`, on any object layer, with one member, `spawnId`. Its pixel position converts to a grid tile the way an Entity's does.
- **Parsing.** Engine core gains a Portal reader next to the Zone and Entity readers. A Portal becomes its covered tile list plus its target. The overlap check Zones already use also warns about overlapping Portals at Map load. Only `crpg` reads Spawn Points from Tiled: the Engine gets them through `MapDefinition`. A Portal whose target the catalog lacks is skipped with a warning.
- **Firing rule.** A Portal fires when the Player's own step moves them from a tile outside the Portal onto a tile inside it, while the Engine isn't paused. It never fires on arriving at a Spawn Point, on a Cutscene Movement or Follow step, or on a step between two tiles of the same Portal. A step while paused is dropped, not saved for later (as for Zones, `adr/0026`). Of two overlapping Portals, the first found wins. When a Portal and a Zone share the tile, the Transition fires and that step's Zone entry is dropped, so the Zone stays unplayed.
- **Spawn Points reach the Engine through the manifest.** `crpg publish` reads every Map's Spawn Points into the manifest's `spawnPoints`, keyed by Map id. The field is optional in the Game Service's manifest model, since World Versions Published before Portals have none, and the client treats a missing one as no Spawn Points. The client's catalog building passes them on, and `MapDefinition` gains `spawnPoints`, a record from `spawnId` to a tile. The Engine resolves a Portal's target through the catalog and emits `{ type: 'transitioned', fromMapId, toMapId, spawn: { x, y } }`, unchanged from ADR-0004. The Engine still never loads a Map it isn't showing (`adr/0028`).
- **Host remount** (`adr/0005`). On `transitioned`, the session ends any running Script, destroys the Engine, and creates a new one with `{ mapId: toMapId, player: { spawn, characterId } }`, keeping the Player's Character. Then it re-applies Companions as after the first mount. The live World Version is not fetched again (`adr/0038`).
- **`crpg tiled`.** The generated `Portal` Class gains `targetMap`, a generated `MapId` enum with one value per Map in `worlds/<world>/maps/`, and `targetSpawn` (string). A new `SpawnPoint` Class holds `spawnId` (string). Running it again refreshes `MapId`, as it already refreshes `CharacterId`.
- **`crpg publish` checks.** It fails on: a Portal whose `targetMap` isn't a Map of the World; a Portal whose `targetSpawn` isn't a Spawn Point on that Map; two Spawn Points on one Map with the same `spawnId`; and a Spawn Point outside its Map. Each failure names the Map file.
- **`world.json` unchanged.** Its `startMap` plus `{ x, y }` `spawn` still says where a new Student starts. Named Spawn Points are only Portal targets.
- **Demo content.** The `demo` World's `main_test` and the temporary `school` Map are joined both ways: a Portal on each, and a Spawn Point beside each Portal.
- **Docs.** `docs/guides/tiled-object-authoring.md` gains "Placing a Portal" and "Placing a Spawn Point". They cover drawing, the two members, the round-trip pattern (a Spawn Point beside each Portal) and the advice to keep Portals off Zones and off each other, with what happens if they overlap. `docs/guides/crpg.md` lists the new checks.

## Testing Decisions

- A good test drives a module through its public seam and asserts what a caller sees, not how it gets there. These are the seams the tests use, all existing ones:
- **Engine core, Tiled parsing** (prior art: the Zone and Entity reader tests). Raw Tiled JSON goes in. The tests assert a Portal's covered tiles, `targetMap` and `targetSpawn`, that blank members and other Classes are skipped, and that overlapping Portals are reported. A Spawn Point's tile is asserted through the manifest test instead.
- **`crpg` checks** (prior art: the Map checks driven through `check()`). One test per failure above, plus a valid round trip between two Maps that passes. The generated Tiled project's `Portal` members, `SpawnPoint` Class and `MapId` values go through the existing Tiled project tests.
- **Manifest** (prior art: the Publish tests, which run when the local services are up). A Published World's manifest carries each Map's Spawn Points.
- **Host remount** (prior art: the session tests with the fake Engine). Emitting `transitioned` destroys the old Engine and creates one with the target Map, the event's spawn and the same Character. A running Script stops.
- **Manual** (no browser automation, per `CLAUDE.md`). Walk `main_test` to `school` and back, and confirm each arrival is beside the right Portal. Confirm that standing on an arrival Portal doesn't fire it, and that stepping off and back on does. Confirm that a Cutscene walking the Player over a Portal doesn't fire it. Confirm that a Portal sharing a tile with a Zone fires the Transition and not the Zone. Confirm that two overlapping Portals warn in the console.

## Out of Scope

- Edge-walk as its own mechanism, `Exit` objects, and whole-edge links.
- Remembering the exact tile a Student left from.
- Companions coming along to another Map: #38.
- Resuming on the Map a Student was last on after a refresh: #145.
- Map-entry Scripts: #13.
- Locked Portals: #150.
- A Script moving the Player to a Map and Spawn Point: #142.
- Making `world.json`'s start a named Spawn Point.
- Fade or other effects between Maps.

## Further Notes

- `adr/0046` lists the rejected options: whole-edge links, an `Exit` Class, one default Spawn Point per Map, a remembered position, and a `toSpawnId` the Host resolves.
- The `school` Map is temporary content for building this. It lives in the gitignored content folder, not in the repo.
