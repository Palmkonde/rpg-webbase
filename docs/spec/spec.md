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

Confirmed 2026-09-19 via grilling session, following investigation of overlap with `issues/05-entity-interaction-hook.md`. See `CONTEXT.md`'s "Content" vocabulary (Script, Dialogue, Flag) and `adr/0008` through `adr/0011` for the rationale behind each architectural call below. See "Dialogue Scripts: Choices, Speakers & Localization" below for how choices, Speaker, and localization extend this.

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

- **CG (full-screen illustration) and cutscene** (a Script taking control away from the Player) — needs a Host→Engine imperative pause/resume channel that doesn't exist and isn't being built this round (`adr/0011`). Blocked on this Dialogue Script slice landing first.
- **Raw per-step (`moved`) or tile/zone-entered Script triggers** — no concrete need yet, and a zone trigger needs a new authored Map-object type that doesn't exist.
- **entityId→script lookup table** — only needed if one Script must serve multiple Entities; not built until that's a real case.
- **Full quest/variable/inventory modeling** — Flags stay a flat key/value store, matching Phase 1's existing "no quests/XP UI yet" boundary. (Reaffirmed in "Dialogue Scripts: Choices, Speakers & Localization" below, including Flag arithmetic specifically.)
- **Ink language integration** — stays separately deferred (see below); this Script system is the general dispatch shell Ink could plug into later, not a replacement for it. (See also `adr/0013` — non-programmer *text editing* is solved separately via a string table; only non-programmer *branching authorship* would actually reopen this.)
- **Pausing/disabling Player movement while Dialogue is shown** — accepted v1 rough edge, not solved here.

### Further Notes

- See `adr/0008` for why this is Host-side rather than Unity-style Engine-side scripting.
- This is the first content built on top of ticket 05/03's events; the ticket-dependency shape (state-collection ticket blocking the dialogue-script ticket, which is blocked by 05 and 03) is for `/to-tickets` to formalize, not fixed here.

## Dialogue Scripts: Choices, Speakers & Localization

Confirmed 2026-09-20 via grilling session, following `docs/research/dialogue-and-choice-script-functionality.md`'s primary-source survey of dialogue/choice systems (Ink, Yarn Spinner, Ren'Py, RPG Maker MZ). Extends "Dialogue Scripts" above: choices grow from a flat, single-Flag round (ticket 14's original scope) into a nested tree with multi-Flag writes, and Dialogue gains a per-line Speaker. See `CONTEXT.md`'s "Content" vocabulary (Script, Dialogue, **Speaker**, Flag) and `adr/0013-dialogue-localization-is-a-string-table-not-a-reopened-adr-0009.md` for the localization rationale. ADR-0009 and ADR-0011 are both reaffirmed, not reopened.

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
13. As a future maintainer, I want it recorded that Flags stay arithmetic-free and quest/item-free even though the student-state model will eventually need both, so that I don't "helpfully" widen Flag into something `CONTEXT.md`'s glossary already says to avoid.
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
- `CONTEXT.md`'s "Content" section gained a new **Speaker** term as part of this round.
- This section's scope (tree-shaped choices, multi-Flag writes, Speaker, locale string table) supersedes ticket 14's original flat/single-Flag/no-Speaker assumptions for whatever ticket(s) `/to-tickets` produces from this section — ticket 14 itself, if already in flight or done, is not retroactively rewritten.

## Dialogue Portraits & Expressions

Confirmed 2026-09-20 via grilling session, following up on "Dialogue Scripts: Choices, Speakers & Localization"'s deferred Portrait/Expression item. See `CONTEXT.md`'s "Content" vocabulary (Speaker, **Portrait**, **Expression**) and `adr/0014-dialogue-portraits-are-a-standalone-asset-type.md` for why Portrait storage is independent of the existing character-spritesheet pipeline (`adr/0006`).

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
- `CONTEXT.md`'s "Content" section gained **Portrait** and **Expression** as part of this round.
- This section supersedes "Dialogue Scripts: Choices, Speakers & Localization"'s Out of Scope note that backlogged Portrait/expression art — that item is now scoped here.

## Dialogue Line Pacing

Confirmed 2026-09-23 via grilling session, following up on ticket 18's Speaker work (see "Dialogue Scripts: Choices, Speakers & Localization" above). This section is Host-side overlay rendering/interaction only: no `CONTEXT.md` vocabulary changes and no `docs/adr/` changes accompany it — evaluated explicitly during grilling and found unnecessary, since this isn't a new cross-cutting Script/Dialogue/Speaker/Flag domain concept, nor does it touch the Engine. `adr/0011-dialogue-v1-does-not-pause-the-player.md` is reaffirmed, not reopened: Dialogue still never blocks the Player, it simply paces its own reveal at the Player's click.

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
16. As a future maintainer, I want it recorded that this feature needed no `CONTEXT.md` or ADR changes, so that a future reader doesn't go looking for a Speaker/Dialogue vocabulary shift or an Engine-contract decision that doesn't exist here.
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
- No `CONTEXT.md` or `docs/adr/` changes accompany this section — evaluated during grilling and found unnecessary (see this section's opening note).

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
10. As a repo maintainer, I want cross-Map duplicate detection available as a script I run on demand, so that I can validate the whole Map catalog without it slowing down routine `npm test`/`lint`.
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
- **Cross-Map check**: a new standalone dev script (outside the `engine-core` package) reads every Map in the maps catalog, calls `collectEntities` per Map, concatenates every Map's `entityId`s, and calls `findDuplicates` over the combined list; for any duplicate, reports which Maps it spans. Run manually, not wired into `npm test`/`npm run lint`.
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
- Turning the per-Map duplicate check into a hard error, or wiring the cross-Map dev script into `npm test`/`lint` — both stay warnings/manual-run for now.
- Any change to the `EngineEvent`/`InteractedEvent` contract itself — `entityId`'s *value* now comes from a different Tiled field, but its type and meaning on the Engine↔Host boundary are unchanged.

### Further Notes

- Ticket 05's own in-flight engine-core code needs a small follow-up against this section before that ticket is done: switching `collectEntities` from `name` to the `entityId` property, and adding the `findDuplicates`-backed warning.
- See `adr/0012` for the full rationale and rejected alternatives (single-layer-only kept, tile-paint-based auto-entities, `name`-as-id kept, Engine-side cross-Map fetching).

## Explicitly out of scope / deferred

- **Quests, XP, inventory, progression rules** beyond the Flags described above — these belong to the Host/main-repo backend, not the Engine, and Flags themselves stay a flat key/value store, not a full progression system.
- **Ink language integration** for dialogue authoring — skip until needed, not designed now; the Dialogue Scripts system above is a separate, general dispatch mechanism Ink could plug into later, not a replacement for it.
- **NPC/Entity sprite rendering** — the Engine has no visual representation for an Entity at all yet (ticket 05 is position + interaction-event only, no sprite). The character-animation mechanism above is deliberately generic so it can cover this later without new Engine code, but the actual wiring is deferred until Entity rendering itself is designed and built.
- **CG/cutscene, non-Interaction/Map-entry Script triggers, entityId→script lookup tables** — see Dialogue Scripts' own Out of Scope above.
- **Flag arithmetic, a Script→Host side-effect channel, timed/auto-advancing choices, a Player-facing locale switcher** — see "Dialogue Scripts: Choices, Speakers & Localization"'s own Out of Scope above.
- **Portrait art normalization pipeline, Portrait animation, and any tie-in to NPC/Entity sprite rendering** — see "Dialogue Portraits & Expressions"'s own Out of Scope above (Portrait/Expression itself is no longer deferred — it's scoped there).

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
