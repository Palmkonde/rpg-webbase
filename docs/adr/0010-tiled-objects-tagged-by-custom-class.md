---
status: superseded by ADR-0012 (single-layer and name-as-id specifics only — the Custom Class tagging decision below still stands)
---

# Map objects are tagged by a Tiled Custom Class, not a dedicated layer or a freeform string

Spawn, Entity, and (eventually) Portal objects all need the Engine/Host tooling to tell them apart. We considered a dedicated named object-layer per kind (an `entities` layer, a `portals` layer, ...), a single shared layer with a freeform `type` string (what the map already did for Spawn), and a single shared layer using Tiled's Custom Class mechanism. We chose Custom Classes in one shared `objects` layer: it's Tiled's own documented mechanism for exactly this (see [Tiled Custom Properties](https://doc.mapeditor.org/en/stable/manual/custom-properties/)), it keeps Tiled's layers free for their existing render-order job (`ground`/`obstacle`/`collision`), and it avoids a new named layer for every future object kind. The cost: this requires a Tiled Project file (`test_map.tiled-project`) to hold the class definitions, so authoring a new kind of map object now depends on a project-level artifact, not just a per-object property typed freehand.
