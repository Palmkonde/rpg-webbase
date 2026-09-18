# Game Engine

A standalone module that renders a grid-based world and moves a Player through it, embedded by a Host application for RPG-style course gamification. The Engine owns rendering and movement only; all game content and progression logic belongs to the Host.

## Language

### Roles

**Engine**:
The framework-agnostic module in this repo that renders a Map and moves the Player through it, detecting Transitions and Interactions. It holds no state of its own — it receives a World Config and emits Engine Events.
_Avoid_: Game, frontend, client

**Host**:
The application that embeds the Engine, owns all state and game content (which Maps exist, dialogue, quests, progression), and reacts to the Engine's Events. In this repo the Host is a Next.js app; in production it is backed by the main platform's database.
_Avoid_: App, backend, server

### World

**Map**:
A single Tiled-authored area the Player walks around in, typically corresponding to one course module.
_Avoid_: Level, Scene, World (Scene is Phaser's own rendering-container concept, distinct from this domain's Map)

**Player**:
The grid-bound character controlled by the student, rendered and moved by the Engine.
_Avoid_: Character, avatar, student (a Student is the real person; the Player is their in-Engine representation)

**Entity**:
An interactable object placed on a Map — an NPC, sign, item, etc. — that the Player can trigger an Interaction with. The Engine treats every Entity generically; what it represents narratively is the Host's concern.
_Avoid_: NPC, object, actor

**Spawn Point**:
The Map coordinate the Player appears at on entering a Map, whether as a Map's default entry point or a Portal's target.
_Avoid_: Start position, entry tile

### Movement

**Transition**:
Movement of the Player from one Map to another, triggered either by walking off a Map's edge into an adjacent Map, or by touching a Portal.
_Avoid_: Warp, level change

**Portal**:
An object authored on a Map that triggers a Transition to a specific target Map and Spawn Point when the Player touches it.
_Avoid_: Door, warp point

### Contract

**World Config**:
The data the Host supplies to the Engine describing what to render: the active Map, the Player's position and character, and which of that Map's Tiled-authored Entities and Portals are currently active. Entities and Portals are defined in the Map itself (in Tiled); World Config only controls which are active for a given Player, not their placement or targets. This is the Engine's entire input surface.
_Avoid_: Game state, props, initial state

**Interaction**:
The event fired when the Player triggers an Entity. The Engine only detects and reports it; it has no knowledge of what the Interaction means.
_Avoid_: Dialogue trigger, talk, activate

**Engine Event**:
A fact the Engine emits outward when something happens (the Player moved, a Transition occurred, an Interaction occurred). The Host listens to these to decide what happens next.
_Avoid_: Callback, action, message
