'use client'

import { PlatformErrorScreen, PlatformNameContext } from './platform-error-screen.tsx'
import { locale, worldContent } from './world-content.ts'
import { useCallback, useMemo } from 'react'
import type { GameError } from '@codeleagues-rpg-engine/client'
import { Game as GameView } from '@codeleagues-rpg-engine/client/react'
import type { SlotComponents } from '@codeleagues-rpg-engine/client/react'
import type { WorldConfig } from '@codeleagues-rpg-engine/engine-core'

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
export function Game({ serviceUrl, worldId, studentId, worldConfig }: { serviceUrl: string; worldId: string; studentId: string; worldConfig: WorldConfig }): React.ReactElement {
  const world = useMemo(() => ({ ...worldContent, worldConfig }), [worldConfig])
  const getToken = useCallback(() => requestToken(studentId), [studentId])

  return (
    <PlatformNameContext value={PLATFORM_NAME}>
      <div style={GAME_STYLE}>
        <GameView
          components={COMPONENTS}
          getToken={getToken}
          locale={locale}
          onError={onError}
          serviceUrl={serviceUrl}
          world={world}
          worldId={worldId}
        />
      </div>
    </PlatformNameContext>
  )
}
