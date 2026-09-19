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

## Canvas & Camera Scaling

### Problem Statement

The game canvas is a fixed, hardcoded 640×480 box that never adapts to the browser window, and its 32×32px tiles read as cramped in a viewport that size. There's no camera behavior at all — no zoom, no following the Player — so the game always looks small regardless of the player's screen, and any Map bigger than the tiny fixed viewport can't be tracked around.

### Solution

The canvas fills the browser window via Phaser's `Scale.FIT` (scaling a 960×540, 16:9 base resolution, so it doesn't letterbox on typical widescreen monitors), and the camera zooms in 2x and follows the Player as they move, bounded to the currently-loaded Map's own edges so it never scrolls past the Map into empty space.

### User Stories

1. As a Player, I want the game to fill my browser window, so that I'm not stuck looking at a small fixed box on an otherwise empty page.
2. As a Player, I want tiles to render at a comfortable size, so that the world doesn't feel cramped or hard to make out.
3. As a Player, I want the camera to follow my character as I move, so that I can always see where I am on the Map.
4. As a Player, I want the camera to stop at the Map's edges, so that I never see empty space beyond the Map boundary.
5. As a Player, I want the game to resize smoothly when I resize my browser window, so that the experience adapts without a page reload.
6. As a Player on a widescreen monitor, I want the game to fill the screen without black bars, so that it feels designed for my display.
7. As a Player on an unusually-shaped window, I want the game to letterbox rather than distort or crop, so that world proportions stay correct.
8. As a Player on a very large or ultrawide monitor, I want the game to keep scaling to fill my screen with no artificial size cap, even if tiles render larger/chunkier as a result.
9. As a Player, I want pixel art to stay crisp, not blurry, at any window size, so the visual style holds up when the game is scaled up.
10. As a Player, I don't want to notice the camera as a separate control I have to manage, so that following/zoom/bounds feel like an inherent part of how the game renders.
11. As a Player transitioning between Maps (edge-walk or Portal), I want the camera to re-center correctly on the new Map, so the view doesn't carry over stale bounds/position from the Map I just left.
12. As an Engine developer, I want camera bounds computed automatically from each Map's own pixel dimensions, so adding a new Map never requires manually configuring its camera.
13. As an Engine developer, I want zoom to be a single Engine-wide constant, so I don't need to tune it per Map.
14. As an Engine developer, I want the camera-bounds calculation available as a pure, unit-testable function, so I can verify it without a browser or a running Phaser instance.
15. As an Engine developer, I want the responsive canvas sizing to require no per-transition or per-Map handling code, so it keeps working automatically as Maps are added.
16. As a Map author, I want to know the effective viewport size at the standard zoom (roughly 480×270 world units), so I can author Maps that fill the frame edge-to-edge when that matters.
17. As a Map author, I want a Map smaller than the viewport to still render correctly (camera just clamps/centers), so small test Maps stay usable during development.
18. As a Host integrator, I want the canvas container to fill the space its parent page gives it instead of being a hardcoded fixed-size box, so the Engine visually integrates into whatever layout the Host provides.
19. As a developer verifying this ticket, I want a manual checklist confirming resize/zoom/follow/bounds behavior in the running app, so the ticket can be marked done despite this repo having no browser automation.

### Implementation Decisions

- Phaser game config gains a `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }` block. The base `width`/`height` change from reading the container's `clientWidth`/`clientHeight` at construction time (640×480 fallback) to a fixed 960×540 (16:9) virtual resolution — FIT scales that fixed buffer to whatever the container becomes, so a live container size is no longer needed at construction.
- The Host-side canvas container drops its hardcoded fixed-size style in favor of filling the space available in its parent page, with no maximum-size cap.
- After the tilemap is created, the Scene sets a fixed zoom of 2 on the main camera, calls `startFollow` on the Player sprite with a centering offset (per Grid Engine's documented convention), and sets camera bounds from the just-loaded tilemap's own pixel dimensions.
- `computeCameraBounds(mapWidthInPixels, mapHeightInPixels)` is a pure function in engine-core's existing `util` module, returning the rectangle passed to `camera.setBounds(...)`. A dedicated `camera` module was tried first but dropped in code review as speculative generality — the function has no branching logic to justify its own module, unlike `tileAnimation`'s `stepAnimation`.
- Zoom (2) and base resolution (960×540) are fixed Engine-wide constants for this round, not exposed via World Config — Hosts and Map authors don't configure camera behavior per Map.
- No changes to World Config, Engine Events, or the Tiled Map format — this is purely how the existing Map/Player render on screen.
- Camera setup re-runs on every Scene `create()`, which already happens on every Map transition (the Host remounts on transition per `adr/0005-host-remounts-on-transition-instead-of-engine-scene-switch.md`) — so zoom/follow/bounds re-establish automatically per Map with no additional transition-handling code.
- See `adr/0007-scale-canvas-with-phaser-fit-and-fixed-camera-zoom.md` for the FIT-vs-RESIZE-vs-ENVELOP and fixed-zoom-vs-variable-resolution rationale.

### Testing Decisions

- Good tests here assert the observable output of pure functions, not Phaser/Scene internals — matching the existing pattern in `packages/engine-core/test/` (`node:test` + `node:assert/strict`, no mocking framework, e.g. `tileAnimation.test.ts`'s tests of `stepAnimation`).
- `computeCameraBounds` gets a unit test in `util.test.ts` alongside the module's other pure functions: given a Map's pixel width/height, it returns the expected `{x: 0, y: 0, width, height}` rectangle, including edge cases like a 1-tile Map and a very large Map.
- Everything past that seam — FIT actually resizing the canvas, zoom actually enlarging tiles, follow actually tracking the Player, letterbox/no-letterbox behavior across window shapes, and pixel-art crispness at large scale — isn't automatable in this repo (no e2e/browser automation exists, per `CLAUDE.md`) and is verified manually: resize the browser window and confirm no letterboxing on a widescreen display, walk the Player to a Map edge and confirm the camera stops rather than showing void, and confirm tiles read as a comfortable, non-blurry size.
- No new test infrastructure needed — reuses the `node:test` setup already wired for `packages/engine-core`.

### Out of Scope

- Map/world size changes — existing Tiled Maps are untouched; only how they're viewed changes.
- Sprite/tileset pixel-art scale factor — zoom is camera-level only, no asset-level scaling.
- A separate UI/HUD camera — no HUD exists yet, so there's nothing to isolate from world zoom; revisit when one is introduced.
- Per-Map or Host-configurable camera behavior — zoom and base resolution are fixed Engine-wide constants for this round.
- A maximum render-size cap for very large/ultrawide monitors — explicitly decided against for now (see ADR 0007); straightforward to add later if it proves necessary.
- Mobile/touch-specific responsive behavior — this addresses desktop browser window resizing only, consistent with the Engine's existing desktop-first, keyboard-only movement scope.
- Any change to the Engine/Host contract (World Config, Engine Events) — purely a rendering/viewport concern internal to the Engine.

### Further Notes

- See `adr/0007-scale-canvas-with-phaser-fit-and-fixed-camera-zoom.md` for the full rationale and rejected alternatives.
- Future Maps intended to fill the frame edge-to-edge at the standard zoom should be authored at roughly 480×270 world units or larger; smaller Maps still render correctly (camera bounds just clamp/center) but won't fill the screen edge-to-edge.

## Dialogue Scripts

Confirmed 2026-09-19 via grilling session, following investigation of overlap with `issues/05-entity-interaction-hook.md`. See `CONTEXT.md`'s "Content" vocabulary (Script, Dialogue, Flag) and `adr/0008` through `adr/0011` for the rationale behind each architectural call below.

Beyond the literal Phase 1 done-bar (Phase 1 explicitly excludes dialogue/quests/XP UI) — this is the first slice of Phase 2-ish "what happens after an Interaction" work, grilled now because ticket 05 (which it depends on) was already being pulled forward.

### Problem Statement

Ticket 05 gives the Engine a way to detect and report "the Player interacted with Entity X" (or, via ticket 03, "the Player entered Map Y"), but nothing yet lets a course/content author attach actual behavior — starting with dialogue — to that report. Without it, an Interaction or a Map-entry is an event nobody's listening to.

### Solution

A Host-side Script: ordinary TypeScript, authored per Entity (or per Map, for entry) via a naming convention, that runs when the corresponding Engine Event fires and produces Dialogue — using a small builder API rather than a new authoring language. Scripts can read and set small per-Student Flags, so future content can branch, even though this round's own Dialogue content stays static.

### User Stories

1. As a content author, I want to write a Script as plain TypeScript, so that I get full IDE/type support without learning a new authoring language.
2. As a content author, I want a Script to be found automatically from the Entity it belongs to, so that I don't have to maintain a separate lookup table for every Entity I author.
3. As a content author, I want to author an Entity in Tiled the same way Spawn points already are, so that I don't have to learn a second Map-authoring convention.
4. As a content author, I want to tag an object's kind (Spawn/Entity/Portal) from a dropdown instead of typing a string, so that a typo can't silently produce an untagged object.
5. As a Player, I want interacting with an Entity that has a Script to show me Dialogue, so that the world feels responsive instead of Entities being inert.
6. As a Player, I want entering a Map that has a Script to show me Dialogue automatically, so that a Map can introduce itself without requiring me to interact with something first.
7. As a Player, I want to pick from Dialogue choices when a Script offers them, so that my responses can matter.
8. As a Player, I want the game world to remain visible and technically walkable while Dialogue is showing in v1, so that a Dialogue box doesn't need to be dismissed through a separate control scheme (accepted rough edge — see Out of Scope).
9. As a content author, I want a Script to be able to check whether a Flag is already set, so that I can write dialogue that changes after the Player has done something once.
10. As a content author, I want a Script to be able to set a Flag as an outcome of a choice, so that the Player's decision persists.
11. As a Host developer, I want Flags stored per-Student, so that two different Students never see each other's progress.
12. As a Host developer, I want Flags modeled as a local fixture shaped like a plausible future real-backend response (mirroring how `WorldConfig` is already stubbed), so that wiring a real database in later requires no redesign of the Script-facing API.
13. As a Host developer, I want a single place to inspect a given Student's current Flags, so that debugging "why did/didn't this dialogue branch fire" is a one-place lookup, not a hunt across scattered state.
14. As an Engine developer, I want the Engine to remain completely unaware that Scripts, Dialogue, or Flags exist, so that the Engine's public surface and its statelessness (ADR-0001) stay unchanged.
15. As an Engine developer, I want Host-side tooling that needs to know which Entities exist on a Map to read the authored Tiled file directly, so that the Engine doesn't need a new entity-catalog API just to support Host tooling.
16. As a ticket-05 implementer, I want the Entity-authoring convention (Tiled Custom Class, shared `objects` layer) already decided, so that I'm not guessing at something ticket 05's own checklist left open.
17. As a future maintainer, I want it recorded that dialogue does not pause the Player in v1, so that I don't "fix" what was actually a deliberate scope cut, and know where the follow-up work (a Host→Engine pause channel) belongs.

### Implementation Decisions

- **Script authoring**: a Script is a TypeScript module built with a small builder/fluent API (e.g. chaining a "say a line" call with a "offer choices" call) — not a parsed DSL, not a data-only config format. See `adr/0009`.
- **Script location convention**: an Entity's Script is found by naming convention from its `entityId` (the Tiled object's `name` field) — no explicit id-to-path lookup table in this round.
- **Triggers**: exactly two Engine Events drive Scripts — the `interacted` event (ticket 05, keyed by `entityId`) for Entity Scripts, and the `transitioned` event's `toMapId` (ticket 03) for Map-entry Scripts. No other Engine Event drives a Script this round.
- **Script context**: a Script receives a read-only context object exposing the current Student's Flags, so the shape supports branching now even though this round's Dialogue content doesn't branch on anything yet.
- **Flags**: a flat per-Student key/value store (boolean/number/string values only — no nested structures, no quest/inventory modeling). Fixture-backed the same way `WorldConfig` already is, behind one small async read/write module (async specifically so a real backend fetch can later replace the in-memory store with no change to callers) so a real backend can later replace the fixture without changing the Script-facing context shape. Student identity for this store is Host-only and does *not* touch `WorldConfig` — the Engine has no use for it, and ADR-0001 already commits the Engine to owning no state (ticket 11's implementation note has the detail; an earlier draft of this line incorrectly said `WorldConfig` would need a new field).
- **Entity/Spawn/Portal authoring in Tiled**: all three share the Map's single `objects` object-layer; each object's kind is tagged via a Tiled Custom Class (`Entity`, `Spawn`, `Portal`), not a freeform string and not a dedicated layer per kind. Requires a Tiled Project file. See `adr/0010` and `guides/tiled-object-authoring.md`.
- **Rendering**: Dialogue is rendered entirely by the Host (resolves the "Open" question below in favor of a Host-side overlay, not in-canvas/Phaser rendering) as a non-blocking overlay — the Engine gains no pause/resume capability in this round. See `adr/0011`.
- **No change to ticket 05's own scope** — this feature consumes 05's `interacted` event as-is; the Tiled-authoring convention decided here fills a gap 05's checklist left implicit, rather than modifying 05's checklist itself.

### Testing Decisions

- Matching the existing pattern (`tileAnimation.test.ts`, `util.test.ts`): test pure logic with `node:test`/`node:assert/strict`, not Phaser/Scene/DOM internals.
- The Flag store's get/set behavior, entityId→script-path resolution, and the Script builder API's output (does chaining produce the right internal step list) are all pure functions and get unit tests.
- Dialogue actually rendering on screen, the overlay's non-blocking behavior, and a Script firing at the right moment during real play aren't automatable here (no e2e/browser automation, per `CLAUDE.md`) — verified manually: interact with a Scripted Entity and confirm the right Dialogue/choices appear, confirm a choice's Flag persists across a second Interaction, confirm the Player can still move while Dialogue is up (the accepted v1 rough edge).

### Out of Scope

- **CG (full-screen illustration) and cutscene** (a Script taking control away from the Player) — needs a Host→Engine imperative pause/resume channel that doesn't exist and isn't being built this round (`adr/0011`). Blocked on this Dialogue Script slice landing first.
- **Raw per-step (`moved`) or tile/zone-entered Script triggers** — no concrete need yet, and a zone trigger needs a new authored Map-object type that doesn't exist.
- **entityId→script lookup table** — only needed if one Script must serve multiple Entities; not built until that's a real case.
- **Full quest/variable/inventory modeling** — Flags stay a flat key/value store, matching Phase 1's existing "no quests/XP UI yet" boundary.
- **Ink language integration** — stays separately deferred (see below); this Script system is the general dispatch shell Ink could plug into later, not a replacement for it.
- **Pausing/disabling Player movement while Dialogue is shown** — accepted v1 rough edge, not solved here.

### Further Notes

- See `adr/0008` for why this is Host-side rather than Unity-style Engine-side scripting.
- This is the first content built on top of ticket 05/03's events; the ticket-dependency shape (state-collection ticket blocking the dialogue-script ticket, which is blocked by 05 and 03) is for `/to-tickets` to formalize, not fixed here.

## Explicitly out of scope / deferred

- **Quests, XP, inventory, progression rules** beyond the Flags described above — these belong to the Host/main-repo backend, not the Engine, and Flags themselves stay a flat key/value store, not a full progression system.
- **Ink language integration** for dialogue authoring — skip until needed, not designed now; the Dialogue Scripts system above is a separate, general dispatch mechanism Ink could plug into later, not a replacement for it.
- **NPC/Entity sprite rendering** — the Engine has no visual representation for an Entity at all yet (ticket 05 is position + interaction-event only, no sprite). The character-animation mechanism above is deliberately generic so it can cover this later without new Engine code, but the actual wiring is deferred until Entity rendering itself is designed and built.
- **CG/cutscene, non-Interaction/Map-entry Script triggers, entityId→script lookup tables** — see Dialogue Scripts' own Out of Scope above.

## Open

(No open items at present — the previous entry, where interaction/dialogue UI renders, was resolved by the Dialogue Scripts section above: a Host-side overlay, not in-canvas.)

## Playground-specific scaffolding

This repo can't reach the main monorepo's real database, so player/world state is stubbed via a local JSON fixture shaped like the eventual real API response. This validates the Engine's config/event contract in isolation now; swapping the fixture for a real fetch later should require no redesign.

## Phase 1 "done" bar

- Multiple Tiled maps
- A character walking via grid-engine + keyboard
- At least one edge-walk transition and one Portal transition wired up between maps
- Ambient/decorative Tiled-authored tile animation renders (e.g. the campfire)
- Player renders and animates via a real normalized character spritesheet (directional walk-cycle + idle), not just a placeholder rectangle
- All driven by the local JSON fixture (no real backend)
- No dialogue/quests/XP UI yet — out of scope for this phase
