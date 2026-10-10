# UI overrides reference

For Platform developers. The game draws its own UI over the Map: Dialogue, choices, Portraits, CG, Companions, and the loading and error screens. You can change it at three levels:

| Level | You change | Use it for |
|---|---|---|
| [CSS variables](#css-variables) | Colours, font, corner radius | Matching your Platform's look |
| [Slots](#slots) | One piece of UI, such as the Dialogue box | Your own components for some pieces |
| [Headless](#drawing-all-the-ui-yourself) | All of it | Your own UI for everything |

How to mount the game is in [`client.md`](client.md).

## CSS variables

Set them on the mount element or any parent. They restyle the built-in UI only, not your own slots.

| Variable | Styles | Default |
|---|---|---|
| `--rpg-font` | All text | `inherit` |
| `--rpg-text` | Text colour of the Dialogue, CG and screens | `white` |
| `--rpg-panel-bg` | The Dialogue panel | `rgba(20, 20, 20, 0.9)` |
| `--rpg-panel-radius` | The Dialogue panel's corners | `0.5rem` |
| `--rpg-cg-bg` | Behind CG art | `black` |
| `--rpg-screen-bg` | Loading and error screens | `black` |

```css
.course-game {
  --rpg-font: 16px/1.4 "Inter", sans-serif;
  --rpg-panel-bg: #1b1030;
  --rpg-panel-radius: 0;
}
```

## Slots

Each piece of UI is a slot. Pass your own renderer for a slot, and the game draws yours instead of the built-in.

```text
Loading             while the World loads
ErrorScreen         after an error; covers everything
CG                  while a CG plays
Companions          while a Companion follows the Player
Dialogue            while a Script shows a line or choices
├── Dialogue.Portrait   beside a line, when the Speaker has a Portrait
└── Choices             when the Script offers choices
    └── Choices.Button  one per choice
```

### Rules

- **Replacing a parent drops its built-in children.** If you replace `Dialogue`, the game no longer draws `Dialogue.Portrait` or `Choices`: your `Dialogue` draws them. Replace `Dialogue.Portrait` alone to keep the built-in Dialogue box with your own Portrait.
- **What shows when.** `ErrorScreen` replaces everything once an error happens. Otherwise `Loading` shows until the World is ready. After that `CG`, `Companions` and `Dialogue` each show while they have something to show, and more than one can show at once.
- **Where yours goes.** Your slot gets an empty element with `display: contents` in the built-in's place. Top-level slots (`Loading`, `ErrorScreen`, `CG`, `Companions`, `Dialogue`) sit over the game area, which is `position: relative`: position yours with `position: absolute`. `Dialogue.Portrait` sits inside the built-in line, which is a `<button>`, so draw inline content there. `Choices.Button` sits inside the built-in choices list.
- **Types.** A misspelt slot name, or a renderer for the wrong props, is a type error. A package upgrade that changes a slot breaks your build, not your Students' screens.
- **Accessibility.** The built-ins use real `<button>` elements, so the keyboard works. Keep yours keyboard-operable too.

### Slot props

| Slot | Props |
|---|---|
| `Loading` | none |
| `ErrorScreen` | `error: GameError`. `error.kind` is `'token'`, `'unauthorized'`, `'forbidden'`, `'worldUpdated'` or `'unavailable'` ([meanings](client.md#errors)) |
| `Dialogue` | `dialogue: DialogueView`, `advance()`, `choose(index)`, `dismissDialogue()` |
| `Dialogue.Portrait` | `speaker: string`, `src: string` (the image URL) |
| `Choices` | `choices: readonly ChoiceView[]`, `choose(index)` |
| `Choices.Button` | `choice: ChoiceView`, `index: number`, `choose(index)` |
| `CG` | `cg: CgView`, `advanceCg()`, `skipCg()` |
| `Companions` | `companions: readonly string[]` (Entity ids), `dismissCompanion(entityId)` |

The view types:

```ts
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

What each built-in does, so yours can match it:

| Slot | Built-in behaviour |
|---|---|
| `Dialogue` | A panel at the bottom centre. A line is a button: clicking it calls `advance()`. Choices go to `Choices`. A **Close** button calls `dismissDialogue()`, shown only when `dialogue.canDismiss` is true |
| `Dialogue.Portrait` | A 96×96 image beside the line |
| `Choices.Button` | A button that calls `choose(index)`. A locked choice is disabled, with `choice.locked` shown as the reason |
| `CG` | The art fills the game area. Clicking it calls `advanceCg()`. A **Skip** button calls `skipCg()`. A ▼ shows while `hasMore` is true |
| `Companions` | One **Dismiss** button per Companion, each calling `dismissCompanion(entityId)` |
| `Loading`, `ErrorScreen` | A full-cover screen with one message. The error messages are listed in [`client.md`](client.md#errors) |

### In React

Pass components to `<Game>` through `components`. Each one renders through a portal inside your own React tree, so your context providers (theme, i18n, router) still reach it.

```tsx
'use client'

import type { SlotProps } from '@codeleagues-rpg-engine/client'
import { Game } from '@codeleagues-rpg-engine/client/react'
import type { SlotComponents } from '@codeleagues-rpg-engine/client/react'

const PANEL = { position: 'absolute', left: 16, right: 16, bottom: 16, padding: 16, background: '#1b1030', color: 'white' } as const

function Dialogue({ dialogue, advance, choose, dismissDialogue }: SlotProps['Dialogue']) {
  return (
    <div style={PANEL}>
      {dialogue.type === 'line'
        ? (
          <button type="button" onClick={advance}>
            <strong>{dialogue.speaker}</strong>
            <p>{dialogue.text}</p>
          </button>
        )
        : dialogue.choices.map((choice, index) => (
          <button key={index} type="button" disabled={choice.locked !== undefined} onClick={() => choose(index)}>
            {choice.text}
          </button>
        ))}
      {dialogue.canDismiss && <button type="button" onClick={dismissDialogue}>Close</button>}
    </div>
  )
}

function ErrorScreen({ error }: SlotProps['ErrorScreen']) {
  return <div role="alert" style={{ position: 'absolute', inset: 0, background: 'black', color: 'white' }}>Something went wrong ({error.kind}).</div>
}

const components: SlotComponents = { Dialogue, ErrorScreen }

export function CourseGame() {
  return <Game components={components} serviceUrl={serviceUrl} worldId={worldId} getToken={getToken} />
}
```

- Define `components` outside the component, or memoise it. Which slots are replaced is read when the game mounts, so adding or removing a slot later has no effect until it remounts.
- This `Dialogue` replaces the whole box, so it draws the choices itself, and shows no Portraits.

### In plain JavaScript

Pass renderers to `mount` through `slots`. A renderer gets the empty element and the first props, draws, and returns `update` (called with each new set of props) and `destroy` (called when the slot goes away):

```ts
import { mount } from '@codeleagues-rpg-engine/client'
import type { SlotRenderer, SlotProps } from '@codeleagues-rpg-engine/client'

const errorScreen: SlotRenderer<SlotProps['ErrorScreen']> = (element, { error }) => {
  const message = document.createElement('p')
  element.append(message)
  const show = ({ error }: SlotProps['ErrorScreen']) => { message.textContent = `Something went wrong (${error.kind}).` }
  show({ error })
  return { update: show, destroy: () => message.remove() }
}

mount(element, { serviceUrl, worldId, getToken, slots: { ErrorScreen: errorScreen } })
```

A renderer can use any library. Render into `element`, and clean up in `destroy`.

## Drawing all the UI yourself

`useGame` mounts the game with no built-in UI at all. Draw everything from `snapshot`, and call the actions on `game`:

```tsx
import { useGame } from '@codeleagues-rpg-engine/client/react'

// Inside your component:
const { ref, snapshot, game } = useGame({ serviceUrl, worldId, getToken })

return (
  <div style={{ position: 'relative', width: '100%', height: '80vh' }}>
    <div ref={ref} style={{ width: '100%', height: '100%' }} />
    {snapshot.dialogue && <MyDialogue dialogue={snapshot.dialogue} onNext={() => game?.advance()} />}
  </div>
)
```

`snapshot` is a [`HostSnapshot`](client.md#hostsnapshot). With no built-in UI, you also draw the loading and error states (from `snapshot.status` and `snapshot.error`), CGs and Companions. `game` is `undefined` until the game has mounted.
