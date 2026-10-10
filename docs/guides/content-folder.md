# Content folder reference

For Authors. Everything you Publish lives in one folder on your machine, the content folder (`crpg` calls it the content root). It holds the Asset Library, which any World can use, and one folder per World. You run every `crpg` command from it. No sample World ships with this project: bring your own Maps and art, or build a tiny one in [`getting-started.md`](getting-started.md).

```text
my-content/
├── .env                              GAME_SERVICE_URL and PUBLISH_KEY; never commit it
├── library/                          the Asset Library
│   ├── characters/
│   │   └── hero/
│   │       ├── hero.png              the Character sheet
│   │       ├── character.json        its frame size
│   │       └── raw.png               your source art, never Published
│   └── tilesets/
│       └── forest.png                tilesets any World can use
└── worlds/
    └── forest-course/                one World; the folder name is its id
        ├── forest-course.tiled-project
        ├── world.json                where the Player starts
        ├── strings.json              the String Table
        ├── maps/
        │   ├── village.tmj
        │   └── cave.tmj
        ├── tilesets/
        │   └── cave-walls.png        tilesets only this World uses
        ├── scripts/
        │   ├── cast.clsc
        │   └── village.clsc
        ├── portraits/
        │   └── Guard/
        │       ├── neutral.png
        │       └── angry.png
        └── cg/
            └── intro/
                ├── 1.png
                └── 2.png
```

To start a World, run `crpg tiled <world>` in the content folder. It creates `worlds/<world>/` with its empty folders, a placeholder `world.json` and `strings.json`, and the World's Tiled project (see [`tiled-object-authoring.md`](tiled-object-authoring.md)). It never creates `library/`: lay that out yourself.

World ids and Character ids use lower-case `a-z`, `0-9`, `-` and `_` only. A World id is permanent once Students have played it, because their Flags are stored under it.

Keep the content folder in git if you share it with other Authors. Add `.env` to its `.gitignore` first, because it holds the Publish key. The Author wizard offers to do that for you ([`crpg.md`](crpg.md#settings)).

A file outside the layout above, such as a notes file, is ignored. So is any file named `raw.*` (`raw.png`, `raw.aseprite`): that is the place for your source art.

## `library/`

### Characters

A Character is the walking appearance of the Player or of a Character Entity. Each one is a folder named for its id:

- `library/characters/<id>/<id>.png`: the sheet, in the four-direction layout in [`character-spritesheet-layout.md`](character-spritesheet-layout.md)
- `library/characters/<id>/character.json`: the size of one frame in pixels, and an optional vertical offset:

  ```json
  { "frameWidth": 32, "frameHeight": 32, "offsetY": 0 }
  ```

  `offsetY` moves the sprite up or down on its tile, in pixels. Leave it out, or at `0`, unless the feet don't sit on the tile.

A Publish uploads only the Characters the World uses: the `player` in `world.json`, every Entity's `characterId` on its Maps, and every `character` its Scripts declare.

### Tilesets

`library/tilesets/` holds tileset images that more than one World uses. Subfolders are fine.

## `worlds/<world>/`

### `world.json`

Where the Player starts, and as which Character:

```json
{
  "startMap": "village",
  "spawn": { "x": 4, "y": 7 },
  "player": "hero"
}
```

- `startMap` is a Map's file name without `.tmj`.
- `spawn` is a tile on that Map, counted from `0` at the top left.
- `player` is a Character id in `library/characters/`.

### `maps/`

One Tiled Map per file, saved as JSON (`.tmj`). The file name is the Map's id. `crpg publish` refuses:

- XML Maps (`.tmx`): save them as JSON instead
- external tilesets (`.tsx`): embed them in the Map (in Tiled's Tilesets panel, **Embed Tileset**)
- Maps that aren't orthogonal, and infinite Maps
- compressed tile layers: set **Tile Layer Format** to CSV or Base64 (uncompressed) in the Map's properties
- Maps with different tile sizes in one World
- an `entityId` or `zoneId` used twice anywhere in the World, even on different Maps

How to place Entities and Zones is in [`tiled-object-authoring.md`](tiled-object-authoring.md).

### `tilesets/`, and how tileset paths resolve

Tiled saves each tileset image as a path relative to the Map. `crpg publish` doesn't follow that path. It finds a folder in it to anchor on, and ignores everything before that folder:

- a path through `library/tilesets/` resolves to the Asset Library's `library/tilesets/`
- any other path through a `tilesets/` folder resolves to this World's own `worlds/<world>/tilesets/`

So `../../../library/tilesets/forest.png` and `/Users/me/art/library/tilesets/forest.png` both resolve to `library/tilesets/forest.png`, and `../tilesets/cave-walls.png` resolves to `worlds/<world>/tilesets/cave-walls.png`. A tileset image outside any `tilesets/` folder fails the Publish. Open the World's `.tiled-project` in Tiled, and pick tilesets from its Project panel, to keep the paths inside these folders.

### `scripts/`

The World's CodeLeagues Scripts, as `.clsc` files. Subfolders are fine. `crpg` brings its own `prelude.clsc`, so a file of that name here is an error. How to write Scripts is in [`codeleagues-script.md`](codeleagues-script.md).

### `strings.json`

The String Table: the text Scripts name with `@key`, one table per Locale. It is optional, and a World without one has an empty English table. Its shape is in [`codeleagues-script.md`](codeleagues-script.md).

### `portraits/`

`portraits/<Speaker>/<expression>.png`, one folder per Speaker. See [`dialogue-portrait-assets.md`](dialogue-portrait-assets.md).

### `cg/`

`cg/<cg-id>/`, one folder of frames per CG. See [`cg-art-assets.md`](cg-art-assets.md).

## Checking it

`crpg publish <world> --dry-run` runs every check and uploads nothing. Each problem names the file and the reason. Every check is listed in [`crpg.md`](crpg.md#checks).
