'use client'

import { currentStudentId, flagStore, runOnce } from '../state/flags.ts'
import { useCallback, useRef, useState } from 'react'
import type { CgFrame } from '../state/cg.ts'
import type { CgStep } from './play-cg.ts'
import { playCG } from './play-cg.ts'
import { resolveCg } from '../state/cg.ts'

export interface CgPlayback {
  cgFrames: CgFrame[] | undefined
  cgStep: CgStep | undefined
  advanceCg: () => void
  skipCg: () => void
  playCgById: (id: string, isStale: () => boolean) => Promise<void>

  // The boot CG's gate; a Script's CG is gated by its own once-only marker instead (adr/0030).
  playCgOnce: (id: string, isStale: () => boolean) => Promise<void>
}

export function useCgPlayback(): CgPlayback {
  const [cgFrames, setCgFrames] = useState<CgFrame[] | undefined>()
  const [cgStep, setCgStep] = useState<CgStep | undefined>()
  const cgHandleRef = useRef<ReturnType<typeof playCG> | null>(null)

  const advanceCg = useCallback((): void => {
    cgHandleRef.current?.advance()
  }, [])

  const skipCg = useCallback((): void => {
    cgHandleRef.current?.skip()
  }, [])

  const playCgById = useCallback(async (id: string, isStale: () => boolean): Promise<void> => {
    const frames = resolveCg(id)
    if (!frames) {return}
    setCgFrames(frames)
    const handle = playCG(id, (step) => {
      if (!isStale()) {setCgStep(step)}
    })
    cgHandleRef.current = handle
    await handle.done
    if (!isStale()) {
      setCgStep(undefined)
      setCgFrames(undefined)
    }
  }, [])

  const playCgOnce = useCallback(
    (id: string, isStale: () => boolean): Promise<void> => runOnce({ store: flagStore, studentId: currentStudentId }, id, () => playCgById(id, isStale)),
    [playCgById],
  )

  return { cgFrames, cgStep, advanceCg, skipCg, playCgById, playCgOnce }
}
