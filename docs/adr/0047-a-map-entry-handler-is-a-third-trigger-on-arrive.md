---
status: accepted (amends adr/0032: the handler index gains a third trigger; reopens the "no Map-entry handlers" line `docs/spec/clsc.md` left out of v1)
---

# A Map-entry handler is a third trigger, `on arrive(<map id>)`

A Script bound to a Map runs when the Player arrives on that Map through a Portal: `on arrive(school) { … }`. The id is the Map's id, its `.tmj` file name without the extension. `arrive` is a third trigger in the handler index `adr/0032` keys by (trigger, id), next to `interact` and `enter`, and like them it keeps its own namespace, so a Map, an Entity and a Zone may share an id. The Host starts it from the `transitioned` Engine Event, once the Engine on the target Map is playing, so a run moves the Engine the Player now stands in. Game boot is not an arrival: the start Map's handler doesn't run when a session starts. There is no Host-side seen gate, unlike a Zone (`adr/0018` as amended by `adr/0030`): the handler runs on every arrival, and a Script that should play once gates itself on a Flag or plays a once-only Cutscene. `crpg publish` warns, as it does for the other two triggers, when the id names no Map of the World.

A Zone entered while an arrival's run is in flight is dropped. It doesn't end the arrival, start its own Script or count as seen, so walking into it again later plays it. Without this, a Spawn Point inside a Zone would cut the arrival off a frame after it starts, since spawning inside a Zone counts as entering it (`adr/0022`), even when that Zone was seen long ago or has no Script. An Interaction still ends an arrival, as it ends any handler, because only the Player's own deliberate action triggers one.

The bytecode's trigger list is positional, so `arrive` is appended at the end and the format version goes up.

## Considered Options

- **Fold it into `enter`, treating a whole Map as one implicit Zone.** Rejected for the reason `adr/0019` kept `zoneEntered` apart from `transitioned`: crossing into a Map and walking into a region inside one are different concepts, and a shared namespace would let a Zone and a Map with the same id collide.
- **`on map(<id>)` or `on transition(<id>)`.** Rejected. `map` reads as a noun, not an event. A Transition is the movement between Maps, not the arrival the handler is about.
- **Let any Zone entry end an arrival, as it ends other handlers (`adr/0030`).** Rejected because of the Spawn Point case above. Ending it only when the Zone starts its own Script was also rejected: an unseen scripted Zone at the Spawn Point would still cut the arrival off.
- **A Host-side seen gate like a Zone's.** Rejected. Nothing asks for one yet, and Flags and once-only Cutscenes already let a Script decide for itself.
