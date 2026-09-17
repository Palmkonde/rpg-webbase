# 05: Generic Entity interaction hook

**What to build:** A placeholder Entity placed on a Map that the Player can interact with, producing a generic Engine Event — with no dialogue/UI attached yet. Beyond the literal Phase 1 done-bar in docs/spec.md, but part of the Engine's overall MVP boundary; included here since it's cheap and doesn't depend on the Transition work in 03/04.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] An Entity object can be authored on a Map (position only — the Engine has no concept of what it represents)
- [ ] An interact input (e.g. a dedicated key) fires only when the Player is adjacent to/facing an Entity
- [ ] The Engine emits an Interaction Engine Event identifying which Entity was interacted with
- [ ] The Host does nothing with the event beyond observing/logging it — no dialogue UI is built here (placement of that UI is still an open question, see docs/spec.md)
