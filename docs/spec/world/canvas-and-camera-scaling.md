# Canvas & Camera Scaling

## Problem Statement

The game canvas is a fixed, hardcoded 640×480 box that never adapts to the browser window, and its 32×32px tiles read as cramped in a viewport that size. There's no camera behavior at all — no zoom, no following the Player — so the game always looks small regardless of the player's screen, and any Map bigger than the tiny fixed viewport can't be tracked around.

## Solution

The canvas fills the browser window via Phaser's `Scale.FIT` (scaling a 960×540, 16:9 base resolution, so it doesn't letterbox on typical widescreen monitors), and the camera zooms in 2x and follows the Player as they move, bounded to the currently-loaded Map's own edges so it never scrolls past the Map into empty space.

## User Stories

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
11. As a Player transitioning between Maps (through a Portal), I want the camera to re-center correctly on the new Map, so the view doesn't carry over stale bounds/position from the Map I just left.
12. As an Engine developer, I want camera bounds computed automatically from each Map's own pixel dimensions, so adding a new Map never requires manually configuring its camera.
13. As an Engine developer, I want zoom to be a single Engine-wide constant, so I don't need to tune it per Map.
14. As an Engine developer, I want the camera-bounds calculation available as a pure, unit-testable function, so I can verify it without a browser or a running Phaser instance.
15. As an Engine developer, I want the responsive canvas sizing to require no per-transition or per-Map handling code, so it keeps working automatically as Maps are added.
16. As a Map author, I want to know the effective viewport size at the standard zoom (roughly 480×270 world units), so I can author Maps that fill the frame edge-to-edge when that matters.
17. As a Map author, I want a Map smaller than the viewport to still render correctly (camera just clamps/centers), so small test Maps stay usable during development.
18. As a Host integrator, I want the canvas container to fill the space its parent page gives it instead of being a hardcoded fixed-size box, so the Engine visually integrates into whatever layout the Host provides.
19. As a developer verifying this ticket, I want a manual checklist confirming resize/zoom/follow/bounds behavior in the running app, so the ticket can be marked done despite this repo having no browser automation.

## Implementation Decisions

- Phaser game config gains a `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }` block. The base `width`/`height` change from reading the container's `clientWidth`/`clientHeight` at construction time (640×480 fallback) to a fixed 960×540 (16:9) virtual resolution — FIT scales that fixed buffer to whatever the container becomes, so a live container size is no longer needed at construction.
- The Host-side canvas container drops its hardcoded fixed-size style in favor of filling the space available in its parent page, with no maximum-size cap.
- After the tilemap is created, the Scene sets a fixed zoom of 2 on the main camera, calls `startFollow` on the Player sprite with a centering offset (per Grid Engine's documented convention), and sets camera bounds from the just-loaded tilemap's own pixel dimensions.
- `computeCameraBounds(mapWidthInPixels, mapHeightInPixels)` is a pure function in engine-core's existing `util` module, returning the rectangle passed to `camera.setBounds(...)`. A dedicated `camera` module was tried first but dropped in code review as speculative generality — the function has no branching logic to justify its own module, unlike `tile-animation`'s `stepAnimation`.
- Zoom (2) and base resolution (960×540) are fixed Engine-wide constants for this round, not exposed via World Config — Hosts and Map authors don't configure camera behavior per Map.
- No changes to World Config, Engine Events, or the Tiled Map format — this is purely how the existing Map/Player render on screen.
- Camera setup re-runs on every Scene `create()`, which already happens on every Map transition (the Host remounts on transition per `adr/0005-host-remounts-on-transition-instead-of-engine-scene-switch.md`) — so zoom/follow/bounds re-establish automatically per Map with no additional transition-handling code.
- See `adr/0007-scale-canvas-with-phaser-fit-and-fixed-camera-zoom.md` for the FIT-vs-RESIZE-vs-ENVELOP and fixed-zoom-vs-variable-resolution rationale.

## Testing Decisions

- Good tests here assert the observable output of pure functions, not Phaser/Scene internals — matching the existing pattern in `packages/engine-core/test/` (`node:test` + `node:assert/strict`, no mocking framework, e.g. `tile-animation.test.ts`'s tests of `stepAnimation`).
- `computeCameraBounds` gets a unit test in `util.test.ts` alongside the module's other pure functions: given a Map's pixel width/height, it returns the expected `{x: 0, y: 0, width, height}` rectangle, including edge cases like a 1-tile Map and a very large Map.
- Everything past that seam — FIT actually resizing the canvas, zoom actually enlarging tiles, follow actually tracking the Player, letterbox/no-letterbox behavior across window shapes, and pixel-art crispness at large scale — isn't automatable in this repo (no e2e/browser automation exists, per `CLAUDE.md`) and is verified manually: resize the browser window and confirm no letterboxing on a widescreen display, walk the Player to a Map edge and confirm the camera stops rather than showing void, and confirm tiles read as a comfortable, non-blurry size.
- No new test infrastructure needed — reuses the `node:test` setup already wired for `packages/engine-core`.

## Out of Scope

- Map/world size changes — existing Tiled Maps are untouched; only how they're viewed changes.
- Sprite/tileset pixel-art scale factor — zoom is camera-level only, no asset-level scaling.
- A separate UI/HUD camera — no HUD exists yet, so there's nothing to isolate from world zoom; revisit when one is introduced.
- Per-Map or Host-configurable camera behavior — zoom and base resolution are fixed Engine-wide constants for this round.
- A maximum render-size cap for very large/ultrawide monitors — explicitly decided against for now (see ADR 0007); straightforward to add later if it proves necessary.
- Mobile/touch-specific responsive behavior — this addresses desktop browser window resizing only, consistent with the Engine's existing desktop-first, keyboard-only movement scope.
- Any change to the Engine/Host contract (World Config, Engine Events) — purely a rendering/viewport concern internal to the Engine.

## Further Notes

- See `adr/0007-scale-canvas-with-phaser-fit-and-fixed-camera-zoom.md` for the full rationale and rejected alternatives.
- Future Maps intended to fill the frame edge-to-edge at the standard zoom should be authored at roughly 480×270 world units or larger; smaller Maps still render correctly (camera bounds just clamp/center) but won't fill the screen edge-to-edge.
