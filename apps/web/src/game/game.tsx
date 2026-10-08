'use client'

import { PlatformErrorScreen, PlatformNameContext } from './platform-error-screen.tsx'
import type { GameError } from '@codeleagues-rpg-engine/client'
import { Game as GameView } from '@codeleagues-rpg-engine/client/react'
import type { SlotComponents } from '@codeleagues-rpg-engine/client/react'
import { useCallback } from 'react'

const GAME_STYLE = { width: '100vw', height: '100vh' }

const PLATFORM_NAME = 'The Reference Platform'

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
