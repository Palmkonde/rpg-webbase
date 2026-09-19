# 09: Responsive Canvas via Phaser Scale.FIT

**What to build:** The game canvas fills the browser window instead of a hardcoded 640×480 box — it scales via Phaser's FIT mode against a 960×540 (16:9) base resolution, so resizing the browser window resizes the canvas to match with no manual reload, and there's no upper size cap.

**Blocked by:** None (can start immediately)

**Status:** done

**Architecture note:** see `docs/adr/0007-scale-canvas-with-phaser-fit-and-fixed-camera-zoom.md` and the "Canvas & Camera Scaling" section of `docs/spec/spec.md`.

- [x] Phaser game config sets `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }` with a 960×540 base width/height
- [x] The Host-side canvas container fills the space available in its page instead of a hardcoded fixed size
- [x] Resizing the browser window resizes the canvas to match, with no manual reload needed
- [x] On a widescreen (16:9-ish) window, the canvas fills edge-to-edge with no letterbox bars
- [x] On an unusually-shaped window, the canvas letterboxes rather than distorting or cropping the world
- [x] No maximum-size cap — the canvas keeps growing to fill very large/ultrawide windows
- [x] Manually verified in the running app (resize the browser window to a few different shapes/sizes) — this repo has no e2e automation, so report the manual check's result before ticking boxes or committing
