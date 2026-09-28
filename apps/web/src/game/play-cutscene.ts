import { currentStudentId, flagStore, runOnce } from '../state/flags.ts'
import type { CutsceneRunnerState } from '../state/cutscene-runner.ts'
import type { CutsceneStep } from '../state/cutscene.ts'
import type { DialogueLine } from '../scripts/script.ts'
import type { TileCoord } from '@game-engine/engine-core'
import { resolveCutscene } from '../state/cutscene.ts'
import { stepCutscene } from '../state/cutscene-runner.ts'

export interface CutsceneHandle {
  done: Promise<void>
  advance: () => void
}

export interface CutsceneCallbacks {
  setPaused: (paused: boolean) => void
  onLine: (line: DialogueLine | undefined) => void
  moveTo: (charId: string, targetPos: TileCoord) => Promise<void>
}

interface AdvanceGate {
  wait: () => Promise<void>
  signal: () => void
}

function noop(): void {
  return undefined
}

// A signal() with nothing waiting (e.g. a stray click during a Movement step) is safely ignored.
function createAdvanceGate(): AdvanceGate {
  let resolveWait: (() => void) | undefined

  return {
    wait() {
      // oxlint-disable-next-line promise/avoid-new
      return new Promise((resolve) => {
        resolveWait = resolve
      })
    },
    signal() {
      resolveWait?.()
      resolveWait = undefined
    },
  }
}

// Drives the pure stepCutscene reducer to completion.
async function runSteps(steps: CutsceneStep[], callbacks: CutsceneCallbacks, gate: AdvanceGate): Promise<void> {
  let state: CutsceneRunnerState = { stepIndex: 0 }

  while (state.stepIndex < steps.length) {
    const step = steps[state.stepIndex]

    if (step.type === 'dialogue') {
      callbacks.onLine(step.line)
      
      // oxlint-disable-next-line no-await-in-loop -- steps are a strict sequence, each waiting on the previous one's own completion signal.
      await gate.wait()
      state = stepCutscene(state, { type: 'advance-click' }, steps)
    } else {

      // oxlint-disable-next-line unicorn/no-useless-undefined -- onLine's param is required; this is the "no line" case, not an omission.
      callbacks.onLine(undefined)

      // oxlint-disable-next-line no-await-in-loop -- see above.
      await callbacks.moveTo(step.charId, step.targetPos)
      state = stepCutscene(state, { type: 'move-finished' }, steps)
    }
  }
}

export function playCutscene(id: string, callbacks: CutsceneCallbacks): CutsceneHandle {
  const steps = resolveCutscene(id)

  if (!steps || steps.length === 0) {
    return { done: Promise.resolve(), advance: noop }
  }

  const gate = createAdvanceGate()
  const done = runOnce({ store: flagStore, studentId: currentStudentId }, id, async () => {
    callbacks.setPaused(true)
    try {
      await runSteps(steps, callbacks, gate)
    } finally {
      callbacks.setPaused(false)
    }
  })

  return { done, advance: gate.signal }
}
