# CG & Cutscene as Script Output

Confirmed 2026-09-27 via grilling session. Extends [CG & Cutscene](cg-and-cutscene.md): that section gave CG exactly one caller (game boot) and left Cutscene's own trigger to issues #25-28. This section makes both reachable from the one place all other Entity-driven content already lives — a Script — closing the gap the user found missing from the issue tracker. See `GLOSSARY.md`'s updated **Script**, **Cutscene**, and **CG** entries and `adr/0018-script-output-generalizes-to-a-discriminated-union.md` for the return-type decision below.

## Problem Statement

CG's only trigger is game boot; Cutscene has no trigger at all yet. Meanwhile an Entity's Script can only ever produce Dialogue — there's no way for an NPC interaction to lead into a full-screen CG (an ending, a reveal) or hand off into a Cutscene, even though spec's own Cutscene design already says a Cutscene should be "one more thing an Entity's Script file can produce." Content authors have no way to reach for CG or Cutscene from the one mechanism every other Entity-driven moment already goes through.

## Solution

A Script's return type generalizes from `Dialogue` alone to a discriminated union that also covers a CG or Cutscene trigger. The Host inspects which one came back and dispatches accordingly: a `Dialogue` renders as it does today, a CG trigger calls the existing `playCG(id)` primitive unchanged, and a Cutscene trigger reserves the same shape for issues #25-28's `playCutscene(id)` to fulfill once built. Whichever of the two plays, the Player is frozen automatically via the existing `setPaused` flag (`adr/0016`), the same freeze Cutscene's own design already specifies. `ScriptBuilder` is untouched — it stays purpose-built for accumulating Dialogue lines and choices; a Script produces a CG/Cutscene trigger by returning a plain object directly, bypassing the builder for that case.

## User Stories

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
12. As a Host developer, I want this scoped to Entity-interaction Scripts only this round, so that Map-entry Scripts (ticket #13, since built as `on arrive` handlers — `adr/0047`) aren't entangled with this change — they inherit the same capability automatically once they exist, since the mechanism doesn't care which Engine Event invoked the Script.
13. As a Host developer, I want `GameCanvas`'s currently boot-only CG state (hardcoded to one id) generalized to track whichever CG is currently active, so that a mid-game CG with a different id doesn't collide with or get blocked by the boot CG's own state.
14. As a future maintainer, I want it recorded why Script's return type is a discriminated union rather than an imperative `playCG`/`playCutscene` call from inside a Script, so that I don't try to "simplify" it into a side-effecting call later (`adr/0018`).
15. As a future maintainer, I want it recorded why `ScriptBuilder` didn't grow `.playCG()`/`.playCutscene()` methods, so that a future contributor doesn't add them expecting builder parity (`adr/0018`).
16. As a future maintainer, I want it recorded that a Cutscene trigger is a forward-reference — `playCutscene` itself doesn't exist yet — so that I don't expect a Script returning one to actually play anything until issues #25-28 land.
17. As a future maintainer, I want it recorded that CG and Cutscene are now distinguished purely by structure (Cutscene has Dialogue/Choice/Movement steps; CG has none), not by trigger source, so `GLOSSARY.md`'s entries read consistently with what the code now allows.
18. As a future maintainer, I want it recorded that a Script-triggered CG/Cutscene still plays at most once per Student, like boot's CG already does, so the "don't replay" behavior (`runOnce`, issue #24) is understood to apply uniformly once it's built, regardless of trigger source.
19. As a QA reviewer, I want the existing Dialogue-only test suite (`scripts.test.ts`) to keep passing unmodified after this change, so that generalizing Script's return type is proven backward compatible, not just forward compatible.
20. As a content author, I want at least one real Entity Script to demonstrably return a CG trigger under some condition, so the mechanism is proven end-to-end the same way ticket 19's `resolveLine` call in `CampFire.ts` proved locale resolution end-to-end.

## Implementation Decisions

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

## Testing Decisions

- Matching the existing pattern (`node:test`/`node:assert/strict`, no mocking framework): reuse `runEntityScript`'s existing seam and test file (`scripts.test.ts`) rather than introduce a new one.
- **Backward compatibility**: every existing `scripts.test.ts` test (asserting `Dialogue` shape) must keep passing unmodified — `Dialogue` remains a valid `ScriptResult` variant.
- **New coverage at the same seam**: given the demo Entity Script's Flag-gated branch, `runEntityScript` surfaces a `CgTrigger` verbatim (`{ type: 'cg', id }`), asserted the same way existing tests assert `Dialogue` shape.
- No new tests needed for `playCG`/`resolveCg`/`resolveCgArt`/`stepCgSlideshow` — that seam is unchanged and already covered from the prior round.
- Everything past this seam — `game-canvas.tsx` actually calling `playCG`/`playCutscene` off the returned type, the Player actually freezing via `setPaused`, a Script-triggered CG actually rendering full-screen — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: interact with the demo Entity under the Flag condition that returns a `CgTrigger`, confirm the CG plays full-screen, confirm the Player can't move or interact until it's skipped or finished, and confirm normal gameplay resumes afterward.

## Out of Scope

- `playCutscene(id)` and the Cutscene step-runner itself — issues #25-28.
- Map-entry Scripts triggering a CG/Cutscene — no longer deferred: ticket #13 built Map-entry Scripts as `on arrive` handlers (`adr/0047`), which play CGs and Cutscenes like any other handler.
- `runOnce`/"don't replay" flag-gating — issue #24. A Script-triggered CG plays at most once per Student in principle, same as boot's, but the shared gating helper isn't built in this round either.
- `ScriptBuilder` gaining `.playCG()`/`.playCutscene()` terminal methods — explicitly rejected, see `adr/0018`.
- A Script calling `playCG`/`playCutscene` imperatively as a side effect — explicitly rejected, see `adr/0018`.

## Further Notes

- Supersedes [CG & Cutscene](cg-and-cutscene.md)'s framing of CG as "shown independent of any Entity" / "isn't triggered by an Interaction" — `GLOSSARY.md`'s CG entry was already updated this round to describe the CG/Cutscene split as structural only.
- `GLOSSARY.md`'s **Script** entry was updated this round to read "producing Dialogue, a Cutscene, or a CG."
- See `adr/0018-script-output-generalizes-to-a-discriminated-union.md` for the return-type decision and its rejected alternatives.
