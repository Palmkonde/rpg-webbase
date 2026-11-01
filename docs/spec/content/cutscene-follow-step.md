# Cutscene Follow Step & Cutscene-Driven Zone Entries

Confirmed 2026-09-30 via grilling session. Resolves issue #28's unsettled stop condition and supersedes #28 itself: one generic Follow step covers both "an NPC follows the Player" and "the Player follows an NPC". Also fixes a pre-existing interaction between Cutscene-driven Player movement and Zones that the Follow step would otherwise make more common. See `GLOSSARY.md`'s new **Follow step** entry and amended **Zone** entry, `adr/0025-follow-step-starts-and-moves-on-instead-of-holding-the-cutscene.md`, `adr/0027-the-player-trails-the-leaders-footsteps-other-followers-chase.md`, and `adr/0026-zone-entries-are-dropped-while-the-engine-is-paused.md`.

## Problem Statement

A Cutscene can only walk a character to a fixed tile, one at a time. A content author who wants the Player to trail an NPC through a scene, or an NPC to trail the Player, has to hand-author every tile of both walks as separate, sequential Movement steps. That can't look like one character following another, because only one of them moves at a time.

Separately, when a Cutscene walks the Player across a Zone, that Zone's Script runs in the middle of the Cutscene. If it produces a Cutscene of its own, it takes over playback: the original Cutscene waits forever on a click it never gets, and the Player is unfrozen while the original Cutscene is still on screen.

## Solution

A Cutscene gains a **Follow step**: one character (the *follower*, the Player or a Character Entity) keeps trailing another (the *leader*) at a gap the Cutscene chooses (empty tiles between them, default 0: right behind the leader). The Cutscene doesn't wait on a Follow step; it goes straight to the next step, usually a Movement step that walks the leader, and the follower trails along. A follow ends when its Cutscene ends, or earlier when the follower is given its own Movement step. The Guard demo Cutscene shows both directions.

Zones now react only to the Player's own movement. While the Engine is paused (a Cutscene or CG has control), Zone entries are dropped, not saved for later. The Zone's seen-Flag stays unset, so walking into it later still sets it off.

## User Stories

1. As a content author, I want one Cutscene step that makes one character follow another, so that I can stage "follow me" scenes without hand-authoring both characters' walks tile by tile.
2. As a content author, I want the same Follow step to work with the Player as follower and an NPC as leader, so that a Cutscene can lead the Player somewhere.
3. As a content author, I want the same Follow step to work with an NPC as follower and the Player as leader, so that an NPC can trail the Player during a scene.
4. As a content author, I want a Follow step to take any Character Entity as the leader, not just the Player, so that two NPCs can walk together too.
5. As a content author, I want the Cutscene to continue to the next step right after a Follow step, so that I can walk the leader in the next step while the follower trails behind.
6. As a content author, I want to choose how many empty tiles the follower keeps between itself and the leader, so that a scene can read as a loose escort or a close tail.
7. As a content author, I want the gap to default to 0 (right behind the leader, grid-engine's own default) when I don't set it, so that the common case needs no options.
8. As a content author, I want a follow to end automatically when its Cutscene ends, so that I never have to remember a cleanup step.
9. As a Player, I want to never be left trailing an NPC after a Cutscene hands control back, so that my own input is the only thing moving me.
10. As a content author, I want giving the follower its own Movement step to end its follow, so that I can switch a character from following to walking somewhere specific without a separate stop step.
11. As a content author, I want a follow started before a Choice hands off to another Cutscene to keep going through that Cutscene and end when the original Cutscene ends, so that branching doesn't cut a follow short.
12. As a content author, I want a Follow step whose leader isn't on the current Map (or is a Prop Entity) to warn in the console and be skipped, like a failed Movement step, so that a typo doesn't hang or crash the Cutscene.
13. As a Player, I want the Guard demo to show me following the Guard on a loop and then the Guard following me, so that both directions are proven in the running game.
14. As a Player, I want the Guard to talk like a smug, bratty kid (kusogaki) during that demo, so that the demo has some character.
15. As a Player, I want a Zone to trigger only when I walk into it myself, so that a Cutscene walking me across a Zone doesn't interrupt that Cutscene.
16. As a Player, I want a Zone that a Cutscene walked me across to still trigger later when I walk into it myself, so that I don't miss its scene just because a Cutscene passed through first.
17. As a Player, I want to not trigger a Zone just because a Cutscene left me standing inside it, so that a Zone always means "I walked in here".
18. As a Player, I want a Zone's Script to never take over a Cutscene that's already playing, so that I'm never stuck frozen or unfrozen in the middle of a scene.
19. As a Map author, I want Zone behavior during Cutscenes to be the same no matter whether a Movement step or a Follow step moved the Player, so that I don't have to think about which one a Cutscene uses.
20. As a Host developer, I want Zone entries during a pause to be filtered out before they reach me, so that the Host needs no "is something playing?" check of its own.
21. As a Host developer, I want spawning inside a Zone right after the boot CG to still fire it (ADR-0022), so that this change doesn't break the arrival trigger.
22. As a future maintainer, I want it recorded why a Follow step doesn't wait while every other Cutscene step does (ADR-0025), so that I don't "fix" it into a step that hangs forever.
23. As a future maintainer, I want it recorded why Zone entries during a pause are dropped instead of queued or nested (ADR-0026), so that I don't reintroduce either alternative without knowing why they were rejected.
24. As a future maintainer, I want it recorded that there's no explicit stop-follow step on purpose, so that I know it's a deferred option, not an oversight.
25. As a QA reviewer, I want the rule "every follow a Cutscene started stops when it ends" covered by an automated test, so that it can't silently regress.

## Implementation Decisions

- **Terminology**: **Follow step**, with *follower* and *leader*, is new in `GLOSSARY.md`. *Target* stays reserved for a Movement step's destination tile. **Zone**'s entry now says only the Player's own movement counts.
- **Scope**: Cutscene-only. No out-of-Cutscene follow or escort mechanic.
- **Step shape**: a new Cutscene step kind alongside Dialogue, Choice, and Movement, carrying the follower's charId, the leader's charId, and a gap. The Cutscene builder gains a `follow(follower, leader, options?)` method next to `moveTo`. When `gap` isn't set, the builder fills in 0, so the step list always has an explicit gap. (The default was first set to 1; a manual playtest showed a one-tile gap didn't read as following, so it now matches grid-engine's own default.)
- **Gap semantics**: the number of empty tiles between follower and leader. For a Character Entity follower it passes straight to grid-engine's `follow` `distance` option (verified in grid-engine's code: `distance: 0` ends adjacent, `distance: 1` leaves one empty tile). For a Player follower it's the number of the leader's footsteps the Player stays behind along the route.
- **Follow style depends on the follower** (`adr/0027`): a Character Entity follower uses grid-engine's `follow`, a shortest-path chase. A Player follower replays the leader's exact footsteps: the Engine records each tile the leader leaves (on grid-engine's `positionChangeFinished`, because the exit tile stays blocked until then) and walks the Player into them one at a time. Added after a manual playtest showed a chasing Player cutting inside the Guard's loop and blocking it.
- **Runner**: the Follow step doesn't wait (ADR-0025). The runner calls the Engine's follow and advances right away. The step-runner reducer gets its own completion event for a started follow, so a Follow step advances only on that event, like every other step kind.
- **Ending a follow**: there is no stop step. The Cutscene player records every follower it started and stops each one's movement when that Cutscene ends, normally or not. A Choice hand-off plays the next Cutscene nested inside the original, so a follow started before the hand-off lasts until the original Cutscene ends. A Movement step on the follower also ends the follow. For a chasing Character Entity, grid-engine does that itself by replacing the character's movement. For a trailing Player, the Engine cancels the trail on any Movement step or stop, because a trail isn't a grid-engine movement (`adr/0027`).
- **Engine surface**: the Engine handle gains a way to start a follow (follower, leader, gap) and a way to stop a character's movement, wrapping grid-engine's `follow`/`stopMovement` for a Character Entity follower and the Engine's own footstep trail for a Player follower (Engine-owned Host-commanded movement lives in its own engine-core module, not the Scene). Starting a follow whose follower or leader isn't a registered character on the current Map warns in the console and does nothing, matching how a failed `moveTo` warns and moves on.
- **Testability of the Cutscene player**: `playCutscene` can take a step registry, using the `registry` parameter `resolveCutscene` already has, so tests can run it against fake steps and fake callbacks.
- **Demo**: the existing `guard-walk` Cutscene grows into the proof. The Guard taunts, the Player follows the Guard around a loop of Movement steps back to the Guard's start, the Guard gives the lead to the Player, the Guard follows the Player while the Player walks to a tile (both at the default gap), and the Guard gloats. The Guard's lines are kusogaki-style: cocky and bratty. Loop corner and destination tiles are picked at implementation time from collision-free tiles near the Guard.
- **Zone entries while paused** (ADR-0026): the Engine doesn't emit `zoneEntered` while `setPaused(true)` is in effect. The entry is dropped, not queued, and no `runOnce` Flag is set, so the Zone stays available. Nothing is re-checked on unpause: a Player left standing inside a Zone sets it off only by walking out and back in (the existing outside→inside rule). The boot CG plays before the Engine exists, so spawn-inside-a-Zone on Map load (ADR-0022) is unaffected. Dialogue doesn't pause the Engine (ADR-0011), so Zones still fire while Dialogue is showing.
- **No contract changes beyond the above**: World Config, the Tiled Map format, and the shape of the `zoneEntered` Engine Event are unchanged. Only when `zoneEntered` is emitted changes.

## Testing Decisions

- Follows the existing pattern (`node:test`/`node:assert/strict`, pure inputs and outputs, hand-written fakes, no mocking framework). Tests assert what a caller sees (steps produced, callbacks invoked, Promise resolution), not internal state.
- **Cutscene builder** (existing seam, alongside `cutscene.test.ts`'s `moveTo` tests): `follow()` builds a Follow step with the given follower and leader, applies the default gap of 0 when unset, carries a given gap unchanged, and chains in order with `say`/`moveTo`/`choice`.
- **Step-runner reducer** (existing seam, alongside `cutscene-runner.test.ts`): a Follow step advances on its own completion event and ignores advance-click, move-finished, and choice-picked, the same way the existing per-kind tests do.
- **Cutscene player** (new seam): `playCutscene` run against a test registry and fake callbacks. Assertions:
  - a Follow step invokes the follow callback and the next step starts without waiting for anything;
  - every follower started is stopped once the Cutscene's `done` resolves;
  - a follow started before a Choice hand-off is still running during the handed-off Cutscene, and is stopped only when the original Cutscene ends;
  - the pause flag is set at the start and cleared at the end.
- **Manual verification** (not automatable here, per `CLAUDE.md`):
  - the `guard-walk` demo plays with the Player visibly trailing the Guard's loop directly behind, then the Guard trailing the Player directly behind;
  - control returns with nobody still following;
  - a Follow step naming a missing leader logs a warning and the Cutscene carries on;
  - a Cutscene walking the Player across a Zone doesn't trigger it, and walking into that Zone afterward does;
  - spawning inside a Zone after the boot CG still fires it.
- The Engine-side Zone guard and follow/stop wrappers have no pure logic worth extracting, so they get no unit tests of their own.

## Out of Scope

- **An explicit stop-follow step**: no scene needs to stop a follow mid-Cutscene yet. Add it when one does; ADR-0025 doesn't change.
- **Follow outside Cutscenes** (escort or companion mechanics during normal play). (No longer deferred — see [Companion: A Character Entity That Keeps Following the Player](companions.md).)
- **Queueing or nesting a Zone's Script that was entered during a Cutscene**: dropped by design (ADR-0026).
- **Other follow options grid-engine offers** (`closestPointIfBlocked`, `facingDirection`, path-length limits): grid-engine's defaults are used.
- **Camera changes**: the camera keeps following the Player sprite whether or not the Player is a follower.

## Further Notes

- Supersedes issue #28: once the implementing ticket is filed, #28 is closed with a comment linking it.
- Supersedes "CG & Cutscene"'s Out of Scope bullet on continuous `follow()` behavior, and "Entity Rendering"'s bullet on #28's stop-condition design, both updated to point here.
- The Zone change fixes a bug that already exists with plain Movement steps (`moveTo` on the Player). It ships as its own ticket, independent of the Follow step.
- Verified against grid-engine 2.52.1's installed API during grilling: `follow` returns `void` and never completes, which is why ADR-0025 exists.
