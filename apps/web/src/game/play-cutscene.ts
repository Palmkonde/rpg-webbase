import type { CutsceneRunnerState, CutsceneStepResult } from '../state/cutscene-runner.ts'
import { currentStudentId, flagStore, runOnce } from '../state/flags.ts'
import type { CutsceneStep } from '../state/cutscene.ts'
import type { DialogueLine } from '../scripts/script.ts'
import { resolveCutscene } from '../state/cutscene.ts'
import { stepCutscene } from '../state/cutscene-runner.ts'

export interface CutsceneHandle {
  done: Promise<void>
  advance: () => void
}

interface CutsceneLoop {
  stepIndex: number
  steps: CutsceneStep[]
  finished: boolean
  onLine: (line: DialogueLine) => void
  resolve: () => void
}

function noop(): void {
  return undefined
}

// Bridges the loop's completion to a Promise.
function createCutsceneDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolveDeferred!: () => void

  // oxlint-disable-next-line promise/avoid-new
  const promise = new Promise<void>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

function emitLine(loop: CutsceneLoop): void {
  loop.onLine(loop.steps[loop.stepIndex].line)
}

function applyCutsceneStep(loop: CutsceneLoop, result: CutsceneStepResult): void {
  if (loop.finished) {return}

  loop.stepIndex = result.stepIndex
  if (!result.done) {
    emitLine(loop)
    return
  }
  loop.finished = true
  loop.resolve()
}

export function playCutscene(
  id: string,
  setPaused: (paused: boolean) => void,
  onLine: (line: DialogueLine) => void,
): CutsceneHandle {
  const steps = resolveCutscene(id)

  if (!steps || steps.length === 0) {
    return { done: Promise.resolve(), advance: noop }
  }

  const { promise, resolve } = createCutsceneDeferred()
  const loop: CutsceneLoop = { stepIndex: 0, steps, finished: false, onLine, resolve }

  // Guards advance against a phantom mount (React Strict Mode) whose runOnce check is still pending.
  let started = false
  const done = runOnce({ store: flagStore, studentId: currentStudentId }, id, async () => {
    started = true
    setPaused(true)
    emitLine(loop)
    try {
      await promise
    } finally {
      setPaused(false)
    }
  })

  return {
    done,
    advance: () => {
      if (started) {
        const state: CutsceneRunnerState = { stepIndex: loop.stepIndex }
        applyCutsceneStep(loop, stepCutscene(state, { type: 'advance-click' }, loop.steps))
      }
    },
  }
}
