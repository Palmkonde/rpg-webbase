# 05: Generic Entity interaction hook

**What to build:** A placeholder Entity placed on a Map that the Player can interact with, producing a generic Engine Event — with no dialogue/UI attached yet. Beyond the literal Phase 1 done-bar in docs/spec.md, but part of the Engine's overall MVP boundary; included here since it's cheap and doesn't depend on the Transition work in 03/04.

**Blocked by:** 02

**Status:** ready-for-agent

**Architecture note:** see `docs/adr/0004-size-engine-event-contract-up-front.md`. The `EngineEvent` union will already reserve an `interacted` variant when 03 lands — its exact fields (e.g. `entityId`) are provisional until this ticket is implemented. For *how* an Entity object is authored, see `docs/adr/0010-tiled-objects-tagged-by-custom-class.md` and `docs/guides/tiled-object-authoring.md` — Entities are tagged via a Tiled Custom Class in the map's shared `objects` layer, with the object's `name` field used as `entityId`.

- [ ] An Entity object can be authored on a Map (position only — the Engine has no concept of what it represents), via the Tiled Custom Class convention in `docs/guides/tiled-object-authoring.md`
- [ ] An interact input (e.g. a dedicated key) fires only when the Player is adjacent to/facing an Entity
- [ ] The Engine emits an Interaction Engine Event identifying which Entity was interacted with
- [ ] The Host does nothing with the event beyond observing/logging it — no dialogue UI is built here (placement of that UI is now resolved: a Host-side overlay, see `docs/spec/spec.md`'s "Dialogue Scripts" section and ticket 12 — just not built in this ticket)
