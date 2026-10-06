---
status: accepted (amended by adr/0038: Postgres also records each World Version and when it stopped being live, and `prune` deletes files no kept World Version uses)
---

# Content is hashed files plus a manifest; Postgres holds only the live pointer and Flags

The game service stores every file the browser downloads (Maps, tileset images, Character sheets, Portraits, CG art, compiled Scripts, the String Table) in an S3-compatible bucket under its content hash, `blobs/<sha256>.<ext>`. Each Publish of a World writes one more such file, a **manifest**: the World's table of contents, mapping each Map, tileset, Character (with its `character.json` metadata), Portrait, CG and the bytecode to its key. Postgres holds only two things: which manifest is live for each World, and one Flags `JSONB` document per (World, Student). Making a World live is a single row update, done after every file is uploaded, so a Student never loads a half-Published World.

The manifest holds keys, never full URLs. The base URL is added when the World is served, so putting a CDN in front of the bucket later is a configuration change, not a re-Publish. Every file is immutable, so a CDN can cache all of them indefinitely. The only answer that changes is "which manifest is live", and the game service gives that.

A World **pins** the Asset Library entries it uses: at Publish, its manifest copies their keys and metadata. A Library change reaches a World only when that World is Published again, and that Publish is validated first, so a Library edit can never break a World nobody re-tested.

## Considered Options

- **Game JSON (Maps, String Table, CG definitions, Character metadata) as `JSONB` rows the service serves.** Rejected: every load would go through the service, nothing in the game queries inside content, and the engine already loads everything by URL.
- **MongoDB.** Its strength, flexible JSON documents, doesn't apply once content lives in the bucket: what's left is two small, fixed shapes, and `JSONB` already covers the Flags document. Postgres adds no driver (`Bun.sql` is built in), is easy to provide in the Nix dev shell, and is what the first consuming platform already runs. We chose Postgres "for now" and wrote no database-switching layer.
- **Path-shaped keys** (`worlds/<id>/maps/main.tmj`). Rejected: they are overwritten in place, so they can't be cached forever, and a failed Publish could corrupt live files.
- **Live Library references** (the client also loads the Library's current manifest). Rejected: one Library change would instantly reach every World, including ones it breaks.
- **One row per Flag.** Rejected for now: Scripts read all of a Student's Flags and patch a few, and nothing queries across Students.
