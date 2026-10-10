# Game Service reference

For operators. The Game Service keeps Published World Versions and each Student's Flags, in a Postgres database and an S3-compatible bucket, and runs as one container image. This page covers everything about running it. For a first install on one machine, follow [`getting-started.md`](getting-started.md) instead.

An install hands out two values:

- the **JWT secret**, which goes to the Platform developer, who signs Student tokens with it ([`client.md`](client.md))
- the **Publish key**, which goes to Authors, who Publish Worlds with it ([`crpg.md`](crpg.md))

## What you need

- A container runtime: Docker with Compose v2.20 or later, or Kubernetes.

On Compose, [`deploy/compose.yaml`](../../deploy/compose.yaml) can run Postgres and a SeaweedFS bucket for you, and the wizard sets them up by default. To use your own instead:

- **Postgres.** Any reachable Postgres works; 18 is the tested version. Create an empty database and a user that owns it. `migrate` creates the tables. Don't share a database with another app: if it already has a `worlds`, `world_versions` or `flags` table, `migrate` fails.
- **An S3-compatible bucket.** AWS S3, Cloudflare R2, SeaweedFS and others all work. Create the bucket yourself: the service never creates it. Keep it private, because Students fetch files through the service and never from the bucket directly. The access key needs `ListBucket`, `GetObject`, `PutObject` and `DeleteObject` on that bucket.

## The image

```text
ghcr.io/palmkonde/codeleagues-rpg-engine-game-service:<version>
```

Each release pushes the version as an `X.Y.Z` tag and, for a stable release, an `X.Y` tag too. A prerelease such as `0.1.0-rc.5` gets only its full tag. Versions are listed on the [releases page](https://github.com/Palmkonde/rpg-webbase/releases). Pin a full version, and move to a new one on purpose: the client package and `crpg` release at the same version as the image, and are meant to be used with it.

The image covers `linux/amd64` and `linux/arm64`. It is signed with keyless cosign, so you can check that this repository's release workflow built it:

```sh
cosign verify ghcr.io/palmkonde/codeleagues-rpg-engine-game-service:<version> \
  --certificate-identity-regexp '^https://github.com/Palmkonde/rpg-webbase/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

The image runs as the non-root user `65532` and has no shell. It works with a read-only root filesystem, as long as `/tmp` is a writable tmpfs. Its one binary takes a subcommand:

| Subcommand | What it does |
|---|---|
| `serve` (default) | Serves the HTTP API on `PORT` |
| `migrate` | Applies the schema migrations the image carries, then exits. Run it before `serve` on every new version |
| `prune` | Deletes World Versions retired for `PRUNE_GRACE_DAYS` or more, then every file no remaining World Version uses, then exits |
| `health` | Exits 0 if `/healthz` on this container answers 200. The image's own `HEALTHCHECK` runs it |

## The setup wizard

The operator wizard writes a `.env` with every value below. It pins the image version (the newest release, or one you name) and generates the JWT secret and the Publish key. By default it sets up the Postgres and bucket the Compose file runs. If you answer `n`, it takes your own Postgres and bucket settings instead, and runs `migrate` against them once. Run it in the folder you deploy from:

```sh
curl -fsSLO https://raw.githubusercontent.com/Palmkonde/rpg-webbase/main/scripts/operator-install.sh
less operator-install.sh   # read it before you run it
bash operator-install.sh
```

Run it again to change a value: it offers each saved value as the default. `deploy/compose.yaml` reads the `.env` it writes. To set the values by hand instead, the next section lists them.

## Environment variables

`serve` checks these at startup. If a required one is missing, it exits and names the missing variable.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:password@host:5432/database` |
| `S3_ENDPOINT` | yes | The bucket's S3 API endpoint, such as `https://s3.eu-west-1.amazonaws.com` or `https://<account>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | yes | The bucket's name |
| `S3_REGION` | yes | The bucket's region, such as `eu-west-1`; R2 takes `auto`. Always set it: some S3 servers reject the region Bun picks when none is given |
| `S3_ACCESS_KEY_ID` | yes | The bucket access key |
| `S3_SECRET_ACCESS_KEY` | yes | Its secret |
| `JWT_SECRET` | yes | The HS256 secret Student tokens are signed with. The Platform signs with the same value. Use at least 32 random bytes |
| `PUBLISH_KEY` | yes | The shared key `crpg` sends to Publish, list World Versions and prune. Use at least 32 random bytes |
| `CORS_ORIGINS` | yes | The Platform origins allowed to call the service from a browser, comma-separated: `https://learn.example.com,https://staging.learn.example.com` |
| `ASSET_BASE_URL` | no | Where Students fetch World files from. See [Serving files and a CDN](#serving-files-and-a-cdn) |
| `PRUNE_GRACE_DAYS` | no | How long a retired World Version's files stay before `prune` may delete them. Default `90` |
| `PORT` | no | The port `serve` listens on. Default `3000` |

With the bundled profile, `.env` also holds `COMPOSE_PROFILES=bundled` and `POSTGRES_PASSWORD`, which the Compose file reads and the service doesn't.

`migrate` reads only `DATABASE_URL`. `prune` reads only the database and bucket variables and `PRUNE_GRACE_DAYS`.

To generate a secret by hand: `openssl rand -hex 32`.

To rotate the JWT secret, change it here and on the Platform at the same time. Students then need a new token, and the client fetches one by itself. To rotate the Publish key, change it here and give Authors the new one.

## Running it with Compose

[`deploy/compose.yaml`](../../deploy/compose.yaml) runs the service hardened: a read-only root filesystem, a tmpfs at `/tmp`, every capability dropped, and `no-new-privileges`. Download it next to the wizard's `.env`, then start it:

```sh
curl -fsSLO https://raw.githubusercontent.com/Palmkonde/rpg-webbase/main/deploy/compose.yaml
docker compose up -d --wait
curl -fsS http://localhost:3000/healthz   # prints "ok"
```

| Service | Runs | When |
|---|---|---|
| `migrate` | `migrate`, then exits | Before `game-service`, on every `up` |
| `game-service` | `serve` on port 3000 | After `migrate` succeeds |
| `prune` | `prune`, then exits | Only when you run it (the `prune` profile) |
| `postgres` | Postgres 18 | With the `bundled` profile |
| `seaweedfs` | A SeaweedFS bucket | With the `bundled` profile |

It reads `GAME_SERVICE_VERSION` from `.env` for the image tag. `COMPOSE_PROFILES=bundled` in `.env` turns on the bundled Postgres and bucket, which sit on the Compose network only, with no ports published. The wizard writes it by default. Leave it out to use your own Postgres and bucket.

With the bundled profile, back up both volumes. `postgres` holds every Student's Flags, which nothing can restore. `seaweedfs` holds World files: without it, Students can't load any World until each one is Published again.

With your own Postgres and bucket, remember that `DATABASE_URL` and `S3_ENDPOINT` are read inside the container, so `localhost` there means the container itself. For a Postgres or bucket on the Docker host, use `host.docker.internal` on Docker Desktop, or the host's address on Linux.

To upgrade, set the new `GAME_SERVICE_VERSION` in `.env` and run `docker compose up -d --wait` again. `migrate` runs before the new `serve` starts.

Put a TLS-terminating reverse proxy in front of port 3000. Platforms and Authors then use its `https://` URL.

### Scheduling `prune`

The service never schedules anything itself. Run `prune` from the host's cron, for example nightly:

```cron
17 3 * * * cd /srv/game-service && docker compose run --rm prune >> prune.log 2>&1
```

It prints the keys it deleted, or `Nothing to prune.` A World Version a Student is still playing is safe as long as it was retired fewer than `PRUNE_GRACE_DAYS` ago. After that, the Student sees "This World was updated. Reload to continue." Authors can also prune from their side with `crpg prune` (see [`crpg.md`](crpg.md#crpg-prune)).

## Running it on Kubernetes

Kubernetes ignores the image's `HEALTHCHECK`, so the Deployment probes `/healthz` itself. Every Pod runs with the same hardened security context. Create the Secret from the wizard's `.env` by loading it into your shell. Don't use `kubectl create secret --from-env-file`: the wizard quotes each value, and `kubectl` keeps the quotes as part of the value.

```sh
set -a; . ./.env; set +a
kubectl create secret generic game-service \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=S3_ENDPOINT="$S3_ENDPOINT" \
  --from-literal=S3_BUCKET="$S3_BUCKET" \
  --from-literal=S3_REGION="$S3_REGION" \
  --from-literal=S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
  --from-literal=S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=PUBLISH_KEY="$PUBLISH_KEY" \
  --from-literal=CORS_ORIGINS="$CORS_ORIGINS"
```

Add `ASSET_BASE_URL` and `PRUNE_GRACE_DAYS` the same way if you set them.

These manifests use `0.1.0`: replace it with your version everywhere it appears. `migrate` runs as a Job named after the version, so each upgrade gets its own. Wait for it to finish before you roll out the Deployment at that version:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: game-service-migrate-0-1-0
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        runAsGroup: 65532
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: migrate
          image: ghcr.io/palmkonde/codeleagues-rpg-engine-game-service:0.1.0
          args: ["migrate"]
          envFrom: [{ secretRef: { name: game-service } }]
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities: { drop: [ALL] }
          volumeMounts: [{ name: tmp, mountPath: /tmp }]
      volumes: [{ name: tmp, emptyDir: { medium: Memory } }]
```

```sh
kubectl apply -f migrate-job.yaml
kubectl wait --for=condition=complete job/game-service-migrate-0-1-0 --timeout=5m
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-service
spec:
  replicas: 2
  selector: { matchLabels: { app: game-service } }
  template:
    metadata: { labels: { app: game-service } }
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        runAsGroup: 65532
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: game-service
          image: ghcr.io/palmkonde/codeleagues-rpg-engine-game-service:0.1.0
          args: ["serve"]
          envFrom: [{ secretRef: { name: game-service } }]
          ports: [{ containerPort: 3000 }]
          readinessProbe: { httpGet: { path: /healthz, port: 3000 }, periodSeconds: 10 }
          livenessProbe: { httpGet: { path: /healthz, port: 3000 }, periodSeconds: 30, failureThreshold: 3 }
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities: { drop: [ALL] }
          volumeMounts: [{ name: tmp, mountPath: /tmp }]
      volumes: [{ name: tmp, emptyDir: { medium: Memory } }]
---
apiVersion: v1
kind: Service
metadata:
  name: game-service
spec:
  selector: { app: game-service }
  ports: [{ port: 80, targetPort: 3000 }]
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: game-service-prune
spec:
  schedule: "17 3 * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          securityContext:
            runAsNonRoot: true
            runAsUser: 65532
            runAsGroup: 65532
            seccompProfile: { type: RuntimeDefault }
          containers:
            - name: prune
              image: ghcr.io/palmkonde/codeleagues-rpg-engine-game-service:0.1.0
              args: ["prune"]
              envFrom: [{ secretRef: { name: game-service } }]
              securityContext:
                readOnlyRootFilesystem: true
                allowPrivilegeEscalation: false
                capabilities: { drop: [ALL] }
              volumeMounts: [{ name: tmp, mountPath: /tmp }]
          volumes: [{ name: tmp, emptyDir: { medium: Memory } }]
```

`serve` keeps no state of its own, so you can run as many replicas as you like. Expose the Service through your Ingress with TLS.

## HTTP API

Every route but `/healthz` is under `/api/v1`.

| Route | Auth | What it does |
|---|---|---|
| `GET /healthz` | none | `200 ok` when Postgres answers, `503` when it doesn't |
| `GET /api/v1/worlds/:world/versions/live` | Student token | The live World Version: `{ id, assetBaseUrl, manifest }`. `404` for a World never Published |
| `GET /api/v1/worlds/:world/versions/:id` | Student token | That World Version, or `404` once it is pruned |
| `GET /api/v1/worlds/:world/flags` | Student token | The Student's Flags, or `{}` |
| `PATCH /api/v1/worlds/:world/flags` | Student token | Merges `{ key: boolean or string }` into the Student's Flags. Up to 200 keys, keys up to 128 characters, 64 KB in all: `400` for a bad body, `413` over a limit |
| `GET /api/v1/blobs/:key` | none | A World file, cacheable forever. `404` for a missing key |
| `POST /api/v1/blobs/missing` | Publish key | `{ keys }` in, `{ missing }` out: the keys the bucket lacks |
| `PUT /api/v1/blobs/:key` | Publish key | Uploads a file. `422` when the bytes don't hash to the key, `413` over 64 MiB |
| `GET /api/v1/worlds/:world/versions/live/summary` | Publish key | The live World Version's Pre-Publish summary, for `crpg` |
| `POST /api/v1/worlds/:world/versions` | Publish key | Makes a new World Version live. `409` when another Publish went live first, `422` naming a file the bucket lacks |
| `GET /api/v1/worlds/:world/versions` | Publish key | The World Versions, newest first |
| `POST /api/v1/prune` | Publish key | Runs `prune`, or with `{ version }` deletes that World Version now. `409` for the live one |

A Student token is `Authorization: Bearer <token>`, signed by the Platform ([`client.md`](client.md#tokens)). A token for another World gets `403`, and a missing, expired or badly signed one gets `401`. The Publish key is `Authorization: Bearer <PUBLISH_KEY>`, and a wrong one gets `401`.

## `/healthz`

`GET /healthz` answers `200 ok` when Postgres answers, and `503` when it doesn't. It sits outside `/api/v1`, so probes never have to follow an API version. Point your load balancer's health check at it.

## Serving files and a CDN

A Published World's files (Maps, tilesets, Characters, Portraits, CG frames, compiled Scripts) live in the bucket under `blobs/<sha256>.<ext>`. Students fetch them with no token, by key. A key is the hash of the file's bytes, so nobody can guess one, and its bytes never change. Only the World Version's manifest, which lists the keys, is token-checked.

By default the service serves these files itself at `<the URL the request came in on>/api/v1/blobs/`. Every response carries `Cache-Control: public, max-age=31536000, immutable`, so browsers keep them after the first visit.

Set `ASSET_BASE_URL` in two cases:

- **Behind a proxy that changes the host or scheme.** The service sees the internal URL, such as `http://game-service:3000`, and Students can't reach it. Set `ASSET_BASE_URL=https://game.example.com/api/v1/blobs/`.
- **Behind a CDN.** Point a CDN at `https://game.example.com/api/v1/blobs/` as its origin, and set `ASSET_BASE_URL` to the CDN's URL for that path, such as `https://cdn.example.com/blobs/`. Nothing in the bucket or on any Platform changes.

The game loads these files cross-origin from the Platform's page, so the CDN must keep CORS working for every origin in `CORS_ORIGINS`. Either forward the `Origin` header and vary the cache on it, or have the CDN add `Access-Control-Allow-Origin` for your Platform origins itself. A CDN that caches one origin's `Access-Control-Allow-Origin` and serves it to another breaks the game on the second Platform.

The trailing slash is optional: the service adds it.

## Next

Give the Platform developer the service's public URL and `JWT_SECRET`, and add their origin to `CORS_ORIGINS`. Give Authors the service's URL and `PUBLISH_KEY`. Send both secrets over a channel meant for secrets.
