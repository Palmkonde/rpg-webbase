# 17: Dialogue choices nest into a tree

**What to build:** A choice's outcome can offer another round of choices instead of ending the exchange, and re-interacting with a Scripted Entity always restarts its Dialogue from the top — proving Dialogue can be a multi-level tree, not just one flat round.

**Blocked by:** 16

**Status:** ready-for-agent

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts: Choices, Speakers & Localization" section (Implementation Decisions: Choice nesting, Branch reconvergence, Dialogue position on re-interact).

- [ ] A choice's outcome can return another set of choices via the same builder, so a Script can express a multi-level branching tree
- [ ] Two branches that reconverge on the same continuation content share it via a plain TypeScript function/closure — no dedicated "gather"/merge-point builder primitive is added
- [ ] A Script always runs from the top on every `interacted`/`transitioned` event; no "current node" is persisted per Student per Script
- [ ] The `ScriptBuilder`'s nested-choice output is unit-tested (`node:test`)
- [ ] Manually verified: interact with a Scripted Entity, pick a choice that leads to another round of choices, walk away mid-tree (move the Player away or interact with something else), interact again, and confirm the conversation restarts from the top — report the result before ticking boxes or committing
