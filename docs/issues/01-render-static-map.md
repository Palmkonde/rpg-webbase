# 01: Render a static Map end-to-end

**What to build:** A Host (Next.js) page that loads a World Config from a local fixture and hands it to the Engine, which mounts Phaser and renders the named Tiled-authored Map. This is the walking skeleton proving the full Host → Engine → Phaser pipe works before any interactivity is added.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Engine core is a separate, framework-agnostic package with no Next.js/React import
- [x] A local JSON fixture supplies the World Config (which Map to load) to the Host
- [x] Loading the Host's page renders the named Tiled-authored Map inside a Phaser canvas
- [x] No Player, movement, or interaction exists yet — this ticket is scaffolding + static render only
