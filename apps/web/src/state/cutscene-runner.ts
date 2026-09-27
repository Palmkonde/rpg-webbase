import type { CutsceneStep } from './cutscene.ts'

export interface CutsceneRunnerState {
  stepIndex: number
}

// Choice-picked/move-finished join this as a union once issues #26/#27 need it (see adr/0017).
export interface CutsceneEvent {
  type: 'advance-click'
}

export interface CutsceneStepResult {
  stepIndex: number
  done: boolean
}

export function stepCutscene(state: CutsceneRunnerState, event: CutsceneEvent, steps: CutsceneStep[]): CutsceneStepResult {
  if (event.type !== 'advance-click') {
    return { stepIndex: state.stepIndex, done: state.stepIndex >= steps.length }
  }

  const stepIndex = Math.min(state.stepIndex + 1, steps.length)
  return { stepIndex, done: stepIndex >= steps.length }
}
