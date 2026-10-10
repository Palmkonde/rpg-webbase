# crpg reference

For Authors. `crpg` checks a World in your content folder ([`content-folder.md`](content-folder.md)) and Publishes it to the Game Service. Students play only what is Published. Each Publish makes a new World Version and puts it live. Students already playing keep their World Version until they reload. For a first World, follow [`getting-started.md`](getting-started.md).

## Install

```sh
npm install -g @codeleagues-rpg-engine/cli@<version>
crpg --help
```

- `<version>` is the Game Service's version: ask your operator.
- It runs on Node 20.12 or later, or on Bun. It needs no Rust or Nix.
- Without a global install: `npx @codeleagues-rpg-engine/cli@<version> <command>`. Don't use `npx crpg`: there is no package named `crpg`, so npx would fetch whatever someone publishes under that name.

## Settings

`publish`, `versions` and `prune` talk to the Game Service. They read two settings:

| Setting | What it is |
|---|---|
| `GAME_SERVICE_URL` | The Game Service's URL, with `http://` or `https://` |
| `PUBLISH_KEY` | Its Publish key, from the operator |

`crpg` reads them from the environment, or from a `.env` file in the folder it runs in. A variable set in your shell wins over `.env`. The Author wizard writes the `.env` for you:

```sh
cd my-content
curl -fsSLO https://raw.githubusercontent.com/Palmkonde/rpg-webbase/main/scripts/author-setup.sh
less author-setup.sh   # read it before you run it
bash author-setup.sh
```

It checks the folder holds `library/` and `worlds/`, writes the two settings to `.env`, offers to add `.env` to `.gitignore` (it holds the Publish key), checks the service answers, and runs a dry run of a World you name. By hand, `.env` is:

```sh
GAME_SERVICE_URL=https://game.example.com
PUBLISH_KEY=the-key-the-operator-gave-you
```

## Commands

Run every command from the content folder: the folder holding `library/` and `worlds/`.

| Command | What it does |
|---|---|
| [`crpg publish <world>`](#crpg-publish) | Checks a World and Publishes it |
| [`crpg versions <world>`](#crpg-versions) | Lists a World's World Versions |
| [`crpg prune`](#crpg-prune) | Deletes old World Versions and unused files |
| [`crpg tiled <world>`](#crpg-tiled) | Writes a World's Tiled project and starter folders |

Exit codes: `0` on success, `1` when a check fails or the service refuses, `2` for wrong arguments or a folder that isn't a content root.

### `crpg publish`

```text
crpg publish <world> [--dry-run] [--new] [--yes]
```

| Flag | What it does |
|---|---|
| `--dry-run` | Runs every check and prints the Pre-Publish report, and uploads nothing. Without the settings it still runs the checks, and skips the report |
| `--new` | Creates the World. A World's first Publish needs it, and any other Publish refuses it, so a misspelt World id can't create a World by accident |
| `--yes` | Goes live without asking when the report shows changes. For scripts and CI |

What a Publish does, in order:

1. Runs every [check](#checks). Any error stops it, and nothing is uploaded.
2. Compares the World with the live World Version and prints the [Pre-Publish report](#the-pre-publish-report). If anything changes, it asks `Publish anyway? [y/N]`. Only `y` or `yes` goes ahead.
3. Uploads only the files the service doesn't have. Files are stored by the hash of their content, so a file used by two Worlds, or two World Versions, is stored once.
4. Makes the new World Version live. If another Author Published the same World since step 2, it is refused: run the command again to see the report against their World Version.

```text
Checked World "forest-course": 0 errors, 0 warnings.
Published World "forest-course": version 3f2a… is live. Uploaded 41 of 41 files; the rest were already on the service.
```

### `crpg versions`

```text
crpg versions <world>
```

Lists the World's World Versions, newest first. A retired one is one that was live before: Students who started on it keep playing it until they reload.

```text
9c1e…  live
3f2a…  retired 2026-10-01T09:12:44.000Z
```

### `crpg prune`

```text
crpg prune
crpg prune --version <id>
```

- With no flag, it deletes World Versions retired longer than the service's grace period (90 days unless the operator changed it), then every file no remaining World Version uses. Operators usually schedule the same cleanup.
- With `--version`, it deletes that World Version now, whatever its age. It refuses the live World Version.

It prints the deleted files, or `Nothing to prune.` A Student still playing a deleted World Version sees "This World was updated. Reload to continue." Reloading puts them on the live one, with their Flags intact.

### `crpg tiled`

```text
crpg tiled <world>
```

Writes `worlds/<world>/<world>.tiled-project`, which lists the Asset Library as a project folder and defines every custom type the Engine reads ([`tiled-object-authoring.md`](tiled-object-authoring.md)). If they are missing, it also creates the World folder, its empty `maps/`, `scripts/`, `portraits/`, `cg/` and `tilesets/` folders, and a placeholder `world.json` and `strings.json`. It never overwrites a file you edited. Run it again after adding a Character to the Library.

## Checks

`crpg publish` reports each problem with the file, the line where there is one, and the reason:

```text
error: worlds/forest-course/world.json: has the player Character "hero", but library/characters/hero/hero.png does not exist
warning: worlds/forest-course/scripts/village.clsc:12: on interact(Smith) names an Entity that is on no Map
```

An error stops the Publish. A warning doesn't, but it usually means something won't work in the game.

| Area | Errors |
|---|---|
| World | The World id isn't lower-case `a-z`, `0-9`, `-` and `_`, or `worlds/<world>/` doesn't exist |
| `world.json` | Missing or not JSON; no `startMap`, or its Map doesn't exist; no whole-number `spawn`, or the spawn tile is off the start Map; no `player` |
| Maps | An XML Map (`.tmx`); a Map that isn't JSON; not orthogonal; infinite; a compressed tile layer; an external tileset; a tileset image with no `tilesets/` folder in its path, or that doesn't exist; Maps with different tile sizes; an `entityId` or `zoneId` used twice in the World |
| Characters | A Character named by `world.json`'s `player`, an Entity's `characterId` or a Script's `character` with no `library/characters/<id>/<id>.png`; a `character.json` that is missing, has no whole-number `frameWidth` and `frameHeight`, or has an `offsetY` that isn't a number |
| Scripts | Any compile error ([`codeleagues-script.md`](codeleagues-script.md#compiling-and-reading-errors)); a `prelude.clsc` of your own; a String Table key missing from a Locale, or a `strings.json` that can't be read |
| CGs | A CG a Script declares with no image in `cg/<cg-id>/` |
| Portraits | A line's `Speaker(Expression)` with no Portrait file; a Portrait folder for a name no Script declares; a PNG not named for an Expression |

| Area | Warnings |
|---|---|
| Scripts | An `on interact(...)` or `on enter(...)` naming an Entity or Zone that is on no Map |

How each file should look is in [`content-folder.md`](content-folder.md).

## The Pre-Publish report

Before going live, `crpg` compares the World with the live World Version and lists what changes for Students:

- the Flags the Scripts declare
- once-only Cutscene Flags
- Companion movers
- Zones

It also lists movers that no Map has an Entity for. Students' stored Flags are never migrated. So a renamed Flag, once-only Cutscene or Zone starts over for every Student, and shows as one removal and one addition. A first Publish prints no report: there is nothing to compare with.

## Trying a World before Students see it

Publish it under a draft World id first. The World id is its folder name, so give the World a second name, then Publish that:

```sh
ln -s forest-course worlds/forest-course-draft    # on Windows, copy the folder instead
crpg publish forest-course-draft --new
```

Then open `forest-course-draft` on your Platform. Ask your Platform developer how to open a World id that no course uses. With the reference Platform in this repository, set `WORLD_ID=forest-course-draft` ([`local-dev.md`](local-dev.md)). Once it plays well, Publish the real id. Flags are kept per World, so a draft never touches Students' progress.
