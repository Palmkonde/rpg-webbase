# Authoring Spawn/Entity/Portal objects in Tiled

How to place a Spawn, Entity, or (later) Portal on a Map. For why this mechanism was chosen over the alternatives, see `../adr/0010-tiled-objects-tagged-by-custom-class.md`.

## Where objects live

All of them go in the map's single `objects` object-layer — don't create a new layer per kind. Layers are reserved for render order (`ground`, `obstacle`, `collision`); object *kind* is tagged separately (see below).

## Tagging an object's kind

Each object's Tiled **Class** field (labeled "Type" in older Tiled versions) is set to a Custom Class, not a freeform string. The project already defines:

- `Spawn`
- `Entity`
- `Portal`

in `test_map.tiled-project`'s Custom Types. Placing an object and picking one of these from the Class dropdown tags it — no typing a string by hand, no risk of a typo silently producing an untagged object.

## Adding a new kind

If a future ticket needs a new object kind, define it once via `View → Custom Types Editor → + → Class` in Tiled (requires the map to belong to a Tiled Project, which `test_map.tiled-project` already provides), scope it to `useAs: ["object"]`, and add member properties if the kind needs data beyond position/name (e.g. Portal will need a target Map + target Spawn Point when ticket 04 designs it).

## Identifying an object

An object's Tiled `name` field is used as its id (e.g. an Entity's `entityId`) — no separate id property needed.
