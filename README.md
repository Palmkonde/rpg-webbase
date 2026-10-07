# game-engine

A playground for an RPG game engine, built with Phaser and Tiled. The game's Scripts are written in CodeLeagues Script (`.clsc`).

## Setup

```sh
nix develop   # Bun, the Rust toolchain and the other dev tools
bun install
bun run dev       # starts Postgres and the bucket in Docker, the Game Service and the web app
bun run migrate   # applies the Game Service's schema; run it once, and again after a schema change
```

`bun run dev` needs Docker: `compose.dev.yaml` runs Postgres and a SeaweedFS bucket, and `dev.env` holds the Game Service's dev-only configuration.

The `assets/` folder holds the Tiled maps and tileset images. It's licensed third-party content, so it isn't in git: get a copy and put it at the repo root before you run the app.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Starts the compose services, the Game Service on :3000 and the web app on :3001, recompiling the Scripts on save |
| `bun run migrate` | Applies the Game Service's committed migrations to the dev Postgres |
| `bun run test` | Runs every test, the Rust compiler's included. The Game Service's Postgres tests skip unless `DATABASE_URL` is set |
| `bun run lint` | Runs oxlint and clippy |
| `bun run typecheck` | Type-checks every package |

## Layout

| Path | What's there |
|---|---|
| `apps/web` | The Host: a Next.js app, plus its Scripts in `src/scripts/` |
| `apps/game-service` | The Game Service: Elysia on Bun, with its Drizzle schema in `src/schema.ts` and migrations in `drizzle/` |
| `packages/engine-core` | The Engine, which runs on Phaser |
| `packages/clsc` | The CodeLeagues Script compiler (Rust) and the VM that runs Scripts (TypeScript) |

## Docs

- [`docs/guides/codeleagues-script.md`](docs/guides/codeleagues-script.md): how to write Scripts
- [`docs/guides/`](docs/guides/): other how-to guides
