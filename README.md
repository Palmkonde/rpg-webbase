# game-engine

A playground for an RPG game engine, built with Phaser and Tiled. The game's Scripts are written in CodeLeagues Script (`.clsc`).

## Setup

```sh
nix develop   # Bun, the Rust toolchain and the other dev tools
bun install
bun run dev   # compiles the Scripts on save and runs the web app
```

The `assets/` folder holds the Tiled maps and tileset images. It's licensed third-party content, so it isn't in git: get a copy and put it at the repo root before you run the app.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Starts the dev server and recompiles the Scripts on save |
| `bun run test` | Runs every test, the Rust compiler's included |
| `bun run lint` | Runs oxlint and clippy |
| `bun run typecheck` | Type-checks every package |

## Layout

| Path | What's there |
|---|---|
| `apps/web` | The Host: a Next.js app, plus its Scripts in `src/scripts/` |
| `packages/engine-core` | The Engine, which runs on Phaser |
| `packages/clsc` | The CodeLeagues Script compiler (Rust) and the VM that runs Scripts (TypeScript) |

## Docs

- [`docs/guides/codeleagues-script.md`](docs/guides/codeleagues-script.md): how to write Scripts
- [`docs/guides/`](docs/guides/): other how-to guides
