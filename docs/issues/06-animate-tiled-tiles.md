# 06: Animate Tiled-authored per-tile tiles (e.g. campfire)

**What to build:** Any tile on a rendered Map that carries Tiled's per-tile `animation` metadata plays back automatically while that Map is showing — cycling through its authored frames at their configured durations, exactly as Tiled previews it. This is generic (not campfire-specific), Engine-owned, and unconditional — no World Config involvement. See `docs/adr/0003-animate-tiles-by-cycling-tilemap-index.md` for the rendering mechanism.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Loading a Map with a Tiled-authored per-tile `animation` block (e.g. `main_test.tmj`'s campfire) shows the tile cycling through its authored frames, not a static first frame
- [x] Playback timing matches each frame's configured duration from Tiled (not hardcoded to the campfire's 100ms)
- [x] Works generically for any tile carrying animation metadata, not hardcoded to the campfire/`animationObject` tileset
- [x] No World Config involvement — animated tiles always play, same as static tiles and collision
