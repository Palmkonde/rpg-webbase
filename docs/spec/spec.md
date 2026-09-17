# Game Engine — Confirmed Spec

Confirmed 2026-09-17 via grilling session. This is the record of what was decided (and explicitly left open) before any code was written — see `../CONTEXT.md` for the glossary and `adr/0001-engine-owns-rendering-only.md` for the rationale behind the biggest architectural call.

## What this repo is

A standalone sandbox for prototyping an RPG-gamification engine. Nothing here is live-wired to the main monorepo yet. Once it's solid, it gets manually copied into that monorepo as a workspace package — there's no shared tooling to match in the meantime, and this repo has no access to that monorepo's backend/API/grader.

The main repo is an education-platform monorepo (backend, frontend on Next.js, API services, grader). This engine exists to make the course feel like an RPG (gamification), not to replay grader output or drive a coding exercise directly.

## Tech stack

- TypeScript throughout
- Phaser + the `grid-engine` plugin for grid-based movement
- Tiled for map authoring (Phaser has native Tiled JSON support)
- A thin Next.js app as the render/demo shell — chosen to mirror the main repo's frontend stack
- `phaserjs/template-nextjs` is reference/inspiration only (the React↔Phaser bridge pattern) — it is **not** forked or scaffolded from directly

## Architecture

A framework-agnostic engine-core package, mounted by the Next.js shell.

- The Engine is **stateless and config-driven**: it takes a World Config (Map, Player position, Entities, Portals) as input and emits Engine Events (moved, transitioned, interacted) as output.
- The Engine owns no state and has no DB access. The Host (Next.js app here, eventually backed by the main monorepo's database) owns all truth.
- See `adr/0001-engine-owns-rendering-only.md` for why this boundary was chosen over an Engine that owns its own state/content.

## Engine scope (MVP boundary)

The Engine owns:
- Tiled-authored tilemap rendering
- Grid-based keyboard movement (desktop-first, no touch)
- Map transitions: both edge-walk (off a map's boundary into an adjacent map) and Portal (authored teleport tiles/objects)
- A generic "Player interacted with Entity" hook

Single-player only — no multiplayer/shared-world sync.

## Explicitly out of scope / deferred

- **Dialogue content, quests, XP, inventory, progression rules** — these belong to the Host/main-repo backend, not the Engine. The Engine only ever reports "Player interacted with Entity X"; it has no idea what that means.
- **Ink language integration** for dialogue authoring — skip until needed, not designed now.

## Open

- **Where does interaction/dialogue UI render** — in-canvas (Phaser draws it) vs. a React overlay outside the canvas? Explicitly left unresolved by request; revisit after Phase 1 rendering work is done. Do not assume an answer here.

## Playground-specific scaffolding

This repo can't reach the main monorepo's real database, so player/world state is stubbed via a local JSON fixture shaped like the eventual real API response. This validates the Engine's config/event contract in isolation now; swapping the fixture for a real fetch later should require no redesign.

## Phase 1 "done" bar

- Multiple Tiled maps
- A character walking via grid-engine + keyboard
- At least one edge-walk transition and one Portal transition wired up between maps
- All driven by the local JSON fixture (no real backend)
- No dialogue/quests/XP UI yet — out of scope for this phase
