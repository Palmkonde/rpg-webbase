# Coding standards

Judgement-call rules for review, adapted from Robert C. Martin's *Clean Code* (chapter in brackets). Mechanical rules (parameter count, nesting depth, magic numbers, import order, function style) are enforced by `.oxlintrc.json`, and the reviewer already carries Fowler's smell baseline. This file adds only what neither covers. Each rule ends with a case this repo has actually hit.

## Names [ch. 2]

- **Use the domain's own words.** Name a concept with its `GLOSSARY.md` term. *Hit:* `walkers` for the set of Character Entity ids.
- **The name keeps telling the truth.** When a function's callers widen or its return value changes, rename it in the same change. *Hit:* `resolvePlayerTexture` resolving NPC sheets; `createCharacters` returning only the Player's sprite.
- **One verb per concept.** Stick to the verbs the codebase already uses:

  | Verb | Meaning |
  |---|---|
  | `read*` | parse one raw Tiled object into a typed value, or `undefined` |
  | `collect*` | gather every match across a raw Tiled map |
  | `resolve*` | look an id up in a catalog or config |
  | `create*` | build a runtime object (scene, engine, builder) |
  | `warn*` | emit an authoring-mistake warning and nothing else |
  | `run*` | execute a Script |

## Functions [ch. 3]

- **One level of abstraction per function.** A top-level function such as `MapScene.create()` reads as a list of named steps; the detail lives one call down.
- **Do one thing.** A function either answers a question or changes state (command-query separation). When it has to do both, the name says both.
- **No flag arguments.** A boolean that picks between two behaviours means there are two functions.

## Boundaries [ch. 8]

- **External data is parsed once, at its seam.** Raw Tiled JSON becomes typed values in `tiled-assets.ts`, including defaults. The Scene and Host consume those types and never re-parse or re-default a raw string. *Hit:* the `facing` default existed in both `tiled-assets.ts` and `map-scene.ts`.
- **Third-party APIs are wrapped where the Host touches them.** grid-engine and Phaser calls stay inside `engine-core`; the Host goes through `EngineHandle`.

## Error handling [ch. 7]

- **Authoring mistakes warn; missing configuration throws.** A bad value in Tiled data or a Script (duplicate id, unknown `characterId`) is `console.warn`-ed and that one object is skipped, so the Map still loads. A World Config the app can't start without (unknown `mapId`) throws.
- **A skip must stay a skip downstream.** Check that a warned-and-skipped object can't still crash a later step. *Hit:* a duplicate Character Entity `entityId` passed the warning and still reached `gridEngine.create`, which silently replaced the earlier character.

## Comments [ch. 4]

- **One clause, and only for a why the code can't carry.** Good reasons are an ADR reference, a lint-rule workaround, or a consequence worth flagging. A function's name carries the what.
- **Delete-test every comment.** If removing it loses no information the code doesn't already carry, it's restating: cut it.
- **History belongs to git.** Ticket and issue numbers, "added for X" and "previously Y" go in commit messages, not comments. *Hit:* `// Character Entity Movement (ticket #34): …`.
- **No commented-out code and no banner or position-marker comments.**

## Tests [ch. 9]

- **Test the pure seam.** Unit tests cover pure parsing and state (`node:test`, raw Tiled-shaped literals in, typed values out, no mocking framework). Scene and grid-engine wiring is verified manually (see `CLAUDE.md`).
- **One behaviour per test, named as a sentence.** Name tests like `'collectEntities defaults a Character Entity's facing to down'`.
- **A new default or branch at the seam gets a test in the same change.**
