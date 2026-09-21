# 08: Normalize Temmie as prep for the missing-direction convention

**What to build:** A hand-normalized version of the already-downloaded Temmie sheet, demonstrating the rule for source sheets missing real directional art — duplicate an available direction's frames into the missing slots. This is asset prep only: it's ready for whenever NPC/Entity rendering is built, but not wired into the running Engine yet (the Engine has no Entity rendering to attach it to — see `docs/spec/spec.md`'s "Explicitly out of scope / deferred").

**Blocked by:** None (can start immediately; independent of 07)

**Status:** done

**Architecture note:** see `docs/adr/0006-normalize-downloaded-character-sheets-into-grid-engines-canonical-layout.md`.

- [x] Temmie's normalized spritesheet exists under `assets/sprites/characters/temmie/`, alongside the original raw download
- [x] The normalized sheet matches grid-engine's canonical directional-grid layout
- [x] Directions Temmie has no real art for are filled by duplicating an available direction's frames, not synthesized (e.g. mirrored) or left blank
- [x] Not wired into any Engine code or spawned anywhere — purely asset prep

**Notes:**
- Temmie's real frame size is 32x32 (not derivable from `characters.ts` since this character isn't wired in yet — see `docs/guides/character-spritesheet-layout.md` for how this was measured).
- Three files under `assets/sprites/characters/temmie/`, not two, because the colleague-supplied download turned out to be a labeled preview screenshot (purple background, captions like "Idle/Talk"/"hOIVS"/"Walk (UNUSED)" baked into the pixels) rather than usable transparent-background art:
  - `source-download.png` — the true, unprocessed original as supplied (168x280). Kept only for provenance/re-cropping; not usable directly (opaque background, baked-in UI text).
  - `raw.png` — a hand-cleaned derivative of it (transparent background, UI chrome cropped out); this is `raw.*` in ADR-0006's sense, and what `temmie.png` was built from.
  - `temmie.png` — the normalized canonical-grid output.
- `raw.png`'s real art is a 3-col x 4-row grid of 32x32 frames in its top-left corner (rest of its 168x280 canvas is empty padding). It arrives already in canonical row order with the missing-direction duplication done: row 0 (down) and row 1 (left) are one pose repeated, row 2 (right) and row 3 (up) are a second, distinct pose repeated. `temmie.png` is a straight trim of that 96x128 content region — no re-duplication or row rebuilding performed here; the ADR-0006 duplication this ticket demonstrates was already applied when `raw.png` was assembled.
- `assets/` is gitignored (see root `CLAUDE.md`) — all three PNGs above are on disk but not tracked by git, same as `fluffy.png` from ticket 07.
- Added a repo-root `flake.nix` (Nix dev shell providing ImageMagick) as reusable tooling for this and future normalization tickets — this repo has no prior Nix usage; flagging in case it warrants an ADR (ADR-0006 review flagged this as a judgement call, not a hard requirement).
