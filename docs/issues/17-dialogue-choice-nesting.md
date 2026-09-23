# 17: Dialogue choices nest into a tree

**What to build:** A choice's outcome can offer another round of choices instead of ending the exchange, and re-interacting with a Scripted Entity always restarts its Dialogue from the top — proving Dialogue can be a multi-level tree, not just one flat round.

**Blocked by:** 16

**Status:** done

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts: Choices, Speakers & Localization" section (Implementation Decisions: Choice nesting, Branch reconvergence, Dialogue position on re-interact).

**Implementation notes:** a `.choice()` outcome nests by taking an optional `next?: Script` (the same `Script = (ctx: ScriptContext) => Dialogue` type a top-level Script already has, per ADR-0009's plain-TypeScript premise) — `script.ts`'s `ChoiceOptions.next`. `game-canvas.tsx`'s `selectChoice` applies the choice's Flag-writes, then, if `next` is present, re-reads Flags and calls `choice.next(ctx)` to produce the following round's `Dialogue` instead of closing the overlay; a bug thrown by `next` is caught and logged as `'Script failed:'` (matching how `runEntityScript`'s own Script bugs are logged), kept separate from the `'Failed to persist Flags:'` catch so the two failure modes aren't conflated. `CampFire.ts` gained a demo nested round (`campFireMemories`) reachable from "Ask what the campfire has seen", whose two choices both point at the same `campFireMemoryEnding` closure to demonstrate reconvergence.

- [x] A choice's outcome can return another set of choices via the same builder, so a Script can express a multi-level branching tree — `ChoiceOptions.next?: Script`, threaded through by `game-canvas.tsx`'s `selectChoice`
- [x] Two branches that reconverge on the same continuation content share it via a plain TypeScript function/closure — no dedicated "gather"/merge-point builder primitive is added — `CampFire.ts`'s `campFireMemories` choices both pass `next: campFireMemoryEnding`
- [x] A Script always runs from the top on every `interacted` event; no "current node" is persisted per Student per Script — already true of `runEntityScript`/`handleEvent`, which re-runs the Script from scratch on every `interacted` event and unconditionally overwrites whatever `Dialogue` (including a mid-tree one) was showing. (`transitioned` doesn't trigger a Script yet — that's ticket 13, not in scope here; the same restart-from-top mechanism will apply once it's wired.)
- [x] The `ScriptBuilder`'s nested-choice output is unit-tested (`node:test`) — `scripts.test.ts`: nested tree, branch reconvergence (shared function reference), and a three-level-deep tree
- [x] Manually verified: interact with a Scripted Entity, pick a choice that leads to another round of choices, walk away mid-tree (move the Player away or interact with something else), interact again, and confirm the conversation restarts from the top — confirmed by the user against the `CampFire` demo entity: nested round reachable via "Ask what the campfire has seen", both its choices reconverge on the same ending line, and re-interacting after walking away mid-tree restarts from the top
