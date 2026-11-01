# Companion: A Character Entity That Keeps Following the Player

Confirmed 2026-09-30 via grilling session. Picks up "Cutscene Follow Step"'s deferred "Follow outside Cutscenes" item. See `GLOSSARY.md`'s new **Companion** entry and `adr/0028-companions-are-host-owned-flags-the-host-reapplies-to-the-engine.md`. Builds on the Follow step (`adr/0025`, `adr/0027`).

## Problem Statement

A Follow step ends when its Cutscene ends, so a character can never keep the Player company during normal play. A content author who wants an NPC to join the Player, like a Guard who says "fine, I'll tag along", has no way to do it: once the Cutscene hands control back, the NPC stops where it is.

## Solution

A Script can turn any Character Entity into a **Companion**: it keeps chasing the Player outside any Cutscene for as long as a Flag says so. The Flag's value is the Companion's Character, so it's remembered across Map transitions. A Companion never blocks the Player. The Player can dismiss it with a button in the corner, which is hidden while a Cutscene or CG is playing. A Companion can't be talked to. The `guard-walk` Cutscene ends with a Choice that can recruit the Guard as the demo.

A Companion comes along to every Map the Player walks onto (#38), carried by World Config.

## User Stories

1. As a content author, I want a Script to turn a Character Entity into a Companion, so that an NPC can join the Player after a scene.
2. As a content author, I want recruiting a Companion to be an ordinary Flag write (for example from a Choice), so that I don't learn a new Script mechanism.
3. As a content author, I want any Character Entity to be able to become a Companion, not just the Guard, so that the mechanic is reusable.
4. As a Player, I want a recruited Companion to keep following me after the Cutscene ends, so that it feels like it joined me.
5. As a Player, I want a Companion to walk right behind me, so that it reads as following me.
6. As a Player, I want a Companion to never block my path, so that it can't trap me in a corridor or dead end.
7. As a Player, I want a Companion to still walk around walls rather than through them, so that it stays believable.
8. As a Player, I want a Companion to pick up following me again after a Cutscene moves it or stops it, so that a scene doesn't quietly make it leave.
9. As a Player, I want a button to dismiss a Companion, so that I can choose to go on alone.
10. As a Player, I want the dismiss button to name the Companion, so that I know which one I'm dismissing.
11. As a Player, I want a dismissed Companion to stop right away and go back to blocking me like any other character, so that dismissing is immediate and clear.
12. As a Player, I want the dismiss button hidden while a Cutscene or CG is playing, so that I can't break a scene halfway through.
13. As a Player, I want the Guard demo to end with "Follow me forever" or "Nah, stay here", so that recruiting is my choice.
14. As a Player, I want picking "Nah, stay here" to leave the Guard at its post, so that declining really declines.
15. As a Player, I want a Companion to come with me when I walk onto another Map, so that "forever" really means forever.
16. As a Player, I want a Companion to appear next to me on each new Map, so that it's there as soon as I arrive.
17. As a Host developer, I want Companion state to live in the existing Flag store, so that it needs no new persistence.
18. As a Host developer, I want one function that re-applies Companion Flags to the Engine, so that "is it following right now?" is decided in one place.
19. As a Host developer, I want that function called when a Map finishes loading, after any Script finishes, and on dismiss, so that every way a chase can be lost is covered.
20. As a Host developer, I want the Engine handle to be usable as soon as `createEngine` resolves, so that the first sync can't reach grid-engine before the Map Scene exists.
21. As an Engine developer, I want the Engine to never track whether a character is a Companion, so that its only new surfaces are a generic "does this character block other characters" toggle and World Config's `companions` list.
22. As a future maintainer, I want it recorded why the Host, not the Engine, re-applies Companions (`adr/0028`), so that I don't move it into the Engine and lose Companions recruited mid-Map.
23. As a future maintainer, I want it recorded that a Companion's Character is written twice (Tiled and the Flag value), so that I know it's a deliberate trade for never loading an unshown Map.
24. As a future maintainer, I want it recorded that talking to a Companion is a future feature, so that I don't treat the missing Interaction as a bug.
25. As a QA reviewer, I want the Flag-to-Engine sync covered by automated tests, so that recruiting and dismissing can't silently break.

## Implementation Decisions

- **Terminology**: **Companion**, new in `GLOSSARY.md`. The Follow step's *follower* role stays Cutscene-only.
- **State** (`adr/0028`): one Flag per Companion, `companion:<entityId>`. Its value is the Companion's `characterId` string while it's a Companion, and `false` once dismissed. There is no other Companion state. Flags are still in-memory, so a page refresh resets Companions. That limitation already exists and isn't this feature's to fix.
- **Recruiting**: a Script writes the Flag. In the demo, a Choice's existing Flag writes set `companion:Guard = 'fluffy'`. The Script author writes the Character a second time; it's already in Tiled.
- **Sync Companions**: one Host function takes the current Flags and the Engine handle. For each `companion:*` Flag holding a Character, it makes that character stop blocking other characters and starts `follow(entityId, player, 0)`. For each one set to `false`, it restores blocking and calls `stopMovement`. It ignores every other Flag. A Companion whose character isn't on the current Map is skipped, using the Engine's existing warn-and-skip behaviour.
- **When sync runs**: once the Engine has finished loading a Map, after every Script finishes (including Cutscenes, CGs and Dialogue Choices, since any of them can write Flags or move the Companion), and after a dismiss.
- **Engine readiness**: `createEngine` resolves only once the Map Scene has been created, so the handle's movement calls are safe to use straight away.
- **Blocking**: the Engine handle gains one generic call that sets whether a character blocks other characters, wrapping grid-engine's collision groups. While a Companion, the character collides with no other characters but still with walls. When dismissed, it goes back to the default group.
- **Chase style**: grid-engine's shortest-path `follow` at gap 0 (`adr/0027`). No new movement code.
- **Dismiss UI**: the Host overlay shows one "Dismiss <entityId>" button per active Companion, only while the Engine isn't paused. Clicking it sets the Flag to `false` and runs sync.
- **Not interactable**: a Companion can't be talked to, even on its home Map.
- **Demo**: `guard-walk` ends with a Choice: "Follow me forever" writes `companion:Guard = 'fluffy'`, and "Nah, stay here" writes nothing. `guard-walk` plays once, so this is the one chance to recruit the Guard.
- **Across Maps** (#38): World Config has a `companions` list (entity id plus Character) that the Host builds from the active Companion Flags on every mount, the first included. On load, the Engine places each one on the first free tile next to the Player's Spawn Point (down, left, right, up), or warns and skips if all four are blocked. The Companion's own placement in Tiled is skipped on its home Map; this rule is provisional.
- **Open question: dismissing away from home.** A Companion dismissed on another Map stays there only until the Player leaves. Next time the Player visits its home Map, it's back at its Tiled placement. Whether it should stay where it was dismissed is undecided.

## Testing Decisions

- Follows the existing pattern (`node:test`/`node:assert/strict`, hand-written fakes, no mocking framework). Tests assert what the fake Engine was asked to do, not how sync decides it.
- **Sync Companions** (new seam, same style as the `playCutscene` tests): given a Flags snapshot and a fake Engine handle that records calls, assert that:
  - a `companion:<id>` Flag with a Character makes that character non-blocking and starts it following the Player at gap 0;
  - a `companion:<id>` Flag set to `false` restores blocking and stops that character's movement;
  - Flags without the `companion:` prefix produce no Engine calls;
  - several Companions each get their own calls.
- **Manual verification** (not automatable here, per `CLAUDE.md`):
  - choosing "Follow me forever" at the end of `guard-walk` makes the Guard chase the Player once control returns;
  - the Player can walk through the Guard;
  - the Guard still goes around walls;
  - after another Cutscene moves the Guard, it resumes chasing;
  - "Dismiss Guard" is hidden during a Cutscene, and when clicked stops the Guard and makes it block again;
  - "Nah, stay here" leaves the Guard at its post.
- **Across Maps** (#38): the World Config seam (`resolveCompanions` pairs each Companion with its Character, and skips an unknown one), the neighbour order (`firstFreeNeighbour` tries down, left, right, up, and finds nothing when all four are blocked), building the `companions` list from Flags (`companionsOf`), and the session passing it on the first mount and on a Transition. Placing Companions and skipping their Tiled placement happen in the Phaser Scene and are verified manually.
- No tests for the call sites (Engine ready, after a Script, on dismiss), the Engine's blocking toggle (a thin grid-engine wrapper), or the Choice's Flag writes (the existing Choice path is already tested).

## Out of Scope

- **Talking to a Companion**: a future feature.
- **Durable Companions across a page refresh**: waits on durable Flags, which is a separate concern.
- **Companion-specific movement** (keeping a distance, trailing the Player's footsteps, formations): grid-engine's chase at gap 0 only.
- **A Companion limit or party UI**: any number of Companion Flags can be set; nothing caps or orders them.

## Further Notes

- Supersedes "Cutscene Follow Step & Cutscene-Driven Zone Entries"'s Out of Scope bullet on follow outside Cutscenes, which is updated to point here.
- A Companion never triggers Zones: Zone detection only watches the Player, and only the Player's own movement (`adr/0026`).
- `docs/ideas/to-questionnaire-guard-companion.md` was the questionnaire this grilling answered. It's deleted now that its answers live here and in `adr/0028`.
