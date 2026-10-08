# Authoring Spawn/Entity/Portal/Zone objects in Tiled

How to place a Spawn, Entity, (later) Portal, or Zone on a Map. For why this mechanism was chosen over the alternatives, see `../adr/0010-tiled-objects-tagged-by-custom-class.md` (Custom Class tagging) and `../adr/0012-map-objects-any-layer-dedicated-identity-property.md` (layer count and identity property).

## Where objects live

Any object layer, any number of them — there's no single dedicated `objects` layer to hunt for or stay confined to. Object *kind* is tagged via Class (see below), not by which layer an object sits on, so spreading objects across several object layers (to group them however makes sense for your Map) is fine. This is independent of your tile-rendering layers (`ground`, `obstacle`, `collision`, and however many more you add) — those aren't capped or affected by how many object layers you use.

## Tagging an object's kind

Each object's Tiled **Class** field (labeled "Type" in older Tiled versions) is set to a Custom Class, not a freeform string. The project defines:

- `Spawn`
- `Entity`
- `Portal`
- `Zone`

in your Tiled Project's Custom Types (the project file lives outside this repo). Placing an object and picking one of these from the Class dropdown tags it — no typing a string by hand, no risk of a typo silently producing an untagged object.

## Identifying an object

An object's identity comes from a **dedicated Class-member property**, not its `name` field — `name` is just a free-text display label and is safe to rename for authoring clarity without breaking anything downstream. For an Entity, that property is `entityId` (a string); for a Zone, `zoneId`, matching the field names the Engine/Host already use for them.

Tiled doesn't validate uniqueness on any property. Reusing an `entityId`/`zoneId` on two objects on the *same* Map produces an Engine warning at load time (`console.warn`, not an error — the Map still loads). Reusing one *across* Maps isn't caught by the Engine (it only ever loads one Map at a time) — check with the standalone dev script over the whole Map catalog instead, once that exists.

## Placing a Zone

Unlike Spawn/Entity/Portal (single points), a Zone is drawn as a real rectangle — draw it snapped to the tile grid (whole-tile x/y/width/height) so its pixel bounds convert to a whole-tile range unambiguously; the Engine doesn't enforce this. Two Zones whose rectangles overlap aren't an error (first entered wins), but produce a load-time warning the same way a duplicate `zoneId` does.

## Placing a Character Entity

An Entity with a non-blank `characterId` renders as an animated character (an NPC, a monster); without one it's a Prop Entity. Its `entityId` doubles as the `charId` a Cutscene Movement step targets. For why `characterId` lives in Tiled rather than World Config, see `../adr/0024-character-entity-picks-its-character-in-tiled-not-world-config.md`.

### One-time: define the enums and Entity members in your Tiled Project

Open `View → Custom Types Editor`:

1. Add an **Enum** `CharacterId` (storage type **String**, "Values as flags" off) with one value per Character in the content folder's `library/characters/` (e.g. `fluffy`, `temmie`). Add a value here by hand whenever a new Character is added — it isn't synced automatically.
2. Add an **Enum** `Facing` (String, not flags) with the values `down`, `left`, `right`, `up`.
3. Select the `Entity` class and add three members:
   - `entityId` — **string**, no default.
   - `characterId` — type **CharacterId**, default **blank**. A non-blank default can make Tiled omit the value from the saved map when it matches, silently turning the Entity into a Prop Entity.
   - `facing` — type **Facing**, default `down` (the Engine also defaults a missing `facing` to `down`).

### Placing one

1. Select an object layer and drop an object (the **Insert Point**/**Insert Rectangle** tools work; snap it to the tile grid).
2. Set **Class** to `Entity`, then fill in `entityId` (unique on the Map), `characterId` (pick from the dropdown), and `facing` (the idle direction in-game comes from this value, not from any picture in Tiled).
3. Reload the game: the animated sprite stands on that tile facing `facing`. A `characterId` missing from the catalog logs an `unknown characterId` warning and skips that Entity.

## Adding a new kind

If a future ticket needs a new object kind, define it once via `View → Custom Types Editor → + → Class` in Tiled (requires the map to belong to a Tiled Project), scope it to `useAs: ["object"]`, and add member properties: a dedicated identity property named for that kind (e.g. Entity's `entityId` — not a shared generic name, and never `name`) if the kind needs to be looked up by id, plus whatever other data it needs beyond position (e.g. Portal will need a target Map + target Spawn Point when ticket 04 designs it).
