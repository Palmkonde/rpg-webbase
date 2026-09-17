# 08: Normalize Temmie as prep for the missing-direction convention

**What to build:** A hand-normalized version of the already-downloaded Temmie sheet, demonstrating the rule for source sheets missing real directional art — duplicate an available direction's frames into the missing slots. This is asset prep only: it's ready for whenever NPC/Entity rendering is built, but not wired into the running Engine yet (the Engine has no Entity rendering to attach it to — see `docs/spec/spec.md`'s "Explicitly out of scope / deferred").

**Blocked by:** None (can start immediately; independent of 07)

**Status:** ready-for-agent

**Architecture note:** see `docs/adr/0006-normalize-downloaded-character-sheets-into-grid-engines-canonical-layout.md`.

- [ ] Temmie's normalized spritesheet exists under `assets/sprites/characters/temmie/`, alongside the original raw download
- [ ] The normalized sheet matches grid-engine's canonical directional-grid layout
- [ ] Directions Temmie has no real art for are filled by duplicating an available direction's frames, not synthesized (e.g. mirrored) or left blank
- [ ] Not wired into any Engine code or spawned anywhere — purely asset prep
