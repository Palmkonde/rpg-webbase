'use client'

import { activeCompanionIds, companionFlag, syncCompanions } from '../state/companions.ts'
import { currentStudentId, flagStore } from '../state/flags.ts'
import { useCallback, useState } from 'react'
import type { EngineHandle } from '@game-engine/engine-core'
import type { RefObject } from 'react'

export interface Companions {
  companionIds: string[]
  syncCompanions: () => Promise<void>
  dismissCompanion: (entityId: string) => Promise<void>
}

// Both callbacks are stable, which game-canvas's effect deps and ScriptPlayer's useMemo rely on.
export function useCompanions(engineRef: RefObject<EngineHandle | undefined>): Companions {
  const [companionIds, setCompanionIds] = useState<string[]>([])

  const sync = useCallback(async (): Promise<void> => {
    const flags = await flagStore.getFlags(currentStudentId)
    // Read after the await: the Engine may have been torn down meanwhile.
    const engine = engineRef.current
    if (!engine) {return}
    syncCompanions(flags, engine)
    setCompanionIds(activeCompanionIds(flags))
  }, [engineRef])

  const dismissCompanion = useCallback(async (entityId: string): Promise<void> => {
    try {
      await flagStore.setFlags(currentStudentId, { [companionFlag(entityId)]: false })
      await sync()
    } catch (error: unknown) {
      console.error('Failed to dismiss Companion:', error)
    }
  }, [sync])

  return { companionIds, syncCompanions: sync, dismissCompanion }
}
