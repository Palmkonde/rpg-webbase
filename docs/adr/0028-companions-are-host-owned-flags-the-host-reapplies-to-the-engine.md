---
status: accepted (amended by adr/0030: re-applied at unfreeze and after a Companion Flag write outside a freeze; amended by adr/0038: the client also dismisses a Companion whose mover or Entity is gone after a re-Publish)
---

# Companions are Host-owned Flags that the Host re-applies to the Engine

A Companion is a Character Entity that keeps chasing the Player outside any Cutscene, for as long as a Flag says so. Its state is a single Host Flag, `companion:<entityId>`, whose value is the Companion's `characterId` (for example `companion:Guard = 'fluffy'`), and `false` once dismissed. A Script sets it (for example through a Choice's Flag writes), and the Host's dismiss button clears it. The Engine never tracks Companions itself.

A Companion's chase is fragile: a Cutscene stops every follower it started when it ends (`adr/0025`), a Movement step on the Companion replaces its chase, and a Map transition remounts the Engine (`adr/0005`). So one Host function re-applies the Companion Flags to the Engine: `follow(companion, player, 0)` for each active Companion (grid-engine's shortest-path chase, `adr/0027`) and `stopMovement` for a dismissed one. The Host calls it when the Engine finishes loading a Map, after any Script finishes, and when the dismiss button is clicked. We rejected having the Engine re-follow its Companions whenever the pause lifts. A Companion recruited mid-Map would be unknown to the Engine until the next remount, because World Config only changes then, so that option would need an "add Companion" call as a second route for the same state.

Carrying a Companion onto a Map it isn't authored on (a later change, after Map transitions exist) goes through World Config, the Engine's single input: a `companions` list of entity id plus Character, placed next to the Player's Spawn Point, with a Companion's own Tiled placement skipped (provisional). The Character lives in the Flag's value rather than being read from the home Map's Tiled file, so the Engine never loads a Map it isn't showing. The cost is that a Script author writes the `characterId` a second time.

A Companion doesn't block the Player, so it can't trap them in a corridor. It isn't interactable. The dismiss button is the only way to dismiss it, and it's hidden while the Engine is paused, so a dismiss can't cut off a Cutscene's Movement step.
