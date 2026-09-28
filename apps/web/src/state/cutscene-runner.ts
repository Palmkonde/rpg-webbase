import type { CutsceneStep } from './cutscene.ts'

export interface CutsceneRunnerState {
  stepIndex: number
}

// Choice-picked joins this as a union once issue #27 needs it (see adr/0017).
export type CutsceneEvent = { type: 'advance-click' } | { type: 'move-finished' }

export interface CutsceneStepResult {
  stepIndex: number
  done: boolean
}

function expectedEvent(step: CutsceneStep): CutsceneEvent['type'] {
  return step.type === 'movement' ? 'move-finished' : 'advance-click'
}

export function stepCutscene(state: CutsceneRunnerState, event: CutsceneEvent, steps: CutsceneStep[]): CutsceneStepResult {
  const currentStep = steps[state.stepIndex]

  // A mismatched event (or none current, already done) is ignored rather than advanced.
  if (!currentStep || event.type !== expectedEvent(currentStep)) {
    return { stepIndex: state.stepIndex, done: state.stepIndex >= steps.length }
  }

  const stepIndex = Math.min(state.stepIndex + 1, steps.length)
  return { stepIndex, done: stepIndex >= steps.length }
}
