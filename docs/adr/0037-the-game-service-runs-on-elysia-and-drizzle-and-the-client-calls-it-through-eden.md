---
status: accepted
---

# The Game Service runs on Elysia and Drizzle, and the client calls it through Eden

The Game Service lives in `apps/game-service` and runs on Bun (`adr/0033`). Its HTTP layer is Elysia: `@elysiajs/jwt` checks the Student tokens from `adr/0036` (HS256), `@elysiajs/cors` admits the Platform's domain, and Elysia's `t` route schemas validate every request body at the trust boundary, including Flag patches and Publish. The service keeps no state of its own. Everything lives in Postgres and the bucket, so an installer can run more than one copy.

Postgres is accessed through Drizzle on Bun's built-in `Bun.sql` driver (`drizzle-orm/bun-sql`). The schema is a TypeScript file, and `drizzle-kit generate` writes migrations as plain SQL files that are reviewed and committed. Migrations are applied by a separate `migrate` command in the service image, which calls Drizzle's runtime migrator and exits. Installers run it before starting a new version, and the service never changes its schema on startup. `drizzle-kit` is a dev-only tool and doesn't ship.

The service owns its own types. The client package and the Publish CLI import them from `apps/game-service` (`type App`), and the client calls the service through Eden Treaty (`@elysiajs/eden`), so routes, params and bodies are checked end to end. As a result, the published client package depends on Eden at runtime and on `apps/game-service` for types at build time. Those types must never reach the client's public `.d.ts`, because a stranger's install would then point at an app that is never published.

## Considered Options

- **`Bun.serve` routes + `jose`, or Hono.** Both would work for a handful of routes. Elysia was chosen for its Bun-native design and because Eden gives typed calls from the client with no hand-written contract.
- **Raw `Bun.sql`, or Prisma.** Raw SQL would cover two tables, but we chose an ORM for a typed schema and generated migrations. Prisma has its own schema language and a generate step, while Drizzle's schema is TypeScript on the driver Bun already has.
- **Migrations applied at startup.** Rejected: installers who review schema changes want to run them as their own step.
- **A types-only `packages/contract` package.** Rejected: with Eden, the service's route definitions *are* the contract, and a second copy would drift.
- **Plain `fetch` with imported types.** Rejected: hand-written paths drift from the routes, and Eden's runtime cost is small.

The storage client (`Bun.s3` alone, or with a SigV4 signer for `Cache-Control`) is left to the serving model, decided separately.
