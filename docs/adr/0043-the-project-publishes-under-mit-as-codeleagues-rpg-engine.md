---
status: accepted
---

# The project publishes under MIT as `@codeleagues-rpg-engine`

Strangers install this project, so the code needs a license and the packages need names that resolve to our code. The whole repo is **MIT**: one root `LICENSE`, and `"license": "MIT"` in every package. MIT is what Phaser and Preact use, Platforms' legal teams approve it without a review, and nothing we ship is copyleft (grid-engine is Apache-2.0, pest and serde_json are MIT OR Apache-2.0). The client's `dist` carries Preact's notice, because Preact is bundled in (`adr/0039`). The CLI carries pest's and serde_json's notices, because they're compiled into its WASM file (`adr/0041`).

Everything publishes under the npm org **`@codeleagues-rpg-engine`**, named after the CodeLeagues brand the Script language already carries:

- `@codeleagues-rpg-engine/client`: the mount package, with its `./react` subpath (`adr/0039`).
- `@codeleagues-rpg-engine/cli`: the Publish CLI, whose `bin` is `crpg` (`crpg publish <world>`, `crpg prune`, `crpg tiled <world>`; `adr/0040`).
- `ghcr.io/palmkonde/codeleagues-rpg-engine-game-service`: the game service, published as an image only. The client and CLI bundle its types (`adr/0037`), so nobody installs it from npm.

The private workspace packages move to the same scope (`@codeleagues-rpg-engine/engine-core`, `@codeleagues-rpg-engine/clsc`, and the root and `apps/web` packages). They are bundled, never published. If one ever leaks into a published `dependencies`, the install then resolves to a scope only we can publish to. At worst it fails; it never fetches a stranger's code, as the old `@game-engine` names could have.

## Considered Options

- **Apache-2.0, or MIT OR Apache-2.0.** Rejected for now: the patent grant buys little with one author. Moving to it later is easy for code the author wrote.
- **AGPL-3.0 on the game service.** Rejected: it would keep hosted forks open, but many companies ban AGPL outright, which works against "any platform can install this".
- **The personal `@palmkonde` scope.** Rejected: it ties the packages to one person, so another maintainer can't co-own them without renaming every package. It's also what GitHub Packages forces, and that registry is ruled out anyway, because installing from it needs a token even for public packages.
- **`@rpg-webbase`, after the repo.** Rejected in favour of the product name.
- **Moving the repo to a GitHub org, so the image path matches the npm org.** Deferred: GHCR forces the GitHub owner into the path, so it stays `palmkonde` until the repo moves. That move is cheap before anyone pulls the image.
