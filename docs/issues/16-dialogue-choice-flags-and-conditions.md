# 16: Dialogue choices write multiple Flags and can be hidden or disabled

**What to build:** A Dialogue choice can set more than one Flag as its outcome, can be hidden entirely until a Flag condition is met, or shown-but-disabled with a reason the Player sees if they try to pick it anyway.

**Blocked by:** 14

**Status:** ready-for-agent

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts: Choices, Speakers & Localization" section (Implementation Decisions: Choice shape).

- [ ] A `.choice()` step accepts a `visible` condition (Flag-based); when false, the choice is omitted from the rendered list entirely
- [ ] A `.choice()` step accepts an `enabled` condition plus a `disabledReason`; when false, the choice renders but isn't selectable, and attempting to pick it surfaces the reason instead of applying any outcome
- [ ] A `.choice()` step's outcome can write a set of Flags (not just one), superseding ticket 14's single-Flag scope
- [ ] The `ScriptBuilder`'s output (Flag-writes, `visible`/`enabled` conditions) is unit-tested (`node:test`)
- [ ] Manually verified: interact with a Scripted Entity offering choices where one is hidden until a Flag is set, one is visible-but-disabled and shows its reason on click, and one sets two Flags at once — report the result before ticking boxes or committing
