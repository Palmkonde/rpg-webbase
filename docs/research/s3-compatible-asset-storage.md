# S3-compatible asset storage: provider differences, serving, CORS and `Bun.s3`

## 1. Question and scope

Ticket [#66](https://github.com/Palmkonde/rpg-webbase/issues/66) (child of map [#65](https://github.com/Palmkonde/rpg-webbase/issues/65)) asks how the game service should store and serve World and Asset Library files through the **S3-compatible API**. That one interface has to cover AWS S3, GCS (through S3 interop with HMAC keys), Cloudflare R2, and MinIO for local dev. The ticket asks four things:

1. Where do the providers disagree, and which subset is safe to rely on?
2. How should files reach the browser: presigned GET, a public-read bucket (optionally behind a CDN), or a proxy through the game service?
3. What bucket CORS does Phaser's loader need?
4. Does Bun's built-in `Bun.s3` client work against all of them?

This note gathers facts and says what they point to. It does not choose. The storage-client choice belongs to [#70](https://github.com/Palmkonde/rpg-webbase/issues/70), and the serving model belongs to the client ↔ game service HTTP contract.

The repo facts below come from the current tree:

- `packages/engine-core` pins `phaser ~4.0.0`, installed as **4.0.0**.
- `new Phaser.Game({...})` in `packages/engine-core/src/engine.ts` sets no `loader` block, so every loader setting is at its default.
- The installed Bun is **1.4.2**.

## 2. Findings in brief

- **The portable subset** is PutObject, GetObject (with Range), HeadObject, DeleteObject, ListObjectsV2, multipart upload, and SigV4 presigned GET/PUT against the provider's own S3 endpoint. Four things are **not** portable:
  - **ACLs.** R2 has none, and new AWS buckets disable them.
  - **Conditional writes.** GCS documents only its own `x-goog-if-generation-match` for PUT, and `Bun.s3` can't send them at all.
  - **The bucket-CORS API.** MinIO's community edition doesn't have it.
  - **Presigned URLs on a custom domain or CDN.** R2 and GCS both say signed URLs work only on the S3/XML endpoint. (§3)
- **Presigned GET breaks the engine's tileset loading as it is today.** `resolveTilesetAssetUrl` builds each tileset URL relative to the map URL with `new URL('../tilesets/…', mapUrl)`. Relative resolution drops the query string, and the signature lives in the query string, so every tileset request goes out unsigned and gets a 403. Presigning therefore forces the game service to hand the client an **absolute URL per file**, through a manifest or a rewritten Tiled JSON. Presigning also makes every page load a cache miss and skips the CDN, and URLs live 7 days at most. (§4)
- **Phaser 4.0 doesn't need `crossOrigin` by default.** Images load by XHR as a blob and are decoded from a `blob:` URL, so the canvas is never tainted. The XHR itself still needs CORS, and so does the `fetch()` of the map JSON. Both are simple GETs with no custom headers, so there is **no preflight**. The minimum bucket rule is: allow the platform's origin(s), methods `GET` and `HEAD`, nothing else. (§5)
- **`Bun.s3` covers the core operations, with gaps.** Bun's docs list all four providers. The client covers put, get, stream, stat, delete, list and presign. As of v1.4.2 it has **no** way to set `Cache-Control`, user metadata, conditional headers, copy, or bucket configuration. Uploading immutable assets with `Cache-Control` therefore needs something more: a CDN rule, a proxy that sets the header, or a SigV4 signer. `new Response(s3file)` in `Bun.serve` is a **302 redirect to a presigned URL**, not a proxy. (§6)

## 3. Where the providers disagree

| Capability | AWS S3 | GCS (XML API + HMAC) | Cloudflare R2 | MinIO (community) |
|---|---|---|---|---|
| Put / Get / Head / Delete | yes | yes | yes | yes |
| ListObjectsV2 (`list-type=2`) | yes | yes, GA since Nov 2021 [^gcs-list] | yes, and recommended over V1 [^r2-api] | yes |
| Multipart upload | yes | yes, "compatible with Amazon S3 multipart uploads"; preconditions **not** supported in multipart requests [^gcs-mpu] | yes [^r2-api] | yes |
| Multi-object delete | yes | yes, `POST ?delete`, up to 1,000 keys [^gcs-del] | yes [^r2-api] | yes |
| Conditional PUT (`If-None-Match: *` / `If-Match`) | yes, on PutObject, CompleteMultipartUpload and CopyObject; 412 on failure [^aws-cond] | `If-None-Match` is not documented for PUT; the documented write precondition is `x-goog-if-generation-match` (0 = only if absent) [^gcs-headers] | yes, for both retrieval and upload [^r2-api] | — |
| ACLs (`x-amz-acl`, `public-read`) | disabled on new buckets by default (Object Ownership) [^aws-bpa] | own `x-goog-acl` [^gcs-put] | **not implemented** [^r2-api] | — |
| Bucket CORS via S3 `PutBucketCors` | yes | configured with `gcloud` or the JSON API; the CORS model differs (see §5) [^gcs-cors] | yes [^r2-api] | **no**: one global setting via `MINIO_API_CORS_ALLOW_ORIGIN`; the bucket-CORS PR was closed and moved to the enterprise product [^minio-cors] |
| Presigned URL max lifetime | 7 days (IAM user, SigV4); shorter with temporary credentials [^aws-presign] | 7 days [^gcs-signed] | 1 s to 7 days [^r2-presign] | — |
| Presigned URL on a custom domain or CDN | — | **no**: "Signed URLs can only be used … through XML API endpoints" [^gcs-signed] | **no**: S3 API domain only, not custom domains [^r2-presign] | — |
| Region | real region | — | `auto` (`us-east-1` and empty also map to `auto`) [^r2-api] | any |

A dash means the source checked doesn't say.

**MinIO itself is a moving target.** The `minio/minio` repository README now says "THIS REPOSITORY IS NO LONGER MAINTAINED". The community edition "is now distributed as source code only" with no pre-compiled binaries, and the repo was archived on 2026-04-25 [^minio-repo]. It still runs as an S3 target for local dev, but the map's "local S3-compatible bucket in the Nix shell" assumption should be revisited (see §7).

**What this points to.** A design that needs only the portable column works everywhere:

- Write each file under a **content-addressed key** (its hash in the key).
- Make a Postgres row the commit point for Publish.

An object then never changes once written, so nothing needs a conditional write. A rerun rewrites identical bytes, and a half-finished Publish leaves orphan objects but no broken World. The orphans can be collected later by listing keys not referenced in Postgres.

## 4. Serving files to the browser

### How the engine resolves URLs today

- `collectTiledMapAssets(tiledMapUrl)` `fetch()`es the Tiled JSON.
- `resolveTilesetAssetUrl(embeddedPath, tiledMapUrl, origin)` then keeps the part from `tilesets/` onward and resolves it as `new URL('../' + stablePath, mapUrl)` (`packages/engine-core/src/util.ts`).
- Character spritesheets come from `character.spriteUrl` (`character-assets.ts`), which is already one absolute URL per file.

The WHATWG URL parser drops the base URL's query string when it resolves a path-relative reference. So if `tiledMapUrl` is `https://bucket…/maps/town.json?X-Amz-Signature=…`, every tileset URL comes out **without** a signature. The bucket answers each one with 403. Each object needs its own signature anyway, because SigV4 signs the object key. A shared signature on the map URL couldn't cover the tilesets even if the query string survived.

### The three options

| | Presigned GET | Public-read bucket (+ optional CDN) | Proxy through the game service |
|---|---|---|---|
| **URL shape** | one absolute URL per file, so the service has to emit a manifest or rewrite Tiled JSON image paths; relative paths stop working | stable, so relative paths keep working as they do today | stable, same-origin when the service shares the page's origin, so relative paths keep working |
| **Browser caching** | a new signature means a new URL and a cache miss on every page load, unless the service caches and reuses URLs | normal HTTP caching; immutable content-addressed keys can be cached forever | normal HTTP caching; the service sets `Cache-Control` itself |
| **CDN** | **not possible on R2 or GCS**: signed URLs work only on the S3/XML endpoint [^r2-presign] [^gcs-signed] | yes: an R2 custom domain gets Cloudflare Cache; `r2.dev` is "rate limited and should only be used for development purposes" [^r2-public] | a CDN can sit in front of the service |
| **Expiry mid-session** | ≤ 7 days; with temporary credentials (IAM role, EC2 instance profile ~6 h, STS AssumeRole 1 h by default) the URL dies with the credential [^aws-presign]. AWS checks expiry when the request **starts**, so a download in flight survives [^aws-presign]. Phaser loads in `preload`, so expiry only matters for assets fetched later (the next Map, a lazy load) | none | none |
| **Access control** | per-file, time-boxed bearer tokens; anyone holding the URL can read until expiry | **none**: anyone with the URL can read. On AWS this means switching off Block Public Access, which is on by default for new buckets [^aws-bpa]. Licensed art in a World would be world-readable | full: the service can check the player's session before streaming |
| **Cost** | no service bandwidth | no service bandwidth | every byte flows through the service: its bandwidth, memory and egress |

**Bun's built-in "serve" is a redirect, not a proxy.** Bun's docs say that returning an `S3File` in a `Response` "redirects the user to a presigned URL for the S3 file" (302) [^bun-s3]. That inherits every presigned-URL cost above, including the query-string loss on relative paths. A real proxy has to stream: `new Response(s3file.stream(), { headers })`.

**Redirects across origins.** If the game service runs on a different origin from the page and redirects to the bucket (a second origin), the Fetch Standard's redirect-taint rule serialises the request's `Origin` as `null` [^fetch-redirect]. The bucket's CORS would then have to allow `*`, because a specific origin will never match. A same-origin service redirecting to the bucket keeps the real `Origin`.

## 5. CORS for Phaser's loader

### What Phaser 4.0 actually does

From the installed source (`node_modules/phaser`, 4.0.0):

- **Images default to XHR.** `Config.js` sets `loaderImageLoadType = GetValue(config, 'loader.imageLoadType', 'XHR')` and `loaderCrossOrigin = … undefined`. `ImageFile` asks for `responseType: 'blob'`. In `onProcess` it creates an `Image` and sets `src = URL.createObjectURL(blob)` (`File.createObjectURL`).
- **No taint.** A `blob:` URL created by the page belongs to the page's origin, so the image is same-origin and the canvas or WebGL texture is never tainted. `crossOrigin` makes no difference on this path.
- **`crossOrigin` matters only in `HTMLImageElement` mode.** If someone sets `loader.imageLoadType: 'HTMLImageElement'`, `loadImage` sets `this.data.crossOrigin = this.crossOrigin` and loads the bucket URL straight into `<img>`. Then `loader.crossOrigin: 'anonymous'` becomes **required**, because WebGL can't use a cross-origin texture without CORS approval [^mdn-webgl], and a tainted canvas throws `SecurityError` on read-back [^mdn-cors-img].
- **The XHR needs CORS.** `XHRLoader` does a plain `xhr.open('GET', …)`. It sets no headers unless `xhrSettings.headers` or `requestedWith` is configured (neither is here), and `withCredentials` defaults to `false`. A cross-origin XHR still needs `Access-Control-Allow-Origin` on the response. The same applies to `tilemapTiledJSON`, `spritesheet`, and the engine's own `fetch(tiledMapUrl)` in `collectTiledMapAssets`.
- **No preflight.** `GET` with only safelisted headers is a CORS-safelisted request, so no `OPTIONS` is sent [^fetch-safelist].

### Minimum bucket CORS rule (S3 JSON form)

```json
[{ "AllowedOrigins": ["https://platform.example"], "AllowedMethods": ["GET", "HEAD"], "MaxAgeSeconds": 3600 }]
```

- **No `PUT` or `AllowedHeaders`.** Uploads come from the CLI and the service, not the browser. If browser uploads to presigned PUT URLs ever appear, they will need `PUT` plus `AllowedHeaders` for `Content-Type`.
- **AWS returns 403 on a mismatch.** It answers "CORS is not enabled for this bucket" or "This CORS request is not allowed" when no rule matches the `Origin` [^aws-cors-ts].
- **GCS uses its own field names.** They are `origin`, `method`, `responseHeader` and `maxAgeSeconds`, set through `gcloud` or the JSON API [^gcs-cors]. Its XML API (the S3-interop endpoint) evaluates the config strictly and **omits** CORS headers on a mismatch. Its JSON API always answers permissively. The authenticated-browser endpoint `storage.cloud.google.com` doesn't support CORS at all [^gcs-cors].
- **MinIO community has only the global `MINIO_API_CORS_ALLOW_ORIGIN`** [^minio-cors].
- **CDN cache key.** A CDN or caching proxy must include `Origin` in its cache key. Otherwise it can serve a cached response without CORS headers to a cross-origin request [^aws-cors-ts].

Because every provider configures CORS differently, CORS is better treated as a **one-time install step**, written up in the installation guide per provider, than as something the game service sets at runtime. `Bun.s3` can't set it either (§6).

## 6. Does `Bun.s3` work against all four?

**Bun's claim.** Bun's S3 docs say it "works with any S3-compatible storage service". They give endpoint examples for AWS S3 (the default, `us-east-1` if no region is given), GCS (`https://storage.googleapis.com`), R2 (`https://<account-id>.r2.cloudflarestorage.com`), MinIO (`http://localhost:9000`), DigitalOcean Spaces and Supabase [^bun-s3]. Configuration comes from `S3_*` env vars, with `AWS_*` as fallback (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_SESSION_TOKEN`) [^bun-s3]. Nothing in this repo has tested that claim against any provider. The build should smoke-test each one (put, list, presign, multipart) before relying on it.

**What it covers.** Checked against the v1.4.2 type definitions [^bun-types]:

- `write`, which uses a multipart `writer` with `partSize`, `queueSize` and `retry` for large files
- `file().stream()`, `slice()` (Range), `exists`, `stat` (etag, size, type), `delete`
- `presign` with `method`, `expiresIn` (default 86,400 s) and `acl`
- `S3Client.list` (ListObjectsV2: `prefix`, `continuationToken`, `delimiter`, `maxKeys`, `startAfter`)

**What it doesn't have.** `S3Options` carries only these fields:

- `acl`, `bucket`, `region`
- `accessKeyId`, `secretAccessKey`, `sessionToken`, `endpoint`, `virtualHostedStyle`
- `partSize`, `queueSize`, `retry`
- `type` (Content-Type), `contentDisposition`, `contentEncoding`
- `storageClass`, `requestPayer`

So there is **no** `Cache-Control`, no user metadata, no `If-Match`/`If-None-Match`, no arbitrary headers, no CopyObject, no bucket CORS or policy calls, and no `response-cache-control` override on presign. Presign may forward `type` and `contentDisposition`; the types don't say.

**Open upstream issues:**
- Conditional writes and user metadata are an open feature request, [oven-sh/bun#17339](https://github.com/oven-sh/bun/issues/17339) (opened 2025-02).
- [oven-sh/bun#44289](https://github.com/oven-sh/bun/issues/44289) (open, 2026-09) reports that some code paths drop `partSize`, `acl`, `storageClass` or `requestPayer`.
- The `acl` option isn't portable anyway: R2 has no ACLs, and new AWS buckets reject them (§3).

**What this points to:**

- `Bun.s3` is enough for the game service's data path: Publish writes, listing for cleanup, presign, streaming.
- Content-addressed keys remove the need for conditional writes (§3).
- The one real gap is **`Cache-Control` on stored objects**. Each option fills it in a different place:

| Option | Where `Cache-Control` comes from |
|---|---|
| Proxy | the proxy sets the header itself |
| CDN | a CDN rule sets the TTL |
| Signer | a SigV4 signer sends `PUT` with `Cache-Control` through `fetch`, e.g. a small signing library or the AWS SDK; not evaluated here |

  #70 should weigh that gap once the serving model is chosen.

## 7. Open questions surfaced

- **Local dev bucket.** MinIO community is archived and source-only (§3). The map's "Local dev for the reference platform: Postgres + a local S3-compatible bucket in the Nix shell" bullet now needs a choice of bucket. One option is MinIO built from source or pinned in nixpkgs. Others are an alternative S3-compatible server, or AIStor Free, which the MinIO README names. Each would need checking against the portable subset in §3.
- **Serving model and the HTTP contract.** Presigned GET forces absolute per-file URLs (a manifest, or Tiled JSON rewritten at Publish), which feeds directly into the "Client ↔ game service HTTP contract" bullet. Public-read or a proxy keeps the engine's relative tileset paths working.
- **Does Publish need `Cache-Control` or conditional writes?** The answer decides between `Bun.s3` alone and `Bun.s3` plus a signer, which matters for #70.

## Sources

[^gcs-list]: Google Cloud, "List objects" (XML API `list-type=2`) and Cloud Storage release notes. https://cloud.google.com/storage/docs/xml-api/get-bucket-list
[^gcs-mpu]: Google Cloud, "XML API multipart uploads". https://docs.cloud.google.com/storage/docs/multipart-uploads
[^gcs-del]: Google Cloud, "Delete multiple objects" (XML API `POST` bucket `?delete`). https://docs.cloud.google.com/storage/docs/xml-api/post-bucket
[^gcs-headers]: Google Cloud, "HTTP headers and query string parameters for XML API". https://docs.cloud.google.com/storage/docs/xml-api/reference-headers
[^gcs-put]: Google Cloud, "PUT Object" (XML API). https://docs.cloud.google.com/storage/docs/xml-api/put-object-upload
[^gcs-cors]: Google Cloud, "Cross-origin resource sharing (CORS)". https://docs.cloud.google.com/storage/docs/cross-origin
[^gcs-signed]: Google Cloud, "Signed URLs". https://docs.cloud.google.com/storage/docs/access-control/signed-urls (HMAC/S3 interop: https://docs.cloud.google.com/storage/docs/interoperability)
[^r2-api]: Cloudflare, "R2 S3 API compatibility". https://developers.cloudflare.com/r2/api/s3/api/
[^r2-presign]: Cloudflare, "R2 presigned URLs". https://developers.cloudflare.com/r2/api/s3/presigned-urls/
[^r2-public]: Cloudflare, "R2 public buckets". https://developers.cloudflare.com/r2/buckets/public-buckets/
[^aws-cond]: AWS, "How to prevent object overwrites with conditional writes". https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
[^aws-presign]: AWS, "Download and upload objects with presigned URLs". https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
[^aws-bpa]: AWS, "Blocking public access to your Amazon S3 storage". https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
[^aws-cors-ts]: AWS, "Troubleshooting CORS". https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors-troubleshooting.html (overview: https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
[^minio-cors]: MinIO global CORS setting `MINIO_API_CORS_ALLOW_ORIGIN`; bucket-CORS PR closed unmerged ("Moving to MinEOS", 2024-08-06). https://github.com/minio/minio/pull/20150
[^minio-repo]: `minio/minio` README and archive banner (archived 2026-04-25). https://github.com/minio/minio
[^bun-s3]: Bun docs, "S3". https://bun.com/docs/runtime/s3
[^bun-types]: Bun v1.4.2 type definitions, `packages/bun-types/s3.d.ts`. https://github.com/oven-sh/bun/blob/bun-v1.4.2/packages/bun-types/s3.d.ts
[^mdn-webgl]: MDN, "Using textures in WebGL" § Cross-domain textures. https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
[^mdn-cors-img]: MDN, "Allowing cross-origin use of images and canvas". https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image
[^fetch-redirect]: WHATWG Fetch Standard, "HTTP-redirect fetch" (redirect-taint) and "serializing a request origin". https://fetch.spec.whatwg.org/#http-redirect-fetch
[^fetch-safelist]: WHATWG Fetch Standard, "CORS-safelisted method" / "CORS-safelisted request-header". https://fetch.spec.whatwg.org/#cors-safelisted-method
