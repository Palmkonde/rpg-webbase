'use client'

import { createFlagStore, createHostSession } from '@codeleagues-rpg-engine/client'
import { locale, worldContent } from './world-content.ts'
import { useEffect, useRef, useState } from 'react'
import type { HostSession } from '@codeleagues-rpg-engine/client'
import { Overlays } from './overlays.tsx'
import type { WorldConfig } from '@codeleagues-rpg-engine/engine-core'
import { createEngine } from '@codeleagues-rpg-engine/engine-core'
import studentState from '../fixtures/student-state.json' with { type: 'json' }

const CANVAS_STYLE = { width: '100vw', height: '100vh' }

export function GameCanvas({ worldConfig }: { worldConfig: WorldConfig }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [session, setSession] = useState<HostSession>()

  useEffect(() => {
    const container = containerRef.current
    if (!container) {return}

    const created = createHostSession({
      createEngine: (options) => createEngine(container, options),
      flags: createFlagStore(studentState.flags),
      world: { ...worldContent, worldConfig },
      locale,
    })
    setSession(created)
    created.start()

    return (): void => {
      created.destroy()
    }
  }, [worldConfig])

  return (
    <>
      <div ref={containerRef} style={CANVAS_STYLE} />
      {session && <Overlays session={session} />}
    </>
  )
}
