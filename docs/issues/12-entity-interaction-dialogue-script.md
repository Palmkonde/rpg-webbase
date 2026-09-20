# 12: Entity Interaction runs a dialogue Script

**What to build:** Interacting with an Entity that has an authored Script shows one static line of Dialogue in a Host-rendered overlay — the smallest end-to-end slice of the whole Scripts pipe (Tiled authoring → entityId → Script → Dialogue).

**Blocked by:** 05

**Status:** done

**Architecture note:** see `docs/adr/0008-scripts-are-host-side-not-engine-side.md`, `docs/adr/0009-scripts-are-typescript-not-a-parsed-dsl.md`, `docs/adr/0010-tiled-objects-tagged-by-custom-class.md` + `docs/guides/tiled-object-authoring.md`, and `docs/adr/0011-dialogue-v1-does-not-pause-the-player.md`.

- [x] An Entity authored via the Tiled `Entity` Custom Class (per `docs/guides/tiled-object-authoring.md`) resolves on the Host to its `entityId` (the object's `name`)
- [x] A Script is found by naming convention from that `entityId` — no lookup table
- [x] A Script is authored as plain TypeScript via a small builder API (e.g. a "say a line" call) — no parser, no DSL
- [x] On `interacted`, the matching Script runs and its line renders in a Host-side overlay; the Engine is never made aware any of this happened
- [x] The overlay is dismissible and non-blocking — the Player can still move while it's showing (accepted v1 rough edge, not a bug to fix here)
- [x] A Script accepts a `ctx` parameter shaped for future Flag-reading, even though nothing reads Flags yet (a stub/no-op satisfies it — real wiring lands in ticket 14)
- [x] entityId→script-path resolution and the builder API's output are unit-tested (`node:test`); overlay rendering and in-game timing are verified manually and reported before ticking boxes (no e2e/browser automation in this repo, per `CLAUDE.md`) — manually verified by the user: interacting with the campfire shows the Dialogue overlay, the Player can still move underneath it, and Close dismisses it
