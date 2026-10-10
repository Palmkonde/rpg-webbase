# CodeLeagues RPG engine

An RPG-style game a Platform mounts to gamify its courses, built with Phaser and Tiled. Authors write Worlds as Tiled Maps and CodeLeagues Script (`.clsc`), and Publish them to a Game Service. Platforms mount the game in their own pages, and each Student's progress is kept on the service.

It ships as three pieces, released together at one version:

- **The Game Service image**, `ghcr.io/palmkonde/codeleagues-rpg-engine-game-service`: keeps Published Worlds and Students' Flags in Postgres and an S3-compatible bucket
- **`@codeleagues-rpg-engine/client`**: the game, which a Platform mounts with `mount()` or `<Game>`
- **`@codeleagues-rpg-engine/cli`** (`crpg`): checks and Publishes a World from an Author's content folder

## Guides

New here? Start with [Getting started](docs/guides/getting-started.md): it goes from nothing to playing a World in your own web app, on one machine.

Then the reference for each role:

1. **Operator**: [Game Service reference](docs/guides/game-service.md)
2. **Platform developer**: [Client package reference](docs/guides/client.md) and [UI overrides reference](docs/guides/ui-overrides.md)
3. **Author**: [crpg reference](docs/guides/crpg.md) and [Content folder reference](docs/guides/content-folder.md)
4. **Contributor**: [Running the stack locally](docs/guides/local-dev.md)

Every guide, the authoring how-tos included, is listed in [`docs/guides/`](docs/guides/README.md). The same guides are mirrored to the [wiki](https://github.com/Palmkonde/rpg-webbase/wiki).

## Developing

```sh
nix develop
bun install
bun run dev       # Postgres and the bucket in Docker, the Game Service on :3000 and the reference Platform on :3001
bun run migrate   # applies the Game Service's schema; run it once, and again after a schema change
```

[`local-dev.md`](docs/guides/local-dev.md) has the rest: Publishing a World to your local service, playing it, and running the checks.

`assets/` is the maintainer's own content folder (`library/` and `worlds/`). It's licensed third-party content, so it isn't in git, and no sample World ships with the repo.

| Command | What it does |
|---|---|
| `bun run dev` | Starts the compose services, the Game Service and the reference Platform |
| `bun run migrate` | Applies the Game Service's committed migrations to the dev Postgres |
| `bun run test` | Runs every test, the Rust compiler's included. The Game Service's Postgres tests skip unless `DATABASE_URL` is set |
| `bun run lint` | Runs oxlint and clippy |
| `bun run typecheck` | Type-checks every package |

## License

MIT. See [`LICENSE`](LICENSE).
