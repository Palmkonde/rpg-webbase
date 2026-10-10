# Getting started

This tutorial takes you from nothing to playing a World in your own web app, all on one machine. On the way you do each role's job:

1. **Operator:** run the Game Service, which keeps Worlds and Students' progress.
2. **Author:** make a tiny World and Publish it.
3. **Platform developer:** build a web app that signs a Student in and mounts the game.
4. **Student:** play, and see your progress saved.

It takes about 30 minutes. Each step says what you should see. The pages it links to are the full reference for each role.

## What you need

- **Docker**, with Compose 2.20 or later (Docker Desktop includes both).
- **Node.js 20.12** or later, with `npm`.
- A terminal. The commands are for macOS and Linux shells.
- Optional: [Tiled](https://www.mapeditor.org/), to look at the Map you make.

Everything goes in one folder:

```sh
mkdir -p ~/rpg && cd ~/rpg
```

```text
~/rpg/
├── game-service/   part 1
├── my-content/     part 2
└── my-platform/    part 3
```

## Part 1: Run the Game Service

You are the **operator** here. Reference: [`game-service.md`](game-service.md).

**1.1** Download the setup wizard and the Compose file:

```sh
mkdir ~/rpg/game-service && cd ~/rpg/game-service
curl -fsSLO https://raw.githubusercontent.com/Palmkonde/rpg-webbase/main/scripts/operator-install.sh
curl -fsSLO https://raw.githubusercontent.com/Palmkonde/rpg-webbase/main/deploy/compose.yaml
```

**1.2** Run the wizard:

```sh
bash operator-install.sh
```

Answer it like this:

| It asks | Answer |
|---|---|
| Use the newest release? | `y` |
| Run Postgres and the bucket in the compose file? | Enter (yes) |
| `CORS_ORIGINS` | `http://localhost:3001`, where your web app will run |
| `ASSET_BASE_URL` | Enter (leave it empty) |

It writes every setting to `.env`, including two secrets you use later: `JWT_SECRET` and `PUBLISH_KEY`.

**1.3** Start it:

```sh
docker compose up -d --wait
curl http://localhost:3000/healthz
```

You should see `ok`. The Game Service, its Postgres and its bucket are running in Docker.

## Part 2: Make a World

You are the **Author** here. Reference: [`crpg.md`](crpg.md) and [`content-folder.md`](content-folder.md).

A World is a folder of Maps, art and Scripts. You'll make one Map with a wall around a meadow, a player Character, and a Guide who talks to you.

**2.1** Install `crpg`, the command that checks and Publishes Worlds:

```sh
npm install -g @codeleagues-rpg-engine/cli
crpg --help
```

**2.2** Make a content folder, and the art. This script draws placeholder art in plain colours, with nothing to install:

```sh
mkdir ~/rpg/my-content && cd ~/rpg/my-content
```

Save it as `make-art.mjs`:

```js
// Draws placeholder art for the Getting Started World: a 2-tile tileset and two Character sheets.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname } from 'node:path'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes) {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

// Writes an RGBA PNG; colorAt(x, y) returns [r, g, b, a].
function png(file, width, height, colorAt) {
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rows.set(colorAt(x, y), y * (width * 4 + 1) + 1 + x * 4)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bits per channel
  header[9] = 6 // RGBA
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

const CLEAR = [0, 0, 0, 0]
const WHITE = [255, 255, 255, 255]

// Tile 1 is grass, tile 2 is a wall.
png('worlds/first-world/tilesets/tiles.png', 64, 32, (x, y) => {
  if (x < 32) return (x * 7 + y * 3) % 11 === 0 ? [70, 135, 60, 255] : [90, 160, 75, 255]
  return y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0 ? [80, 80, 90, 255] : [120, 120, 130, 255]
})

// A 3x4 grid of 32x32 frames: rows face down, left, right, up; columns are left foot, standing, right foot.
function character(id, body) {
  png(`library/characters/${id}/${id}.png`, 96, 128, (x, y) => {
    const column = Math.floor(x / 32)
    const row = Math.floor(y / 32)
    const fx = x % 32
    const fy = (y % 32) - (column === 1 ? 0 : 1)
    if (fx < 8 || fx >= 24 || fy < 4 || fy >= 30) return CLEAR
    const eyes = [[12, 19], [10], [21], []][row]
    if (fy >= 9 && fy < 12 && eyes.some((eye) => fx === eye || fx === eye + 1)) return WHITE
    return body
  })
  writeFileSync(`library/characters/${id}/character.json`, `${JSON.stringify({ frameWidth: 32, frameHeight: 32 })}\n`)
}

character('hero', [60, 110, 200, 255])
character('guide', [220, 130, 40, 255])
```

Run it:

```sh
node make-art.mjs
```

It writes three images:

| File | What it is |
|---|---|
| `worlds/first-world/tilesets/tiles.png` | Two 32×32 tiles: grass, and a wall |
| `library/characters/hero/hero.png` | A blue Character: 3 frames for each of 4 directions |
| `library/characters/guide/guide.png` | The same, in orange |

It also writes a `character.json` beside each Character, with its frame size. `library/` is the Asset Library, art any World can use. The tileset sits in the World's own folder. [`content-folder.md`](content-folder.md) explains where everything goes.

**2.3** Start the World's Tiled project:

```sh
crpg tiled first-world
```

You should see `Wrote worlds/first-world/first-world.tiled-project`. `crpg tiled` created the World's other folders, and placeholder `world.json` and `strings.json` files. Its Character list holds `guide` and `hero`, from the art you just made.

**2.4** Make the Map. Save this as `worlds/first-world/maps/meadow.tmj`:

```json
{
  "type": "map",
  "version": "1.10",
  "orientation": "orthogonal",
  "renderorder": "right-down",
  "infinite": false,
  "width": 10,
  "height": 8,
  "tilewidth": 32,
  "tileheight": 32,
  "nextlayerid": 3,
  "nextobjectid": 2,
  "tilesets": [
    {
      "firstgid": 1,
      "name": "tiles",
      "image": "../tilesets/tiles.png",
      "imagewidth": 64,
      "imageheight": 32,
      "tilewidth": 32,
      "tileheight": 32,
      "tilecount": 2,
      "columns": 2,
      "margin": 0,
      "spacing": 0,
      "tiles": [
        { "id": 1, "properties": [{ "name": "ge_collide", "type": "bool", "value": true }] }
      ]
    }
  ],
  "layers": [
    {
      "id": 1,
      "name": "ground",
      "type": "tilelayer",
      "x": 0,
      "y": 0,
      "width": 10,
      "height": 8,
      "opacity": 1,
      "visible": true,
      "properties": [{ "name": "ge_charLayer", "type": "string", "value": "ground" }],
      "data": [
        2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
        2, 1, 1, 1, 1, 1, 1, 1, 1, 2,
        2, 1, 1, 1, 1, 1, 1, 1, 1, 2,
        2, 1, 1, 1, 1, 1, 1, 1, 1, 2,
        2, 1, 1, 1, 1, 1, 1, 1, 1, 2,
        2, 1, 1, 1, 1, 1, 1, 1, 1, 2,
        2, 1, 1, 1, 1, 1, 1, 1, 1, 2,
        2, 2, 2, 2, 2, 2, 2, 2, 2, 2
      ]
    },
    {
      "id": 2,
      "name": "objects",
      "type": "objectgroup",
      "x": 0,
      "y": 0,
      "opacity": 1,
      "visible": true,
      "objects": [
        {
          "id": 1,
          "name": "Guide",
          "type": "Entity",
          "x": 192,
          "y": 96,
          "width": 32,
          "height": 32,
          "rotation": 0,
          "visible": true,
          "properties": [
            { "name": "entityId", "type": "string", "value": "Guide" },
            { "name": "characterId", "type": "string", "propertytype": "CharacterId", "value": "guide" },
            { "name": "facing", "type": "string", "propertytype": "Facing", "value": "left" }
          ]
        }
      ]
    }
  ]
}
```

This is the JSON that Tiled saves:

- The `ground` layer is the meadow: tile `1` is grass, tile `2` is a wall. The wall tile has `ge_collide`, so nobody walks through it. `ge_charLayer` marks the layer Characters walk on.
- The `objects` layer holds one Entity, the Guide. It stands on tile (6, 3), wears the `guide` Character, and faces left.

To see it, open `worlds/first-world/first-world.tiled-project` in Tiled, then the Map. [`tiled-object-authoring.md`](tiled-object-authoring.md) shows how to place objects there yourself.

**2.5** Say where the Player starts. Replace `worlds/first-world/world.json` with:

```json
{
  "startMap": "meadow",
  "spawn": { "x": 2, "y": 3 },
  "player": "hero"
}
```

**2.6** Write the Guide's Script. Save this as `worlds/first-world/scripts/cast.clsc`. It declares the Guide, an Entity that can speak and move:

```clsc
mover Guide;
```

Then save this as `worlds/first-world/scripts/guide.clsc`:

```clsc
flag met_guide: bool = false;

on interact(Guide) with Guide {
    if met_guide {
        Guide: "Welcome back! I remembered you, because your progress is saved on the Game Service.";
        return;
    }
    Guide: "Hello! Walk with the arrow keys, and press E to talk.";
    Guide: "Now reload the page and talk to me again.";
    set met_guide = true;
}
```

The Script runs each time the Player talks to the Guide. `met_guide` is a Flag: a value saved for each Student. [`codeleagues-script.md`](codeleagues-script.md) covers the language.

**2.7** Point `crpg` at your Game Service. It reads `.env` in the content folder:

```sh
echo 'GAME_SERVICE_URL=http://localhost:3000' > .env
grep '^PUBLISH_KEY=' ../game-service/.env >> .env
```

**2.8** Check the World, without uploading anything:

```sh
crpg publish first-world --dry-run
```

You should see `Checked World "first-world": 0 errors, 0 warnings.` If you see an error, it names the file and the problem.

**2.9** Publish it. A World's first Publish needs `--new`:

```sh
crpg publish first-world --new
```

You should see `Published World "first-world": version … is live.`

## Part 3: Build the Platform

You are the **Platform developer** here. Reference: [`client.md`](client.md) and [`ui-overrides.md`](ui-overrides.md).

A Platform is the web app a Student signs in to. Yours is a Next.js app with one page that mounts the game, and one route that signs the Student's token. The code is the same as the reference Platform in this repository, `apps/web`.

**3.1** Create the app, and install the game and a JWT library:

```sh
cd ~/rpg
npx create-next-app@latest my-platform --yes --src-dir --use-npm
cd my-platform
npm install @codeleagues-rpg-engine/client jose
```

**3.2** Configure it. The app signs tokens with the Game Service's `JWT_SECRET`, so copy it over:

```sh
printf 'GAME_SERVICE_URL=http://localhost:3000\nWORLD_ID=first-world\n' > .env.local
grep '^JWT_SECRET=' ../game-service/.env >> .env.local
```

**3.3** Add the settings reader. Save as `src/env.ts`:

```ts
// Server-side only: the one place the Platform reads its configuration.
export function requireEnv(name: 'GAME_SERVICE_URL' | 'WORLD_ID' | 'JWT_SECRET'): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set: add it to .env.local`)
  }
  return value
}
```

**3.4** Add the token route. Save as `src/app/api/game-token/route.ts`:

```ts
import { SignJWT } from 'jose'
import { requireEnv } from '@/env'

const BAD_REQUEST = 400

// The Game Service refuses a token signed for any other audience (adr/0036).
const AUDIENCE = 'game-service'
const LIFETIME = '1h'

function readStudentId(body: unknown): string | undefined {
  const studentId = typeof body === 'object' && body !== null && 'studentId' in body ? body.studentId : undefined
  return typeof studentId === 'string' && studentId !== '' ? studentId : undefined
}

// Signs a World-scoped token for the Student the page names.
export async function POST(request: Request): Promise<Response> {
  const studentId = readStudentId(await request.json().catch(() => ({})))
  if (!studentId) {
    return Response.json({ error: 'studentId must be a non-empty string' }, { status: BAD_REQUEST })
  }

  // A real Platform checks its own session here, and that the signed-in Student may play this World, instead of trusting the body.
  const token = await new SignJWT({ world: requireEnv('WORLD_ID') })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(studentId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(LIFETIME)
    .sign(new TextEncoder().encode(requireEnv('JWT_SECRET')))
  return Response.json({ token })
}
```

The game calls this route for a token that says which Student is playing which World. Here the Student id comes from the page. A real Platform takes it from its own sign-in instead ([`client.md`](client.md#tokens)).

**3.5** Add your own error screen, a UI override. Save as `src/game/platform-error-screen.tsx`:

```tsx
'use client'

import type { GameErrorKind, SlotProps } from '@codeleagues-rpg-engine/client'
import { createContext, useContext } from 'react'

// Stands in for whatever a real Platform provides above the game (theme, i18n, its name); the override reading it proves the portal keeps React context.
export const PlatformNameContext = createContext('an unknown Platform')

const SCREEN_STYLE = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  padding: '1.5rem',
  background: '#1b1030',
  color: '#f5e9ff',
  textAlign: 'center',
} as const

const NEXT_STEPS: Record<GameErrorKind, string> = {
  token: 'Sign in again, then come back to this page.',
  unauthorized: 'Your session ended. Sign in again to keep playing.',
  forbidden: 'Ask your teacher to enroll you in this World.',
  worldUpdated: 'This World was updated. Reload to continue.',
  unavailable: 'The game service is down. Try again in a few minutes.',
}

export function PlatformErrorScreen({ error }: SlotProps['ErrorScreen']): React.ReactElement {
  const platformName = useContext(PlatformNameContext)

  return (
    <div role="alert" style={SCREEN_STYLE}>
      <h1>{`${platformName} couldn't start the game`}</h1>
      <p>{NEXT_STEPS[error.kind]}</p>
    </div>
  )
}
```

**3.6** Add the game component. Save as `src/game/game.tsx`:

```tsx
'use client'

import { PlatformErrorScreen, PlatformNameContext } from './platform-error-screen'
import type { GameError } from '@codeleagues-rpg-engine/client'
import { Game as GameView } from '@codeleagues-rpg-engine/client/react'
import type { SlotComponents } from '@codeleagues-rpg-engine/client/react'
import { useCallback } from 'react'

const GAME_STYLE = { width: '100vw', height: '100vh' }

const PLATFORM_NAME = 'My Platform'

// One override, so this Platform shows slot overrides working.
const COMPONENTS: SlotComponents = { ErrorScreen: PlatformErrorScreen }

// This Platform's own route signs the token (adr/0036); a rejection shows the Student the `token` ErrorScreen.
async function requestToken(studentId: string): Promise<string> {
  const response = await fetch('/api/game-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ studentId }),
  })
  if (!response.ok) {
    throw new Error(`The Platform refused a game token (HTTP ${response.status})`)
  }
  const { token } = await response.json() as { token: string }
  return token
}

// Where a real Platform would log or react to each kind; the ErrorScreen override already shows the Student a message.
function onError(error: GameError): void {
  console.error(`[game] ${error.kind}:`, error)
}

// A client component: a Server Component can't hand `getToken`, `onError` or the overrides down as props.
export function Game({ serviceUrl, worldId, studentId }: { serviceUrl: string; worldId: string; studentId: string }): React.ReactElement {
  const getToken = useCallback(() => requestToken(studentId), [studentId])

  return (
    <PlatformNameContext value={PLATFORM_NAME}>
      <div style={GAME_STYLE}>
        <GameView
          components={COMPONENTS}
          getToken={getToken}
          onError={onError}
          serviceUrl={serviceUrl}
          worldId={worldId}
        />
      </div>
    </PlatformNameContext>
  )
}
```

`<Game>` mounts the game. `components` replaces the built-in error screen with yours ([`ui-overrides.md`](ui-overrides.md)).

**3.7** Replace the home page. Save as `src/app/page.tsx`:

```tsx
import { Game } from '@/game/game'
import { Suspense } from 'react'
import { requireEnv } from '@/env'

// Stands in for the signed-in Student, so switching it shows another Student's Flags.
const DEFAULT_STUDENT = 'dev-student'

function readStudentId(student: string | string[] | undefined): string {
  return typeof student === 'string' && student !== '' ? student : DEFAULT_STUDENT
}

async function StudentGame({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.ReactElement> {
  const { student } = await searchParams
  const studentId = readStudentId(student)

  // Keyed by the Student, so switching `?student=` remounts the game instead of carrying one Student's Flags into another's.
  return <Game key={studentId} serviceUrl={requireEnv('GAME_SERVICE_URL')} studentId={studentId} worldId={requireEnv('WORLD_ID')} />
}

export default function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): React.ReactElement {
  return (
    <Suspense>
      <StudentGame searchParams={searchParams} />
    </Suspense>
  )
}
```

**3.8** Start it on port 3001, since the Game Service has 3000:

```sh
npm run dev -- --port 3001
```

## Part 4: Play

You are the **Student** now.

1. Open <http://localhost:3001>. You see "Loading…", then the meadow, with your blue Character on the left and the orange Guide on the right.
2. Walk right with the arrow keys (or W, A, S, D) until you stand next to the Guide, facing it. Press **E** to talk. Click the text to read on.
3. Reload the page and talk to the Guide again. It says "Welcome back!": the `met_guide` Flag was saved on the Game Service.
4. Open <http://localhost:3001/?student=someone-else>. This is a new Student, so the Guide greets you as a stranger.

**See your UI override.** In `.env.local`, change one character of `JWT_SECRET`, then restart `npm run dev` and reload. The service refuses the token, and your error screen shows "My Platform couldn't start the game". Put the secret back and restart.

## Part 5: Change the World

1. In `guide.clsc`, change the Guide's first line.
2. Publish again, this time without `--new`:

   ```sh
   cd ~/rpg/my-content
   crpg publish first-world
   ```

3. Reload the game and talk to the Guide.

If a Publish adds or removes a Flag, a Zone or a Companion, `crpg` lists it and asks before going live. Students' saved Flags are never migrated, so it checks with you first.

## Next steps

| To | Read |
|---|---|
| Deploy the Game Service for real, on Compose or Kubernetes | [`game-service.md`](game-service.md) |
| Sign real Students in, or use the game without React | [`client.md`](client.md) |
| Restyle or replace the game's UI | [`ui-overrides.md`](ui-overrides.md) |
| Draw Maps in Tiled | [`tiled-object-authoring.md`](tiled-object-authoring.md) |
| Write Dialogue, choices, Cutscenes and CGs | [`codeleagues-script.md`](codeleagues-script.md) |
| Add Characters, Portraits and CG art | [`character-spritesheet-layout.md`](character-spritesheet-layout.md), [`dialogue-portrait-assets.md`](dialogue-portrait-assets.md), [`cg-art-assets.md`](cg-art-assets.md) |
| Every `crpg` command and check | [`crpg.md`](crpg.md) |

To stop everything, press Ctrl-C in the `npm run dev` terminal, then run `docker compose down` in `~/rpg/game-service`. Your data stays in Docker volumes. `docker compose down -v` deletes it too.
