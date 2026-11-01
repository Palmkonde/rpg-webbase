# CG & Cutscene

Confirmed 2026-09-23 via grilling session. Resolves the blocker "Dialogue Scripts" left open (`adr/0011`): a Host→Engine pause channel now exists, so a Script can finally take control away from the Player. See `GLOSSARY.md`'s "Content" vocabulary (**Cutscene**, **CG**, and updated **Script**/**Dialogue** entries) and `adr/0016-host-engine-pause-channel-is-a-single-imperative-flag.md` / `adr/0017-cutscene-gets-its-own-step-runner.md` for the two architectural calls below.

## Problem Statement

Dialogue never takes control from the Player and never moves anyone — by design (`adr/0011`). That's fine for ordinary conversation, but it can't deliver either of the two things this project's reference points (Undertale, RPG tutorial sequences) rely on: a full-screen illustrated intro shown before the Player ever takes control, and an in-world scene where an NPC interaction genuinely stages something (the Player frozen, a character walking into position, dialogue playing out) rather than just another dialogue box the Player can idly walk away from mid-read. There's also no mechanism at all for "show this once and never again" — every existing Dialogue simply re-runs from the top on every interaction.

## Solution

Two new, independent content types, both gated by the existing Flag mechanism so each plays at most once per Student:

- **CG**: a full-screen illustrated slideshow — static art and captions the Player advances by clicking, and can skip entirely — shown independent of any Entity (its first use is the game's intro at boot).
- **Cutscene**: a Script that takes control away from the Player for its duration, playing an ordered sequence of Dialogue, Choice, and Movement steps, triggered the same way Dialogue is (an NPC Interaction).

Both route through one shared helper that checks the Student's Flags, skips if already seen, and marks the Flag on completion — "don't replay" is automatic, not something each caller has to remember. Making Cutscene's Player-freeze possible required the Host→Engine pause channel `adr/0011` deliberately deferred; that channel is built here as the smallest thing that satisfies it (`adr/0016`).

## User Stories

1. As a Player, I want to watch an intro CG when the game starts, so that the story is set up before I take control, matching the reference points (Undertale) this project is aiming for.
2. As a Player, I want to click to advance the CG's frames, so that I move through the slideshow at my own pace instead of waiting on a timer.
3. As a Player, I want to skip the CG entirely, so that a restarted session doesn't force me to sit through the same intro every time.
4. As a Player, I want a CG I've already seen to not play again, so that it never interrupts a later session.
5. As a content author, I want a CG's captions to resolve through the same locale string table Dialogue already uses, so that a CG's narration is translatable the same way Dialogue text is.
6. As a content author, I want a CG's art stored independently of the character-spritesheet pipeline, so that full-screen illustrations aren't forced through machinery built for animated walk-cycle sheets.
7. As a Host developer, I want `playCG(id)` callable from anywhere, not hardcoded to game boot, so that a future CG (an ending, a mid-game reveal) doesn't require re-plumbing this mechanism.
8. As a Player, I want interacting with an NPC that has a Cutscene to freeze my character and let the scene play out, so that a tutorial or story beat reads as a real cutscene, not just another dialogue box I can walk away from.
9. As a Player, I want an NPC to be able to walk toward me during a Cutscene, so that a scripted interaction can feel staged rather than static.
10. As a Player, I want a Cutscene that's already played to not play again, so that re-interacting with the same NPC afterward doesn't repeat the scene.
11. As a content author, I want a Cutscene to mix Dialogue lines, Choices, and forced Movement in one sequence, so that I can author a scene richer than plain back-and-forth dialogue.
12. As a content author, I want a Cutscene's Choices to work exactly like Dialogue's existing Choices (branch, write Flags), so that I don't have to learn a second choice mechanism.
13. As a content author, I want to move a character to a specific point during a Cutscene without hand-authoring a walk animation, so that staging a scene needs no new art or a scripting language of its own.
14. As a content author, I want a Movement step to target either the Player or another map Entity, so that a Cutscene can move the Player into position, an NPC toward the Player, or both.
15. As a Map author, I want to add a Cutscene-triggering NPC using the exact same Tiled convention Dialogue-triggering Entities already use (Class = Entity, an `entityId` property), so that I don't learn a second Map-authoring convention just because this Entity happens to drive a Cutscene.
16. As a content author, I want a Cutscene triggered by the same Interaction event Dialogue already uses, so that adding one doesn't require a new kind of Map trigger.
17. As a Host developer, I want `playCutscene`/`playCG` to both route through one shared "already seen?" check, so that "don't replay" behavior is automatic and can't be forgotten by a future cutscene's author.
18. As a Host developer, I want the seen-flag to live in the same Flag store Dialogue already uses, so that cutscene state doesn't need a second persistence mechanism.
19. As an Engine developer, I want a single `setPaused` boolean the Host can flip, so that "the Player can't act right now" has one source of truth instead of every input handler needing its own special case.
20. As an Engine developer, I want `handleMovementInput` and `handleInteractInput` to both check that same pause flag, so that a paused Cutscene can't be interrupted by walking away or opening another Dialogue.
21. As a content author, I want forced Movement to reuse grid-engine's own pathfinding (`moveTo`), so that staged movement looks like normal walking (same animation, same collision-awareness) instead of a custom teleport or slide.
22. As a future maintainer, I want it recorded that continuous NPC-follows-Player behavior (grid-engine's `follow`) was considered and deferred, so that I don't assume it's already supported when a future Cutscene actually needs it.
23. As a future maintainer, I want it recorded that Flags remain in-memory-only for this feature (a page refresh still resets "seen" state), so that I treat a lost cutscene flag as a known, pre-existing limitation, not a new bug.
24. As a future maintainer, I want it recorded why Cutscene needed its own step-runner instead of reusing Dialogue's rendering, so that I don't try to "simplify" it back into Dialogue's one-shot model (`adr/0017`).
25. As a future maintainer, I want it recorded why the Host→Engine pause channel is a single imperative flag rather than a World Config field, so that I understand it was a deliberate call, not an oversight (`adr/0016`).
26. As a Host developer, I want the Cutscene step-runner to be a pure function, so that its sequencing logic (what comes next given an event) is verifiable without a running Phaser instance.
27. As a Host developer, I want the CG slideshow's stepping to be a pure function, so that its advance/skip logic is verifiable without a running Phaser instance.

## Implementation Decisions

- **Terminology**: "CG" and "Cutscene" are the two content types, matching the split `GLOSSARY.md`/this spec already reserved for them (see "Dialogue Scripts" Out of Scope, now resolved here).
- **CG pacing**: the Player advances frames by clicking, and can skip the whole CG via a separate control — a pure "slideshow stepper" function (given the current frame index and an advance/skip event, returns the next frame index or `done`).
- **CG content**: captions/narration resolve through the existing locale string table (same `resolveLine` mechanism Dialogue uses); art resolves through a Portrait-style decoupled asset registry (same pattern as `adr/0014`, keyed by an arbitrary per-frame id, no relationship to the character-spritesheet pipeline).
- **CG trigger**: `playCG(id)` is a general primitive callable from anywhere; the only caller this round is game boot (the intro).
- **Cutscene freeze**: for its duration, the Player is fully frozen — both movement and interact input are disabled via the new Engine `setPaused` flag (`adr/0016`).
- **Cutscene composition**: an ordered sequence of steps of three kinds — Dialogue lines, Choices (reusing the existing `Choice`/`Choice.next?` type as-is, no new branching shape), and Movement. `ScriptBuilder` grows a `.moveTo()`-style step alongside its existing `say()`/`choice()`.
- **Movement steps**: wrap grid-engine's existing `moveTo(charId, targetPos)` — one-shot, resolves via its own completion signal, no custom pathfinding built. Can target the Player or any map Entity (any `charId`). Continuous following (grid-engine's `follow`) is not used this round.
- **Cutscene trigger**: reuses the existing `interacted` Engine Event and the entityId → Script lookup convention Dialogue already uses — a Cutscene is one more thing an Entity's Script file can produce. `playCutscene(id)` itself stays a general primitive (callable from anywhere), but NPC-interact is the only caller wired up this round; no new trigger types are built.
- **Cutscene execution model**: a new Host-side sequential step-runner — a pure reducer that, given the current step and a completion event (advance-click, choice-picked, move-finished), decides the next step, holding execution at each step until it resolves. This does not reuse Dialogue's one-shot render (`adr/0017`); Dialogue and `Choice.next?` are unchanged.
- **Shared "don't replay" helper**: both `playCG(id)` and `playCutscene(id)` route through one `runOnce(id, playFn)`-style helper: checks `ctx.flags` for that id's seen-flag, skips (does nothing) if already set, otherwise runs `playFn` and marks the flag on completion. This is the one place "already seen" logic lives.
- **Flag storage**: one boolean per CG/Cutscene id, stored in the existing Flag store (`ctx.flags`) — same shape and mechanism as every other Flag, no schema change. Flags stay in-memory-only, matching their current (pre-existing) behavior — this feature doesn't make them durable.
- **New Engine surface**: a single imperative `setPaused(bool)` call, checked at the top of both `handleMovementInput` and `handleInteractInput` before either reads input (`adr/0016`). No other Engine surface changes — World Config, Engine Events, and the Tiled Map format are all unchanged.

## Testing Decisions

- Matching the existing pattern (`node:test`/`node:assert/strict`, pure functions only, no mocking framework): the Cutscene step-runner, the CG slideshow-stepper, the `runOnce` flag-gate helper, and the extended `ScriptBuilder`'s Movement-step output all get unit tests.
- **Cutscene step-runner**: given a step list and a sequence of completion events (advance-click, choice-picked, move-finished), asserts the resulting step-index progression and the terminal `done` state, including an event that doesn't match the current step's expected completion (ignored, not advanced).
- **CG slideshow-stepper**: given the current frame index and an advance/skip event, asserts the next frame index or `done`.
- **`runOnce`**: given a Flags object and an id, asserts an already-seen id skips without invoking `playFn`, and a not-yet-seen id invokes `playFn` and sets the flag — alongside `flags.ts`'s existing tests.
- **`ScriptBuilder` Movement output**: does chaining `.moveTo(...)` alongside `.say()`/`.choice()` produce the right step list — same pattern as the existing Dialogue/Choice builder-output tests.
- Everything past those seams — the pause flag actually disabling input in a running Scene, grid-engine's `moveTo` actually walking a sprite, the CG slideshow actually rendering full-screen art and timing correctly on screen, the dialogue overlay actually freezing during a Cutscene — isn't automatable here (no e2e/browser automation, per `CLAUDE.md`) and is verified manually: trigger a test Cutscene via NPC interact and confirm the Player freezes, an NPC walks to the Player's position, Dialogue plays, and re-interacting afterward does nothing (flag already set); watch the CG intro at boot and confirm clicking advances frames, skip jumps straight to gameplay, and it doesn't replay on a second boot within the same session (Flags being in-memory means a full page refresh does reset it — expected, not a bug).

## Out of Scope

- **Continuous `follow()` behavior** (an NPC that keeps tracking the Player rather than walking to a fixed point) — grid-engine has this, but it's a real feature with its own stop-condition design; this round's Movement step is one-shot `moveTo` only. (No longer deferred — see [Cutscene Follow Step & Cutscene-Driven Zone Entries](cutscene-follow-step.md).)
- **Making Flags durable across a page refresh** — pre-existing limitation (Flags are in-memory today), not this feature's problem to fix; a separate, generically useful ticket if it's ever needed.
- **New trigger types beyond NPC-interact** (an item-pickup trigger) — `playCutscene`/`playCG` are generic enough to support one later, but none is built or wired up this round. (A zone-entered trigger is no longer deferred — see [Zone: Walking Into a Region Triggers a Script](../world/zones.md).)
- **A replay/gallery mode for already-seen CG/Cutscenes** — "seen" is a one-way, permanent Flag this round; no UI or mechanism to re-watch.
- **Camera control during a Cutscene** (pans, zoom changes) — not requested; Movement covers character position only.
- **CG's per-frame art production workflow** — this section confirms CG reuses the Portrait-style decoupled asset registry pattern, not the specifics of producing that art.

## Further Notes

- Supersedes "Dialogue Scripts"' Out of Scope bullet on CG/cutscene and "Explicitly out of scope / deferred"'s matching line in [README.md](../README.md#explicitly-out-of-scope--deferred) — both are updated to point here.
- See `adr/0016-host-engine-pause-channel-is-a-single-imperative-flag.md` for the pause-channel decision and `adr/0017-cutscene-gets-its-own-step-runner.md` for why Cutscene doesn't reuse Dialogue's rendering.
- `GLOSSARY.md` gained **Cutscene** and **CG** as part of this round; `Script`'s and `Dialogue`'s entries were updated to reflect that Cutscene is now a real, designed concept rather than "not-yet-designed."
