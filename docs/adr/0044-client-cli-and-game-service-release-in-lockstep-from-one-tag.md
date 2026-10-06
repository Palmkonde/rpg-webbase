---
status: accepted
---

# The client, CLI and Game Service release in lockstep from one tag

The client and the CLI bundle the Game Service's Eden types at build time (`adr/0037`), so each is built against one exact shape of the service's routes. All three artifacts — `@codeleagues-rpg-engine/client`, `@codeleagues-rpg-engine/cli` and the `ghcr.io/palmkonde/codeleagues-rpg-engine-game-service` image (`adr/0043`) — therefore share one version number. Pushing a `vX.Y.Z` git tag runs one workflow that writes that version into every package, then publishes both npm packages and the image. Nobody bumps a version by hand. The compatibility rule an installer needs is a single sentence: a client or CLI works with any Game Service of the same minor version. A patch release may change any one of the three; a change to a route's shape is at least a minor.

## Considered Options

- **Independent versions, an API version header, and a compatibility table.** Rejected: three version lines and a table installers must read, for one maintainer who always changes the routes and their callers together.
- **Changesets-driven releases.** Rejected for now: its value is per-package changelogs and independent bumps, which lockstep doesn't need. A tag pushed by hand is enough.
