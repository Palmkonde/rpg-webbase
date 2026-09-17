# 04: Portal Transition

**What to build:** A Portal object authored on a Map that, when the Player touches it, transitions them to a specific target Map and Spawn Point — independent of walking off a Map edge.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] A Portal object can be authored in Tiled with a target Map and target Spawn Point
- [ ] The Player touching a Portal triggers a Transition to that target Map/Spawn Point
- [ ] The Engine emits the same shape of Transition Engine Event as the edge-walk case (a Portal is just another trigger for the same Transition mechanism)
- [ ] At least one Portal is wired up between two of the existing Maps as a demo
