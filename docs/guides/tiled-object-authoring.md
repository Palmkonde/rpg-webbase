# Placing Entities and Zones in Tiled

How to place the objects the Engine reads on a Map. For why it works this way, see [`adr/0010`](../adr/0010-tiled-objects-tagged-by-custom-class.md) (Custom Class tagging) and [`adr/0012`](../adr/0012-map-objects-any-layer-dedicated-identity-property.md) (any layer, a dedicated identity property).

## Open the World's Tiled project

From the content folder ([`content-folder.md`](content-folder.md)), run:

```sh
crpg tiled <world>
```

Then open `worlds/<world>/<world>.tiled-project` in Tiled instead of the loose Maps. The project lists the Asset Library as a folder, and defines every custom type the Engine reads:

- the Classes `Entity` (`entityId`, `characterId`, `facing`), `Zone` (`zoneId`) and `Portal` (no members: the Engine doesn't read Portals yet)
- the enums `Facing` (`down`, `left`, `right`, `up`) and `CharacterId` (one value per Character in `library/characters/`)

Run it again after adding a Character to the Library, to refresh the `CharacterId` list. It rewrites only those generated types and the project's two folders. Your Maps, your own custom types and your other project settings stay as they are.

## Where objects go

On any object layer, and on as many object layers as you like. An object's kind comes from its Class, never from its layer, so group objects into layers however suits the Map. Tile layers (`ground`, `obstacle`, `collision` and the rest) are separate, and aren't affected.

## Tagging and naming an object

Set the object's **Class** to `Entity` or `Zone` from the dropdown. Don't type it.

Then fill in its identity property: `entityId` for an Entity, `zoneId` for a Zone. Scripts find the object by this id (`on interact(<entityId>)`, `on enter(<zoneId>)`). The object's `name` field is only a label for you, and you can rename it freely.

Each `entityId` and each `zoneId` must be unique in the whole World, across every Map. Tiled doesn't check this, but `crpg publish` does, and it fails on a repeat. An Entity and a Zone may share an id.

## Placing a Zone

A Zone is a rectangle, not a point. Draw it with **Insert Rectangle**, snapped to the tile grid, so it covers whole tiles. Two overlapping Zones are allowed: the first one entered wins. The Engine warns about them when the Map loads.

## Placing an Entity

1. Select an object layer and drop an object with snapping on. For a Prop Entity, use **Insert Tile**, since the tile is its picture.
2. Set **Class** to `Entity`, and fill in `entityId`.
3. For a Character Entity, such as an NPC or a monster, pick its `characterId` from the dropdown, and set `facing`, the direction it idles in. Leave `characterId` blank for a Prop Entity, such as a sign or a campfire: it shows the object's own tile and never moves.
4. Publish ([`crpg.md`](crpg.md)) and reload the game. The Character stands on that tile, facing `facing`.

A Character Entity's `entityId` is also the name a Script's `mover` declares to move it in a Cutscene ([`codeleagues-script.md`](codeleagues-script.md)). A `characterId` with no Character in `library/characters/` fails the Publish.

`characterId`'s default stays blank on purpose. Tiled leaves out a value that equals its default when it saves, so a non-blank default could silently turn a Character Entity into a Prop Entity.
