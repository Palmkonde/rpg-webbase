---
status: accepted (amends adr/0005: a Transition comes from a Portal, not a crossed edge, and lands on the Portal's named Spawn Point, not a Map's default one)
---

# Edge-walk folds into Portals, which target named Spawn Points

There is no separate edge-walk Transition. A way off a Map's edge is a Portal: a rectangle on any object layer, Class `Portal`, drawn over the opening, with `targetMap` and `targetSpawn`. A Spawn Point is a point object, Class `SpawnPoint`, with a `spawnId` unique on its Map. A Map has one for each way in, so walking back through a Portal lands the Player beside the Portal they left by. A Portal fires only on the Player's own step onto it from outside, never on arriving at a Spawn Point, being walked by a Cutscene, or moving within the same Portal, and a step while the Engine is paused is dropped (as for Zones, adr/0026). `crpg publish` reads every Map's Spawn Points into the manifest, so `MapDefinition` carries them and the Engine emits `transitioned` with coordinates, as adr/0004 sized it, without loading a Map it isn't showing (adr/0028).

## Considered Options

- **Whole-edge links** (a Map property `north: school`): rejected because edge tiles are walkable, so a whole edge can't mark one opening, and one edge could reach only one Map.
- **A separate `Exit` Class** fired by pressing outward from a boundary tile: rejected as a second mechanism for the same Transition. With a Portal one tile deep at the edge, the feel is nearly the same, and a locked Portal (#150) covers edges for free.
- **One default Spawn Point per Map** (adr/0005's wording): rejected because a Map with two ways in would drop a returning Player at the wrong one.
- **Remembering the tile the Player left from**: rejected because it needs per-session memory a refresh loses (#145), where an Author-placed Spawn Point is fixed and checkable.
- **`transitioned` carrying a `toSpawnId` the Host resolves**: rejected because it reshapes the event, and the Engine can resolve coordinates from `MapDefinition` instead.

## Consequences

`world.json`'s start keeps its `{ x, y }` spawn; only Portals use named Spawn Points.

A step onto a tile that a Portal shares with a Zone fires the Transition and drops the Zone entry, so the Zone stays unplayed. Of two overlapping Portals the first wins, and the Engine warns on load, as for Zones. Authors are told not to overlap a Portal with a Zone or another Portal (`docs/guides/tiled-object-authoring.md`).
