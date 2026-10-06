---
status: accepted (amends adr/0038: the Asset Library has no Publish of its own, so `prune` keeps only files used by kept World Versions)
---

# Publish uploads through the service by hash and goes live by compare-and-swap; the Asset Library has no Publish of its own

An Author Publishes one World at a time with `publish <world>`, run from the content root. The CLI checks everything locally, then hashes every file the World uses and asks the game service which hashes it is missing. It uploads each missing file to the service with `PUT /blobs/<sha256>` and the Publish key (`adr/0036`). The service hashes the bytes as they arrive and refuses a mismatch before anything reaches the bucket. Every `blobs/<sha256>` key can be cached forever (`adr/0034`), so the bytes behind a key must be checked by something other than the client that sent them.

Going live is a compare-and-swap. The CLI fetches the live World Version's summary (declared Flags, once-only Flags, Companion movers, Zones, Entities), compares it locally with the new one, and shows the Pre-Publish report (`adr/0038`). It then sends the manifest along with `expectedLive`, the id of the World Version the report was computed against. In one transaction, the service checks that every key the manifest names exists, inserts the World Version, and moves the live pointer, but only if the live World Version is still `expectedLive`. If another Publish landed in between, the request is refused and the Author re-runs it against the new live version. A World's first Publish needs `--new`, because a World id is permanent once Flags are stored under it, and a typo should not create one.

The Asset Library has no Publish of its own. `publish <world>` uploads whichever Library files that World uses from the local `library/` folder and pins them in the manifest (`adr/0034`). That is the same Library the Author tested against in Tiled. The service keeps no "current Library", so `prune` keeps only files used by kept World Versions (amending `adr/0038`).

Tileset image paths are rewritten to their bucket keys at Publish, and each Map is hashed after the rewrite (`adr/0035`'s build detail).

## Considered Options

- **Presigned PUT straight to the bucket.** Rejected: the S3 subset every provider shares can't tie a presigned upload to a checksum, so the service would have to read every object back to trust its key. World art is small, so routing it through the service costs little.
- **Moving the live pointer unconditionally.** Rejected: an Author could confirm a report computed against one World Version and then overwrite a different one that a colleague had just Published.
- **`publish --library` with a current Library on the service**, against which every World Publish resolves. Rejected: because Worlds pin what they use, a server-side Library protects nothing more when the content folder is one shared repository, and it adds a second Publish an Author has to remember to run first.
- **Computing the Pre-Publish report on the service.** Rejected: the service stays a store plus a compare-and-swap, and `--dry-run` prints the same report without a separate route.
