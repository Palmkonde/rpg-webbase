# Authoring Spawn/Entity/Portal objects in Tiled

How to place a Spawn, Entity, or (later) Portal on a Map. For why this mechanism was chosen over the alternatives, see `../adr/0010-tiled-objects-tagged-by-custom-class.md` (Custom Class tagging) and `../adr/0012-map-objects-any-layer-dedicated-identity-property.md` (layer count and identity property).

## Where objects live

Any object layer, any number of them — there's no single dedicated `objects` layer to hunt for or stay confined to. Object *kind* is tagged via Class (see below), not by which layer an object sits on, so spreading objects across several object layers (to group them however makes sense for your Map) is fine. This is independent of your tile-rendering layers (`ground`, `obstacle`, `collision`, and however many more you add) — those aren't capped or affected by how many object layers you use.

## Tagging an object's kind

Each object's Tiled **Class** field (labeled "Type" in older Tiled versions) is set to a Custom Class, not a freeform string. The project defines:

- `Spawn`
- `Entity`
- `Portal`

in `test_map.tiled-project`'s Custom Types. Placing an object and picking one of these from the Class dropdown tags it — no typing a string by hand, no risk of a typo silently producing an untagged object.

## Identifying an object

An object's identity comes from a **dedicated Class-member property**, not its `name` field — `name` is just a free-text display label and is safe to rename for authoring clarity without breaking anything downstream. For an Entity, that property is `entityId` (a string), matching the field name the Engine/Host already use for it.

Tiled doesn't validate uniqueness on any property. Reusing an `entityId` on two objects on the *same* Map produces an Engine warning at load time (`console.warn`, not an error — the Map still loads). Reusing one *across* Maps isn't caught by the Engine (it only ever loads one Map at a time) — check with the standalone dev script over the whole Map catalog instead, once that exists.

## Adding a new kind

If a future ticket needs a new object kind, define it once via `View → Custom Types Editor → + → Class` in Tiled (requires the map to belong to a Tiled Project, which `test_map.tiled-project` already provides), scope it to `useAs: ["object"]`, and add member properties: a dedicated identity property named for that kind (e.g. Entity's `entityId` — not a shared generic name, and never `name`) if the kind needs to be looked up by id, plus whatever other data it needs beyond position (e.g. Portal will need a target Map + target Spawn Point when ticket 04 designs it).
