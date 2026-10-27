# Naming things in a World

Every id in a World is used somewhere else: a folder name, a Tiled property, or a Script. This page lists each one, the characters it can use, where it must be unique, and what refers to it.

## The one rule that catches people out

A Script can only refer to an id that is a valid name in CodeLeagues Script ([`codeleagues-script.md`](codeleagues-script.md)):

- It starts with a letter (`a-z`, `A-Z`) or `_`.
- After that come letters, digits (`0-9`) and `_`.
- There's no `-`, no space, and no leading digit.
- It isn't a keyword, such as `loop`, `flag` or `cutscene`.
- A leading `_` makes the name private to its file (see [`codeleagues-script.md`](codeleagues-script.md#splitting-files-use-and-_private)).

Some ids may legally contain `-`, such as Character ids and Map file names. Such an id works everywhere except in a Script. If a Script will ever name it, write it with `_` instead: `town_square.tmj`, not `town-square.tmj`.

Case matters everywhere. `Guard` and `guard` are two different ids.

## Ids

| Id | Where you set it | Characters | Unique within | Referred to by |
|---|---|---|---|---|
| World id | The folder name, `worlds/<world>/` | lower-case `a-z`, `0-9`, `-`, `_` | the content folder | `crpg` commands. It is permanent once Students have played the World, because their Flags are stored under it |
| Character id | The folder name, `library/characters/<id>/` | lower-case `a-z`, `0-9`, `-`, `_` | the Asset Library | `world.json`'s `player`, an Entity's `characterId`, a Script's `character` |
| Map id | The Map's file name without `.tmj` | not checked; keep to Script names | the World | `world.json`'s `startMap`, a Portal's `targetMap`, `on arrive(<map id>)` |
| `entityId` | The Entity's property in Tiled | keep to Script names | the whole World, across every Map | `on interact(<entityId>)`, `mover <entityId>;` |
| `zoneId` | The Zone's property in Tiled | keep to Script names | the whole World, across every Map | `on enter(<zoneId>)` |
| `spawnId` | The Spawn Point's property in Tiled | any text | its own Map | a Portal's `targetSpawn` |
| CG id | `cg <cg-id>;` in a Script | Script names | the Scripts | the folder `cg/<cg-id>/` and caption keys `cg.<cg-id>.<n>` |
| Speaker or Mover name | `speaker <Name>;` or `mover <entityId>;` in a Script | Script names | the Scripts | the Portrait folder `portraits/<Name>/`, in the same case |
| Flag name | `flag <name>: bool = false;` in a Script | Script names | the Student's Flags for the World | the Script's own `if` and `set` |
| String Table key | A key in `strings.json` | letters, digits and `_`, in segments joined by `.` | each Locale | `@key` in a Script |

An Entity and a Zone may share an id, and so may a Map. A Script tells them apart by its trigger: `interact`, `enter` and `arrive` are separate namespaces.

## Names the game builds for you

The Host stores some Flags under names derived from an id. Don't declare a Flag with one of these names yourself:

- `<zoneId>_seen` marks a Zone as played. A Zone `gate` and a Flag of your own named `gate_seen` would clash (see [`cg-cutscene-seen-flags.md`](cg-cutscene-seen-flags.md)).
- `companion:<entityId>` marks a Character Entity as a Companion. Write it as `companion[<entityId>]` in a Script.

## File names

- A Portrait is `portraits/<Speaker>/<expression>.png`, with the Expression in lower case: `neutral.png`, `happy.png` (see [`dialogue-portrait-assets.md`](dialogue-portrait-assets.md)).
- A Character sheet is `library/characters/<id>/<id>.png` (see [`character-spritesheet-layout.md`](character-spritesheet-layout.md)).
- A CG's frames play in natural file-name order, so `2.jpg` comes before `10.jpg` (see [`cg-art-assets.md`](cg-art-assets.md)).
- Any file named `raw.*` is your source art, and is never Published.
- `prelude.clsc` is reserved: `crpg` brings its own.
