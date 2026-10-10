# Client package reference

For Platform developers. `@codeleagues-rpg-engine/client` is the game your Platform mounts on its own pages. This page covers its whole public API. For a first setup, follow [`getting-started.md`](getting-started.md). To change how the game looks, see [`ui-overrides.md`](ui-overrides.md). `apps/web` in this repository is a working Next.js example.

## Install

```sh
npm install @codeleagues-rpg-engine/client@<version>
```

- Use the Game Service's version: the client, `crpg` and the service release together.
- `phaser` and `grid-engine` come with it as dependencies. Preact is bundled inside it.
- The `./react` entry needs `react` and `react-dom` 19, as optional peers. The core entry works without React.

| Entry | Exports |
|---|---|
| `@codeleagues-rpg-engine/client` | `mount`, `GameError`, and the types `GameOptions`, `MountOptions`, `GameInstance`, `GameErrorKind`, `HostSnapshot`, `DialogueView`, `ChoiceView`, `CgView`, `Flags`, `SlotName`, `SlotProps`, `SlotRenderer`, `SlotHandle`, `SlotOverrides` |
| `@codeleagues-rpg-engine/client/react` | `Game`, `useGame`, and the types `GameProps`, `UseGame`, `SlotComponent`, `SlotComponents` |

## What you need from others

| Value | From |
|---|---|
| The Game Service's URL | the operator ([`game-service.md`](game-service.md)) |
| Its `JWT_SECRET` | the operator |
| Your Platform's origin added to its `CORS_ORIGINS` | the operator |
| A Published World id | an Author ([`crpg.md`](crpg.md)) |

## Tokens

The game proves who is playing with a short-lived token your server signs. Your server decides who the Student is and which World they may play, from your own sign-in and enrollment.

| Part | Value |
|---|---|
| Algorithm | `HS256`, signed with the Game Service's `JWT_SECRET` |
| `sub` | Your Student id: any stable, opaque string. Flags are stored under it, and it is never shown |
| `world` | The World id this Student may play |
| `aud` | `game-service` |
| `exp` | Required. An hour is plenty: the game asks for a new token when one expires |

A token for another World is refused with `403`. A missing, expired or badly signed one is refused with `401`. Any server language works, because the token is a standard JWT. With `jose` in a Next.js route handler:

```ts
import { SignJWT } from 'jose'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {throw new Error('JWT_SECRET is not set')}
const secret = new TextEncoder().encode(jwtSecret)

export async function POST(): Promise<Response> {
  // Your own sign-in decides who this is and whether they may play this World.
  const student = await currentStudent()
  if (!student) {return new Response('Not signed in', { status: 401 })}
  const worldId = await worldForCourse(student.courseId)

  const token = await new SignJWT({ world: worldId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(student.id)
    .setAudience('game-service')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
  return Response.json({ token })
}
```

Take the Student from your session, never from the request body. (`apps/web` takes it from `?student=` so contributors can switch Students, and marks that spot as where a real Platform checks its session.)

## `mount(element, options)`

Mounts the game into `element` and returns a [`GameInstance`](#gameinstance).

```ts
import { mount } from '@codeleagues-rpg-engine/client'

async function getToken(): Promise<string> {
  const response = await fetch('/api/game-token', { method: 'POST' })
  if (!response.ok) {throw new Error(`No game token (HTTP ${response.status})`)}
  const { token } = await response.json()
  return token
}

const game = mount(document.querySelector('#game')!, {
  serviceUrl: 'https://game.example.com',
  worldId: 'forest-course',
  getToken,
  onError: (error) => console.error(`[game] ${error.kind}`, error),
  locale: 'en',
})

// Later, on leaving the page:
game.unmount()
```

### Options

| Option | Type | Required | What it does |
|---|---|---|---|
| `serviceUrl` | `string` | yes | The Game Service's URL |
| `worldId` | `string` | yes | The World to play. It must match the token's `world` |
| `getToken` | `() => Promise<string>` | yes | Returns a Student token. It is called at mount, and again after any `401`, when the request is retried once. Reject when the Student is signed out |
| `onError` | `(error: GameError) => void` | no | Called with every error, whether or not the error screen shows it |
| `locale` | `string` | no | The String Table Locale to show, such as `th`. Defaults to `en`. A key missing in that Locale falls back to `en`, then shows as `[key]` |
| `slots` | `SlotOverrides` | no | Your own renderers for pieces of the UI. See [`ui-overrides.md`](ui-overrides.md) |

### Behaviour

- The game fills `element`. Give `element` a size: the game draws nothing in a zero-height box.
- Phaser is loaded only when `mount` runs, so importing the package on a server is safe. `mount` itself must run in a browser.
- Mounting into an element that already holds a game throws an error. Unmount first.
- Each mount has its own state. Mounting again, even for the same Student, starts fresh and reads Flags from the service.
- Flags are read once at mount. Each change is saved to the service in order. A failed save is retried 3 times over about 5 seconds, then the game stops with `unavailable`. Two open tabs each keep their own copy until reloaded.
- A session keeps the World Version it started on. A Publish mid-session reaches the Student on their next mount.

## `GameInstance`

What `mount` returns. The built-in overlays use the same actions.

| Member | What it does |
|---|---|
| `unmount()` | Tears down the game, its overlays and any running Script. Safe to call twice |
| `getSnapshot()` | Returns the current [`HostSnapshot`](#hostsnapshot). The same object until something changes |
| `subscribe(listener)` | Calls `listener` on every change. Returns a function that unsubscribes |
| `advance()` | Shows the next Dialogue line |
| `choose(index)` | Picks a choice. `index` counts every shown choice, locked ones included |
| `dismissDialogue()` | Closes the Dialogue, ending the Script there. Only when `dialogue.canDismiss` is true |
| `advanceCg()` | Shows the next CG frame, or ends the CG after the last |
| `skipCg()` | Ends the CG |
| `dismissCompanion(entityId)` | Sends a Companion away |
| `setLocale(locale)` | Switches the Locale. Text on screen changes at once |

## `HostSnapshot`

What the game is showing. A custom UI draws from it ([`ui-overrides.md`](ui-overrides.md)).

```ts
interface HostSnapshot {
  status: 'loading' | 'playing' | 'error'
  dialogue: DialogueView | undefined
  cg: CgView | undefined
  companions: readonly string[]     // Entity ids; empty while a Cutscene holds the Player
  error: GameError | undefined
}

type DialogueView =
  | { type: 'line'; speaker: string; text: string; portrait: string | undefined; canDismiss: boolean }
  | { type: 'choices'; choices: ChoiceView[]; canDismiss: boolean }

interface ChoiceView {
  text: string
  locked: string | undefined        // why it can't be picked, or undefined
}

interface CgView {
  art: string | undefined           // the frame's image URL
  caption: string
  hasMore: boolean
}
```

- `portrait` is the Portrait image's URL, or `undefined` when the Speaker has none for that Expression.
- `canDismiss` is `false` while a Cutscene or CG holds the Player.

## Errors

Every error reaches `onError` as a `GameError` (a subclass of `Error`) with a `kind`:

| `kind` | Cause | Built-in message | Usual fix |
|---|---|---|---|
| `token` | `getToken()` rejected | We couldn't confirm who you are. Sign in again to play. | Check your token route |
| `unauthorized` | The service refused the token, even after a fresh one | Your sign-in has expired. Sign in again to play. | Your `JWT_SECRET` differs from the service's |
| `forbidden` | The token's `world` isn't this `worldId` | You don't have access to this World. | Sign the World you mount |
| `worldUpdated` | The session's World Version was pruned | This World was updated. Reload to continue. | The Student reloads |
| `unavailable` | The service is unreachable or answered `5xx`, the World was never Published, or a Flag save failed | The game is unavailable right now. Try again later. | Check the URL, `CORS_ORIGINS` and the service's health, or ask the Author to Publish |

The first error stops the game, and the error screen covers it. To show your own screen, override the `ErrorScreen` slot ([`ui-overrides.md`](ui-overrides.md)).

## React: `<Game>`

```tsx
'use client'

import { Game } from '@codeleagues-rpg-engine/client/react'

export function CourseGame({ worldId }: { worldId: string }) {
  return (
    <div style={{ width: '100%', height: '80vh' }}>
      <Game serviceUrl="https://game.example.com" worldId={worldId} getToken={getToken} onError={logGameError} />
    </div>
  )
}
```

- Props: every [option](#options) except `slots`, plus `components`, your own UI pieces as React components ([`ui-overrides.md`](ui-overrides.md)).
- It mounts once per `serviceUrl` and `worldId`, and remounts when either changes.
- The latest `getToken`, `onError` and `locale` are always used, so inline functions are fine.
- To switch Students on one page, give it a `key` per Student, so the new Student starts fresh.
- It renders a `div` that fills its parent. Size the parent.
- In a Next.js App Router page it needs `'use client'`, like any component that runs in the browser.

## React: `useGame(options)`

Mounts the game with no built-in overlays, for a Platform that draws all of its UI. It takes the same options as `<Game>` (without `components`) and returns:

| Field | What it is |
|---|---|
| `ref` | Put it on the element the game mounts into |
| `snapshot` | The current [`HostSnapshot`](#hostsnapshot). The component re-renders when it changes |
| `game` | The [`GameInstance`](#gameinstance), or `undefined` until mounted |

An example is in [`ui-overrides.md`](ui-overrides.md#drawing-all-the-ui-yourself).
