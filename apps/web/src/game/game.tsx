'use client'

import { locale, worldContent } from './world-content.ts'
import { useEffect, useRef } from 'react'
import type { GameError } from '@codeleagues-rpg-engine/client'
import type { WorldConfig } from '@codeleagues-rpg-engine/engine-core'
import { mount } from '@codeleagues-rpg-engine/client'
import studentState from '../fixtures/student-state.json' with { type: 'json' }

const GAME_STYLE = { width: '100vw', height: '100vh' }

// A placeholder until this Platform signs Student tokens; nothing checks it before the Game Service does.
async function getToken(): Promise<string> {
  return 'dev-token'
}

// Where a real Platform would log or react to each kind; the built-in ErrorScreen already shows the Student a message.
function onError(error: GameError): void {
  console.error(`[game] ${error.kind}:`, error)
}

export function Game({ serviceUrl, worldId, worldConfig }: { serviceUrl: string; worldId: string; worldConfig: WorldConfig }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {return}

    const game = mount(container, {
      serviceUrl,
      worldId,
      getToken,
      onError,
      locale,
      world: { ...worldContent, worldConfig },
      flags: studentState.flags,
    })
    return game.unmount
  }, [serviceUrl, worldId, worldConfig])

  return <div ref={containerRef} style={GAME_STYLE} />
}
