# 03: Edge-walk Transition to a second Map

**What to build:** A second Tiled Map exists, and walking the Player off the edge of the first Map transitions them onto the second Map at its Spawn Point.

**Blocked by:** 02

**Status:** ready-for-agent

**Architecture note:** see `docs/adr/0004-size-engine-event-contract-up-front.md` and `docs/adr/0005-host-remounts-on-transition-instead-of-engine-scene-switch.md`. `createEngine` gains an `onEvent` callback; the Engine emits a `transitioned` `EngineEvent` (fromMapId, toMapId, target Spawn Point) and the Host reacts by supplying a new World Config, rather than the Engine switching Phaser scenes itself. Still open, deferred during grilling: where the edge→target-Map connectivity and each Map's default Spawn Point get authored (likely new fields on `MapDefinition`) — settle this before implementing.

- [ ] A second Tiled-authored Map is added and loadable by the Engine
- [ ] Walking the Player off a configured edge of Map 1 triggers a Transition to Map 2
- [ ] The Player appears at Map 2's Spawn Point after the Transition
- [ ] The Engine emits an Engine Event describing the Transition (from-Map, to-Map) that the Host can observe
