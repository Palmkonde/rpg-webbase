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
