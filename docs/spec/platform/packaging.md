# Packaging: Client Package, Game Service and Publish CLI

Confirmed 2026-10-06 via grilling session, closing the build fog of the packaging map (#65). Builds on the decision tickets #66–#75 and their ADRs: storage (`adr/0034`, `adr/0035`), Student identity (`adr/0036`), the service stack (`adr/0037`), World Versions and `prune` (`adr/0038`), the mount API (`adr/0039`), Publish (`adr/0040`, `adr/0041`), file serving (`adr/0042`), names and license (`adr/0043`). New here: the Glossary's **Host** is redefined as the runtime inside the mounted game, and the three artifacts release in lockstep (`adr/0044`).

## Problem Statement

The game only runs inside this repo's own Next.js app. Its content is hard-coded: asset registries list file paths, a JSON fixture picks the start Map, Flags live in memory and reset on refresh, and licensed art is symlinked into the app's public folder. A Platform can't install the game, an Author can't get a World to Students without editing code, and nobody but this repo's maintainer could run any of it.

## Solution

Three installable pieces, plus a reference Platform and guides that prove them end to end:

- **`@codeleagues-rpg-engine/client`**: everything that is the Host today, moved out of `apps/web` into a package. A Platform calls `mount(element, options)` (or `<Game>` from `./react`), gets a headless store back, and can override any piece of UI through typed slots.
- **The Game Service image**: holds Published World Versions and their files, and each Student's Flags, in Postgres plus an S3-compatible bucket. It answers the client's World Version and Flags requests and the CLI's Publish requests.
- **`@codeleagues-rpg-engine/cli` (`crpg`)**: an Author checks and Publishes a World from a content folder, prunes old files, and generates the World's Tiled project.
- **`apps/web`** becomes a reference Platform that signs Student tokens and mounts the game exactly as a real Platform would. `docs/guides/` explains each install step for operators, Platform developers, Authors, and contributors.

## User Stories

**Platform developer**

1. As a Platform developer, I want to install one npm package and call `mount(element, { serviceUrl, worldId, getToken })`, so that the game runs on any route of my app without me knowing about Phaser.
2. As a Platform developer using React, I want `<Game>` and `useGame` from a `./react` subpath, so that the game fits my component tree, while the core works without React.
3. As a Platform developer using a server-rendered framework, I want `mount` to load Phaser only in the browser, so that I need no client-only wrapper.
4. As a Platform developer, I want to sign a short-lived World-scoped token in a small route of my own, so that my existing sign-in decides who may play which World.
5. As a Platform developer, I want the client to call my `getToken()` again and retry once when the service answers 401, so that a token expiring mid-Script doesn't lose a Flag write.
6. As a Platform developer, I want `onError` to report a typed error kind (`token`, `unauthorized`, `forbidden`, `worldUpdated`, `unavailable`), so that I can log or react to each one differently.
7. As a Platform developer, I want a built-in error screen with a default message per error kind, so that I get a sensible failure UI without writing one.
8. As a Platform developer, I want to replace any slot (Dialogue, its Portrait, Choice buttons, CG, Companions, Loading, ErrorScreen) with my own renderer or React component, so that the game matches my Platform's design.
9. As a Platform developer, I want a wrong slot name or wrong slot props to be a type error, so that an upgrade that changes a slot breaks my build, not my Students' screens.
10. As a Platform developer, I want my React overrides portalled into the built-in parent's element, so that my app's context providers (theme, i18n) still reach them.
11. As a Platform developer, I want to restyle the built-in overlays with CSS variables, so that small visual changes need no slot override.
12. As a Platform developer, I want `unmount()` to tear the game down cleanly and a remount to start with fresh state, so that route changes don't leak Flags, Students, or Locales between mounts.
13. As a Platform developer, I want to pass a Locale and change it with `setLocale`, so that Students read keyed text in their language.
14. As a Platform developer, I want the package's types to expose only its own view types, never the service's internal route types, so that my install doesn't reference an unpublished app.
15. As a Platform developer, I want a guide with a copyable token-signing snippet and a full mount example, so that integrating takes an afternoon.

**Operator**

16. As an operator, I want to pull one signed, multi-arch image from GHCR, so that I can run the Game Service on amd64 or arm64 and verify where it came from.
17. As an operator, I want the image to run as a non-root user with no shell, and to work with a read-only root filesystem plus a tmpfs `/tmp`, so that a compromise has as little to work with as possible.
18. As an operator, I want to configure the service entirely through environment variables, and have it exit at startup naming any required one that's missing, so that a misconfiguration fails loudly before it serves traffic.
19. As an operator, I want any S3-compatible bucket and any Postgres to work, with the region set explicitly, so that I'm not tied to one cloud.
20. As an operator, I want to apply schema migrations with a separate `migrate` command I run before starting a new version, so that I review and control schema changes.
21. As an operator, I want a `prune` command I can schedule with my own cron or Kubernetes CronJob, so that the bucket doesn't grow forever.
22. As an operator, I want a `health` subcommand and a `/healthz` route that checks Postgres, so that my container runtime and load balancer know when the service is ready.
23. As an operator, I want to point `ASSET_BASE_URL` at a CDN without touching the bucket or any Platform, so that I can add caching later as configuration only.
24. As an operator, I want to admit my Platform's origins through `CORS_ORIGINS`, so that only my Platform's pages can call the service from a browser.
25. As an operator, I want an example compose file and Kubernetes snippets for `serve`, a one-off `migrate`, and a scheduled `prune`, so that I start from a working deployment.
26. As an operator, I want a setup wizard that generates the JWT secret and Publish key, takes my bucket and Postgres credentials, and runs `migrate`, so that a first install is a guided few minutes.

**Author**

27. As an Author, I want to install `crpg` from npm and run it on Node or Bun without Rust or Nix, so that I can Publish from any machine.
28. As an Author, I want `crpg tiled <world>` to generate my World's Tiled project and custom types, so that I start a new World without hand-syncing types.
29. As an Author, I want `crpg publish <world> --dry-run` to run every check and print the Pre-Publish report without uploading, so that I can test a World safely.
30. As an Author, I want every content error (bad tileset anchor, missing Character, Portrait for an undeclared Speaker, missing CG file, duplicate Entity id, bad `world.json`, Script compile error) reported with the file and the reason, so that I can fix it without guessing.
31. As an Author, I want Publish to upload only files the service is missing, so that re-Publishing a small change is fast.
32. As an Author, I want to see which Flags, once-only Cutscenes, Companions, and Zones a Publish adds or removes, and confirm before going live, so that I never reset Students' progress by accident.
33. As an Author, I want a Publish to be refused if someone else went live after my report was computed, so that I never overwrite a colleague's Publish blind.
34. As an Author, I want a World's first Publish to require `--new`, so that a typo in the World id doesn't create a new World.
35. As an Author, I want `crpg prune` and `crpg prune --version <id>`, so that I can clean up old World Versions myself.
36. As an Author, I want a guide to the content-folder layout (`library/`, `worlds/<id>/`, `world.json`, `character.json`, Portraits, CG frames), so that I know where every file goes.
37. As an Author, I want a setup wizard that writes my service URL and Publish key to `.env` and runs a dry-run Publish, so that I know my setup works before my first real Publish.
38. As an Author, I want to try a World on the real service under a separate draft World id, so that I can play it before Publishing it to Students.

**Student**

39. As a Student, I want my Flags saved on the server, so that my progress survives refreshes, new tabs, and new devices.
40. As a Student, I want to keep playing the World Version I started even if an Author Publishes mid-session, so that the Map never changes under me.
41. As a Student, I want the game to stop with a clear message if my progress can't be saved, so that I never keep playing progress that will be lost.
42. As a Student, I want a clear "This World was updated. Reload to continue." when my session's files have been pruned, so that I know to reload rather than seeing broken art.
43. As a Student, I want a Companion that no longer exists in the World to be dismissed automatically, so that I'm never left with a dismiss button for nothing.
44. As a Student, I want World files to load from cache after my first visit, so that the game starts quickly on a return visit.

**Contributor / maintainer**

45. As a contributor, I want `bun run dev` to start Postgres, the bucket, the Game Service, and the reference Platform, so that I can work on the whole stack with one command.
46. As a contributor, I want the reference Platform to take `?student=<id>`, so that I can test Flags kept per Student by switching ids.
47. As a contributor, I want the service's tests to run against a real Postgres and bucket, and to skip with a clear message when they aren't running, so that `bun run test` stays usable without Docker.
48. As a maintainer, I want every PR checked by lint, typecheck, and test before it can merge into `main`, so that `main` stays green.
49. As a maintainer, I want pushing a `vX.Y.Z` tag to publish the client, the CLI, and the image together at that version, so that releasing is one step and the three always match.
50. As a maintainer, I want npm publishing through trusted publishing with provenance and no long-lived token, so that a leaked secret can't publish a package.
51. As a maintainer, I want the release to fail if a packed package contains anything outside its `dist/` or anything under `assets/`, so that licensed art never ships.
52. As a maintainer, I want Dependabot to bump the base-image digest, Actions, npm, and cargo dependencies, so that security fixes arrive without me watching.
53. As a maintainer, I want my licensed `assets/` kept local and gitignored, as my own content folder I Publish from, so that it never reaches the repo or a package.

## Implementation Decisions

**Packages**

- **Layout**: `packages/client`, `packages/cli`, `apps/game-service`, and `apps/web` (the reference Platform). `engine-core` and `clsc` stay separate private workspace packages, bundled into the client and CLI, never published. Every package moves to the `@codeleagues-rpg-engine` scope and gets `"license": "MIT"`, and a root `LICENSE` is added (`adr/0043`).
- **Client** (`adr/0039`): ESM plus `.d.ts`, built with `files: ["dist"]`. Entry points `.` and `./react`. `phaser` and `grid-engine` are regular dependencies kept out of the bundle. Preact is bundled. React is an optional peer of `./react` only. Eden Treaty is a runtime dependency. The service's `type App` is used at build time only and must never appear in the public `.d.ts`. `dist` carries Preact's license notice.
- **CLI** (`adr/0041`): `bin` is `crpg`, Node or Bun, using only `fetch`, `fs`, and `crypto`. It reads `GAME_SERVICE_URL` and `PUBLISH_KEY` from the environment, or from a `.env` in the folder it runs in (a variable already in the environment wins), so the Author wizard's `.env` works under Node too. The clsc compiler is built to WASM from `compile_sources` and bundled. `dist` carries pest's and serde_json's notices.
- **What moves into the client**: the Host's script player and commands, CG playback, Companion sync, the Flags store, and the overlays (ported from the temp-ui React components to Preact built-ins), with their tests. All Host state that is module-level today (Flags store, Student, Locale, active CG) becomes per mount instance.
- **`prelude.clsc`** (the Expression enum and the command declarations) moves out of `apps/web` into `clsc`, bundled into both the CLI and the client and versioned with them (#68). Authors never edit it: `crpg publish` compiles each World's Scripts against it.
- **What moves to the maintainer's content folder**: the demo Scripts (`cast.clsc`, the campfire and guard Scripts) and the String Table fixture are World content tied to the licensed Maps, so they move into the local, gitignored content folder under `worlds/<id>/` and leave the repo.
- **What's deleted**: the hard-coded registries (Map and Character catalogs, Portraits, CG art, String Table), which the manifest and `world.json` replace; the World Config and Flag seed fixtures; the `apps/web/public/assets` symlinks; and the boot CG path (`runOnce`, `seenFlag`, the hard-coded `intro`). How a World shows an intro is decided later; a Zone on the spawn tile whose Script plays a CG already works (`adr/0022`).
- **Re-fetching Scripts on every Transition** (`adr/0005`) goes away: a session fetches everything for its World Version by id (`adr/0038`).
- **clsc**: the `--store` Flag seed option is removed; Flags start empty and come from the service. `--strings` takes the World's own `strings.json`.

**Game Service storage** (derived from `adr/0034`, `adr/0038`, `adr/0040`, not a new decision)

- Postgres has three shapes: a World row holding its live World Version pointer; World Version rows holding the manifest, the Pre-Publish summary, and when the version stopped being live; and one Flags `JSONB` document per (World, Student). Files live in the bucket as `blobs/<sha256>.<ext>`. The tables, and the migration log, live in their own `game_service` Postgres schema (see [Game Service Postgres Schema](game-service-postgres-schema.md), `adr/0045`).

**Game Service HTTP contract**

Every route but `/healthz` is served under `/api/v1`, so a later incompatible API can live beside it as `/api/v2`.

Every Student route is token-checked (`adr/0036`): the `:world` in the path must equal the token's `world` claim, and the Student is the token's `sub`.

- `GET /api/v1/worlds/:world/versions/live` and `GET /api/v1/worlds/:world/versions/:id` both return `{ id, assetBaseUrl, manifest }`. The client asks for `live` once at mount and uses `id` from then on. A World never Published returns 404. A pruned World Version returns 404.
- **Manifest shape** (stored as JSON in Postgres with its World Version, served inline):

  ```ts
  {
    start: { map, spawn: { x, y }, player },               // from world.json
    maps: Record<mapId, key>,                               // tileset image paths already rewritten to keys
    characters: Record<characterId, { key, frameWidth, frameHeight, offsetY }>,
    portraits: Record<speaker, Partial<Record<Expression, key>>>,
    cgs: Record<cgId, key[]>,                               // frames in order
    scripts: key,
    strings: key,
    entities: string[],                                     // for Companion auto-dismiss (adr/0038)
    spawnPoints?: Record<mapId, Record<spawnId, { x, y }>>, // Portal targets (adr/0046); absent before Portals
    files: key[],                                           // every key, tilesets included: existence check and prune
  }
  ```

  `start` is inline rather than a blob because the client needs it before loading anything else.
- **Pre-Publish summary** (declared Flags, once-only Flags, Companion movers, Zones, Entities) is stored with the World Version. It's read by the CLI with the Publish key, never sent to Students.
- `GET /api/v1/worlds/:world/flags` returns the Student's Flags document, or `{}`.
- `PATCH /api/v1/worlds/:world/flags` takes `{ [key]: boolean | string }` and merges shallowly on the server (`jsonb ||`), so concurrent writers never lose each other's keys. There's no delete: a dismissed Companion is `false`. Limits: 200 keys, keys up to 128 characters, the whole document up to 64 KB. A malformed body is 400; one over a limit is 413. The API checks shape only, never the World Version's declarations (`adr/0038`).
- `GET /api/v1/blobs/:key`: no token. `stat()` first, then stream from the private bucket, with `Cache-Control: public, max-age=31536000, immutable`, `ETag`, and `Content-Length`. A missing key is 404. `ASSET_BASE_URL` defaults to this route (`adr/0042`).
- **Publish routes** are those in `adr/0040`, all behind the Publish key (`401` without it):
  - `POST /api/v1/blobs/missing` takes `{ keys }` and answers `{ missing }`, the keys the bucket lacks.
  - `PUT /api/v1/blobs/:key` takes the file's raw bytes. The key is `<sha256>.<ext>`, the same key the manifest holds, and the object lives at `blobs/<key>`. The service hashes the bytes as they arrive and refuses a mismatch with `422` before anything reaches the bucket. A file over 64 MiB is `413`.
  - `GET /api/v1/worlds/:world/versions/live/summary` answers `{ id, summary }` for the Pre-Publish diff, or `404` for a World never Published.
  - `POST /api/v1/worlds/:world/versions` takes `{ manifest, summary, expectedLive }`, with `expectedLive` left out for a World's first Publish. In one transaction it inserts the World Version and moves the live pointer, but only if the live one is still `expectedLive`. It answers `201 { id }`, `409` for a stale `expectedLive`, `422` naming any key the manifest names that the bucket lacks, and `400` for a manifest of the wrong shape.
  - `GET /api/v1/worlds/:world/versions` answers the World's World Versions newest first as `[{ id, createdAt, retiredAt, live }]` (`retiredAt` is when it stopped being live, `null` for the live one), or `404` for a World never Published. `crpg versions <world>` prints it, so an Author can find the id `prune --version` takes.
  - `POST /api/v1/prune` takes `{ version? }` and answers `{ removed }`, the keys it deleted from the bucket. It first deletes every World Version retired for `PRUNE_GRACE_DAYS` or more (a deleted World Version is the "pruned" one that answers 404), then every file no remaining World Version's `files` list names. With `version`, that one World Version is deleted whatever its age: `409` if it is the World's live one, `404` if it does not exist. The `prune` subcommand runs the same cleanup directly against the database and bucket.
- `GET /healthz` returns 200 when Postgres answers. It stays outside `/api/v1`, so container health checks and load balancers never follow an API version.
- **Status codes → client error kinds**: `getToken()` rejecting → `token`; 401 after the one retry → `unauthorized`; 403 → `forbidden`; 404 on a World Version or a blob mid-session → `worldUpdated`; 404 on `live` (never Published), 5xx, or a network failure → `unavailable`.
- **Flags type**: `boolean | string` everywhere (the client's store narrows from today's `boolean | number | string`).

**Host session (client)**

- **Flags**: read once at mount. Each write updates memory first, then sends a `PATCH`. Writes go out one at a time, in order. A 401 refreshes the token and retries once. A network error or 5xx retries with backoff, 3 tries over about 5 seconds; if all fail, the session raises `unavailable` and the built-in ErrorScreen covers the game. No offline queue: a reload reads back what the server stored. Two tabs each keep their own copy; neither sees the other's writes until it reloads.
- **Companion auto-dismiss** (`adr/0038`): at load, a stored Companion whose mover the Scripts no longer declare, or whose Entity isn't in `manifest.entities`, is set to `false`.
- **URLs**: the client builds every file URL as `assetBaseUrl + key`. engine-core loads a Map, its tilesets, and Character sheets from those URLs. Relative tileset resolution is replaced by the keys Publish wrote into each Map (`adr/0035`, `adr/0040`).

**Reference Platform (`apps/web`)**

- One page mounts `<Game>`. `getToken` calls the Platform's own `POST /api/game-token { studentId }`, which signs with `jose`: HS256, `JWT_SECRET`, `sub` = the Student id, `world` = `WORLD_ID`, `aud: "game-service"`, one-hour `exp`. The Student id comes from `?student=<id>` (default `dev-student`), with a comment marking where a real Platform checks its own session and enrollment instead.
- The page overrides one slot (`ErrorScreen`) with a React component, so slot overrides are shown working.
- Configuration lives in a gitignored env file with a committed example: `GAME_SERVICE_URL`, `WORLD_ID`, `JWT_SECRET`. Local dev uses fixed dev secrets so `bun run dev` works without setup.
- The maintainer's licensed `assets/` stays local and gitignored, restructured into a content folder (`library/` + `worlds/<id>/`) and Published to the local Game Service.

**Image and deploy**

- **Build**: `bun build --compile` produces one binary per architecture, cross-compiled in a `--platform=$BUILDPLATFORM` stage (no QEMU). Migrations are embedded with `--asset`. Dotenv and bunfig autoloading are disabled in the binary. The final stage only copies the binary onto `gcr.io/distroless/base-nossl-debian13:nonroot`, pinned by digest, with numeric `USER 65532`. `Bun.sql` and `Bun.s3` connect from the compiled binary (proved in the first image ticket, so the `oven/bun:1.4-distroless` fallback is not needed). The embedded `drizzle/` folder sits beside the entry in Bun's virtual filesystem, so `database.ts` reads it from there when compiled. Docker Hardened Images were weighed as the base and not used: pulls need a `docker login dhi.io`, which every contributor and CI build would then need, and the distroless base is anonymous and already tracked by Dependabot.
- **Subcommands**: `serve` (default), `migrate`, `prune`, `health`. `HEALTHCHECK` uses `health`, since the image has no shell or curl.
- **Environment**: `DATABASE_URL`; `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (always passed explicitly, because Bun signs with region `auto` for a custom endpoint, and strict servers reject it); `JWT_SECRET`; `PUBLISH_KEY`; `CORS_ORIGINS` (comma-separated). Optional: `ASSET_BASE_URL`, `PRUNE_GRACE_DAYS` (default 90), `PORT` (default 3000). The service checks them at startup and exits naming any that are missing.
- **Running it**: `migrate` runs as a one-off container before `serve` (compose `service_completed_successfully`, or a Kubernetes Job). The install guide's Compose example has a `bundled` profile that runs Postgres and SeaweedFS beside the service, unpublished; the operator wizard picks it by default and generates their credentials, and an operator with their own Postgres and bucket answers no. `prune` is scheduled by the operator; the service never schedules anything itself. The guide's examples set a read-only root filesystem, a tmpfs at `/tmp`, and drop all capabilities.

**Local dev**

- A root compose file runs `postgres:18` and SeaweedFS (`weed mini`, with the bucket and access key created from environment variables at startup). `postgres:18` keeps its data under `/var/lib/postgresql/18/docker`, so the volume mounts `/var/lib/postgresql`. The same file, with the `image` profile adding the Game Service image and a one-off `migrate`, is the guide's example deploy (`docker compose -f compose.dev.yaml --profile image up --build --wait`). MinIO is excluded: nixpkgs flags it as having known vulnerabilities, and its community edition is archived.
- `bun run dev` brings up the compose services, then the Game Service and the reference Platform. Nix keeps supplying Bun, Rust, and the tools, not the services.

**Repo workflow and release**

- **Rulesets**: `main` requires PRs, with lint, typecheck, and test as required checks, and no force-push or deletion. Only admins bypass. Merges are rebase-only, to keep atomic commits, and head branches are deleted automatically after merge. A tag ruleset lets only admins create or move `v*` tags. `Closes #N` in the PR body or a commit message closes the issue when the PR merges. The commit and ticket-completion sections of `CLAUDE.md` and `docs/agents/issue-tracker.md` are rewritten for branch → PR → merge (branch name `<issue>-<slug>`).
- **CI**: one workflow on PRs and on pushes to `main`: Bun and Rust, `bun run lint`, `bun run typecheck`, `bun run test`, with Postgres 18 and SeaweedFS as service containers.
- **Release** (`adr/0044`): a `v*` tag runs the CI checks, writes the tag's version into each package, builds the client and the CLI (with its WASM), and fails if `npm pack --dry-run` lists anything outside `dist/` or under `assets/`. It stages both packages through npm trusted publishing with provenance, and a maintainer approves each staged version with 2FA before it goes live. It builds and pushes the image to GHCR for amd64 and arm64 with provenance, an SBOM, and keyless cosign signing. Last, it creates a GitHub Release with generated notes. The npm org and each package's trusted-publisher link are a one-time manual setup.
- **Dependabot** watches the base-image digest, GitHub Actions, npm, and cargo.

**Guides** (`docs/guides/`, one topic per file)

- A **Getting started** tutorial takes a reader from nothing to playing on one machine. It runs the Game Service with the operator wizard, builds a tiny World from generated placeholder art (no licensed content), Publishes it, and builds a Next.js Platform from `apps/web`'s code, including one UI override.
- **Reference pages**, one per part: the Game Service (operator), the client package and UI overrides (Platform developer), `crpg` and the content folder (Author), plus local dev (contributor). The README links Getting started first, then the references in the order operator → Platform developer → Author.
- The Compose deploy is a committed file, `deploy/compose.yaml`, that the tutorial and the Game Service reference both download, so neither keeps its own copy.
- Updated: Tiled object authoring is reduced to what `crpg tiled` doesn't generate. CG art, Portrait assets, and Character sheet layout are rewritten from `public/assets` paths and registry edits to content-folder paths.
- **Wizards**: an operator-install `/wizard` and an Author-setup `/wizard` (`adr/0040`), committed as `scripts/operator-install.sh` and `scripts/author-setup.sh` and fetched by raw URL, since operators and Authors have no clone.
- **Wiki mirror**: `docs/guides/` is mirrored to the repo's GitHub wiki on every push to `main` that touches it (`.github/workflows/wiki.yml`), with `docs/guides/README.md` as its Home page. `docs/guides/` stays the source of truth, and the mirror overwrites any edit made on the wiki.

## Testing Decisions

- A good test drives a module through its public seam and asserts what an outside caller sees: an HTTP response, what's live, the printed report, a snapshot, the calls a fake Engine received. It never asserts internal structure. The style stays `node:test`/`node:assert/strict` under `bun run test`, with hand-written fakes and no mocking framework.
- **Game Service, through its HTTP surface**: requests go straight into the Elysia app (`app.handle(new Request(…))`, no listening port) against the real Postgres and bucket from the compose file. Each test uses its own World ids and key prefix. The tests skip with a clear message when `DATABASE_URL` isn't set, except when `CI` is set: there a missing `DATABASE_URL` fails the run, so a misconfigured workflow can't pass the required check with the service untested. They cover:
  - token checks: a wrong World, a wrong `aud`, an expired token
  - Flags: merge, limits, 400 and 413
  - World Versions: `live` and by id, 404 for a never-Published World and for a pruned World Version
  - `/blobs`: headers, a missing key, and a 200 body rather than a 302 (the `adr/0042` trap)
  - upload: a hash mismatch is refused
  - commit: a missing key is refused, and so is a stale `expectedLive`
  - `prune`: the grace period, and refusing the live World Version
  - `/healthz`
- **CLI, as a command against a real service**: a test runs `publish` / `prune` on a synthetic content folder in a temp directory, with the CLI's Eden client pointed at the in-process service app. It asserts through the service's HTTP surface (what's live, which blobs exist) and on the printed report. It covers every local check, the anchor rewrite, the Pre-Publish diff, `--new`, `--yes`, `--dry-run`, and "only missing files are uploaded". This catches drift between the CLI and the service that a fake client would hide.
- **Client, through the per-mount Host session**: this is the headless store behind `mount` (snapshot, `subscribe`, actions), built with an Engine factory and a service client that tests replace with fakes. It covers:
  - loading the World Version once, then by id
  - Flags read at mount, ordered writes, the 401 retry, backoff then `unavailable`
  - the status-to-error-kind mapping
  - Companion auto-dismiss
  - the Dialogue, CG, and Companion snapshots

  `mount()` itself (Phaser and the DOM), the Preact built-ins, and the slot portals aren't covered here. Prior art: the Companion sync and CG tests now in `apps/web/test`, and the VM tests in `packages/clsc/vm/test`.
- **engine-core**: its existing unit tests, updated so Maps, tilesets, and Characters load from `assetBaseUrl + key`. No new seam.
- **Fixtures are synthetic only**: 1×1 PNGs, a tiny hand-written `.tmj`, and small `.clsc` files. No licensed or third-party art in the repo.
- **Manual verification** (no browser automation, per `CLAUDE.md`):
  - the reference Platform end to end: Publish from the local content folder, play, refresh and keep Flags, switch `?student=`
  - re-Publishing mid-session leaves the open session on its World Version
  - the `ErrorScreen` override shows
  - the image runs under compose with a read-only root filesystem
  - both wizards
  - a dry-run release workflow on a test tag

## Out of Scope

- **Which Character a carried Companion walks with**: #76, blocked by #38.
- **A "World finished" signal to the Platform**: #77.
- **A distributable CC0 sample World**: the install guide is "bring your own World".
- **A `crpg dev` command**: Authors Publish to a draft World id instead.
- **A polished web UI for the guides**: they stay Markdown.
- **How a World shows an intro**: the boot CG is dropped; decided later.
- **An offline queue for Flag writes**: a failed write stops the game instead.
- **Real sign-in in the reference Platform**: `?student=` stands in for it.
- Everything already in the map's Out of scope: removing content from the author's Strapi, an admin upload UI, Quest, multiplayer, generated Character previews, a rollback command, deleting a whole World.

## Further Notes

- The Glossary's intro and **Host** entry now describe the Host as the runtime inside the mounted game. Older ADRs and spec sections that say the Host owns content or persistence (`adr/0001`, `adr/0028`, the Dialogue and Companion spec files) are read with that change: content belongs to the World, persistence to the Game Service, and sign-in to the Platform.
- Earlier sections' "Flags are in-memory, so a refresh resets them" limitations end with this section.
- Rewrote "What this repo is", the tech stack's demo-shell line, the Architecture bullets, and "Playground-specific scaffolding" in [README.md](../README.md) to match this delivery model.
