# 16: Dialogue choices write multiple Flags and can be hidden or disabled

**What to build:** A Dialogue choice can set more than one Flag as its outcome, can be hidden entirely until a Flag condition is met, or shown-but-disabled with a reason the Player sees if they try to pick it anyway.

**Blocked by:** 14

**Status:** done

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts: Choices, Speakers & Localization" section (Implementation Decisions: Choice shape).

**Implementation notes:** the spec's "Flag-based" condition isn't a new predicate/expression type — per ADR-0009 (plain TypeScript, not a parsed DSL), `visible`/`enabled` are plain `boolean`s the Script author evaluates against `ctx.flags` before calling `.choice()`, the same way `CampFire.ts` already branches its `say()` text. Also: `ScriptBuilder.build()` keeps every choice in `Dialogue.choices`, conditions and all — `visible: false` choices are *not* dropped from the array. "Omitted from the rendered list" happens at render time in `DialogueOverlay`, which is why the checklist's third box (builder output unit-tested) and last box (rendering behavior manually verified) are two different seams, not one.

- [x] A `.choice()` step accepts a `visible` condition (Flag-based); when false, the choice is omitted from the rendered list entirely — `dialogue-overlay.tsx`'s `visibleChoices` filters on `choice.visible !== false` at render time
- [x] A `.choice()` step accepts an `enabled` condition plus a `disabledReason`; when false, the choice renders but isn't selectable, and attempting to pick it surfaces the reason instead of applying any outcome — `dialogue-overlay.tsx`'s `handleChoiceClick` shows `choice.disabledReason` and returns before calling `onChoose` when `choice.enabled === false`
- [x] A `.choice()` step's outcome can write a set of Flags (not just one), superseding ticket 14's single-Flag scope — `script.ts`'s `ChoiceOptions.flags` is a full `Flags` patch, applied via `game-canvas.tsx`'s `selectChoice` calling `flagStore.setFlags(currentStudentId, choice.flags)`
- [x] The `ScriptBuilder`'s output (Flag-writes, `visible`/`enabled` conditions) is unit-tested (`node:test`) — `scripts.test.ts`
- [x] Manually verified: interact with a Scripted Entity offering choices where one is hidden until a Flag is set, one is visible-but-disabled and shows its reason on click, and one sets two Flags at once — report the result before ticking boxes or committing — manually verified by the user: confirmed all three scenarios against the `CampFire` demo entity
