# Game Engine — Confirmed Spec

Confirmed 2026-09-17 via grilling session. This is the record of what was decided (and explicitly left open) before any code was written — see `../GLOSSARY.md` for the glossary and `adr/0001-engine-owns-rendering-only.md` for the rationale behind the biggest architectural call.

This file holds the cross-cutting decisions. Each feature's spec lives in its own file, `<domain>/<feature>.md`, listed here by domain in the order it was confirmed.

### World: Maps and what's placed on them

- [Canvas & Camera Scaling](world/canvas-and-camera-scaling.md)
- [Map Object Authoring: Layer Flexibility & Dedicated Identity](world/map-object-authoring.md)
- [Zone: Walking Into a Region Triggers a Script](world/zones.md)
- [Entity Rendering: Character Entities and Prop Entities](world/entity-rendering.md)
- [Portals and Named Spawn Points: Moving Between Maps](world/portals.md)

### Content: what Scripts produce

- [Dialogue Scripts](content/dialogue-scripts.md)
- [Dialogue Scripts: Choices, Speakers & Localization](content/dialogue-choices-speakers-localization.md)
- [Dialogue Portraits & Expressions](content/dialogue-portraits.md)
- [Dialogue Line Pacing](content/dialogue-line-pacing.md)
- [CG & Cutscene](content/cg-and-cutscene.md)
- [CG & Cutscene as Script Output](content/cg-and-cutscene-as-script-output.md)
- [Cutscene Follow Step & Cutscene-Driven Zone Entries](content/cutscene-follow-step.md)
- [Companion: A Character Entity That Keeps Following the Player](content/companions.md)

### Language: CodeLeagues Script

- [CodeLeagues Script](language/codeleagues-script.md)

### Platform: installing the game and talking to it

- [Packaging: Client Package, Game Service and Publish CLI](platform/packaging.md)
- [Game Service Postgres Schema: Sharing an Existing Database](platform/game-service-postgres-schema.md)
- [Platform Commands: Battles and Lessons Started From a Script](platform/platform-commands.md)

## What this repo is

The source of a game any education Platform can install to make its courses feel like an RPG (gamification), not to replay grader output or drive a coding exercise directly. It ships three pieces (see [Packaging: Client Package, Game Service and Publish CLI](platform/packaging.md)): a client package a Platform mounts, a Game Service the Platform deploys next to its own services, and a CLI Authors Publish Worlds with. `apps/web` is a reference Platform that uses them exactly as a real one would. This replaces the earlier plan to copy the engine into the author's own platform monorepo by hand; that monorepo is now just one consuming Platform.

## Tech stack

- TypeScript throughout
- Phaser + the `grid-engine` plugin for grid-based movement
- Tiled for map authoring (Phaser has native Tiled JSON support)
- A thin Next.js app as the reference Platform — chosen to mirror the author's own platform's frontend stack
- `phaserjs/template-nextjs` is reference/inspiration only (the React↔Phaser bridge pattern) — it is **not** forked or scaffolded from directly

## Architecture

A framework-agnostic engine-core package, embedded by the Host inside the client package, which a Platform mounts.

- The Engine is **stateless and config-driven**: it takes a World Config (Map, Player position, Entities, Portals) as input and emits Engine Events (moved, transitioned, interacted) as output.
- The Engine owns no state and has no DB access. The Host plays the World's Scripts per mounted game; content comes from the World Version and Flags from the Game Service.
- See `adr/0001-engine-owns-rendering-only.md` for why this boundary was chosen over an Engine that owns its own state/content.

## Engine scope (MVP boundary)

The Engine owns:
- Tiled-authored tilemap rendering
- Grid-based keyboard movement (desktop-first, no touch)
- Map transitions through Portals, authored objects that target a named Spawn Point on another Map. An opening at a Map's edge is a Portal too; there is no separate edge-walk (see [Portals and Named Spawn Points](world/portals.md), `adr/0046`).
- A generic "Player interacted with Entity" hook
- Tiled-authored ambient/decorative tile animation (e.g. the campfire) — any tile carrying Tiled's per-tile `animation` metadata plays back generically, unconditional and Engine-owned like the rest of rendering, not gated by World Config. See `adr/0003-animate-tiles-by-cycling-tilemap-index.md` for the rendering mechanism.
- Player directional walk-cycle and idle animation via a normalized character spritesheet, in place of the earlier static placeholder. See `adr/0006-normalize-downloaded-character-sheets-into-grid-engines-canonical-layout.md`.

Single-player only — no multiplayer/shared-world sync.

## Player animation & character assets

The Player renders via a real, normalized character spritesheet instead of a placeholder rectangle, using grid-engine's built-in directional walk-cycle animation (4 cardinal directions × left-foot/standing/right-foot frames). Idle is just the "standing" frame of the current facing direction, which grid-engine drives automatically when the Player stops moving — no separate idle-state code is needed.

- Any downloaded/third-party character sheet is normalized by hand (cropped/rearranged in an external image tool) into grid-engine's canonical layout before use; a sheet the team draws itself is authored directly in that layout and skips normalization entirely.
- Where a source sheet has no real art for one or more directions, the missing direction's frames are filled by duplicating an available direction's frames at normalization time — not synthesized (e.g. mirrored) or faked at runtime, and not rejected outright.
- Normalized character assets live at `assets/sprites/characters/<name>/`, keeping both the original download (`raw.*`) and the normalized output, so a bad crop can be redone without re-sourcing the asset.
- The Engine's runtime rendering code is asset-agnostic: it always consumes the same canonical shape via grid-engine's `characterIndex`/`WalkingAnimationMapping`, regardless of which character or source it came from — this is what lets the same mechanism later cover an NPC/Entity sprite without new Engine code.
- On texture load failure, the Engine falls back to the existing placeholder-rectangle generator (kept, not removed) and logs a warning naming the missing texture key, so a broken asset reference stays visually and diagnostically obvious instead of failing silently.
- No artificial runtime scale factor is applied to the sprite (the earlier `PLACEHOLDER_HEIGHT_SCALE`-style multiplier is dropped) — it renders at the normalized sheet's native pixel size.

This round's concrete deliverable normalizes and wires in one test character ("fluffy") as the actual spawned Player, to prove the mechanism end-to-end in the running app. A second test asset ("Temmie" — a sheet missing some directions) is normalized as prep for the missing-direction convention above, but is not wired in anywhere yet, since the Engine has no Entity rendering to attach it to (see Explicitly out of scope below).

## Explicitly out of scope / deferred

- **Quests, XP, inventory, progression rules** beyond the Flags described in the feature specs — these belong to the Host/main-repo backend, not the Engine, and Flags themselves stay a flat key/value store, not a full progression system.
- **Ink language integration** for dialogue authoring — skip until needed, not designed now; the [Dialogue Scripts](content/dialogue-scripts.md) system is a separate, general dispatch mechanism Ink could plug into later, not a replacement for it.
- **NPC/Entity sprite rendering** — no longer deferred; see [Entity Rendering: Character Entities and Prop Entities](world/entity-rendering.md).
- **entityId→script lookup tables** — see [Dialogue Scripts](content/dialogue-scripts.md)' own Out of Scope. (Map-entry Scripts are no longer deferred — they are `on arrive(<map id>)` handlers, `adr/0047`; CG/cutscene itself is no longer deferred — see [CG & Cutscene](content/cg-and-cutscene.md); zone-entered triggers are no longer deferred either — see [Zone: Walking Into a Region Triggers a Script](world/zones.md).)
- **Flag arithmetic, a Script→Host side-effect channel, timed/auto-advancing choices, a Player-facing locale switcher** — see [Dialogue Scripts: Choices, Speakers & Localization](content/dialogue-choices-speakers-localization.md)'s own Out of Scope.
- **Portrait art normalization pipeline, Portrait animation, and any tie-in to NPC/Entity sprite rendering** — see [Dialogue Portraits & Expressions](content/dialogue-portraits.md)'s own Out of Scope (Portrait/Expression itself is no longer deferred — it's scoped there).

## Open

(No open items at present — the previous entry, where interaction/dialogue UI renders, was resolved by [Dialogue Scripts](content/dialogue-scripts.md): a Host-side overlay, not in-canvas.)

## Playground-specific scaffolding

Superseded by [Packaging](platform/packaging.md): the local JSON fixtures (World Config, Flag seed, String Table) and the hard-coded asset registries are deleted. The reference Platform plays a World Published from a local content folder to a local Game Service.

## Phase 1 "done" bar

- Multiple Tiled maps
- A character walking via grid-engine + keyboard
- At least one Portal transition wired up between maps (edge-walk later folded into Portals, `adr/0046`)
- Ambient/decorative Tiled-authored tile animation renders (e.g. the campfire)
- Player renders and animates via a real normalized character spritesheet (directional walk-cycle + idle), not just a placeholder rectangle
- All driven by the local JSON fixture (no real backend)
- No dialogue/quests/XP UI yet — out of scope for this phase
