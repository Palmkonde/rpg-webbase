# Game Engine

A standalone module that renders a grid-based world and moves a Player through it, embedded by a Host application for RPG-style course gamification. The Engine owns rendering and movement only; all game content and progression logic belongs to the Host.

## Language

### Roles

**Engine**:
The framework-agnostic module in this repo that renders a Map and moves the Player through it, detecting Transitions and Interactions. It holds no state of its own — it receives a World Config and emits Engine Events.
_Avoid_: Game, frontend, client

**Host**:
The application that embeds the Engine, owns all state and game content (which Maps exist, dialogue, quests, progression), and reacts to the Engine's Events. In production it is backed by the main platform's database.
_Avoid_: App, backend, server

**Platform**:
The application a Student signs in to, which mounts the game and runs the game service alongside its own services. It owns sign-in, courses, and which World each Student may play, and vouches for who the Student is.
_Avoid_: Host (the application that embeds the Engine and reacts to its Events), LMS, CMS

**Game Service**:
The server a Platform deploys alongside its own services. It holds the Published Worlds and the Asset Library, and each Student's Flags, and serves them to the game.
_Avoid_: Backend, server, API

**Student**:
The real person playing, known to the game only by an opaque id the Platform vouches for. The game holds no account or profile of its own for them.
_Avoid_: User, account, Player (the Student's in-Engine representation)

**Author**:
Someone who writes Worlds or Asset Library art and Publishes them. Authoring is a separate role from playing: an Author is not a Student, and is not identified by one.
_Avoid_: Admin, creator, teacher

### World

**World**:
One course's whole bundle of game content: its Maps, Scripts, cast, String Table, and the art only it uses (its own tilesets, Portraits, CG art), loaded together when the game is mounted. Each Student's Flags belong to one World. A World can use art from the Asset Library without owning it.
_Avoid_: Campaign, game, course (a course is the platform's concept; which World a course shows is the platform's choice)

**Asset Library**:
Shared art, such as tilesets and Characters, that any World can use. It belongs to no single World.
_Avoid_: Shared assets, common pack

**Publish**:
Pushing a World's authored content, or Asset Library art, from an author's machine into the place the game loads it from. Only Published content is what Students play.
_Avoid_: Upload, deploy, sync

**World Version**:
The frozen copy of a World that one Publish of it produces. Exactly one World Version of each World is live; Students who start playing get the live one, and keep playing the one they started on even after a newer one goes live. A Student's Flags belong to the World, not to any one World Version.
_Avoid_: Release, build, revision

**Map**:
A single Tiled-authored area the Player walks around in, typically corresponding to one course module.
_Avoid_: Level, Scene (Phaser's own rendering-container concept, distinct from this domain's Map), World (a World holds many Maps)

**Player**:
The Student's in-Engine representation: grid-bound, rendered and moved by the Engine.
_Avoid_: Character (as a synonym for the Player role — a Player *has* a Character, see that entry, but isn't one), avatar, student (a Student is the real person; the Player is their in-Engine representation)

**Character**:
The animated sprite-sheet appearance a Player or Character Entity walks and idles with, always normalized to a fixed four-direction grid regardless of source art completeness (ADR-0006).
_Avoid_: Sprite, avatar

**Entity**:
An interactable object placed on a Map — an NPC, sign, item, etc. — that the Player can trigger an Interaction with. The Engine treats every Entity generically; what it represents narratively is the Host's concern. Every Entity is either a Character Entity or a Prop Entity, depending on whether it has a Character.
_Avoid_: NPC, object, actor

**Character Entity**:
An Entity that has a Character: registered and animated the same way the Player is, and eligible to be the target of a Cutscene's Movement or Follow step.
_Avoid_: NPC, movable Entity, animated Entity

**Mover**:
Anything a Cutscene can walk: the Player or a Character Entity. A Prop Entity or an unplaced narrator can be a Speaker but never a Mover.
_Avoid_: Actor, walker, Character (the appearance a Mover walks with, not the Mover itself)

**Companion**:
A Character Entity that keeps chasing the Player outside any Cutscene, on every Map the Player visits, for as long as a Flag says so. It never blocks the Player. The Player can dismiss it whenever they have control, but can't talk to it. Any Character Entity can become one; a Script decides when.
_Avoid_: Follower (the role inside a Follow step), party member, tagalong

**Prop Entity**:
An Entity with no Character: a fixed picture at a fixed Map position, drawn from the Tiled object's own tile — interactable, but never a Movement or Follow target.
_Avoid_: Static Entity, decoration

**Spawn Point**:
The Map coordinate the Player appears at on entering a Map, whether as a Map's default entry point or a Portal's target.
_Avoid_: Start position, entry tile

**Zone**:
A Tiled-authored rectangular region on a Map whose Script runs the moment the Player's position transitions into it — not an explicit action, unlike an Entity Interaction. Only the Player's own movement counts: a Player walked into a Zone by a Cutscene (a Movement or Follow step) doesn't trigger it, and that entry is dropped, not saved for later. Plays at most once per Student, gated by a Flag the Host keeps; it counts as played the moment its Script starts, even if the Player walks away partway through.
_Avoid_: Trigger area, collision box (this project has no pixel-level collision concept — the Player's position is always a single grid tile)

### Movement

**Transition**:
Movement of the Player from one Map to another, triggered either by walking off a Map's edge into an adjacent Map, or by touching a Portal.
_Avoid_: Warp, level change

**Portal**:
An object authored on a Map that triggers a Transition to a specific target Map and Spawn Point when the Player touches it.
_Avoid_: Door, warp point

### Contract

**World Config**:
The data the Host supplies to the Engine describing what to render in the live game: the active Map, and the Player's position and Character. Entities, Zones, and Portals are defined in the Map itself (in Tiled) and are always live once their Map loads, not gated by World Config (ADR-0021). This is the Engine's entire input surface — distinct from Tiled's own editor preview of a placed object, a separate design-time-only concern. It is the live, per-session input *into* a World, not the World itself.
_Avoid_: Game state, props, initial state

**Interaction**:
The event fired when the Player triggers an Entity. The Engine only detects and reports it; it has no knowledge of what the Interaction means.
_Avoid_: Dialogue trigger, talk, activate

**Engine Event**:
A fact the Engine emits outward when something happens (the Player moved, a Transition occurred, an Interaction occurred, a Zone was entered). The Host listens to these to decide what happens next.
_Avoid_: Callback, action, message

### Content

**Script**:
Host-authored code that runs when a specific Engine Event fires for a specific Entity, Zone, or Map, producing Dialogue, a Cutscene, or a CG. The Engine has no knowledge that Scripts exist.
_Avoid_: Event handler, callback, quest (a Quest is a larger, not-yet-designed concept a Script may someday drive, not what a Script is itself)

**CodeLeagues Script**:
The home-grown language Scripts are written in, stored as `.clsc` files. It is statically typed: every Flag, Speaker, Mover, Character, Expression, and Cutscene or CG it names is declared and checked before the game runs.
_Avoid_: DSL, `.cls`

**Dialogue**:
Text and Player-facing choices that a Script shows as its output, rendered entirely by the Host. Each line carries a Speaker and may show a Portrait. Never takes control away from the Player. Only one plays at a time: another Interaction, entering a Zone, leaving the Map, or dismissing it ends it where it stands.
_Avoid_: Cutscene (a separate concept, below, that always takes control from the Player — Dialogue never does), text box

**Cutscene**:
A Script that takes control away from the Player for its duration: a sequence of Dialogue, Choice, and Movement steps, during which the Player can't move or interact with anything else. A Cutscene can play another; control returns to the Player only when the outermost one ends. Plays every time it's started, unless it's marked once-only; then a named Flag stops it after its first full play.
_Avoid_: Dialogue (never takes control from the Player; a Cutscene always does), Scene (Phaser's own rendering-container concept, distinct from this domain)

**Follow step**:
A Cutscene step in which one character (the Player or a Character Entity, the *follower*) keeps trailing another (the *leader*) at a Cutscene-chosen gap, lasting until control returns to the Player (a Cutscene played from inside another ending doesn't end it) or the follower is given its own Movement step. A following Player walks the leader's exact route, footstep by footstep; a following Character Entity instead heads straight for the leader by the shortest way. Unlike a Movement step, the Cutscene doesn't wait on it: the next step starts right away, typically a Movement step that walks the leader.
_Avoid_: Escort, chase, target (a Movement step's *target* is a destination tile, not a character)

**CG**:
A full-screen illustrated slideshow — static art and captions the Player advances by clicking, and can skip entirely. Has no Dialogue/Choice/Movement steps and never takes control through them the way a Cutscene does; that structural difference, not what triggers it, is what separates the two. Freezes the Player for its duration the same way a Cutscene does whenever a Script plays one mid-game. Like a Cutscene, it plays every time unless it's marked once-only.
_Avoid_: Cutscene (differ only in structure — no Dialogue/Choice/Movement steps — not in trigger; a CG can be a Script's output the same way a Cutscene can), splash screen

**Speaker**:
The character (or narrator) a line of Dialogue is attributed to. Not necessarily the Entity whose Script produced it — a Script can voice a different character, or an unplaced narrator, within its own Dialogue.
_Avoid_: Entity (a Speaker need not be a placed, interactable Entity on the Map)

**String Table**:
The translatable home of Player-facing text: each entry is a key with one text per Locale. A line, choice, or locked reason in a Script either writes its English text in place or names a key from the String Table; only the keyed ones can be translated.
_Avoid_: Strings file, translation file, dictionary

**Locale**:
The language the Player reads text in, such as English or Thai. English is the language Scripts are written in; other Locales exist only through the String Table.
_Avoid_: Language (ambiguous with CodeLeagues Script), region

**Portrait**:
A static illustration representing a Speaker's appearance in the Dialogue overlay, chosen per line by Expression. Lives independently of a Player/Entity's character spritesheet — a Speaker need not have one, or any in-world visual representation at all.
_Avoid_: Sprite (a Player/Entity's animated on-map spritesheet is a different concept with a different pipeline — see `adr/0006` vs `adr/0014`), avatar

**Expression**:
The specific emotional state a Portrait depicts, chosen from a fixed, project-wide set (Neutral, Happy, Sad, Angry, Surprised) rather than authored freely per character.
_Avoid_: Emotion, mood, pose

**Flag**:
A small, durable per-Student fact (e.g. "has talked to this Entity") that a Script can read and set, persisting across sessions.
_Avoid_: Variable, state, quest progress
