# Game Engine — Confirmed Spec

Confirmed 2026-09-17 via grilling session. This is the record of what was decided (and explicitly left open) before any code was written — see `../GLOSSARY.md` for the glossary and `adr/0001-engine-owns-rendering-only.md` for the rationale behind the biggest architectural call.

## What this repo is

The source of a game any education Platform can install to make its courses feel like an RPG (gamification), not to replay grader output or drive a coding exercise directly. It ships three pieces (see "Packaging: Client Package, Game Service and Publish CLI" below): a client package a Platform mounts, a Game Service the Platform deploys next to its own services, and a CLI Authors Publish Worlds with. `apps/web` is a reference Platform that uses them exactly as a real one would. This replaces the earlier plan to copy the engine into the author's own platform monorepo by hand; that monorepo is now just one consuming Platform.

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
- `computeCameraBounds(mapWidthInPixels, mapHeightInPixels)` is a pure function in engine-core's existing `util` module, returning the rectangle passed to `camera.setBounds(...)`. A dedicated `camera` module was tried first but dropped in code review as speculative generality — the function has no branching logic to justify its own module, unlike `tile-animation`'s `stepAnimation`.
- Zoom (2) and base resolution (960×540) are fixed Engine-wide constants for this round, not exposed via World Config — Hosts and Map authors don't configure camera behavior per Map.
- No changes to World Config, Engine Events, or the Tiled Map format — this is purely how the existing Map/Player render on screen.
- Camera setup re-runs on every Scene `create()`, which already happens on every Map transition (the Host remounts on transition per `adr/0005-host-remounts-on-transition-instead-of-engine-scene-switch.md`) — so zoom/follow/bounds re-establish automatically per Map with no additional transition-handling code.
- See `adr/0007-scale-canvas-with-phaser-fit-and-fixed-camera-zoom.md` for the FIT-vs-RESIZE-vs-ENVELOP and fixed-zoom-vs-variable-resolution rationale.

### Testing Decisions

- Good tests here assert the observable output of pure functions, not Phaser/Scene internals — matching the existing pattern in `packages/engine-core/test/` (`node:test` + `node:assert/strict`, no mocking framework, e.g. `tile-animation.test.ts`'s tests of `stepAnimation`).
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

Confirmed 2026-09-19 via grilling session, following investigation of overlap with `issues/05-entity-interaction-hook.md`. See `GLOSSARY.md`'s "Content" vocabulary (Script, Dialogue, Flag) and `adr/0008` through `adr/0011` for the rationale behind each architectural call below. See "Dialogue Scripts: Choices, Speakers & Localization" below for how choices, Speaker, and localization extend this.

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

- **Script authoring**: a Script is a TypeScript module built with a small builder/fluent API (e.g. chaining a "say a line" call with a "offer choices" call) — not a parsed DSL, not a data-only config format. See `adr/0009`. (Choice shape — multi-Flag writes, visible/disabled conditions, nesting into a tree — and per-line Speaker are refined in "Dialogue Scripts: Choices, Speakers & Localization" below.)
- **Script location convention**: an Entity's Script is found by naming convention from its `entityId` (the Tiled object's dedicated `entityId` property — see "Map Object Authoring" below, superseding an earlier draft of this line that said the object's `name` field) — no explicit id-to-path lookup table in this round.
- **Triggers**: exactly two Engine Events drive Scripts — the `interacted` event (ticket 05, keyed by `entityId`) for Entity Scripts, and the `transitioned` event's `toMapId` (ticket 03) for Map-entry Scripts. No other Engine Event drives a Script this round.
- **Script context**: a Script receives a read-only context object exposing the current Student's Flags, so the shape supports branching now even though this round's Dialogue content doesn't branch on anything yet.
- **Flags**: a flat per-Student key/value store (boolean/number/string values only — no nested structures, no quest/inventory modeling). Fixture-backed the same way `WorldConfig` already is, behind one small async read/write module (async specifically so a real backend fetch can later replace the in-memory store with no change to callers) so a real backend can later replace the fixture without changing the Script-facing context shape. Student identity for this store is Host-only and does *not* touch `WorldConfig` — the Engine has no use for it, and ADR-0001 already commits the Engine to owning no state (ticket 11's implementation note has the detail; an earlier draft of this line incorrectly said `WorldConfig` would need a new field).
- **Entity/Spawn/Portal authoring in Tiled**: each object's kind is tagged via a Tiled Custom Class (`Entity`, `Spawn`, `Portal`), not a freeform string and not a dedicated layer per kind; objects can live on any number of object layers (superseding an earlier draft of this line that required one shared `objects` layer — see "Map Object Authoring" below). Requires a Tiled Project file. See `adr/0010`, `adr/0012`, and `guides/tiled-object-authoring.md`.
- **Rendering**: Dialogue is rendered entirely by the Host (resolves the "Open" question below in favor of a Host-side overlay, not in-canvas/Phaser rendering) as a non-blocking overlay — the Engine gains no pause/resume capability in this round. See `adr/0011`.
- **No change to ticket 05's own scope** — this feature consumes 05's `interacted` event as-is; the Tiled-authoring convention decided here fills a gap 05's checklist left implicit, rather than modifying 05's checklist itself.

### Testing Decisions

- Matching the existing pattern (`tile-animation.test.ts`, `util.test.ts`): test pure logic with `node:test`/`node:assert/strict`, not Phaser/Scene/DOM internals.
- The Flag store's get/set behavior, entityId→script-path resolution, and the Script builder API's output (does chaining produce the right internal step list) are all pure functions and get unit tests.
- Dialogue actually rendering on screen, the overlay's non-blocking behavior, and a Script firing at the right moment during real play aren't automatable here (no e2e/browser automation, per `CLAUDE.md`) — verified manually: interact with a Scripted Entity and confirm the right Dialogue/choices appear, confirm a choice's Flag persists across a second Interaction, confirm the Player can still move while Dialogue is up (the accepted v1 rough edge).

### Out of Scope

- **CG (full-screen illustration) and cutscene** (a Script taking control away from the Player) — needed a Host→Engine imperative pause/resume channel that didn't exist yet (`adr/0011`). No longer deferred: designed and scoped in "CG & Cutscene" below.
- **Raw per-step (`moved`) Script triggers** — no concrete need yet. (Tile/zone-entered triggers are no longer deferred — see "Zone: Walking Into a Region Triggers a Script" below.)
- **entityId→script lookup table** — only needed if one Script must serve multiple Entities; not built until that's a real case.
- **Full quest/variable/inventory modeling** — Flags stay a flat key/value store, matching Phase 1's existing "no quests/XP UI yet" boundary. (Reaffirmed in "Dialogue Scripts: Choices, Speakers & Localization" below, including Flag arithmetic specifically.)
- **Ink language integration** — stays separately deferred (see below); this Script system is the general dispatch shell Ink could plug into later, not a replacement for it. (See also `adr/0013` — non-programmer *text editing* is solved separately via a string table; only non-programmer *branching authorship* would actually reopen this.)
- **Pausing/disabling Player movement while Dialogue is shown** — accepted v1 rough edge, not solved here.

### Further Notes

- See `adr/0008` for why this is Host-side rather than Unity-style Engine-side scripting.
- This is the first content built on top of ticket 05/03's events; the ticket-dependency shape (state-collection ticket blocking the dialogue-script ticket, which is blocked by 05 and 03) is for `/to-tickets` to formalize, not fixed here.

## Dialogue Scripts: Choices, Speakers & Localization

Confirmed 2026-09-20 via grilling session, following `docs/research/dialogue-and-choice-script-functionality.md`'s primary-source survey of dialogue/choice systems (Ink, Yarn Spinner, Ren'Py, RPG Maker MZ). Extends "Dialogue Scripts" above: choices grow from a flat, single-Flag round (ticket 14's original scope) into a nested tree with multi-Flag writes, and Dialogue gains a per-line Speaker. See `GLOSSARY.md`'s "Content" vocabulary (Script, Dialogue, **Speaker**, Flag) and `adr/0013-dialogue-localization-is-a-string-table-not-a-reopened-adr-0009.md` for the localization rationale. ADR-0009 and ADR-0011 are both reaffirmed, not reopened.

### Problem Statement

Ticket 14 proves a Script can read and write one Flag through one flat round of choices — enough to show Scripts can branch and persist an outcome, but not enough to author dialogue that reads like the Undertale/visual-novel/RPG reference points this project is aiming for: a single choice rarely stands alone (it usually leads to more choices), a single Flag rarely captures a whole outcome, dialogue with more than one character has no way to say who's talking, and a designer who isn't comfortable writing TypeScript has no way to edit or translate a line of dialogue without going through a programmer.

### Solution

Four independent extensions to the existing Script/Dialogue/Flag mechanism, none of which reopen ADR-0009 (TypeScript builder, not a parsed DSL) or ADR-0011 (no Host→Engine pause channel): choices become a nested tree that can write multiple Flags per branch and can be hidden or shown-but-disabled; Dialogue lines gain an open-ended Speaker so a Script can voice more than one character; dialogue text resolves through a locale-keyed string table so non-technical authors can edit and translate lines without touching a Script's TypeScript structure (`adr/0013`); and a short list of adjacent asks (Flag arithmetic, Script→Host side effects, timed choices, portraits) are explicitly named and deferred rather than silently dropped.

### User Stories

1. As a content author, I want a choice to lead to another round of choices, so that a conversation can branch more than once instead of ending after a single pick.
2. As a content author, I want a choice to set more than one Flag at once, so that a single decision can capture a compound outcome (e.g. both "met the merchant" and "was rude to them").
3. As a Player, I want some choices to be hidden until I've met their condition, so that dialogue doesn't visibly list options I haven't earned yet.
4. As a Player, I want some choices to be visible-but-locked with a reason shown when I try to pick them, so that I know what I need to do to unlock them instead of just seeing them absent.
5. As a content author, I want to write a choice's shared "what happens next" content once as a plain TypeScript function, so that two branches that reconverge don't require me to duplicate the same dialogue lines.
6. As a Player, I want re-interacting with a Scripted Entity to always start its dialogue from the top, so that I'm never confused about where a half-finished conversation left off.
7. As a content author, I want a Dialogue line to carry who's speaking, so that a conversation with more than one character reads clearly instead of every line looking like it comes from one voice.
8. As a content author, I want a Script to attribute a line to a character other than the Entity it's attached to (including a narrator with no Entity in the world), so that a single Script can stage a scene with more than one speaker.
9. As a Player, I want an unattributed line to default to the Entity's own name, so that simple one-voice Scripts don't need to repeat the speaker on every line.
10. As a designer who doesn't write TypeScript, I want to edit and translate a line of dialogue text without touching a Script file, so that I'm not blocked on a programmer for routine content changes.
11. As a Host developer, I want dialogue text to resolve through a locale-keyed lookup instead of being hardcoded inline in a Script, so that adding a language later doesn't mean editing every Script.
12. As a Host developer, I want the locale a line resolves against to be fixture-stubbed today (mirroring how `WorldConfig` and Flags already are), so that a real backend/locale-selection mechanism can replace it later with no redesign of the Script-facing API.
13. As a future maintainer, I want it recorded that Flags stay arithmetic-free and quest/item-free even though the student-state model will eventually need both, so that I don't "helpfully" widen Flag into something `GLOSSARY.md`'s glossary already says to avoid.
14. As a future maintainer, I want the Flag store's async get/set shape to stay generic, so that a sibling Quest/Item store can be added later without changing the Script-facing `ctx` contract.
15. As a future maintainer, I want it recorded that a Script→Host side-effect channel (playing a sound, swapping a portrait, granting an item) was considered and explicitly deferred, so that I build the concrete feature's own API when it's actually needed instead of guessing at a generic hook now.
16. As a future maintainer, I want it recorded that timed/auto-advancing choices were considered and rejected, so that I don't reopen ADR-0011's declined pause channel chasing a feature nobody asked for.
17. As a future maintainer, I want it recorded that portrait/expression art is wanted but explicitly backlogged behind this work, so that it's a known future ticket, not a forgotten idea.
18. As a future maintainer, I want it recorded why the localization fix is a string table rather than a reopened ADR-0009, so that I understand the narrower, cheaper path was a deliberate choice, not an oversight (`adr/0013`).

### Implementation Decisions

- **Choice shape**: a `.choice()` step takes display text, an optional `visible` condition (Flag-based; false ⇒ the choice is omitted from the rendered list entirely), an optional `enabled` condition plus a `disabledReason` (false ⇒ the choice renders but isn't selectable; attempting to pick it surfaces the reason instead), and a set of Flag-writes to apply as its outcome — supersedes ticket 14's original single-Flag-per-choice scope.
- **Choice nesting**: a choice's outcome can itself return another set of choices via the same builder, so Dialogue is a tree, not a single flat round — supersedes the "Script authoring" bullet in "Dialogue Scripts" above, which only demonstrated one flat "say a line"/"offer choices" step.
- **Branch reconvergence**: no dedicated "gather"/merge-point primitive is built. Two branches that need the same continuation content share it by both calling the same plain TypeScript function/closure — ADR-0009's "plain TypeScript, not a parsed DSL" already provides this for free.
- **Dialogue position on re-interact**: a Script always runs from the top on every `interacted`/`transitioned` event; no "current node" is persisted per Student per Script. A half-finished tree simply restarts.
- **Speaker**: each Dialogue line gains an optional `speaker` field (a plain string, not tied to `entityId`); when omitted, it defaults to the owning Entity's display name. A Script may set a different speaker per line, including one with no corresponding Entity (e.g. a narrator). (A Portrait/Expression is bundled onto this same per-line option — see "Dialogue Portraits & Expressions" below.)
- **Localization**: dialogue line text resolves through a small, pure, locale-keyed lookup function (a string table) rather than being passed as an inline literal — content/translation edits happen in that table, not in a Script's TypeScript. Locale itself is fixture-stubbed for now (a hardcoded default, matching how `WorldConfig`/Flags are already stubbed) — a Player-facing language switcher is not built this round. See `adr/0013` for why this doesn't reopen ADR-0009.
- **Flags stay unchanged**: still a flat, per-Student, boolean/number/string key/value store with no arithmetic operations — reaffirmed, not widened, despite student-state eventually growing quests/items. The Flag store's existing async get/set interface already stays generic enough (mirroring `WorldConfig`'s fixture-backed pattern) for a future sibling Quest/Item store to be added without changing the Script-facing `ctx` contract.
- **No Script→Host side-effect channel**: not built this round. A Script triggering something beyond a Flag write (sound, portrait swap, granting an item) gets its own purpose-built API when that concrete feature is actually designed, rather than a speculative generic hook now.

### Testing Decisions

- Same pattern as "Dialogue Scripts" above (`node:test`/`node:assert/strict`, pure functions only): the extended `ScriptBuilder`'s output — a choice's Flag-writes, `visible`/`enabled` conditions, nested choice trees, and each line's resolved `speaker` — gets unit tests alongside the existing builder-output tests.
- The new locale-resolution lookup function gets its own unit tests (given a key and a locale, returns the expected text; a missing key/locale falls back predictably) — a new, small pure module tested the same way `flags.ts` already is.
- Everything past those two seams — hidden vs. disabled choices actually rendering differently in the overlay, a disabled choice's reason actually surfacing on click, a real playthrough navigating a multi-level tree, a line's speaker actually rendering distinctly per line, and restart-at-top behavior on re-interact — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: interact with a Scripted Entity offering a tree of choices, confirm hidden choices are absent and disabled ones show their reason on click, confirm two speakers in one exchange render distinctly, and confirm re-interacting restarts the conversation from the top.

### Out of Scope

- **Flag arithmetic** (increment/compare on numeric Flags) — considered and declined; Flags stay simple set/overwrite. Revisit only if a concrete counter-driven need shows up, not speculatively.
- **Quest/Item modeling** — still belongs entirely to a future, separate concept, not a widened Flag. This round only confirms the Flag store's interface won't need to change shape when that future work lands.
- **A generic Script→Host side-effect channel** — deferred; see Implementation Decisions above.
- **Timed/auto-advancing choices** — declined outright; would risk reopening ADR-0011's declined Host→Engine pause channel for no concrete benefit identified.
- **Portrait/expression art and its asset pipeline** — wanted, but explicitly backlogged behind this work; no `assets/` convention for character-expression art exists yet, and building one is its own, separate research/spec effort. (Now scoped in "Dialogue Portraits & Expressions" below.)
- **A Player-facing locale switcher** — the string-table mechanism is built and tested; actually letting a Player choose a language is a later, separate concern.
- **Random/weighted line variation, one Script calling another, an in-script jump/goto** — considered; all three are already achievable in plain TypeScript with zero builder changes (ADR-0009's whole premise), so none get dedicated builder syntax until a concrete authoring pain point shows up.
- **Save/resume mid-dialogue** — a non-issue given restart-at-top above; nothing to resume.

### Further Notes

- See `docs/research/dialogue-and-choice-script-functionality.md` for the primary-source survey (Ink, Yarn Spinner, Ren'Py, RPG Maker MZ) this section's decisions were grilled against.
- See `adr/0013-dialogue-localization-is-a-string-table-not-a-reopened-adr-0009.md` for why localization doesn't reopen ADR-0009, and what would actually trigger reopening it (a designer needing to build/rearrange branching structure, not just edit line text).
- `GLOSSARY.md`'s "Content" section gained a new **Speaker** term as part of this round.
- This section's scope (tree-shaped choices, multi-Flag writes, Speaker, locale string table) supersedes ticket 14's original flat/single-Flag/no-Speaker assumptions for whatever ticket(s) `/to-tickets` produces from this section — ticket 14 itself, if already in flight or done, is not retroactively rewritten.

## Dialogue Portraits & Expressions

Confirmed 2026-09-20 via grilling session, following up on "Dialogue Scripts: Choices, Speakers & Localization"'s deferred Portrait/Expression item. See `GLOSSARY.md`'s "Content" vocabulary (Speaker, **Portrait**, **Expression**) and `adr/0014-dialogue-portraits-are-a-standalone-asset-type.md` for why Portrait storage is independent of the existing character-spritesheet pipeline (`adr/0006`).

### Problem Statement

A Dialogue line can now carry a Speaker, but nothing lets a Script show what that Speaker looks like — Undertale/visual-novel-style dialogue routinely pairs a line with a character illustration that changes with the character's emotional state, and this project has no path to that at all: no asset location for this kind of art, no way for a Script to select one, and no defined fallback when one doesn't exist.

### Solution

A line's presentation options grow to include an optional Portrait, selected by a fixed Expression value alongside its Speaker. Portrait art lives in its own asset location, independent of the existing per-character spritesheet/normalization pipeline (`adr/0006`, `adr/0014`) — a Speaker (including a narrator) can have Portrait art without needing an on-map character sprite at all, or vice versa. A line with no matching Portrait art simply renders text-only, exactly as it does today.

### User Stories

1. As a content author, I want to select a Portrait and Expression for a line alongside its Speaker, so that dialogue can show what a character looks like as they speak, not just their name.
2. As a Player, I want a character's Portrait to change with their Expression, so that dialogue reads with the emotional nuance Undertale/visual-novel dialogue has.
3. As a content author, I want to pick a line's Expression from a fixed, known set (Neutral, Happy, Sad, Angry, Surprised), so that I'm choosing from a real vocabulary instead of inventing an arbitrary string that might not match any art.
4. As a content author, I want a Speaker with no drawn Portrait for a given Expression to just show text, so that I'm never blocked from shipping dialogue by incomplete art.
5. As a content author, I want a narrator (a Speaker with no Entity or on-map sprite) to be able to have a Portrait too, so that scene-setting narration isn't second-class next to character dialogue.
6. As a Host developer, I want Portrait art stored independently of `assets/sprites/characters/<name>/`'s normalization pipeline, so that a static illustration isn't forced through machinery built for animated walk-cycle sheets.
7. As a Host developer, I want a Portrait's resolution (Speaker + Expression → asset) to be a pure, testable function, so that I can verify "no art for this combination" falls back correctly without a running browser.
8. As a future maintainer, I want it recorded why Portrait art doesn't reuse the character-spritesheet pipeline, so that I don't "fix" what was actually a deliberate decoupling (`adr/0014`).
9. As a future maintainer, I want the Expression vocabulary's small starting set recorded as deliberately minimal, so that extending it later (adding a member + matching art) reads as expected growth, not a missed requirement.

### Implementation Decisions

- **Expression**: a fixed, closed TypeScript union/enum — `Neutral | Happy | Sad | Angry | Surprised` — not a freeform string. A Script can only request a value from this set.
- **Portrait selection**: bundled into the same per-line presentation options as Speaker (e.g. `.say(text, { speaker, portrait: 'happy' })`), not a separate builder step — both describe how a line is presented, not what it says.
- **Portrait storage**: independent of `assets/sprites/characters/<name>/` and ADR-0006's raw/normalized pipeline. Keyed directly by whatever string a Script uses as `speaker`, with no dependency on that Speaker having an Entity, a Player character, or a spritesheet at all. See `adr/0014`.
- **Resolution/fallback**: a small pure function resolves (Speaker, Expression) to a Portrait asset reference or `undefined`; `undefined` means the line renders text-only, with no warning — a missing Portrait for a valid Expression is an expected content-authoring gap, not a bug (the closed Expression type already rules out a typo'd value).
- **No relationship to Entity/Player sprite rendering**: this is purely a Dialogue-overlay (Host-rendered, `adr/0011`) concern; it does not touch, require, or wait on the still-unbuilt NPC/Entity sprite rendering work.

### Testing Decisions

- The `ScriptBuilder`'s output gains coverage for a line's `portrait`/Expression fields, alongside its existing `speaker` coverage — same seam, same pattern (`node:test`, pure function assertions on what `build()` returns).
- The new Portrait-resolution function gets its own unit tests, modeled on the existing `resolvePlayerTexture`/`pickPlayerTexture` split in `player-assets.ts`: given a Speaker and Expression, returns the expected asset reference, or `undefined` when no matching art exists.
- Everything past those two seams — the overlay actually rendering a Portrait image, swapping it per Expression, and falling back to text-only when one is missing — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: interact with a Scripted Entity whose lines cycle through a few Expressions and confirm the Portrait changes, and confirm a line with no matching Portrait art still renders correctly as text-only.

### Out of Scope

- **An Expression beyond the initial five** (Neutral, Happy, Sad, Angry, Surprised) — extend only when a real line actually needs one; the set is deliberately minimal, not exhaustive.
- **Portrait art normalization/authoring pipeline details** (image dimensions, format, how a non-technical author adds new art) — this section confirms *where* Portrait art lives and how it's referenced, not the art-production workflow itself.
- **Portrait animation or transition effects** (fading, sliding, lip-sync-style movement) — static images only.
- **Any relationship to NPC/Entity on-map sprite rendering** — that remains its own, separately-deferred, unbuilt concern (see "Explicitly out of scope / deferred").

### Further Notes

- See `adr/0014-dialogue-portraits-are-a-standalone-asset-type.md` for the full rationale against reusing the character-spritesheet pipeline.
- `GLOSSARY.md`'s "Content" section gained **Portrait** and **Expression** as part of this round.
- This section supersedes "Dialogue Scripts: Choices, Speakers & Localization"'s Out of Scope note that backlogged Portrait/expression art — that item is now scoped here.

## Dialogue Line Pacing

Confirmed 2026-09-23 via grilling session, following up on ticket 18's Speaker work (see "Dialogue Scripts: Choices, Speakers & Localization" above). This section is Host-side overlay rendering/interaction only: no `GLOSSARY.md` vocabulary changes and no `docs/adr/` changes accompany it — evaluated explicitly during grilling and found unnecessary, since this isn't a new cross-cutting Script/Dialogue/Speaker/Flag domain concept, nor does it touch the Engine. `adr/0011-dialogue-v1-does-not-pause-the-player.md` is reaffirmed, not reopened: Dialogue still never blocks the Player, it simply paces its own reveal at the Player's click.

### Problem Statement

Ticket 18 gave a Dialogue round's lines a distinct Speaker, but the Host overlay still renders every line in a round all at once, stacked in one box — a multi-speaker exchange (e.g. a narrator aside followed by the Entity's own line) reads as a wall of simultaneous text rather than the turn-by-turn back-and-forth of visual-novel-style dialogue. There's also no way for a Player to control their own reading pace through a round; they see everything at once or nothing.

### Solution

A Dialogue round's lines reveal one at a time instead of all at once: at any moment, at most one line (its Speaker and text) is visible in the overlay. Clicking anywhere on the dialogue box advances from the current line to the next, replacing it outright — there is no persistent scrollback of previously-shown lines within a round. Once the round's last line is showing, the box's click-to-advance stops, and the round's choices (if any) and the always-present Close control render exactly as they do today. A small visual cue indicates when more lines remain to be revealed.

### User Stories

1. As a Player, I want a Dialogue round's lines to appear one at a time, so that a multi-speaker exchange reads like a real back-and-forth conversation instead of a wall of simultaneous text.
2. As a Player, I want to control when the next line appears by clicking, so that I can read at my own pace instead of everything being dumped on me at once.
3. As a Player, I want clicking anywhere on the dialogue box to advance the line, so that I don't have to aim for a small dedicated button.
4. As a Player, I want the previous line to disappear once the next one appears, so that the box stays focused on who's talking right now instead of accumulating into a growing wall of text.
5. As a Player, I want a visual cue telling me more lines are coming, so that I know to click instead of assuming the conversation has ended.
6. As a Player, I want the round's choices to appear only once I've read every line, so that I'm not asked to decide before I've heard the whole exchange.
7. As a Player, I want to still be able to close the dialogue at any point, including partway through a round's lines, so that I'm never trapped reading something I want to back out of (reaffirms ADR-0011's non-blocking precedent).
8. As a Player, when I click while the round's choices are showing, I want that click to do nothing unless it lands on an actual choice, so that I don't accidentally pick an option or skip past something by clicking in the wrong place.
9. As a content author, I want this pacing to apply automatically to every Dialogue round without any per-Script opt-in, so that I don't have to remember a flag to get the VN-style presentation ticket 18 was building toward.
10. As a content author, I want a single-line round to behave exactly as it does today — the one line shows immediately, no click required — so that simple Scripts aren't penalized with an extra click for content that was never multi-line to begin with.
11. As a content author, I want a choiceless round's last line to just sit there once shown (Close is the only way out), so that a round with nothing to decide doesn't need any special end-of-round affordance beyond what already exists.
12. As a Host developer, I want this feature to require no changes to `Dialogue`/`DialogueLine`'s shape or to `ScriptBuilder`'s output, so that ticket 18's data model and its tests stay untouched — this is purely a rendering/interaction change to the overlay.
13. As a Host developer, I want the "click advances" behavior implemented as a real interactive element (not a bare `<div onClick>`), so that it satisfies this repo's `jsx-a11y` lint rules without a dedicated keyboard-handling feature having to be built.
14. As a future maintainer, I want it recorded that typewriter-style animated text reveal was considered and declined for this round, so that "line pacing" isn't conflated with "character-by-character text animation" if it comes up later.
15. As a future maintainer, I want it recorded that a dedicated keyboard-advance (Space/Enter) binding was considered and deferred, not forgotten, so that it's a known possible follow-up rather than a silently-dropped idea.
16. As a future maintainer, I want it recorded that this feature needed no `GLOSSARY.md` or ADR changes, so that a future reader doesn't go looking for a Speaker/Dialogue vocabulary shift or an Engine-contract decision that doesn't exist here.
17. As a future maintainer, I want it recorded that manual verification (not a new automated seam) covers this feature end to end, consistent with tickets 16-18's treatment of overlay rendering/interaction, so that a reviewer doesn't go looking for unit tests that were deliberately not written.

### Implementation Decisions

- **Pacing model**: the overlay tracks a current line index into the active round's `dialogue.lines`, rendering only the line at that index (Speaker + text) — never a slice or accumulation of prior lines.
- **Advance trigger**: the dialogue box itself is the click target, not a dedicated "Next" button. Implemented as a real `<button>` (styled to match the box, not a raw `<div>` with a click handler), so `jsx-a11y`'s interactive-element rules are satisfied without a dedicated keyboard feature — Enter/Space activation comes along as a side effect of correct semantic HTML.
- **Gating**: the box's click-to-advance is only active while the current index is before the round's last line. Once the last line is showing, box clicks do nothing further — the round's choices (if any) and Close render in the box's action area per ticket 16's existing `visible`/`enabled` logic, unchanged.
- **Reveal style**: instant full-line swap — no character-by-character/typewriter animation.
- **Reset on new round**: the current line index resets to the first line whenever a new `Dialogue` object is handed to the overlay (a fresh top-level Script run on re-interact, or a `choice.next(ctx)` continuation) — the same "always starts from the top, no position persisted" precedent ticket 17 established at the round level, applied here at the line level within a round.
- **Zero-line rounds**: a round with no lines at all (choices only) shows its choices immediately — nothing to paginate through, so this is the natural base case, not a special one.
- **Close availability**: unchanged — Close renders and remains clickable at every point, including mid-pagination, per ADR-0011's non-blocking precedent.
- **Visual cue**: a small Host-side-only indicator shows while the current index is before the last line, and disappears once the last line is showing. Its exact visual treatment is a UI-polish detail, not a data/interaction decision this section fixes.
- **No `Dialogue`/`DialogueLine`/`ScriptBuilder` changes**: this section touches only the Host overlay's rendering/interaction logic — the data `ScriptBuilder` produces (per ticket 18) is unchanged.

### Testing Decisions

- No new automated-test seam. The pagination index, click-gating logic, and line-swap rendering are all interactive, DOM-driven overlay behavior — the same category as ticket 16/17's `visible`/`enabled` choice filtering and `handleChoiceClick`, none of which are unit-tested (this repo has no e2e/browser automation and no jsdom/React Testing Library installed, per `CLAUDE.md`).
- Manually verified: interact with a Scripted Entity whose round stages at least two lines with different Speakers (`CampFire.ts`'s narrator-staged round from ticket 18 already fits), and confirm: (a) only one line is visible at a time, (b) clicking the box advances to the next line and the previous one disappears, (c) the visual cue is present while more lines remain and gone on the last line, (d) the round's choices/Close appear only once the last line is showing, (e) Close remains clickable at every step, and (f) a single-line round shows its one line immediately with no click required.

### Out of Scope

- **Typewriter/character-by-character text animation** — considered and declined for this round; instant full-line swap only. Revisit only if a concrete request for it shows up, not speculatively.
- **Dedicated keyboard-advance handling (Space/Enter)** — deferred; using a real `<button>` for the click target already gives this for free as an implementation detail, but no bespoke keyboard feature (e.g. a global keydown listener) is built.
- **Visual cue's exact styling/animation** — this section confirms a cue exists and when it shows/hides, not its specific look.
- **Any relationship to Portrait/Expression rendering** — this section is pacing only; how a Portrait renders alongside a paced line is "Dialogue Portraits & Expressions"'s concern, not reopened here.
- **Timed/auto-advancing lines** — still declined, per "Dialogue Scripts: Choices, Speakers & Localization"'s existing Out of Scope note; pacing here is always Player-click-driven, never a clock.

### Further Notes

- Builds directly on ticket 18's `Dialogue`/`DialogueLine`/Speaker work — no changes to that data shape.
- See `docs/research/dialogue-and-choice-script-functionality.md`: this section's specific concern (line-by-line reveal pacing) isn't covered by that survey's table, since Ink/Yarn Spinner/Ren'Py/RPG Maker MZ all treat one-line-at-a-time text-box advancement as baseline engine behavior rather than a documented authoring decision worth surveying.
- No `GLOSSARY.md` or `docs/adr/` changes accompany this section — evaluated during grilling and found unnecessary (see this section's opening note).

## CG & Cutscene

Confirmed 2026-09-23 via grilling session. Resolves the blocker "Dialogue Scripts" left open (`adr/0011`): a Host→Engine pause channel now exists, so a Script can finally take control away from the Player. See `GLOSSARY.md`'s "Content" vocabulary (**Cutscene**, **CG**, and updated **Script**/**Dialogue** entries) and `adr/0016-host-engine-pause-channel-is-a-single-imperative-flag.md` / `adr/0017-cutscene-gets-its-own-step-runner.md` for the two architectural calls below.

### Problem Statement

Dialogue never takes control from the Player and never moves anyone — by design (`adr/0011`). That's fine for ordinary conversation, but it can't deliver either of the two things this project's reference points (Undertale, RPG tutorial sequences) rely on: a full-screen illustrated intro shown before the Player ever takes control, and an in-world scene where an NPC interaction genuinely stages something (the Player frozen, a character walking into position, dialogue playing out) rather than just another dialogue box the Player can idly walk away from mid-read. There's also no mechanism at all for "show this once and never again" — every existing Dialogue simply re-runs from the top on every interaction.

### Solution

Two new, independent content types, both gated by the existing Flag mechanism so each plays at most once per Student:

- **CG**: a full-screen illustrated slideshow — static art and captions the Player advances by clicking, and can skip entirely — shown independent of any Entity (its first use is the game's intro at boot).
- **Cutscene**: a Script that takes control away from the Player for its duration, playing an ordered sequence of Dialogue, Choice, and Movement steps, triggered the same way Dialogue is (an NPC Interaction).

Both route through one shared helper that checks the Student's Flags, skips if already seen, and marks the Flag on completion — "don't replay" is automatic, not something each caller has to remember. Making Cutscene's Player-freeze possible required the Host→Engine pause channel `adr/0011` deliberately deferred; that channel is built here as the smallest thing that satisfies it (`adr/0016`).

### User Stories

1. As a Player, I want to watch an intro CG when the game starts, so that the story is set up before I take control, matching the reference points (Undertale) this project is aiming for.
2. As a Player, I want to click to advance the CG's frames, so that I move through the slideshow at my own pace instead of waiting on a timer.
3. As a Player, I want to skip the CG entirely, so that a restarted session doesn't force me to sit through the same intro every time.
4. As a Player, I want a CG I've already seen to not play again, so that it never interrupts a later session.
5. As a content author, I want a CG's captions to resolve through the same locale string table Dialogue already uses, so that a CG's narration is translatable the same way Dialogue text is.
6. As a content author, I want a CG's art stored independently of the character-spritesheet pipeline, so that full-screen illustrations aren't forced through machinery built for animated walk-cycle sheets.
7. As a Host developer, I want `playCG(id)` callable from anywhere, not hardcoded to game boot, so that a future CG (an ending, a mid-game reveal) doesn't require re-plumbing this mechanism.
8. As a Player, I want interacting with an NPC that has a Cutscene to freeze my character and let the scene play out, so that a tutorial or story beat reads as a real cutscene, not just another dialogue box I can walk away from.
9. As a Player, I want an NPC to be able to walk toward me during a Cutscene, so that a scripted interaction can feel staged rather than static.
10. As a Player, I want a Cutscene that's already played to not play again, so that re-interacting with the same NPC afterward doesn't repeat the scene.
11. As a content author, I want a Cutscene to mix Dialogue lines, Choices, and forced Movement in one sequence, so that I can author a scene richer than plain back-and-forth dialogue.
12. As a content author, I want a Cutscene's Choices to work exactly like Dialogue's existing Choices (branch, write Flags), so that I don't have to learn a second choice mechanism.
13. As a content author, I want to move a character to a specific point during a Cutscene without hand-authoring a walk animation, so that staging a scene needs no new art or a scripting language of its own.
14. As a content author, I want a Movement step to target either the Player or another map Entity, so that a Cutscene can move the Player into position, an NPC toward the Player, or both.
15. As a Map author, I want to add a Cutscene-triggering NPC using the exact same Tiled convention Dialogue-triggering Entities already use (Class = Entity, an `entityId` property), so that I don't learn a second Map-authoring convention just because this Entity happens to drive a Cutscene.
16. As a content author, I want a Cutscene triggered by the same Interaction event Dialogue already uses, so that adding one doesn't require a new kind of Map trigger.
17. As a Host developer, I want `playCutscene`/`playCG` to both route through one shared "already seen?" check, so that "don't replay" behavior is automatic and can't be forgotten by a future cutscene's author.
18. As a Host developer, I want the seen-flag to live in the same Flag store Dialogue already uses, so that cutscene state doesn't need a second persistence mechanism.
19. As an Engine developer, I want a single `setPaused` boolean the Host can flip, so that "the Player can't act right now" has one source of truth instead of every input handler needing its own special case.
20. As an Engine developer, I want `handleMovementInput` and `handleInteractInput` to both check that same pause flag, so that a paused Cutscene can't be interrupted by walking away or opening another Dialogue.
21. As a content author, I want forced Movement to reuse grid-engine's own pathfinding (`moveTo`), so that staged movement looks like normal walking (same animation, same collision-awareness) instead of a custom teleport or slide.
22. As a future maintainer, I want it recorded that continuous NPC-follows-Player behavior (grid-engine's `follow`) was considered and deferred, so that I don't assume it's already supported when a future Cutscene actually needs it.
23. As a future maintainer, I want it recorded that Flags remain in-memory-only for this feature (a page refresh still resets "seen" state), so that I treat a lost cutscene flag as a known, pre-existing limitation, not a new bug.
24. As a future maintainer, I want it recorded why Cutscene needed its own step-runner instead of reusing Dialogue's rendering, so that I don't try to "simplify" it back into Dialogue's one-shot model (`adr/0017`).
25. As a future maintainer, I want it recorded why the Host→Engine pause channel is a single imperative flag rather than a World Config field, so that I understand it was a deliberate call, not an oversight (`adr/0016`).
26. As a Host developer, I want the Cutscene step-runner to be a pure function, so that its sequencing logic (what comes next given an event) is verifiable without a running Phaser instance.
27. As a Host developer, I want the CG slideshow's stepping to be a pure function, so that its advance/skip logic is verifiable without a running Phaser instance.

### Implementation Decisions

- **Terminology**: "CG" and "Cutscene" are the two content types, matching the split `GLOSSARY.md`/this spec already reserved for them (see "Dialogue Scripts" Out of Scope, now resolved here).
- **CG pacing**: the Player advances frames by clicking, and can skip the whole CG via a separate control — a pure "slideshow stepper" function (given the current frame index and an advance/skip event, returns the next frame index or `done`).
- **CG content**: captions/narration resolve through the existing locale string table (same `resolveLine` mechanism Dialogue uses); art resolves through a Portrait-style decoupled asset registry (same pattern as `adr/0014`, keyed by an arbitrary per-frame id, no relationship to the character-spritesheet pipeline).
- **CG trigger**: `playCG(id)` is a general primitive callable from anywhere; the only caller this round is game boot (the intro).
- **Cutscene freeze**: for its duration, the Player is fully frozen — both movement and interact input are disabled via the new Engine `setPaused` flag (`adr/0016`).
- **Cutscene composition**: an ordered sequence of steps of three kinds — Dialogue lines, Choices (reusing the existing `Choice`/`Choice.next?` type as-is, no new branching shape), and Movement. `ScriptBuilder` grows a `.moveTo()`-style step alongside its existing `say()`/`choice()`.
- **Movement steps**: wrap grid-engine's existing `moveTo(charId, targetPos)` — one-shot, resolves via its own completion signal, no custom pathfinding built. Can target the Player or any map Entity (any `charId`). Continuous following (grid-engine's `follow`) is not used this round.
- **Cutscene trigger**: reuses the existing `interacted` Engine Event and the entityId → Script lookup convention Dialogue already uses — a Cutscene is one more thing an Entity's Script file can produce. `playCutscene(id)` itself stays a general primitive (callable from anywhere), but NPC-interact is the only caller wired up this round; no new trigger types are built.
- **Cutscene execution model**: a new Host-side sequential step-runner — a pure reducer that, given the current step and a completion event (advance-click, choice-picked, move-finished), decides the next step, holding execution at each step until it resolves. This does not reuse Dialogue's one-shot render (`adr/0017`); Dialogue and `Choice.next?` are unchanged.
- **Shared "don't replay" helper**: both `playCG(id)` and `playCutscene(id)` route through one `runOnce(id, playFn)`-style helper: checks `ctx.flags` for that id's seen-flag, skips (does nothing) if already set, otherwise runs `playFn` and marks the flag on completion. This is the one place "already seen" logic lives.
- **Flag storage**: one boolean per CG/Cutscene id, stored in the existing Flag store (`ctx.flags`) — same shape and mechanism as every other Flag, no schema change. Flags stay in-memory-only, matching their current (pre-existing) behavior — this feature doesn't make them durable.
- **New Engine surface**: a single imperative `setPaused(bool)` call, checked at the top of both `handleMovementInput` and `handleInteractInput` before either reads input (`adr/0016`). No other Engine surface changes — World Config, Engine Events, and the Tiled Map format are all unchanged.

### Testing Decisions

- Matching the existing pattern (`node:test`/`node:assert/strict`, pure functions only, no mocking framework): the Cutscene step-runner, the CG slideshow-stepper, the `runOnce` flag-gate helper, and the extended `ScriptBuilder`'s Movement-step output all get unit tests.
- **Cutscene step-runner**: given a step list and a sequence of completion events (advance-click, choice-picked, move-finished), asserts the resulting step-index progression and the terminal `done` state, including an event that doesn't match the current step's expected completion (ignored, not advanced).
- **CG slideshow-stepper**: given the current frame index and an advance/skip event, asserts the next frame index or `done`.
- **`runOnce`**: given a Flags object and an id, asserts an already-seen id skips without invoking `playFn`, and a not-yet-seen id invokes `playFn` and sets the flag — alongside `flags.ts`'s existing tests.
- **`ScriptBuilder` Movement output**: does chaining `.moveTo(...)` alongside `.say()`/`.choice()` produce the right step list — same pattern as the existing Dialogue/Choice builder-output tests.
- Everything past those seams — the pause flag actually disabling input in a running Scene, grid-engine's `moveTo` actually walking a sprite, the CG slideshow actually rendering full-screen art and timing correctly on screen, the dialogue overlay actually freezing during a Cutscene — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: trigger a test Cutscene via NPC interact and confirm the Player freezes, an NPC walks to the Player's position, Dialogue plays, and re-interacting afterward does nothing (flag already set); watch the CG intro at boot and confirm clicking advances frames, skip jumps straight to gameplay, and it doesn't replay on a second boot within the same session (Flags being in-memory means a full page refresh does reset it — expected, not a bug).

### Out of Scope

- **Continuous `follow()` behavior** (an NPC that keeps tracking the Player rather than walking to a fixed point) — grid-engine has this, but it's a real feature with its own stop-condition design; this round's Movement step is one-shot `moveTo` only. (No longer deferred — see "Cutscene Follow Step & Cutscene-Driven Zone Entries" below.)
- **Making Flags durable across a page refresh** — pre-existing limitation (Flags are in-memory today), not this feature's problem to fix; a separate, generically useful ticket if it's ever needed.
- **New trigger types beyond NPC-interact** (an item-pickup trigger) — `playCutscene`/`playCG` are generic enough to support one later, but none is built or wired up this round. (A zone-entered trigger is no longer deferred — see "Zone: Walking Into a Region Triggers a Script" below.)
- **A replay/gallery mode for already-seen CG/Cutscenes** — "seen" is a one-way, permanent Flag this round; no UI or mechanism to re-watch.
- **Camera control during a Cutscene** (pans, zoom changes) — not requested; Movement covers character position only.
- **CG's per-frame art production workflow** — this section confirms CG reuses the Portrait-style decoupled asset registry pattern, not the specifics of producing that art.

### Further Notes

- Supersedes "Dialogue Scripts"' Out of Scope bullet on CG/cutscene and "Explicitly out of scope / deferred"'s matching line below — both are updated to point here.
- See `adr/0016-host-engine-pause-channel-is-a-single-imperative-flag.md` for the pause-channel decision and `adr/0017-cutscene-gets-its-own-step-runner.md` for why Cutscene doesn't reuse Dialogue's rendering.
- `GLOSSARY.md` gained **Cutscene** and **CG** as part of this round; `Script`'s and `Dialogue`'s entries were updated to reflect that Cutscene is now a real, designed concept rather than "not-yet-designed."

## CG & Cutscene as Script Output

Confirmed 2026-09-27 via grilling session. Extends "CG & Cutscene" above: that section gave CG exactly one caller (game boot) and left Cutscene's own trigger to issues #25-28. This section makes both reachable from the one place all other Entity-driven content already lives — a Script — closing the gap the user found missing from the issue tracker. See `GLOSSARY.md`'s updated **Script**, **Cutscene**, and **CG** entries and `adr/0018-script-output-generalizes-to-a-discriminated-union.md` for the return-type decision below.

### Problem Statement

CG's only trigger is game boot; Cutscene has no trigger at all yet. Meanwhile an Entity's Script can only ever produce Dialogue — there's no way for an NPC interaction to lead into a full-screen CG (an ending, a reveal) or hand off into a Cutscene, even though spec's own Cutscene design already says a Cutscene should be "one more thing an Entity's Script file can produce." Content authors have no way to reach for CG or Cutscene from the one mechanism every other Entity-driven moment already goes through.

### Solution

A Script's return type generalizes from `Dialogue` alone to a discriminated union that also covers a CG or Cutscene trigger. The Host inspects which one came back and dispatches accordingly: a `Dialogue` renders as it does today, a CG trigger calls the existing `playCG(id)` primitive unchanged, and a Cutscene trigger reserves the same shape for issues #25-28's `playCutscene(id)` to fulfill once built. Whichever of the two plays, the Player is frozen automatically via the existing `setPaused` flag (`adr/0016`), the same freeze Cutscene's own design already specifies. `ScriptBuilder` is untouched — it stays purpose-built for accumulating Dialogue lines and choices; a Script produces a CG/Cutscene trigger by returning a plain object directly, bypassing the builder for that case.

### User Stories

1. As a content author, I want an Entity's Script to be able to trigger a CG the same way it produces Dialogue, so that an NPC interaction can lead into a full-screen moment without a separate mechanism.
2. As a content author, I want an Entity's Script to be able to trigger a Cutscene the same way it produces Dialogue, so that a scripted scene is reachable from the exact place every other Entity-driven content already lives.
3. As a content author, I want to pick a CG or Cutscene by id from within a Script, so that I don't need a new lookup mechanism beyond the one `playCG(id)`/`playCutscene(id)` already provide.
4. As a content author, I want a Script to branch between returning Dialogue, a CG, or a Cutscene based on the Student's Flags, so that (e.g.) a first-time interaction can play a CG while a later one falls back to ordinary Dialogue — the same branching pattern `CampFire.ts` already uses for Dialogue variations.
5. As a Player, I want to be frozen automatically whenever a Script-triggered CG or Cutscene plays, so that I can't wander off or interact with something else mid-slideshow or mid-scene.
6. As a Player, I want that freeze to work exactly the way Cutscene's freeze already does (`adr/0016`), so that CG and Cutscene behave consistently regardless of which one is playing.
7. As a Host developer, I want `playCG(id)` reused completely unchanged for Script-triggered CGs, so that boot's CG and a mid-game CG share one code path with no special-casing.
8. As a Host developer, I want `runEntityScript`'s return type to generalize rather than gain a second, parallel method, so that there's exactly one place a Script's output is interpreted.
9. As a Host developer, I want `ScriptBuilder` to stay exactly as it is today, so that its `.say()`/`.choice()` API isn't stretched to represent content it wasn't designed for.
10. As a Host developer, I want a CG/Cutscene trigger to be a plain, minimal `{ type, id }` object, so that a Script author can return one without learning a second builder API.
11. As a content author, I want a Choice's `next` (already typed as `Script`) to automatically support returning a CG/Cutscene trigger too, so that a CG or Cutscene is reachable mid-conversation, not only as a Script's very first, top-level output.
12. As a Host developer, I want this scoped to Entity-interaction Scripts only this round, so that Map-entry Scripts (ticket #13, not yet built) aren't entangled with this change — they inherit the same capability automatically once they exist, since the mechanism doesn't care which Engine Event invoked the Script.
13. As a Host developer, I want `GameCanvas`'s currently boot-only CG state (hardcoded to one id) generalized to track whichever CG is currently active, so that a mid-game CG with a different id doesn't collide with or get blocked by the boot CG's own state.
14. As a future maintainer, I want it recorded why Script's return type is a discriminated union rather than an imperative `playCG`/`playCutscene` call from inside a Script, so that I don't try to "simplify" it into a side-effecting call later (`adr/0018`).
15. As a future maintainer, I want it recorded why `ScriptBuilder` didn't grow `.playCG()`/`.playCutscene()` methods, so that a future contributor doesn't add them expecting builder parity (`adr/0018`).
16. As a future maintainer, I want it recorded that a Cutscene trigger is a forward-reference — `playCutscene` itself doesn't exist yet — so that I don't expect a Script returning one to actually play anything until issues #25-28 land.
17. As a future maintainer, I want it recorded that CG and Cutscene are now distinguished purely by structure (Cutscene has Dialogue/Choice/Movement steps; CG has none), not by trigger source, so `GLOSSARY.md`'s entries read consistently with what the code now allows.
18. As a future maintainer, I want it recorded that a Script-triggered CG/Cutscene still plays at most once per Student, like boot's CG already does, so the "don't replay" behavior (`runOnce`, issue #24) is understood to apply uniformly once it's built, regardless of trigger source.
19. As a QA reviewer, I want the existing Dialogue-only test suite (`scripts.test.ts`) to keep passing unmodified after this change, so that generalizing Script's return type is proven backward compatible, not just forward compatible.
20. As a content author, I want at least one real Entity Script to demonstrably return a CG trigger under some condition, so the mechanism is proven end-to-end the same way ticket 19's `resolveLine` call in `CampFire.ts` proved locale resolution end-to-end.

### Implementation Decisions

- **Terminology**: Script, CG, and Cutscene as defined in `GLOSSARY.md` (updated this round) — CG and Cutscene now differ by structure only (Dialogue/Choice/Movement steps or their absence), not by what triggers them.
- **Return-type generalization**: a Script's output becomes a discriminated union instead of `Dialogue` alone:

  ```ts
  interface CgTrigger { type: 'cg'; id: string }
  interface CutsceneTrigger { type: 'cutscene'; id: string }
  type ScriptResult = Dialogue | CgTrigger | CutsceneTrigger

  type Script = (ctx: ScriptContext) => ScriptResult
  ```

  (This shape is settled, per this round's grilling session and `adr/0018`.)
- **`ScriptBuilder` unchanged**: stays Dialogue-only (`.say()`/`.choice()`/`.build()`). A Script returns a `CgTrigger`/`CutsceneTrigger` as a plain object literal directly, bypassing the builder for that case — the builder exists to accumulate lines and choices, and a trigger has neither.
- **`runEntityScript` generalizes**: its return type widens from `Promise<Dialogue | undefined>` to `Promise<ScriptResult | undefined>`. Its entityId → Script-file lookup convention is otherwise unchanged.
- **Host dispatch**: `game-canvas.tsx`'s `handleEvent` (Entity-interact) and `selectChoice` (`Choice.next`) both switch on the returned `ScriptResult`'s `type`: `Dialogue` renders as it does today; a `CgTrigger` calls the existing `playCG(id, onFrame)` — the exact primitive game boot already uses, with no changes to `play-cg.ts`/`cg.ts`/`cg-art.ts`/`cg-slideshow.ts`; a `CutsceneTrigger` reserves the same dispatch point for issues #25-28's `playCutscene(id)`, not built this round.
- **Player freeze**: whenever a Script-triggered `CgTrigger` or `CutsceneTrigger` plays, the Player is frozen via the existing `setPaused` flag (`adr/0016`) for its duration, automatically and with no per-call opt-out. Boot's CG doesn't need this — there's no Player yet to freeze at that point.
- **CG active-state generalization**: `GameCanvas`'s current boot-only CG state (module-level frame list/id, current frame index, playback handle — all hardcoded to the one boot id) generalizes to track whichever CG id is currently active, so a Script-triggered CG with a different id doesn't collide with boot's own state.
- **Proof of mechanism**: extend `CampFire.ts` (or a similarly small demo Entity Script) to conditionally return a `CgTrigger` under some Flag condition, mirroring how ticket 19's `resolveLine` call in `CampFire.ts` already proves the string-table mechanism end-to-end.
- **Not built this round**: `playCutscene(id)` and the Cutscene step-runner itself (issues #25-28) — `CutsceneTrigger` only reserves the shape.
- See `adr/0018-script-output-generalizes-to-a-discriminated-union.md` for this decision and its two rejected alternatives (an imperative `playCG`/`playCutscene` call from inside a Script; new `ScriptBuilder` terminal methods).

### Testing Decisions

- Matching the existing pattern (`node:test`/`node:assert/strict`, no mocking framework): reuse `runEntityScript`'s existing seam and test file (`scripts.test.ts`) rather than introduce a new one.
- **Backward compatibility**: every existing `scripts.test.ts` test (asserting `Dialogue` shape) must keep passing unmodified — `Dialogue` remains a valid `ScriptResult` variant.
- **New coverage at the same seam**: given the demo Entity Script's Flag-gated branch, `runEntityScript` surfaces a `CgTrigger` verbatim (`{ type: 'cg', id }`), asserted the same way existing tests assert `Dialogue` shape.
- No new tests needed for `playCG`/`resolveCg`/`resolveCgArt`/`stepCgSlideshow` — that seam is unchanged and already covered from the prior round.
- Everything past this seam — `game-canvas.tsx` actually calling `playCG`/`playCutscene` off the returned type, the Player actually freezing via `setPaused`, a Script-triggered CG actually rendering full-screen — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: interact with the demo Entity under the Flag condition that returns a `CgTrigger`, confirm the CG plays full-screen, confirm the Player can't move or interact until it's skipped or finished, and confirm normal gameplay resumes afterward.

### Out of Scope

- `playCutscene(id)` and the Cutscene step-runner itself — issues #25-28.
- Map-entry Scripts triggering a CG/Cutscene — ticket #13 (Map-entry Scripts) is itself still unbuilt; this mechanism is trigger-agnostic so Map-entry inherits it automatically once #13 ships, but that wiring isn't built here.
- `runOnce`/"don't replay" flag-gating — issue #24. A Script-triggered CG plays at most once per Student in principle, same as boot's, but the shared gating helper isn't built in this round either.
- `ScriptBuilder` gaining `.playCG()`/`.playCutscene()` terminal methods — explicitly rejected, see `adr/0018`.
- A Script calling `playCG`/`playCutscene` imperatively as a side effect — explicitly rejected, see `adr/0018`.

### Further Notes

- Supersedes "CG & Cutscene" above's framing of CG as "shown independent of any Entity" / "isn't triggered by an Interaction" — `GLOSSARY.md`'s CG entry was already updated this round to describe the CG/Cutscene split as structural only.
- `GLOSSARY.md`'s **Script** entry was updated this round to read "producing Dialogue, a Cutscene, or a CG."
- See `adr/0018-script-output-generalizes-to-a-discriminated-union.md` for the return-type decision and its rejected alternatives.

## Map Object Authoring: Layer Flexibility & Dedicated Identity

Confirmed 2026-09-20 via grilling session, triggered while implementing ticket 05 (Entity interaction hook). Supersedes two specific calls from ADR-0010 (single shared object layer, `name`-as-id); ADR-0010's Custom Class tagging decision itself is unaffected. See `adr/0012-map-objects-any-layer-dedicated-identity-property.md` for the full rationale and rejected alternatives, and `guides/tiled-object-authoring.md` for the current how-to.

### Problem Statement

ADR-0010's original authoring rules didn't hold up once Entities were actually being authored for ticket 05: a Map author with many tile-rendering layers is still boxed into exactly one shared `objects` layer for every placed object regardless of Map complexity, and an object's free-text `name` field doubling as its `entityId` means a routine rename (for authoring clarity, reorganizing labels) silently changes the id a Script or Flag is keyed to — with nothing preventing two different objects from accidentally sharing the same id in the first place.

### Solution

Class-tagged Spawn/Entity/Portal objects can now live on any number of object layers — the Class tag alone still tells them apart, so the single-layer rule was never load-bearing. Identity for a Class-tagged object comes from a dedicated Class-member property (`entityId` for Entity) instead of `name`, so a display-label rename can never break a downstream reference. Because Tiled validates uniqueness on no property, the Engine warns (not errors) when two objects on the same Map share an id, and a standalone dev script catches the same collision across the whole Map catalog, since the Engine itself only ever loads one Map at a time (ADR-0001).

### User Stories

1. As a Map author, I want to place Spawn/Entity/Portal objects on any object layer I choose, so that I'm not forced to cram every placed object into one shared layer regardless of how many tile-rendering layers my Map uses.
2. As a Map author, I want to organize objects across multiple object layers (by area, by kind, by authoring pass) if that's clearer for my workflow, so that Map authoring scales with Map complexity.
3. As a Map author, I want an object's `name` field to stay a free, renamable display label, so that I can clean up or reorganize labels without worrying about breaking something downstream.
4. As a Map author, I want an Entity's real identity to live in its own dedicated property (`entityId`), so that it's clear at a glance, in Tiled's own property panel, which field actually matters to the Engine/Host.
5. As a content author, I want a Script/Flag tied to a specific Entity to keep working even if that Entity's display name changes later, so that routine map cleanup doesn't silently orphan content.
6. As a Map author, I want to be warned if I accidentally give two objects on the same Map the same id, so that I catch a copy-paste mistake before two Entities silently share a Script.
7. As a Host/content author, I want to catch an id reused across two different Maps, so that ticket 12+'s Script-lookup-by-`entityId` convention doesn't silently resolve two unrelated Entities to the same Script.
8. As an Engine developer, I want the per-Map duplicate check to run in the same pass that already walks every object, so that it costs nothing extra and adds no new Engine surface.
9. As an Engine developer, I want the Engine to stay stateless and single-Map-at-a-time (ADR-0001), so that a cross-Map check never becomes the Engine's own responsibility.
10. As a repo maintainer, I want cross-Map duplicate detection available as a script I run on demand, so that I can validate the whole Map catalog without it slowing down routine `bun run test`/`lint`.
11. As a future ticket-04 implementer (Portal), I want the same any-layer, dedicated-property pattern already established, so that I'm not re-deciding authoring mechanics ticket 05 already settled.
12. As a future maintainer reading ADR-0010, I want it clearly marked which parts a later decision superseded, so that I don't follow stale guidance.
13. As a Map author, I want to know that snake_case (`entity_key`-style) naming isn't this project's established convention for identity properties, so that I don't invent a third inconsistent style when a future kind needs its own.
14. As a Map author reusing existing tileset art (e.g. the campfire) for an Entity, I want to stamp it as a Tile Object with its own `entityId` and `name`, so that I get a real per-instance identity without hand-drawing an invisible marker on top of it.
15. As an Engine developer, I want the pixel→grid conversion to stay correct whether an object is a plain point/rectangle or a tile-referencing object, so that a tile-object Entity's interaction position isn't off by one row.

### Implementation Decisions

- **Identity source**: `collectEntities` (`packages/engine-core/src/tiled-assets.ts`) reads an object's `entityId` Class-member property (from its `properties` array) instead of its `name` field. This is Entity's own instance of a general pattern — a future kind's identity property gets its own dedicated name (never `name`, never a shared generic property name across kinds).
- **Layer cardinality**: objects are no longer required to live on one named `objects` layer. `collectEntities` already scanned every `objectgroup`-type layer regardless of name/count before this decision; this formalizes that as the sanctioned authoring pattern rather than a guide/ADR constraint the code silently didn't enforce.
- **Duplicate detection, shared core**: a new pure function `findDuplicates(values: string[]): string[]` in `packages/engine-core/src/util.ts` (alongside `computeCameraBounds`) returns every value appearing more than once in its input. One function, two call sites.
- **Per-Map warning**: the Engine calls `findDuplicates` over one Map's collected `entityId`s at load time; if it returns anything, `console.warn`s naming the Map and the duplicated id(s) — a warning, not a thrown error, so the Map still loads.
- **Cross-Map check**: a new standalone dev script (outside the `engine-core` package) reads every Map in the maps catalog, calls `collectEntities` per Map, concatenates every Map's `entityId`s, and calls `findDuplicates` over the combined list; for any duplicate, reports which Maps it spans. Run manually, not wired into `bun run test`/`bun run lint`.
- **ADR status**: ADR-0010 is superseded (not rewritten) by ADR-0012 for its single-layer and name-as-id specifics; its Custom Class tagging decision remains current and unaffected.

### Testing Decisions

- `collectEntities`'s extended behavior (reading `entityId` from `properties`; the existing gid/bottom-anchor tile-object handling is unaffected) gets unit tests in `tiled-assets.test.ts`, matching its existing pattern (`node:test`/`node:assert/strict`, raw Tiled-JSON-shaped literals in, `EntityObject[]` out).
- `findDuplicates` gets unit tests in `util.test.ts`, matching that file's existing pattern for `computeCameraBounds`/`resolveTilesetAssetUrl` — including the empty-input and no-duplicates edge cases.
- The Engine's `console.warn` call site and the dev script's file-reading/reporting are both thin I/O wrappers around the two tested pure functions above and get no test suite of their own, matching the existing `resolvePlayerTexture`/`pickPlayerTexture` split in `player-assets.ts`.
- Everything past those two pure-function seams (the warning actually appearing in a browser console, the dev script's CLI output) is verified manually, consistent with this repo having no e2e/browser automation (`CLAUDE.md`).

### Out of Scope

- Migrating the existing (dead/unused) `spawn_point` object's `spawn_key` property to this pattern, or wiring Tiled-authored Spawn data into the Engine at all — spawn position is driven entirely by `WorldConfig` today, and `spawn_key` is explicitly dead/temporary code, not revived by this decision.
- Portal's own dedicated identity property name/shape — this decision establishes the pattern, not ticket 04's specifics.
- Tile-Definition-level Class tagging producing an Entity with no placed object — considered and rejected (`adr/0012`): a tile layer's cells carry no per-instance identity in Tiled's data model.
- Turning the per-Map duplicate check into a hard error, or wiring the cross-Map dev script into `bun run test`/`lint` — both stay warnings/manual-run for now.
- Any change to the `EngineEvent`/`InteractedEvent` contract itself — `entityId`'s *value* now comes from a different Tiled field, but its type and meaning on the Engine↔Host boundary are unchanged.

### Further Notes

- Ticket 05's own in-flight engine-core code needs a small follow-up against this section before that ticket is done: switching `collectEntities` from `name` to the `entityId` property, and adding the `findDuplicates`-backed warning.
- See `adr/0012` for the full rationale and rejected alternatives (single-layer-only kept, tile-paint-based auto-entities, `name`-as-id kept, Engine-side cross-Map fetching).

## Zone: Walking Into a Region Triggers a Script

Confirmed 2026-09-27 via grilling session. Resolves the "tile/zone-entered Script trigger" item "Dialogue Scripts" Out of Scope left deferred (superseding that bullet and "CG & Cutscene"'s own matching deferral — both are updated to point here) and extends the Engine's set of Script-driving triggers with a third kind, alongside Interact (ticket 05/12) and the still-unbuilt Map-entry `transitioned` trigger (ticket #13). See `GLOSSARY.md`'s new **Zone** entry and `adr/0019` through `adr/0022` for the four architectural calls below.

### Problem Statement

Every existing way a Script can run today requires either an explicit action (pressing Interact while facing an Entity) or crossing a Map's outer boundary (the `transitioned` event, driving ticket #13's still-unbuilt Map-entry Scripts). Neither covers the reference-point beat this project is aiming for (Undertale, RPG tutorial sequences): a Player walking into a room or across a threshold *within* a Map and having a scene simply begin, with no button press and no full Map change. Content authors currently have no way to place that kind of trigger at all.

### Solution

A new Map-object kind, **Zone** — a Tiled-authored rectangular region, tagged and identified the same way Entity already is (Custom Class + a dedicated `zoneId` property) but drawn as a real multi-tile rectangle instead of a single point. The Engine emits a new `zoneEntered` Engine Event the instant the Player's grid position transitions from outside a Zone's rectangle to inside it — including the Player's very first appearance on any Map, if that spawn tile happens to fall inside one. Whatever Script is found for that `zoneId` runs exactly the same way an Entity's (or, once built, a Map's) Script does: it can produce Dialogue, a CG, or a Cutscene, gated so it plays at most once per Student via the same `runOnce`/Flag mechanism CG and Cutscene already share.

### User Stories

1. As a Player, I want walking into a specific area of a Map to start a Cutscene/CG/Dialogue automatically, so that a scene can begin the way it does in the RPGs this project is modeled on, without needing to press a button on an NPC first.
2. As a content author, I want to place a Zone the same way I already place a Spawn/Entity/Portal, so that I don't have to learn a second Map-authoring mechanism for a third trigger kind.
3. As a content author, I want a Zone's Script to be able to produce Dialogue, a CG, or a Cutscene, so that I'm not limited to only one kind of content for a walk-in trigger.
4. As a content author, I want a Zone to be findable by the same generic "look up a Script by id" mechanism Entities already use, so that authoring a Zone's Script feels identical to authoring an Entity's.
5. As a Player, I want a Zone's Cutscene/CG to only ever play once, so that walking back through the same doorway later doesn't replay the same scene.
6. As a Player, I want walking into a Zone whose Script produces a Cutscene or CG to freeze me for its duration, exactly the way an NPC-triggered Cutscene already does, so the experience is consistent regardless of what triggered it.
7. As a Map author, I want to draw a Zone as a rectangle covering more than one tile, so that a doorway-sized or room-sized trigger area doesn't require me to precisely land on a single tile.
8. As a Map author, I want a Zone's identity to come from a dedicated `zoneId` property (not its display `name`), so that renaming a Zone for authoring clarity can never silently break a Script reference, matching how Entity's `entityId` already works.
9. As a Map author, I want to be warned if I accidentally give two Zones on the same Map the same id, so that I catch a copy-paste mistake the same way Entity's duplicate-id warning already catches it.
10. As a Player, I want a Zone to trigger even if my very first appearance on a Map (right after boot's intro CG, or after walking through a Portal/edge-transition into a new Map) happens to land inside one, so that "the moment I arrive somewhere" can itself be a trigger, not just "the moment I walk somewhere new after already being there."
11. As a Player, I want a Zone to not trigger repeatedly while I stand still inside it, so that it behaves like a single moment, not a continuous effect.
12. As a Host developer, I want `zoneEntered` to carry only a `zoneId`, mirroring `interacted`'s own minimal `entityId`-only shape, so the Engine Event contract stays as small as ADR-0004 already established this project prefers.
13. As a Host developer, I want the same Host-side dispatch that already turns an Entity's Script result into Dialogue/CG/Cutscene to handle a Zone's Script result too, with no new dispatch logic, so that "what a Script produces" stays decoupled from "what triggered it."
14. As an Engine developer, I want Zone detection to use grid-engine's own position-tracking (`steppedOn`/`getPosition`), not a hand-rolled per-frame poll, so that detection stays as cheap and idiomatic as everything else this Engine already does with grid-engine.
15. As an Engine developer, I want a Zone's authored rectangle converted to a fixed list of grid tiles once, at Map load, so that "is the Player inside this Zone" is a plain tile-membership question, never a pixel-level collision calculation.
16. As a Map author, I want to know that a Zone's rectangle should be drawn snapped to the tile grid, so that the pixel-to-tile conversion is unambiguous and I'm not left guessing why a Zone that's a half-tile off doesn't behave as expected.
17. As a Map author, I want overlapping Zone rectangles to at least warn me at Map load, so that an accidental overlap doesn't silently produce confusing "which one fired" behavior with no diagnostic at all.
18. As a Host developer, I want a Zone's Script found via a lookup mechanism shared with Entity's (parameterized by kind/folder), not a hand-duplicated copy of the same import/try-catch logic, so that a third trigger kind later doesn't mean a third near-identical function.
19. As a future maintainer, I want it recorded that ticket #13's Map-entry Script (keyed by `transitioned`'s `toMapId`) stays a separate, already-shipped Engine Event, not folded into or replaced by Zone, so that I don't try to "simplify" two genuinely different concepts (crossing a Map's outer boundary vs. entering a region inside one) into each other.
20. As a future maintainer, I want it recorded that a Zone's activation is not gated by World Config (every Zone authored on the loaded Map is simply live), matching how Entity/Portal activation already works in practice today despite the spec's original "which are active" language, so I don't go looking for WorldConfig plumbing that was never built for Entities/Portals either.
21. As a future maintainer, I want it recorded why overlapping-Zone resolution stays undesigned beyond a load-time warning (deterministic "first match," not specially engineered), so a future contributor doesn't assume a priority/ordering system exists that was never built.
22. As a Player, I want the Player character's actual sprite size to have no bearing on whether I've "entered" a Zone, so that the trigger always matches my logical grid position, the same as every other Engine mechanic already does.
23. As a Map author, I want a guide explaining how to place and tag a Zone in Tiled, so that I'm not reverse-engineering the convention from source code.
24. As a Host developer, I want Zone's `runOnce` gating to reuse the exact seen-flag convention CG/Cutscene already use (`<id>_seen`), so that "don't replay" logic doesn't get a second, parallel implementation.
25. As a QA reviewer, I want the pure Tiled-parsing seam (`collectZones`/`readZone`) to be the one place this feature's core logic is unit-tested, so that a reviewer isn't left looking for tests of Scene-internal/grid-engine wiring that was deliberately left to manual verification, consistent with how Entity Interact already works.

### Implementation Decisions

- **Terminology**: **Zone** — a Tiled-authored, Class-tagged rectangular region on a Map, identified by a dedicated `zoneId` property. `GLOSSARY.md` gains this term.
- **Authoring**: A new Tiled Custom Class `Zone`, defined in the Map's Tiled Project alongside `Spawn`/`Entity`/`Portal`. Placed as a real rectangle object (not a point), required by authoring convention (documented in a guide, not enforced by the Engine) to be drawn snapped to the tile grid so its pixel bounds convert unambiguously to a whole-tile range.
- **Identity & duplicate detection**: A Zone's identity is its `zoneId` property, exactly mirroring Entity's `entityId` (never `name`). The existing per-Map duplicate-id warning (`findDuplicates`) extends to cover `zoneId`s the same way it already covers `entityId`s.
- **Overlap handling**: Two Zones whose rectangles overlap are not specially resolved — deterministic "first match wins" — but the Engine's per-Map load pass warns (`console.warn`) if it finds overlapping Zone rectangles, the same diagnostic-not-error treatment duplicate ids already get. Full overlap-resolution semantics stay explicitly undesigned pending a concrete need.
- **Tiled → Engine conversion**: A Zone's `x, y, width, height` (pixels) convert once, at Map load, into a fixed list of covered grid tiles — the same floor-division approach `readEntity` already uses for a point object's position, applied across the full rectangle. The resulting shape, from analysis during grilling (not a built prototype):
  ```ts
  interface ZoneObject {
    zoneId: string
    tiles: { x: number; y: number }[]
  }
  ```
- **Detection mechanism**: Uses grid-engine's own `steppedOn(charIds, tiles, layer)` observable — subscribed once per Zone at Scene creation — rather than a per-frame position poll (unlike Entity Interact's existing `getFacingPosition` check, which does poll every frame; Zone detection is push-based and doesn't touch that existing pattern). The Player's very-first-appearance case (spawn tile already inside a Zone) additionally needs one explicit `getPosition(PLAYER_ID)` check at Scene creation, since `steppedOn` only fires on an actual movement-driven entry.
- **Engine Event**: A new, minimal Engine Event, `{ type: 'zoneEntered', zoneId: string }`, mirroring `interacted`'s own minimalism (ADR-0004).
- **Fire semantics**: Edge-triggered only — fires once on the outside→inside transition (including the Player's first-ever appearance on a Map, treating "not yet spawned" as trivially outside every Zone), never continuously while the Player stands inside. Applies uniformly at every Map (re)load — boot and every subsequent Portal/edge-walk transition — not specially cased to the very first boot. (Later narrowed: entries while the Engine is paused are dropped — see "Cutscene Follow Step & Cutscene-Driven Zone Entries" below.)
- **Replay gating**: Reuses the existing `runOnce`/Flag mechanism unchanged (the same `<id>_seen` Flag convention CG/Cutscene already use) — a Zone's Script plays at most once per Student, exactly like a Script-triggered CG/Cutscene already does.
- **Script dispatch**: No new dispatch logic — whatever Script a `zoneId` resolves to produces the same `ScriptResult` (Dialogue | CgTrigger | CutsceneTrigger) an Entity's Script already can, handled by the same existing Host-side dispatch.
- **Script-lookup generalization**: The existing per-entityId Script lookup (dynamic import + try/catch) generalizes into one shared helper parameterized by kind (e.g. `entities/`, `zones/`), rather than either a fully duplicated parallel function per kind or a single flat cross-kind id namespace — avoiding both code duplication and cross-kind id collisions.
- **Relationship to ticket #13 (Map-entry Script)**: Zone and Map-entry stay two separate, coexisting Engine Events. Zone does not touch, generalize, or reopen the already-shipped `transitioned` Engine Event or ticket #13's own (still-unbuilt) scope — they share the Script-lookup pattern, not the Engine Event contract.
- **Activation**: No WorldConfig-gated filtering — every Zone authored on the currently-loaded Map is simply always live, matching the actual (not originally-aspirational) behavior Entities/Portals already have.
- **Character layer**: Fixed to this project's single existing character layer (`"ground"`) — no multi-layer/multi-floor concept exists elsewhere in the codebase to design around.

### Testing Decisions

- Matching the existing pattern (`node:test`/`node:assert/strict`, raw Tiled-JSON-shaped literals in, typed objects out, no mocking framework): the one seam this feature adds pure logic at, `collectZones`/`readZone` (mirroring `collectEntities`/`readEntity`'s existing test file and style), gets unit tests — given a raw Tiled object with Class=Zone, a `zoneId` property, and a pixel rectangle, asserts the correct `zoneId` and the correct, complete list of covered grid tiles; also covers a Zone missing/blank `zoneId` being skipped, and an object tagged with a different or no Class being skipped, mirroring `collectEntities`'s own existing test coverage exactly.
- The generalized Script-lookup helper reuses and extends `runEntityScript`'s existing test seam (`scripts.test.ts`) rather than introducing a new one — same assertions, just proven to also resolve a `zones/`-sourced Script by a `zoneId`.
- The duplicate-`zoneId` per-Map warning reuses `findDuplicates`'s existing test coverage (`util.test.ts`) as-is — no new pure function, so no new tests, just a new call site.
- Everything past those two pure-function seams — `steppedOn`/`getPosition` actually firing in a running Scene, the Player actually freezing, a Cutscene/CG/Dialogue actually appearing on walking into a Zone, the spawn-already-inside case actually firing at Map load, and the overlapping-Zone warning actually appearing in a browser console — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: place a test Zone over/near the Spawn Point, confirm walking into it from outside triggers its Script exactly once, confirm re-entering afterward does nothing (already seen), confirm a Zone placed so the Spawn Point itself falls inside it fires immediately on Map load, and confirm two overlapping test Zones produce a console warning at Map load.

### Out of Scope

- Any change to World Config, or building real "active Entities/Portals/Zones" filtering — Zones follow the existing de facto "everything authored is live" behavior; retrofitting real activation filtering is a separate, bigger change affecting Entities/Portals too.
- Reopening or restructuring the already-shipped `transitioned` Engine Event, or ticket #13's own scope — Zone is a new, separate, coexisting Engine Event.
- Deterministic priority/ordering rules for overlapping Zones beyond a load-time warning — "first match wins" stays undesigned/unspecified further.
- Non-rectangular Zone shapes (polygon, ellipse, ...) — Tiled's rectangle object only.
- Pixel-precise or sprite-bounding-box collision — the Player is always a single grid tile, matching every other Engine mechanic; a Zone's tile-membership check is the entire mechanism.
- A continuous "while standing inside" trigger mode — Zone is strictly edge-triggered, once per entry, gated to at most once ever per Student.

### Further Notes

- This is a new, permanent Engine Event type and a new Tiled Custom Class — a genuinely hard-to-reverse architectural decision per this project's own convention (`CLAUDE.md`'s "Where decisions live"). See `adr/0019` (Zone stays a separate Engine Event from `transitioned`), `adr/0020` (Script lookup-by-id generalizes to one shared, kind-parameterized helper), `adr/0021` (Zone activation isn't World Config-gated, matching Entity/Portal's actual behavior), and `adr/0022` (spawning inside a Zone counts as entering it).
- `docs/guides/tiled-object-authoring.md` is expected to gain a Zone-authoring section, extending the existing Spawn/Entity/Portal guide rather than a new file, per `CLAUDE.md`'s "one topic per file" rule.
- Verified against grid-engine's actual installed API (`steppedOn`, `getPosition`, `Position`/`CharLayer` types) during grilling, not assumed.
- See the "CG & Cutscene" and "CG & Cutscene as Script Output" sections above for the Dialogue/CG/Cutscene dispatch mechanism this reuses entirely unchanged.

## Entity Rendering: Character Entities and Prop Entities

Confirmed 2026-09-29 via grilling session. Resolves this spec's own "NPC/Entity sprite rendering" deferral (below) and is the prerequisite issue #28 (Cutscene Movement continuous Follow) turned out to depend on without being filed as such — #26/#28 already generalize Movement/Follow steps to target "the Player or any map Entity," but no Entity has ever been a real, moveable character for either to target. See `GLOSSARY.md`'s new **Character**, **Character Entity**, and **Prop Entity** entries, and `adr/0023-entity-rendering-splits-into-character-entities-and-prop-entities.md` / `adr/0024-character-entity-picks-its-character-in-tiled-not-world-config.md` for the two architectural calls below.

### Problem Statement

Entities have no visual representation in the live game at all today — only the Player renders. A Tiled-authored Entity like Campfire carries a `gid` (a picked tile) purely for Tiled's own editor preview; the running game draws nothing for it. This already blocks real content (a Script can trigger Dialogue/CG/Cutscene from an Entity the Player can't actually see) and blocks #26/#28's own designs, which assume a movable NPC exists to target.

### Solution

Every Entity is now either a Character Entity or a Prop Entity, decided by whether it has a Character (an animated sprite-sheet appearance) — derived from whether its Tiled object carries a `characterId` property, not a separately authored flag. A Character Entity is registered and animated exactly like the Player (a real grid-engine character, automatically eligible for a Cutscene's Movement or Follow step), authored via a new `characterId` Tiled property (an enum dropdown sourced from `catalogs.ts`) and an optional `facing` property for its idle orientation. A Prop Entity has no Character and needs none — it renders directly from its own Tiled object's picked tile, the same as any other painted tile, with no sprite-sheet prep and no grid-engine registration. Rendering for both tiers is unconditional once their Map is loaded, matching Entity/Portal/Zone's existing (not World-Config-gated) activation behavior.

### User Stories

1. As a Player, I want to see NPCs and monsters walking around the Map, so that the world feels alive rather than an empty layout with invisible interaction points.
2. As a Player, I want to see static objects like a campfire actually rendered in the game, so that Tiled-authored decoration isn't visible only to the Map's designer.
3. As a Map author, I want to place a Character Entity using the exact same Tiled convention I already use for any Entity (Class = Entity, an `entityId` property), so I don't learn a second placement convention just because this Entity happens to walk.
4. As a Map author, I want to pick a Character Entity's sprite from a dropdown of catalog ids directly in Tiled, so I don't have to hand-type a string I might get wrong or don't know the valid values for.
5. As a Map author, I want a Character Entity's idle facing direction to be something I set per-instance in Tiled, so two placements of the same NPC can face different directions without duplicating the character asset.
6. As a Map author, I want a Character Entity's facing direction to default sensibly (`'down'`) if I don't set it, so a minimal placement still looks correct without extra authoring effort.
7. As a Map author, I want a Prop Entity to need no extra properties beyond what any Entity already needs (just `entityId`, no `characterId`), so a static object like a campfire stays as simple to place as it is today.
8. As a Map author, I want the Campfire object I've already placed to just start rendering, with no re-authoring required, so this feature doesn't force me to touch every existing Map.
9. As a Content author, I want a Character Entity's Script (Dialogue/CG/Cutscene) to work completely unchanged, so adding a visible sprite to an NPC doesn't require touching its interaction logic at all.
10. As a Content author, I want a Cutscene's Movement step to actually move a Character Entity's visible sprite when it targets that Entity's `charId`, so the Movement/Follow steps #26/#28 already designed have something real to animate.
11. As a Content author, I want a Cutscene's Follow step (once #28 itself is built) to work on any Character Entity with no extra per-Entity setup, so "can this Entity be followed" isn't a separate authoring decision from "does this Entity have a Character."
12. As a Host developer, I want a Character Entity's sprite defined via the same `CharacterDefinition` catalog shape the Player already uses, so this feature adds no new asset type or authoring pipeline.
13. As a Host developer, I want a Character Entity registered into grid-engine's `characters` array the same way the Player already is, so movement/animation code needs no parallel implementation for NPCs.
14. As a Host developer, I want Prop Entity rendering to reuse the Engine's existing tile-image resolution (the same mechanism any painted tile already uses), so this feature adds no new asset-loading code for static objects.
15. As a Host developer, I want an Entity's tier (Character vs. Prop) derived from parsed Tiled data, not a second authored field, so there's no way for a `characterId`-bearing Entity to be accidentally marked as a Prop or vice versa.
16. As a Map author, I want the Entity Custom Class's `characterId` values defined in the Map's Tiled Project (not hand-typed freeform), so Tiled itself catches a typo before it ever reaches the running game.
17. As an Engine developer, I want `EntityObject`'s shape to grow optional `characterId`/`facing` fields rather than become a new parallel type, so Entity Interact's existing consumer needs no changes.
18. As an Engine developer, I want Prop Entity rendering and Character Entity registration to happen once at Scene creation, mirroring how the Player and Tiled tile-animation are already set up, so this feature needs no new per-frame Scene logic.
19. As a future maintainer, I want it recorded why Entity rendering splits into two tiers instead of forcing every Entity through the Player's four-direction sprite-sheet pipeline, so I don't "simplify" it back into one system without understanding the tradeoff (`adr/0023`).
20. As a future maintainer, I want it recorded why a Character Entity's `characterId` lives in Tiled rather than World Config (unlike the Player's own `characterId`), so I don't "fix" it to match the Player's pattern without understanding it was deliberate (`adr/0024`).
21. As a future maintainer, I want it recorded that Character Entity rendering automatically implies Movement/Follow eligibility with no separate capability flag, so I don't go looking for an opt-out mechanism that was deliberately not built.
22. As a future maintainer, I want it recorded that Entity/Prop/Character rendering is unconditional once a Map loads (not World-Config-gated), consistent with Entity/Portal/Zone's existing de facto behavior, so I don't assume this feature quietly introduced activation filtering that was never built.
23. As a QA reviewer, I want the pure Tiled-parsing seam (`readEntity`/`collectEntities`'s extension) to be the one place this feature's core logic is unit-tested, so I'm not left looking for tests of Scene-internal/grid-engine wiring that's deliberately manual-verification-only, consistent with Entity Interact and Zone detection.
24. As a Map author, I want to be warned (not blocked) if I give a Character Entity a `characterId` that doesn't match any id in the catalog, so a typo or stale reference is diagnosable without silently crashing the Map load.
25. As a Player, I want two different Entities using the same `characterId` (e.g. two guards both looking like "fluffy") to render and move independently, so reusing one catalog sprite across multiple placements just works, the same as reusing a tileset tile already does.
26. As a Host developer, I want this feature's data flow (Tiled → `EntityObject` → Scene) to require no change to the Tiled Map format's other layers (`ground`/`obstacle`/`collision`) or existing Zone/Portal objects, so this stays additive.
27. As a Map author, I want the Entity Custom Class's schema (this feature's `characterId`/`facing` additions) defined in a project-level `test_map.tiled-project` file, so opening the Map in Tiled picks the schema up automatically rather than requiring per-designer manual setup.
28. As an Engine developer, I want `collectEntities`'s existing duplicate-`entityId` warning to keep working unchanged for both Character and Prop Entities, so this feature needs no parallel duplicate-detection logic.

### Implementation Decisions

- **Terminology**: **Character**, **Character Entity**, **Prop Entity** — three new terms (`GLOSSARY.md` gains all three; see the domain glossary for exact definitions).
- **Tier derivation**: not a separately authored field. An Entity is a Character Entity if its Tiled object's `characterId` property is present and non-blank; otherwise it's a Prop Entity — mirroring how `entityId`/`zoneId` already work as the sole identity signal (ADR-0012).
- **New Tiled `Entity` Custom Class properties**, defined in a new `test_map.tiled-project` file (none exists in the repo today, despite ADR-0010 calling for one — creating it is part of this work):
  - `characterId` (optional, **enum** type, values = `catalogs.ts`'s character ids) — the designer picks a Character Entity's sprite from a dropdown rather than typing a string.
  - `facing` (optional, defaults to `'down'` if unset) — a Character Entity's idle-facing direction.
- **`EntityObject` shape** grows two optional fields (`characterId?: string`, `facing?: Direction`) rather than becoming a new parallel type — Entity Interact's existing consumer of `EntityObject` needs no changes.
- **Character Entity rendering**: registered into grid-engine's `characters` array at Scene creation exactly like the Player already is, using the same `CharacterDefinition` catalog shape (`catalogs.ts`) and the same normalized-sprite-sheet pipeline (ADR-0006) — no new asset type. This makes a Character Entity automatically eligible for a Cutscene's Movement or Follow step via its `entityId` as `charId` — no separate capability flag (#26's `moveTo`/`follow` already accept "the Player or any map Entity").
- **Prop Entity rendering**: drawn directly from its Tiled object's own tile (`gid`) at Scene creation, reusing the Engine's existing tile-image resolution — no `CharacterDefinition` entry, no sprite-sheet normalization, no grid-engine registration.
- **Activation**: unconditional once the Entity's Map is loaded, for both tiers — matching Entity/Portal/Zone's existing de facto behavior (ADR-0021), not gated by World Config.
- **Player unaffected**: the Player's own rendering, `characterId` resolution (via World Config), and spawn behavior are entirely unchanged; this feature only adds a second, Entity-side path that happens to reuse the same underlying Character asset pipeline.
- See `adr/0023` for why rendering splits into two tiers instead of one uniform pipeline, and `adr/0024` for why a Character Entity's `characterId` lives in Tiled rather than World Config.

### Testing Decisions

- Matching the existing pattern (`node:test`/`node:assert/strict`, raw Tiled-JSON-shaped literals in, typed objects out, no mocking framework): `readEntity`/`collectEntities`'s extension is the one place this feature's core logic is unit-tested, mirroring `readZone`/`collectZones`'s own test file and style.
- Given a raw Tiled `Entity`-class object with a `characterId` property, asserts the returned `EntityObject` carries it (Character Entity case); given one without, asserts it's absent (Prop Entity case).
- Given a `facing` property, asserts it's carried through unchanged; given none, asserts it resolves to `'down'`.
- Existing `readEntity`/`collectEntities` coverage (blank/missing `entityId` skipped, duplicate-`entityId` warning, non-`Entity`-class objects skipped) is unaffected and stays as-is — no regressions expected, not re-specified here.
- Everything past that seam — a Character Entity actually appearing as a grid-engine character and walking, a Prop Entity's tile actually drawing on screen, a Cutscene Movement step actually animating a Character Entity — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: place a test Character Entity (e.g. wire `fluffy` as a Guard) and confirm Campfire's existing Prop Entity object on `main_test.tmj`, confirm both actually render in the browser (not just Tiled's editor preview), confirm the Character Entity idles facing its authored `facing` direction, and confirm a Cutscene Movement step can walk it to a point.

### Out of Scope

- **Issue #28's own stop-condition design** (Follow's exact stop behavior) — this section only gives Follow something to target; the stop-condition question stays a separate, already-filed, explicitly deferred ticket. (Since resolved — see "Cutscene Follow Step & Cutscene-Driven Zone Entries" below.)
- **World-Config-gated Entity/Portal/Zone activation** — not retrofitted here either, per ADR-0021's existing precedent; a future ticket building real activation would apply to all three kinds uniformly.
- **An explicit per-Entity movability capability flag** — considered and rejected; Character-tier already implies Movement/Follow eligibility with no opt-out, since no concrete case for one exists yet.
- **Portrait/Speaker tie-in** — a Character Entity's Character asset has no relationship to Portrait (already independent per ADR-0014); this section doesn't touch Dialogue rendering.
- **Monster-specific behavior (AI, combat, aggro)** — "monster" is mentioned only as an example of a Character Entity; no behavior beyond what any Character Entity already gets (walk/idle animation, Movement/Follow eligibility) is designed here.
- **Automatic sync between the Tiled Project's `characterId` enum and `catalogs.ts`** — kept manual, matching ADR-0006's existing precedent that new character sheets are added rarely enough not to need tooling.
- **Retroactively re-authoring every existing Map's Prop Entities** — Campfire's existing Tiled object needs no changes to start rendering; this is additive, not a migration.

### Further Notes

- Supersedes this spec's own "Explicitly out of scope / deferred" bullet on "NPC/Entity sprite rendering" below — updated to point here.
- `GLOSSARY.md` gained **Character**, **Character Entity**, and **Prop Entity** as part of this round; **Player**'s and **World Config**'s entries were also corrected — World Config's entry no longer claims Entity/Portal activation-gating that ADR-0021 already found was never real.
- See `adr/0023-entity-rendering-splits-into-character-entities-and-prop-entities.md` and `adr/0024-character-entity-picks-its-character-in-tiled-not-world-config.md`.
- This is the prerequisite issue #28 was blocked on without being filed as such; #28 itself still needs its own follow-up grilling pass on the stop-condition question before it's ready-for-agent. (Resolved — see "Cutscene Follow Step & Cutscene-Driven Zone Entries" below.)

## Cutscene Follow Step & Cutscene-Driven Zone Entries

Confirmed 2026-09-30 via grilling session. Resolves issue #28's unsettled stop condition and supersedes #28 itself: one generic Follow step covers both "an NPC follows the Player" and "the Player follows an NPC". Also fixes a pre-existing interaction between Cutscene-driven Player movement and Zones that the Follow step would otherwise make more common. See `GLOSSARY.md`'s new **Follow step** entry and amended **Zone** entry, `adr/0025-follow-step-starts-and-moves-on-instead-of-holding-the-cutscene.md`, `adr/0027-the-player-trails-the-leaders-footsteps-other-followers-chase.md`, and `adr/0026-zone-entries-are-dropped-while-the-engine-is-paused.md`.

### Problem Statement

A Cutscene can only walk a character to a fixed tile, one at a time. A content author who wants the Player to trail an NPC through a scene, or an NPC to trail the Player, has to hand-author every tile of both walks as separate, sequential Movement steps. That can't look like one character following another, because only one of them moves at a time.

Separately, when a Cutscene walks the Player across a Zone, that Zone's Script runs in the middle of the Cutscene. If it produces a Cutscene of its own, it takes over playback: the original Cutscene waits forever on a click it never gets, and the Player is unfrozen while the original Cutscene is still on screen.

### Solution

A Cutscene gains a **Follow step**: one character (the *follower*, the Player or a Character Entity) keeps trailing another (the *leader*) at a gap the Cutscene chooses (empty tiles between them, default 0: right behind the leader). The Cutscene doesn't wait on a Follow step; it goes straight to the next step, usually a Movement step that walks the leader, and the follower trails along. A follow ends when its Cutscene ends, or earlier when the follower is given its own Movement step. The Guard demo Cutscene shows both directions.

Zones now react only to the Player's own movement. While the Engine is paused (a Cutscene or CG has control), Zone entries are dropped, not saved for later. The Zone's seen-Flag stays unset, so walking into it later still sets it off.

### User Stories

1. As a content author, I want one Cutscene step that makes one character follow another, so that I can stage "follow me" scenes without hand-authoring both characters' walks tile by tile.
2. As a content author, I want the same Follow step to work with the Player as follower and an NPC as leader, so that a Cutscene can lead the Player somewhere.
3. As a content author, I want the same Follow step to work with an NPC as follower and the Player as leader, so that an NPC can trail the Player during a scene.
4. As a content author, I want a Follow step to take any Character Entity as the leader, not just the Player, so that two NPCs can walk together too.
5. As a content author, I want the Cutscene to continue to the next step right after a Follow step, so that I can walk the leader in the next step while the follower trails behind.
6. As a content author, I want to choose how many empty tiles the follower keeps between itself and the leader, so that a scene can read as a loose escort or a close tail.
7. As a content author, I want the gap to default to 0 (right behind the leader, grid-engine's own default) when I don't set it, so that the common case needs no options.
8. As a content author, I want a follow to end automatically when its Cutscene ends, so that I never have to remember a cleanup step.
9. As a Player, I want to never be left trailing an NPC after a Cutscene hands control back, so that my own input is the only thing moving me.
10. As a content author, I want giving the follower its own Movement step to end its follow, so that I can switch a character from following to walking somewhere specific without a separate stop step.
11. As a content author, I want a follow started before a Choice hands off to another Cutscene to keep going through that Cutscene and end when the original Cutscene ends, so that branching doesn't cut a follow short.
12. As a content author, I want a Follow step whose leader isn't on the current Map (or is a Prop Entity) to warn in the console and be skipped, like a failed Movement step, so that a typo doesn't hang or crash the Cutscene.
13. As a Player, I want the Guard demo to show me following the Guard on a loop and then the Guard following me, so that both directions are proven in the running game.
14. As a Player, I want the Guard to talk like a smug, bratty kid (kusogaki) during that demo, so that the demo has some character.
15. As a Player, I want a Zone to trigger only when I walk into it myself, so that a Cutscene walking me across a Zone doesn't interrupt that Cutscene.
16. As a Player, I want a Zone that a Cutscene walked me across to still trigger later when I walk into it myself, so that I don't miss its scene just because a Cutscene passed through first.
17. As a Player, I want to not trigger a Zone just because a Cutscene left me standing inside it, so that a Zone always means "I walked in here".
18. As a Player, I want a Zone's Script to never take over a Cutscene that's already playing, so that I'm never stuck frozen or unfrozen in the middle of a scene.
19. As a Map author, I want Zone behavior during Cutscenes to be the same no matter whether a Movement step or a Follow step moved the Player, so that I don't have to think about which one a Cutscene uses.
20. As a Host developer, I want Zone entries during a pause to be filtered out before they reach me, so that the Host needs no "is something playing?" check of its own.
21. As a Host developer, I want spawning inside a Zone right after the boot CG to still fire it (ADR-0022), so that this change doesn't break the arrival trigger.
22. As a future maintainer, I want it recorded why a Follow step doesn't wait while every other Cutscene step does (ADR-0025), so that I don't "fix" it into a step that hangs forever.
23. As a future maintainer, I want it recorded why Zone entries during a pause are dropped instead of queued or nested (ADR-0026), so that I don't reintroduce either alternative without knowing why they were rejected.
24. As a future maintainer, I want it recorded that there's no explicit stop-follow step on purpose, so that I know it's a deferred option, not an oversight.
25. As a QA reviewer, I want the rule "every follow a Cutscene started stops when it ends" covered by an automated test, so that it can't silently regress.

### Implementation Decisions

- **Terminology**: **Follow step**, with *follower* and *leader*, is new in `GLOSSARY.md`. *Target* stays reserved for a Movement step's destination tile. **Zone**'s entry now says only the Player's own movement counts.
- **Scope**: Cutscene-only. No out-of-Cutscene follow or escort mechanic.
- **Step shape**: a new Cutscene step kind alongside Dialogue, Choice, and Movement, carrying the follower's charId, the leader's charId, and a gap. The Cutscene builder gains a `follow(follower, leader, options?)` method next to `moveTo`. When `gap` isn't set, the builder fills in 0, so the step list always has an explicit gap. (The default was first set to 1; a manual playtest showed a one-tile gap didn't read as following, so it now matches grid-engine's own default.)
- **Gap semantics**: the number of empty tiles between follower and leader. For a Character Entity follower it passes straight to grid-engine's `follow` `distance` option (verified in grid-engine's code: `distance: 0` ends adjacent, `distance: 1` leaves one empty tile). For a Player follower it's the number of the leader's footsteps the Player stays behind along the route.
- **Follow style depends on the follower** (`adr/0027`): a Character Entity follower uses grid-engine's `follow`, a shortest-path chase. A Player follower replays the leader's exact footsteps: the Engine records each tile the leader leaves (on grid-engine's `positionChangeFinished`, because the exit tile stays blocked until then) and walks the Player into them one at a time. Added after a manual playtest showed a chasing Player cutting inside the Guard's loop and blocking it.
- **Runner**: the Follow step doesn't wait (ADR-0025). The runner calls the Engine's follow and advances right away. The step-runner reducer gets its own completion event for a started follow, so a Follow step advances only on that event, like every other step kind.
- **Ending a follow**: there is no stop step. The Cutscene player records every follower it started and stops each one's movement when that Cutscene ends, normally or not. A Choice hand-off plays the next Cutscene nested inside the original, so a follow started before the hand-off lasts until the original Cutscene ends. A Movement step on the follower also ends the follow. For a chasing Character Entity, grid-engine does that itself by replacing the character's movement. For a trailing Player, the Engine cancels the trail on any Movement step or stop, because a trail isn't a grid-engine movement (`adr/0027`).
- **Engine surface**: the Engine handle gains a way to start a follow (follower, leader, gap) and a way to stop a character's movement, wrapping grid-engine's `follow`/`stopMovement` for a Character Entity follower and the Engine's own footstep trail for a Player follower (Engine-owned Host-commanded movement lives in its own engine-core module, not the Scene). Starting a follow whose follower or leader isn't a registered character on the current Map warns in the console and does nothing, matching how a failed `moveTo` warns and moves on.
- **Testability of the Cutscene player**: `playCutscene` can take a step registry, using the `registry` parameter `resolveCutscene` already has, so tests can run it against fake steps and fake callbacks.
- **Demo**: the existing `guard-walk` Cutscene grows into the proof. The Guard taunts, the Player follows the Guard around a loop of Movement steps back to the Guard's start, the Guard gives the lead to the Player, the Guard follows the Player while the Player walks to a tile (both at the default gap), and the Guard gloats. The Guard's lines are kusogaki-style: cocky and bratty. Loop corner and destination tiles are picked at implementation time from collision-free tiles near the Guard.
- **Zone entries while paused** (ADR-0026): the Engine doesn't emit `zoneEntered` while `setPaused(true)` is in effect. The entry is dropped, not queued, and no `runOnce` Flag is set, so the Zone stays available. Nothing is re-checked on unpause: a Player left standing inside a Zone sets it off only by walking out and back in (the existing outside→inside rule). The boot CG plays before the Engine exists, so spawn-inside-a-Zone on Map load (ADR-0022) is unaffected. Dialogue doesn't pause the Engine (ADR-0011), so Zones still fire while Dialogue is showing.
- **No contract changes beyond the above**: World Config, the Tiled Map format, and the shape of the `zoneEntered` Engine Event are unchanged. Only when `zoneEntered` is emitted changes.

### Testing Decisions

- Follows the existing pattern (`node:test`/`node:assert/strict`, pure inputs and outputs, hand-written fakes, no mocking framework). Tests assert what a caller sees (steps produced, callbacks invoked, Promise resolution), not internal state.
- **Cutscene builder** (existing seam, alongside `cutscene.test.ts`'s `moveTo` tests): `follow()` builds a Follow step with the given follower and leader, applies the default gap of 0 when unset, carries a given gap unchanged, and chains in order with `say`/`moveTo`/`choice`.
- **Step-runner reducer** (existing seam, alongside `cutscene-runner.test.ts`): a Follow step advances on its own completion event and ignores advance-click, move-finished, and choice-picked, the same way the existing per-kind tests do.
- **Cutscene player** (new seam): `playCutscene` run against a test registry and fake callbacks. Assertions:
  - a Follow step invokes the follow callback and the next step starts without waiting for anything;
  - every follower started is stopped once the Cutscene's `done` resolves;
  - a follow started before a Choice hand-off is still running during the handed-off Cutscene, and is stopped only when the original Cutscene ends;
  - the pause flag is set at the start and cleared at the end.
- **Manual verification** (not automatable here, per `CLAUDE.md`):
  - the `guard-walk` demo plays with the Player visibly trailing the Guard's loop directly behind, then the Guard trailing the Player directly behind;
  - control returns with nobody still following;
  - a Follow step naming a missing leader logs a warning and the Cutscene carries on;
  - a Cutscene walking the Player across a Zone doesn't trigger it, and walking into that Zone afterward does;
  - spawning inside a Zone after the boot CG still fires it.
- The Engine-side Zone guard and follow/stop wrappers have no pure logic worth extracting, so they get no unit tests of their own.

### Out of Scope

- **An explicit stop-follow step**: no scene needs to stop a follow mid-Cutscene yet. Add it when one does; ADR-0025 doesn't change.
- **Follow outside Cutscenes** (escort or companion mechanics during normal play). (No longer deferred — see "Companion: A Character Entity That Keeps Following the Player" below.)
- **Queueing or nesting a Zone's Script that was entered during a Cutscene**: dropped by design (ADR-0026).
- **Other follow options grid-engine offers** (`closestPointIfBlocked`, `facingDirection`, path-length limits): grid-engine's defaults are used.
- **Camera changes**: the camera keeps following the Player sprite whether or not the Player is a follower.

### Further Notes

- Supersedes issue #28: once the implementing ticket is filed, #28 is closed with a comment linking it.
- Supersedes "CG & Cutscene"'s Out of Scope bullet on continuous `follow()` behavior, and "Entity Rendering"'s bullet on #28's stop-condition design, both updated to point here.
- The Zone change fixes a bug that already exists with plain Movement steps (`moveTo` on the Player). It ships as its own ticket, independent of the Follow step.
- Verified against grid-engine 2.52.1's installed API during grilling: `follow` returns `void` and never completes, which is why ADR-0025 exists.

## Companion: A Character Entity That Keeps Following the Player

Confirmed 2026-09-30 via grilling session. Picks up "Cutscene Follow Step"'s deferred "Follow outside Cutscenes" item. See `GLOSSARY.md`'s new **Companion** entry and `adr/0028-companions-are-host-owned-flags-the-host-reapplies-to-the-engine.md`. Builds on the Follow step (`adr/0025`, `adr/0027`).

### Problem Statement

A Follow step ends when its Cutscene ends, so a character can never keep the Player company during normal play. A content author who wants an NPC to join the Player, like a Guard who says "fine, I'll tag along", has no way to do it: once the Cutscene hands control back, the NPC stops where it is.

### Solution

A Script can turn any Character Entity into a **Companion**: it keeps chasing the Player outside any Cutscene for as long as a Flag says so. The Flag's value is the Companion's Character, so it's remembered across Map transitions once those exist. A Companion never blocks the Player. The Player can dismiss it with a button in the corner, which is hidden while a Cutscene or CG is playing. A Companion can't be talked to. The `guard-walk` Cutscene ends with a Choice that can recruit the Guard as the demo.

This spec covers a Companion on the Map where it was recruited. Carrying a Companion onto other Maps is decided here but built in a later ticket, once Map transitions (#3) exist.

### User Stories

1. As a content author, I want a Script to turn a Character Entity into a Companion, so that an NPC can join the Player after a scene.
2. As a content author, I want recruiting a Companion to be an ordinary Flag write (for example from a Choice), so that I don't learn a new Script mechanism.
3. As a content author, I want any Character Entity to be able to become a Companion, not just the Guard, so that the mechanic is reusable.
4. As a Player, I want a recruited Companion to keep following me after the Cutscene ends, so that it feels like it joined me.
5. As a Player, I want a Companion to walk right behind me, so that it reads as following me.
6. As a Player, I want a Companion to never block my path, so that it can't trap me in a corridor or dead end.
7. As a Player, I want a Companion to still walk around walls rather than through them, so that it stays believable.
8. As a Player, I want a Companion to pick up following me again after a Cutscene moves it or stops it, so that a scene doesn't quietly make it leave.
9. As a Player, I want a button to dismiss a Companion, so that I can choose to go on alone.
10. As a Player, I want the dismiss button to name the Companion, so that I know which one I'm dismissing.
11. As a Player, I want a dismissed Companion to stop right away and go back to blocking me like any other character, so that dismissing is immediate and clear.
12. As a Player, I want the dismiss button hidden while a Cutscene or CG is playing, so that I can't break a scene halfway through.
13. As a Player, I want the Guard demo to end with "Follow me forever" or "Nah, stay here", so that recruiting is my choice.
14. As a Player, I want picking "Nah, stay here" to leave the Guard at its post, so that declining really declines.
15. As a Player, I want a Companion to come with me when I walk onto another Map, so that "forever" really means forever. (Later ticket, after #3.)
16. As a Player, I want a Companion to appear next to me on each new Map, so that it's there as soon as I arrive. (Later ticket, after #3.)
17. As a Host developer, I want Companion state to live in the existing Flag store, so that it needs no new persistence.
18. As a Host developer, I want one function that re-applies Companion Flags to the Engine, so that "is it following right now?" is decided in one place.
19. As a Host developer, I want that function called when a Map finishes loading, after any Script finishes, and on dismiss, so that every way a chase can be lost is covered.
20. As a Host developer, I want the Engine handle to be usable as soon as `createEngine` resolves, so that the first sync can't reach grid-engine before the Map Scene exists.
21. As an Engine developer, I want the Engine to stay unaware of Companions, so that its only new surface is a generic "does this character block other characters" toggle.
22. As a future maintainer, I want it recorded why the Host, not the Engine, re-applies Companions (`adr/0028`), so that I don't move it into the Engine and lose Companions recruited mid-Map.
23. As a future maintainer, I want it recorded that a Companion's Character is written twice (Tiled and the Flag value), so that I know it's a deliberate trade for never loading an unshown Map.
24. As a future maintainer, I want it recorded that talking to a Companion is a future feature, so that I don't treat the missing Interaction as a bug.
25. As a QA reviewer, I want the Flag-to-Engine sync covered by automated tests, so that recruiting and dismissing can't silently break.

### Implementation Decisions

- **Terminology**: **Companion**, new in `GLOSSARY.md`. The Follow step's *follower* role stays Cutscene-only.
- **State** (`adr/0028`): one Flag per Companion, `companion:<entityId>`. Its value is the Companion's `characterId` string while it's a Companion, and `false` once dismissed. There is no other Companion state. Flags are still in-memory, so a page refresh resets Companions. That limitation already exists and isn't this feature's to fix.
- **Recruiting**: a Script writes the Flag. In the demo, a Choice's existing Flag writes set `companion:Guard = 'fluffy'`. The Script author writes the Character a second time; it's already in Tiled.
- **Sync Companions**: one Host function takes the current Flags and the Engine handle. For each `companion:*` Flag holding a Character, it makes that character stop blocking other characters and starts `follow(entityId, player, 0)`. For each one set to `false`, it restores blocking and calls `stopMovement`. It ignores every other Flag. A Companion whose character isn't on the current Map is skipped, using the Engine's existing warn-and-skip behaviour.
- **When sync runs**: once the Engine has finished loading a Map, after every Script finishes (including Cutscenes, CGs and Dialogue Choices, since any of them can write Flags or move the Companion), and after a dismiss.
- **Engine readiness**: `createEngine` resolves only once the Map Scene has been created, so the handle's movement calls are safe to use straight away.
- **Blocking**: the Engine handle gains one generic call that sets whether a character blocks other characters, wrapping grid-engine's collision groups. While a Companion, the character collides with no other characters but still with walls. When dismissed, it goes back to the default group.
- **Chase style**: grid-engine's shortest-path `follow` at gap 0 (`adr/0027`). No new movement code.
- **Dismiss UI**: the Host overlay shows one "Dismiss <entityId>" button per active Companion, only while the Engine isn't paused. Clicking it sets the Flag to `false` and runs sync.
- **Not interactable**: a Companion can't be talked to, even on its home Map.
- **Demo**: `guard-walk` ends with a Choice: "Follow me forever" writes `companion:Guard = 'fluffy'`, and "Nah, stay here" writes nothing. `guard-walk` plays once, so this is the one chance to recruit the Guard.
- **Across Maps (later ticket, blocked by #3)**: World Config gains a `companions` list (entity id plus Character) that the Host builds from the Companion Flags. On load, the Engine places each one on the first free tile next to the Player's Spawn Point (down, left, right, up), or warns and skips if all four are blocked. The Companion's own placement in Tiled is skipped on its home Map; this rule is provisional.

### Testing Decisions

- Follows the existing pattern (`node:test`/`node:assert/strict`, hand-written fakes, no mocking framework). Tests assert what the fake Engine was asked to do, not how sync decides it.
- **Sync Companions** (new seam, same style as the `playCutscene` tests): given a Flags snapshot and a fake Engine handle that records calls, assert that:
  - a `companion:<id>` Flag with a Character makes that character non-blocking and starts it following the Player at gap 0;
  - a `companion:<id>` Flag set to `false` restores blocking and stops that character's movement;
  - Flags without the `companion:` prefix produce no Engine calls;
  - several Companions each get their own calls.
- **Manual verification** (not automatable here, per `CLAUDE.md`):
  - choosing "Follow me forever" at the end of `guard-walk` makes the Guard chase the Player once control returns;
  - the Player can walk through the Guard;
  - the Guard still goes around walls;
  - after another Cutscene moves the Guard, it resumes chasing;
  - "Dismiss Guard" is hidden during a Cutscene, and when clicked stops the Guard and makes it block again;
  - "Nah, stay here" leaves the Guard at its post.
- No tests for the call sites (Engine ready, after a Script, on dismiss), the Engine's blocking toggle (a thin grid-engine wrapper), or the Choice's Flag writes (the existing Choice path is already tested).

### Out of Scope

- **Carrying a Companion across Maps**: decided above, built in a later ticket blocked by #3, because no Map transition exists yet.
- **Talking to a Companion**: a future feature.
- **Durable Companions across a page refresh**: waits on durable Flags, which is a separate concern.
- **Companion-specific movement** (keeping a distance, trailing the Player's footsteps, formations): grid-engine's chase at gap 0 only.
- **A Companion limit or party UI**: any number of Companion Flags can be set; nothing caps or orders them.

### Further Notes

- Supersedes "Cutscene Follow Step & Cutscene-Driven Zone Entries"'s Out of Scope bullet on follow outside Cutscenes, which is updated to point here.
- A Companion never triggers Zones: Zone detection only watches the Player, and only the Player's own movement (`adr/0026`).
- `docs/ideas/to-questionnaire-guard-companion.md` was the questionnaire this grilling answered. It's deleted now that its answers live here and in `adr/0028`.

## Packaging: Client Package, Game Service and Publish CLI

Confirmed 2026-10-06 via grilling session, closing the build fog of the packaging map (#65). Builds on the decision tickets #66–#75 and their ADRs: storage (`adr/0034`, `adr/0035`), Student identity (`adr/0036`), the service stack (`adr/0037`), World Versions and `prune` (`adr/0038`), the mount API (`adr/0039`), Publish (`adr/0040`, `adr/0041`), file serving (`adr/0042`), names and license (`adr/0043`). New here: the Glossary's **Host** is redefined as the runtime inside the mounted game, and the three artifacts release in lockstep (`adr/0044`).

### Problem Statement

The game only runs inside this repo's own Next.js app. Its content is hard-coded: asset registries list file paths, a JSON fixture picks the start Map, Flags live in memory and reset on refresh, and licensed art is symlinked into the app's public folder. A Platform can't install the game, an Author can't get a World to Students without editing code, and nobody but this repo's maintainer could run any of it.

### Solution

Three installable pieces, plus a reference Platform and guides that prove them end to end:

- **`@codeleagues-rpg-engine/client`**: everything that is the Host today, moved out of `apps/web` into a package. A Platform calls `mount(element, options)` (or `<Game>` from `./react`), gets a headless store back, and can override any piece of UI through typed slots.
- **The Game Service image**: holds Published World Versions and their files, and each Student's Flags, in Postgres plus an S3-compatible bucket. It answers the client's World Version and Flags requests and the CLI's Publish requests.
- **`@codeleagues-rpg-engine/cli` (`crpg`)**: an Author checks and Publishes a World from a content folder, prunes old files, and generates the World's Tiled project.
- **`apps/web`** becomes a reference Platform that signs Student tokens and mounts the game exactly as a real Platform would. `docs/guides/` explains each install step for operators, Platform developers, Authors, and contributors.

### User Stories

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

### Implementation Decisions

**Packages**

- **Layout**: `packages/client`, `packages/cli`, `apps/game-service`, and `apps/web` (the reference Platform). `engine-core` and `clsc` stay separate private workspace packages, bundled into the client and CLI, never published. Every package moves to the `@codeleagues-rpg-engine` scope and gets `"license": "MIT"`, and a root `LICENSE` is added (`adr/0043`).
- **Client** (`adr/0039`): ESM plus `.d.ts`, built with `files: ["dist"]`. Entry points `.` and `./react`. `phaser` and `grid-engine` are regular dependencies kept out of the bundle. Preact is bundled. React is an optional peer of `./react` only. Eden Treaty is a runtime dependency. The service's `type App` is used at build time only and must never appear in the public `.d.ts`. `dist` carries Preact's license notice.
- **CLI** (`adr/0041`): `bin` is `crpg`, Node or Bun, using only `fetch`, `fs`, and `crypto`. The clsc compiler is built to WASM from `compile_sources` and bundled. `dist` carries pest's and serde_json's notices.
- **What moves into the client**: the Host's script player and commands, CG playback, Companion sync, the Flags store, and the overlays (ported from the temp-ui React components to Preact built-ins), with their tests. All Host state that is module-level today (Flags store, Student, Locale, active CG) becomes per mount instance.
- **`prelude.clsc`** (the Expression enum and the command declarations) moves out of `apps/web` into `clsc`, bundled into both the CLI and the client and versioned with them (#68). Authors never edit it: `crpg publish` compiles each World's Scripts against it.
- **What moves to the maintainer's content folder**: the demo Scripts (`cast.clsc`, the campfire and guard Scripts) and the String Table fixture are World content tied to the licensed Maps, so they move into the local, gitignored content folder under `worlds/<id>/` and leave the repo.
- **What's deleted**: the hard-coded registries (Map and Character catalogs, Portraits, CG art, String Table), which the manifest and `world.json` replace; the World Config and Flag seed fixtures; the `apps/web/public/assets` symlinks; and the boot CG path (`runOnce`, `seenFlag`, the hard-coded `intro`). How a World shows an intro is decided later; a Zone on the spawn tile whose Script plays a CG already works (`adr/0022`).
- **Re-fetching Scripts on every Transition** (`adr/0005`) goes away: a session fetches everything for its World Version by id (`adr/0038`).
- **clsc**: the `--store` Flag seed option is removed; Flags start empty and come from the service. `--strings` takes the World's own `strings.json`.

**Game Service storage** (derived from `adr/0034`, `adr/0038`, `adr/0040`, not a new decision)

- Postgres has three shapes: a World row holding its live World Version pointer; World Version rows holding the manifest, the Pre-Publish summary, and when the version stopped being live; and one Flags `JSONB` document per (World, Student). Files live in the bucket as `blobs/<sha256>.<ext>`.

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

- **Build**: `bun build --compile` produces one binary per architecture, cross-compiled in a `--platform=$BUILDPLATFORM` stage (no QEMU). Migrations are embedded with `--asset`. Dotenv and bunfig autoloading are disabled in the binary. The final stage only copies the binary onto `gcr.io/distroless/base-nossl-debian13:nonroot`, pinned by digest, with numeric `USER 65532`. Not yet proven: that `Bun.sql` and `Bun.s3` connect from a compiled binary; the first image ticket proves it. The fallback is `oven/bun:1.4-distroless` running from source as `USER 65532`.
- **Subcommands**: `serve` (default), `migrate`, `prune`, `health`. `HEALTHCHECK` uses `health`, since the image has no shell or curl.
- **Environment**: `DATABASE_URL`; `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (always passed explicitly, because Bun signs with region `auto` for a custom endpoint, and strict servers reject it); `JWT_SECRET`; `PUBLISH_KEY`; `CORS_ORIGINS` (comma-separated). Optional: `ASSET_BASE_URL`, `PRUNE_GRACE_DAYS` (default 90), `PORT` (default 3000). The service checks them at startup and exits naming any that are missing.
- **Running it**: `migrate` runs as a one-off container before `serve` (compose `service_completed_successfully`, or a Kubernetes Job). `prune` is scheduled by the operator; the service never schedules anything itself. The guide's examples set a read-only root filesystem, a tmpfs at `/tmp`, and drop all capabilities.

**Local dev**

- A root compose file runs `postgres:18` and SeaweedFS (`weed mini`, with the bucket and access key created from environment variables at startup). `postgres:18` keeps its data under `/var/lib/postgresql/18/docker`, so the volume mounts `/var/lib/postgresql`. The same file, with a profile adding the Game Service image and a one-off `migrate`, is the guide's example deploy. MinIO is excluded: nixpkgs flags it as having known vulnerabilities, and its community edition is archived.
- `bun run dev` brings up the compose services, then the Game Service and the reference Platform. Nix keeps supplying Bun, Rust, and the tools, not the services.

**Repo workflow and release**

- **Rulesets**: `main` requires PRs, with lint, typecheck, and test as required checks, and no force-push or deletion. Only admins bypass. Merges are rebase-only, to keep atomic commits, and head branches are deleted automatically after merge. A tag ruleset lets only admins create or move `v*` tags. `Closes #N` in the PR body or a commit message closes the issue when the PR merges. The commit and ticket-completion sections of `CLAUDE.md` and `docs/agents/issue-tracker.md` are rewritten for branch → PR → merge (branch name `<issue>-<slug>`).
- **CI**: one workflow on PRs and on pushes to `main`: Bun and Rust, `bun run lint`, `bun run typecheck`, `bun run test`, with Postgres 18 and SeaweedFS as service containers.
- **Release** (`adr/0044`): a `v*` tag runs the CI checks, writes the tag's version into each package, builds the client and the CLI (with its WASM), and fails if `npm pack --dry-run` lists anything outside `dist/` or under `assets/`. It publishes both packages through npm trusted publishing with provenance. It builds and pushes the image to GHCR for amd64 and arm64 with provenance, an SBOM, and keyless cosign signing. Last, it creates a GitHub Release with generated notes. The npm org and each package's trusted-publisher link are a one-time manual setup.
- **Dependabot** watches the base-image digest, GitHub Actions, npm, and cargo.

**Guides** (`docs/guides/`, one topic per file)

- New: installing the Game Service (operator), mounting the game (Platform developer), Publishing a World (Author), the content folder (Author), and local dev (contributor). The README links to them in that order: operator → Platform developer → Author.
- Updated: Tiled object authoring is reduced to what `crpg tiled` doesn't generate. CG art, Portrait assets, and Character sheet layout are rewritten from `public/assets` paths and registry edits to content-folder paths.
- **Wizards**: an operator-install `/wizard` and an Author-setup `/wizard` (`adr/0040`).

### Testing Decisions

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

### Out of Scope

- **Which Character a carried Companion walks with**: #76, blocked by #38.
- **A "World finished" signal to the Platform**: #77.
- **A distributable CC0 sample World**: the install guide is "bring your own World".
- **A `crpg dev` command**: Authors Publish to a draft World id instead.
- **A polished web UI for the guides**: they stay Markdown.
- **How a World shows an intro**: the boot CG is dropped; decided later.
- **An offline queue for Flag writes**: a failed write stops the game instead.
- **Real sign-in in the reference Platform**: `?student=` stands in for it.
- Everything already in the map's Out of scope: removing content from the author's Strapi, an admin upload UI, Quest, multiplayer, generated Character previews, a rollback command, deleting a whole World.

### Further Notes

- The Glossary's intro and **Host** entry now describe the Host as the runtime inside the mounted game. Older ADRs and spec sections that say the Host owns content or persistence (`adr/0001`, `adr/0028`, the Dialogue and Companion sections above) are read with that change: content belongs to the World, persistence to the Game Service, and sign-in to the Platform.
- Earlier sections' "Flags are in-memory, so a refresh resets them" limitations end with this section.
- Rewrote "What this repo is", the tech stack's demo-shell line, the Architecture bullets, and "Playground-specific scaffolding" above to match this delivery model.

## Explicitly out of scope / deferred

- **Quests, XP, inventory, progression rules** beyond the Flags described above — these belong to the Host/main-repo backend, not the Engine, and Flags themselves stay a flat key/value store, not a full progression system.
- **Ink language integration** for dialogue authoring — skip until needed, not designed now; the Dialogue Scripts system above is a separate, general dispatch mechanism Ink could plug into later, not a replacement for it.
- **NPC/Entity sprite rendering** — no longer deferred; see "Entity Rendering: Character Entities and Prop Entities" above.
- **Map-entry Script triggers, entityId→script lookup tables** — see Dialogue Scripts' own Out of Scope above. (CG/cutscene itself is no longer deferred — see "CG & Cutscene" above; zone-entered triggers are no longer deferred either — see "Zone: Walking Into a Region Triggers a Script" above.)
- **Flag arithmetic, a Script→Host side-effect channel, timed/auto-advancing choices, a Player-facing locale switcher** — see "Dialogue Scripts: Choices, Speakers & Localization"'s own Out of Scope above.
- **Portrait art normalization pipeline, Portrait animation, and any tie-in to NPC/Entity sprite rendering** — see "Dialogue Portraits & Expressions"'s own Out of Scope above (Portrait/Expression itself is no longer deferred — it's scoped there).

## Open

(No open items at present — the previous entry, where interaction/dialogue UI renders, was resolved by the Dialogue Scripts section above: a Host-side overlay, not in-canvas.)

## Playground-specific scaffolding

Superseded by "Packaging" below: the local JSON fixtures (World Config, Flag seed, String Table) and the hard-coded asset registries are deleted. The reference Platform plays a World Published from a local content folder to a local Game Service.

## Phase 1 "done" bar

- Multiple Tiled maps
- A character walking via grid-engine + keyboard
- At least one edge-walk transition and one Portal transition wired up between maps
- Ambient/decorative Tiled-authored tile animation renders (e.g. the campfire)
- Player renders and animates via a real normalized character spritesheet (directional walk-cycle + idle), not just a placeholder rectangle
- All driven by the local JSON fixture (no real backend)
- No dialogue/quests/XP UI yet — out of scope for this phase
