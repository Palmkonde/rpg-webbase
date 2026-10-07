/** @jsxImportSource preact */
import { SCREEN_MESSAGE_STYLE, SCREEN_STYLE } from './screen-style.ts'
import type { GameErrorKind } from '../game-error.ts'
import type { JSX } from 'preact'

// The Student sees what to do next; the error's own message is for the Platform's `onError`.
const ERROR_MESSAGES: Record<GameErrorKind, string> = {
  token: 'We couldn\'t confirm who you are. Sign in again to play.',
  unauthorized: 'Your sign-in has expired. Sign in again to play.',
  forbidden: 'You don\'t have access to this World.',
  worldUpdated: 'This World was updated. Reload to continue.',
  unavailable: 'The game is unavailable right now. Try again later.',
}

export function ErrorScreen({ kind }: { kind: GameErrorKind }): JSX.Element {
  return (
    <div role="alert" style={SCREEN_STYLE}>
      <p style={SCREEN_MESSAGE_STYLE}>{ERROR_MESSAGES[kind]}</p>
    </div>
  )
}
