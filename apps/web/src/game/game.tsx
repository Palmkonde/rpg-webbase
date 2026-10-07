'use client'

import { PlatformErrorScreen, PlatformNameContext } from './platform-error-screen.tsx'
import { locale, worldContent } from './world-content.ts'
import type { GameError } from '@codeleagues-rpg-engine/client'
import { Game as GameView } from '@codeleagues-rpg-engine/client/react'
import type { SlotComponents } from '@codeleagues-rpg-engine/client/react'
import type { WorldConfig } from '@codeleagues-rpg-engine/engine-core'
import { useMemo } from 'react'

const GAME_STYLE = { width: '100vw', height: '100vh' }

const PLATFORM_NAME = 'The Reference Platform'

// One override, so this Platform shows slot overrides working.
const COMPONENTS: SlotComponents = { ErrorScreen: PlatformErrorScreen }

// A placeholder until this Platform signs Student tokens; nothing checks it before the Game Service does.
async function getToken(): Promise<string> {
  return 'dev-token'
}

// Where a real Platform would log or react to each kind; the ErrorScreen override already shows the Student a message.
function onError(error: GameError): void {
  console.error(`[game] ${error.kind}:`, error)
}

// A client component: a Server Component can't hand `getToken`, `onError` or the overrides down as props.
export function Game({ serviceUrl, worldId, worldConfig }: { serviceUrl: string; worldId: string; worldConfig: WorldConfig }): React.ReactElement {
  const world = useMemo(() => ({ ...worldContent, worldConfig }), [worldConfig])

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
