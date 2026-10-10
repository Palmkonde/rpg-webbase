# Running the stack locally

For contributors. One command runs Postgres, a bucket, the Game Service and the reference Platform (`apps/web`) on your machine. Then you Publish a World from your own content folder and play it in the browser.

## What you need

- [Nix](https://nixos.org/download) with flakes, which supplies Bun, the Rust toolchain (with the WASM linker `crpg` needs), and the other tools. Without Nix, install Bun 1.4, and Rust with the `wasm32-unknown-unknown` target and `lld`, yourself.
- Docker with Compose v2, for Postgres and the bucket.
- A content folder with at least one World ([`content-folder.md`](content-folder.md)). None ships with the repo: the maintainer's art is licensed and lives in the gitignored `assets/`. Bring your own. Putting it at `assets/` keeps it out of git.

## Start it

```sh
nix develop
bun install
bun run dev        # Postgres and SeaweedFS in Docker, the Game Service on :3000, the reference Platform on :3001
bun run migrate    # in a second terminal: creates the schema. Run it again after a schema change
```

`bun run dev` reads its settings from `dev.env`: fixed dev-only secrets (`JWT_SECRET=dev-jwt-secret-not-for-production`, `PUBLISH_KEY=dev-publish-key`) and `WORLD_ID=demo`, the World the reference Platform opens. The Game Service restarts when its code changes, and Next.js reloads the Platform.

Postgres listens on `localhost:5432` and SeaweedFS's S3 API on `localhost:8333`. Their data stays in Docker volumes across restarts. `docker compose -f compose.dev.yaml down -v` wipes it.

## Publish a World to it

Build `crpg` from source, then run it in your content folder with the dev settings:

```sh
bun run --cwd packages/cli build

cd assets
printf 'GAME_SERVICE_URL=http://localhost:3000\nPUBLISH_KEY=dev-publish-key\n' > .env
node ../packages/cli/dist/cli.js publish demo --new
```

Drop `--new` after the first Publish. Rebuild `crpg` after you change `packages/cli` or the compiler. [`crpg.md`](crpg.md) covers every command.

## Play it

Open <http://localhost:3001>. The page plays as the Student `dev-student`. Add `?student=<id>` to play as someone else: each Student has their own Flags, so this is how you check that progress is kept per Student.

To open a World other than `demo`, set `WORLD_ID` when you start the stack. A variable set in your shell wins over `dev.env`:

```sh
WORLD_ID=forest-course bun run dev
```

The reference Platform's token route signs with `dev.env`'s `JWT_SECRET`. Its error screen is a React slot override, so it also shows slot overrides working.

## Run the Game Service image instead

To try the image an operator runs, hardened the same way (read-only root filesystem, a tmpfs `/tmp`, every capability dropped), stop `bun run dev` first, because the image also listens on 3000:

```sh
docker compose -f compose.dev.yaml --profile image up --build --wait
```

This builds the image from `apps/game-service/Dockerfile` and runs `migrate` once before `serve`.

## Checks

| Command | What it runs |
|---|---|
| `bun run test` | Every test, the Rust compiler's included. Use it rather than bare `bun test`, which skips `cargo test` and the Script fixture compile |
| `bun run lint` | oxlint and clippy. It must pass clean before a PR |
| `bun run typecheck` | `tsc` in every package |

The Game Service's and `crpg`'s tests that need Postgres and the bucket skip unless `DATABASE_URL` is set. To run them, keep the compose services up and load `dev.env`:

```sh
bun --env-file=dev.env run test
```

CI runs all three on every PR, with Postgres and SeaweedFS as service containers, so nothing skips there.

## Where things are

| Path | What's there |
|---|---|
| `apps/game-service` | The Game Service: Elysia on Bun, with its Drizzle schema in `src/schema.ts` and migrations in `drizzle/` |
| `apps/web` | The reference Platform: a Next.js page that signs Student tokens and mounts the game |
| `packages/client` | `@codeleagues-rpg-engine/client`, the package Platforms install |
| `packages/cli` | `@codeleagues-rpg-engine/cli`, the `crpg` command |
| `packages/engine-core` | The Engine, on Phaser. Bundled into the client, never published on its own |
| `packages/clsc` | The CodeLeagues Script compiler (Rust, built to WASM for `crpg`) and the VM that runs Scripts |

How work is planned and merged is in `CLAUDE.md` and `docs/agents/issue-tracker.md`.
