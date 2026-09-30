# Guard Companion: open design questions

**Purpose:** Idea: after the `guard-walk` Cutscene, offer a Choice that makes the Guard keep following the Player after the Cutscene ends. Before it can be specced and ticketed, these design questions need answers.

**From:** Claude, **To:** Palm (future self), **How your answers will be used:** fed into a `/grill-with-docs` round, then `/to-spec` and `/to-tickets` as a new feature.

## Context

The Follow step (#35) only exists inside a Cutscene, and every follow ends when its Cutscene ends (ADR-0025). A following Player replays the leader's footsteps, and a following Character Entity chases by grid-engine's shortest path (ADR-0027). A Guard that follows *after* a Cutscene is a companion or escort mechanic, which #35 ruled out of scope. Constraints that shape it:
- A Map transition remounts the whole Engine (ADR-0005).
- The Guard is authored only on `main_test.tmj` (ADR-0024).
- Flags are in-memory only, so a page refresh resets them.
- The Engine already exposes `follow` and `stopMovement` on its handle.

## How to answer

No deadline. Answer before starting this feature. Each question has a recommended answer (➡️) you can accept with "yes". Partial answers and "not sure" are fine: flag them rather than skipping.

## Scope

### Should this be its own ticket, separate from #35?

➡️ Recommended: separate. #35 is finished and closed on its own; this becomes a new spec section and ticket.

>

### What does "forever" mean?

- (a) Until the Player leaves this Map. On return, the Guard is back at its post.
- (b) Across every Map, like a party member. This needs the Guard to exist on Maps it wasn't authored on, a large change to World Config and ADR-0024.
- (c) For the page session, remembered by a Flag, and restarted whenever the Guard's Map loads.

_Why this matters: (b) is several times bigger than (a) or (c) and reopens an ADR._

➡️ Recommended: (a) plus a Flag. The Choice sets a Flag such as `guard_following`, and whenever the Guard's Map loads with that Flag set, the Guard starts chasing the Player again.

>

## Behaviour

### Can the Player ever make the Guard stop following?

_Why this matters: a follower that can never be dismissed can trap the Player in narrow corridors._

➡️ Recommended: yes. Talking to the following Guard offers "Stop following me", which clears the Flag and stops the follow.

>

### Which follow style does the Guard use?

➡️ Recommended: the same as Cutscenes, a shortest-path chase at the default gap 0 (ADR-0027). An NPC trailing the Player's exact footsteps isn't needed.

>

### Can Cutscenes still move the Guard while it's following?

For example, a later Cutscene gives the Guard a Movement step while it's chasing the Player.

➡️ Recommended: yes. A Cutscene step overrides the chase, and the chase resumes when the Cutscene ends if the Flag is still set.

>

## Ownership

### Who starts a follow outside a Cutscene?

- (a) The Host calls the Engine's `follow` directly whenever the Flag is set, including on every Map load.
- (b) A new World Config field lists which Entities follow the Player.

➡️ Recommended: (a). Whether the Guard follows is Host game state, and the Engine doesn't need to know why a character is following.

>

### What should the glossary call a character that follows outside a Cutscene?

_Why this matters: "follower" already means the role inside a Follow step, so reusing it would blur the two._

➡️ Recommended: **Companion**, a Character Entity that chases the Player outside any Cutscene.

>

## Anything else?

Anything this idea needs that isn't asked above? For example, should the Companion be a Guard-only demo or a reusable mechanic, and should it survive a page refresh once Flags are durable?

>
