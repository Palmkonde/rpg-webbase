# 07: Player renders and animates via a normalized character spritesheet

**What to build:** Arrow-keying the Player around a Map shows a real, directionally-animated character — walk-cycle in all 4 directions, idle when stopped — instead of the current placeholder rectangle. If the real texture fails to load, the Player still renders (falls back to the existing placeholder) and a console warning names the missing texture key, so a broken asset reference is never silent.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Architecture note:** see `docs/adr/0006-normalize-downloaded-character-sheets-into-grid-engines-canonical-layout.md` and the "Player animation & character assets" section of `docs/spec/spec.md`.

- [ ] A normalized character spritesheet ("John") exists under `assets/sprites/characters/john/`, alongside the original downloaded file, matching grid-engine's canonical directional-grid layout
- [ ] The Player spawns using this spritesheet instead of the placeholder rectangle
- [ ] Moving in each of the 4 directions plays that direction's walk-cycle; releasing movement shows that direction's idle/standing frame
- [ ] The sprite renders at the spritesheet's native pixel size — no artificial scale factor applied
- [ ] If the real texture fails to load, the Player falls back to the existing placeholder rectangle and a console warning names the missing texture key
- [ ] Manually verified in the running app (arrow keys in all 4 directions, plus a deliberately broken texture path) — this repo has no e2e automation, so report the manual check's result before ticking boxes or committing
