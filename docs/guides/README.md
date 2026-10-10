# Guides

Documentation for the CodeLeagues RPG engine.

## Start here

[Getting started](getting-started.md): from nothing to playing a World in your own web app, on one machine. It walks through each role's job once.

## Reference

Everything about each part, by role.

| Role | Page | Covers |
|---|---|---|
| Operator | [Game Service reference](game-service.md) | The image, environment variables, the setup wizard, Compose and Kubernetes, `migrate` and `prune`, the HTTP API, `/healthz`, serving files and CDNs |
| Platform developer | [Client package reference](client.md) | Tokens, `mount`, `<Game>`, `useGame`, the game's state and actions, errors |
| Platform developer | [UI overrides reference](ui-overrides.md) | CSS variables, every slot and its props, drawing all the UI yourself |
| Author | [crpg reference](crpg.md) | Settings, every command and flag, every check, the Pre-Publish report, drafts |
| Author | [Content folder reference](content-folder.md) | Where every file of a World goes, and what each holds |

## Authoring how-tos

- [Writing Scripts](codeleagues-script.md): CodeLeagues Script, the language of Dialogue, Cutscenes and Flags
- [Placing Entities and Zones in Tiled](tiled-object-authoring.md)
- [Laying out a Character sheet](character-spritesheet-layout.md)
- [Adding Dialogue Portrait art](dialogue-portrait-assets.md)
- [Adding CG art](cg-art-assets.md)
- [Naming a Zone's seen-flag](cg-cutscene-seen-flags.md)

## Contributing

- [Running the stack locally](local-dev.md): working on this repository
