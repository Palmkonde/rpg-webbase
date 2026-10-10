---
status: accepted (amends adr/0037: where the schema lives and where the migrator records what it has applied)
---

# The Game Service keeps its tables and migration log in its own `game_service` Postgres schema

An operator often already runs a Postgres, and may only be able to give the Game Service a database that other apps use too. In Postgres's default `public` schema, the service's `worlds`, `world_versions` and `flags` tables could collide with another app's. Drizzle's migration log, `drizzle.__drizzle_migrations`, is shared by every Drizzle app in the database, so two such apps would read each other's records of what was applied. So every table, and the migration log, lives in one Postgres schema named `game_service`. `migrate` creates it if it is missing, which needs the `CREATE` privilege on the database (an owner has it). Nothing the service creates can then collide with another app, an operator can grant it that one schema, and `DROP SCHEMA game_service CASCADE` removes it.

The name is fixed. One Game Service holds every World, so an operator never needs two in one database, and drizzle-kit writes the name into each generated migration.

Prereleases (`0.1.0-rc.*`) created their tables in `public`. The first migration is rewritten instead of adding one that moves them, so those installs start empty in `game_service` and their `public` tables are no longer read. Only prerelease installs are affected.

## Considered Options

- **Docs only: "give the Game Service its own database".** Rejected: some managed Postgres plans give one database, and nothing would stop a collision.
- **Prefixed table names (`game_worlds`).** Rejected: it avoids table collisions but not the shared migration log, and a schema does the same job in one place.
- **A configurable schema name.** Rejected: every generated migration would need templating, for a case that doesn't happen.
- **A migration that moves prerelease tables out of `public`.** Rejected: hand-written SQL kept in the history forever, for installs that were only ever prereleases.
