'use client'

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

  return { cgFrames, cgStep, advanceCg, skipCg, playCgById }
}
