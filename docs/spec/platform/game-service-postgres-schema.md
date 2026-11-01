# Game Service Postgres Schema: Sharing an Existing Database

Confirmed 2026-10-09 via grilling session, while walking through the operator guide (#95). Decision record: `adr/0045`, amending `adr/0037`.

## Problem Statement

An operator who already runs Postgres, and especially one whose managed plan gives a single database, wants to point the Game Service at a database other apps already use. Today the service creates `worlds`, `world_versions` and `flags` in Postgres's default `public` schema, and records its migrations in `drizzle.__drizzle_migrations`. If another app already has a table of one of those names, `migrate` fails. If another app also uses Drizzle, the two apps share one migration log and read each other's records of what was applied. The guides can only say "give it its own database", and nothing enforces that.

## Solution

The Game Service keeps everything it creates in one Postgres schema of its own, `game_service`: its three tables and its migration log. `migrate` creates the schema when it is missing. An operator can then point the service at any database, empty or shared: nothing the service creates can collide with another app, they can grant it that one schema, and one `DROP SCHEMA` removes it. Prerelease installs start fresh in the new schema.

## User Stories

1. As an operator, I want to point the Game Service at a database my other apps already use, so that I don't need a second database on a managed plan that gives me one.
2. As an operator, I want `migrate` to succeed on a database where another app already has a `worlds`, `world_versions` or `flags` table, so that a common table name never blocks an install.
3. As an operator, I want `migrate` to leave every other app's tables and data untouched, so that installing the Game Service can't damage anything else in the database.
4. As an operator whose other app also uses Drizzle, I want the Game Service's migration log kept apart from that app's, so that neither app skips or re-runs the other's migrations.
5. As an operator, I want `migrate` to create the Game Service's schema itself, so that a first install needs no SQL from me.
6. As an operator, I want `migrate` to need only the `CREATE` privilege on the database (which an owner has), so that I know exactly what to grant its user.
7. As an operator, I want everything the Game Service owns in one Postgres schema, so that I can grant, back up or inspect it as one unit.
8. As an operator, I want to remove the Game Service from a shared database with one `DROP SCHEMA game_service CASCADE`, so that uninstalling it leaves nothing behind.
9. As an operator, I want running `migrate` again to change nothing when the schema is current, so that it stays safe to run before every start, as the Compose example does.
10. As an operator, I want an upgrade's new migrations to land in the same schema, so that later versions keep working in a shared database.
11. As an operator on a `0.1.0-rc.*` prerelease, I want the release notes to say my `public` tables are no longer read and how to drop them, so that I'm not surprised by an empty install or left with tables I don't need.
12. As an operator, I want the install guide and the setup wizard to say an existing database works and what privilege `migrate` needs, so that I don't create a dedicated database for nothing.
13. As an operator using the Compose example's bundled Postgres, I want nothing to change for me, so that the default install keeps working the same way.
14. As a contributor, I want `bun run migrate` to create the schema in my dev database, so that local dev keeps working after I reset my volumes.
15. As a contributor, I want new migrations that drizzle-kit generates to target the same schema by themselves, so that I never write the schema name by hand.
16. As a maintainer, I want a test that runs `migrate` on a database another app already uses, so that a regression that writes into `public` fails CI.

## Implementation Decisions

- **One fixed Postgres schema, `game_service`** (`adr/0045`). It holds the Game Service's three tables. The Drizzle table definitions declare it, so every query, and every migration drizzle-kit generates, names it. The name is not configurable: generated migrations carry the name in their SQL, and one Game Service holds every World, so an operator never needs two in one database.
- **The migration log lives in the same schema.** The runtime migrator records applied migrations in `game_service`, not in Drizzle's default `drizzle` schema, so the service creates nothing outside `game_service`.
- **`migrate` creates the schema** when it is missing (`CREATE SCHEMA IF NOT EXISTS`). The database user needs the `CREATE` privilege on the database; owning it is enough. The service never creates the database itself.
- **The first migration is rewritten, not followed by a move.** The committed initial migration is regenerated to create everything in `game_service`, and the history stays one migration. A `0.1.0-rc.*` install then sees an empty migration log in `game_service`, creates fresh tables there, and no longer reads its `public` tables. No migration moves prerelease data.
- **drizzle-kit is limited to the `game_service` schema**, so generating or checking migrations never sees, or tries to drop, other apps' tables in a shared dev database.
- **Nothing else changes.** The HTTP contract, the client, the CLI, `prune`, `/healthz`, the image and its subcommands, the environment variables and the bucket stay as they are. `DATABASE_URL` still names a database, and Postgres's `search_path` is not relied on.
- **Docs.** The install guide and the operator wizard say an existing or shared database works and that the user needs `CREATE` on it. The "give it its own database" advice and the note on why a shared one fails both go. Release notes for the version that ships this give prerelease operators the statements that drop the old `public` tables and the `drizzle` schema. They warn not to drop the `drizzle` schema in a database another Drizzle app uses. A contributor resets the dev database with `docker compose -f compose.dev.yaml down -v`, then `bun run migrate`.

## Testing Decisions

- As in "Packaging": a good test drives a module through its public seam and asserts what an outside caller sees. Here the seam is the `migrate` subcommand, run through the real entry point against a throwaway database on the compose Postgres. Prior art is the existing `migrate` test, which runs the entry point against an empty database it creates and drops. Like the other service tests, these skip without `DATABASE_URL`, except in CI.
- `migrate` on an empty database exits 0. Afterwards the three tables and the migration log are in `game_service`, and `public` holds no table and no `drizzle` schema exists.
- `migrate` on a database where another app already has `public.worlds`, `public.world_versions`, `public.flags` and a `drizzle.__drizzle_migrations` with rows of its own exits 0. Afterwards those tables and their rows are unchanged, and the Game Service's tables are in `game_service`.
- Running `migrate` a second time exits 0 and changes nothing.
- The existing HTTP-surface tests (Flags, World Versions, Publish, `prune`, `/healthz`) stay as they are. Run against a migrated database, they prove the routes query the new schema. The compiled-binary test keeps proving the embedded migrations apply.

## Out of Scope

- A configurable schema name, or more than one Game Service in a database.
- Moving data from a prerelease install's `public` tables into `game_service`.
- Relying on, or setting, Postgres's `search_path`.
- The service creating its own database, or a dedicated Postgres role per install.
- Any change to the bucket's layout: its keys already sit under their own `blobs/` prefix.

## Further Notes

- The operator guide written for #95 says to give the Game Service its own database, and says why a shared one fails. That stays correct until this lands, and this work replaces it.
- Only `0.1.0-rc.*` installs are affected by the rewritten first migration. No stable release has shipped.
