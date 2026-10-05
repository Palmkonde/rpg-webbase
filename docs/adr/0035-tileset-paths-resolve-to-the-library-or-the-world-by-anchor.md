---
status: accepted (supersedes adr/0002)
---

# Tileset paths resolve to the Asset Library or the World by anchor, at Publish

Content is authored in one content folder: `library/tilesets/` and `library/characters/` for the Asset Library, and `worlds/<id>/` for each World, which has its own `tilesets/`. Each World is its own Tiled project. The CLI generates it, along with the custom types the engine reads, and adds `../../library` as a project folder. Tilesets stay embedded in each Map.

Because a World can be opened from anywhere, the relative paths Tiled writes still can't be trusted, which is `adr/0002`'s original problem. Publish keeps `adr/0002`'s anchoring idea with two anchors. A tileset image path containing `library/tilesets/` resolves to that path inside the Asset Library. Any other path containing `tilesets/` resolves from its last `tilesets/` segment inside the World's own `tilesets/` folder. Everything before the anchor is ignored. A path with no anchor, or one that points at a missing file, fails the Publish, and the error names the Map and the path.

This replaces `adr/0002`'s other half, "resolve against a `tilesets/` folder next to the served Map", because content-addressed storage (`adr/0034`) has no "next to". Publish resolves every path to a bucket key ahead of time. Whether the engine then looks the key up in the manifest or reads it from a rewritten Map is a build detail.

## Considered Options

- **One Tiled project for the whole content folder.** Rejected: one project per World is easier to maintain. Its cost is that the Library is reached through `../../library`, so resolution has to keep anchoring rather than trust plain relative paths.
- **External tileset files (`.tsj`) that Publish embeds.** Rejected for now: embedded tilesets are what the Maps already use, and Phaser can't load external ones anyway.
- **Library-only tilesets.** Rejected: some tilesets belong to one Map or World, and forcing them into the Library makes every one-off tileset shared.
