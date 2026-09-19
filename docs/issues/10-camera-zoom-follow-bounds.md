# 10: Camera Zoom, Follow, and Per-Map Bounds

**What to build:** The main camera zooms in on the Map and follows the Player as they move, staying within the currently-loaded Map's own edges so it never scrolls into empty space beyond the Map.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Architecture note:** see `docs/adr/0007-scale-canvas-with-phaser-fit-and-fixed-camera-zoom.md` and the "Canvas & Camera Scaling" section of `docs/spec/spec.md`.

- [ ] Main camera zoom is set to a fixed factor of 2 after the Map loads
- [ ] Camera follows the Player sprite with a centering offset as they move
- [ ] Camera bounds are computed from the loaded Map's own pixel dimensions (via a new pure `computeCameraBounds` function) and set on the camera, so it never scrolls past the Map's edges
- [ ] `computeCameraBounds` has unit tests (`node:test`) covering at least a typical Map and an edge case (e.g. a Map smaller than the viewport)
- [ ] Zoom/follow/bounds re-establish correctly after a Map transition (edge-walk or Portal), since the Host remounts the Engine on transition
- [ ] Manually verified in the running app (walk the Player to each edge of the Map and confirm the camera stops rather than showing void; confirm tiles read at a comfortable, non-blurry size) — this repo has no e2e automation, so report the manual check's result before ticking boxes or committing
