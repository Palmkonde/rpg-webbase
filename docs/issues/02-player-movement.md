# 02: Player spawns and moves on the grid

**What to build:** A Player character appears on the rendered Map at its configured Spawn Point and can be moved around the Map's grid one cell at a time using the keyboard.

**Blocked by:** 01

**Status:** done

- [x] grid-engine is wired into the Engine for grid-based movement
- [x] The World Config's Spawn Point determines where the Player first appears
- [x] Arrow keys (or WASD) move the Player exactly one grid cell per press/hold, snapping to the grid
- [x] The Player cannot walk through tiles marked as blocked/collidable on the Map
