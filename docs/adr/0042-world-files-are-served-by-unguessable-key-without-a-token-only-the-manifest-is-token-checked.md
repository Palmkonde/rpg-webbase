---
status: accepted
---

# World files are served by unguessable key without a token; only the manifest is token-checked

Every Student of a World loads the same files. What differs per Student is their Flags, which already sit behind the World-scoped token (`adr/0036`). So the game service serves every `blobs/<sha256>.<ext>` file (`adr/0034`) to anyone who asks for its key, at `GET /blobs/<key>`. A key is a content hash: it can't be guessed or listed, but it isn't a secret once seen. Only the manifest, the list of a World Version's keys, is token-checked: the client gets it from the route that loads a World Version, which refuses a token for any other World. That includes an older World Version fetched by id (`adr/0038`). So a Student who loses access keeps the files they already saw until `prune` deletes them, but can't learn the keys a later Publish adds.

The bucket stays private. The service streams each file from it with `Bun.s3`, checking first that the object exists, so a pruned file answers 404 and the client shows "This World was updated. Reload to continue." (`adr/0038`). The service sets `Cache-Control: public, max-age=31536000, immutable` itself, because a key's bytes never change (`adr/0040` checks them on upload). A reloading browser sends no request for files it already has, and the default install needs no CDN to get there.

The World Version response carries an asset base URL, and the client builds `baseUrl + key`, the one key-to-URL step `adr/0040` asks for. Every URL loads without a header, so it can go straight into Phaser's loader or a Platform override's `<img src>` (`adr/0039`). The base URL comes from one optional service setting, `ASSET_BASE_URL`. It defaults to the service's own `/blobs/`. An operator can point it at a CDN in front of the service, with no bucket changes, or at a public bucket or a CDN in front of the bucket, in which case the bucket's public policy and its GET/HEAD CORS rule are the operator's to set. The Platform never configures it.

## Considered Options

- **Files readable only by the World's Students.** Rejected: a Student who may play can already save any file from devtools, so privacy only keeps out people who hold a key without being Students. It would need a key-to-World index the service doesn't have, plus one of the next two options.
- **Presigned GET URLs.** Rejected: they break the single key-to-URL step, and they have to be renewable for an older World Version for a whole session (`adr/0038`).
- **The client fetches each file with the Bearer header and turns it into an object URL.** Rejected: it means rewriting every tileset reference inside each Map before Phaser loads it, and keeping Phaser and the overlays from fetching anything themselves.
- **A public-read bucket as the default.** Rejected: the S3 subset every provider shares has no ACL or bucket-CORS API, so every installer would set both by hand in their provider's console. It's still available through `ASSET_BASE_URL`.
- **The manifest as a plain, untokened file.** Rejected: anyone with its key could follow every later Publish of the World, and token-checking it costs nothing on a route that already checks the token.
- **The Platform passes the base URL to `mount`.** Rejected: only the operator knows whether a CDN is in front, and moving to one would mean redeploying every Platform.
- **Range requests on `/blobs`.** Left out: nothing loads part of a file. `Bun.s3` streams don't handle Range, so it would be a hand-built 206 response.
