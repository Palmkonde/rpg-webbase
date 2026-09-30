import type { Choice, DialogueLine } from '../scripts/script.ts'
import type { ChoiceStep, CutsceneRegistry, CutsceneStep, FollowStep, MovementStep } from '../state/cutscene.ts'
import type { CutsceneEvent, CutsceneRunnerState } from '../state/cutscene-runner.ts'
import { currentStudentId, flagStore, runOnce } from '../state/flags.ts'
import type { TileCoord } from '@game-engine/engine-core'
import { resolveCutscene } from '../state/cutscene.ts'
import { stepCutscene } from '../state/cutscene-runner.ts'

export interface CutsceneHandle {
  done: Promise<void>
  advance: () => void
  pickChoice: (choice: Choice) => void
}

export interface CutsceneCallbacks {
  setPaused: (paused: boolean) => void
  onLine: (line: DialogueLine | undefined) => void
  onChoices: (choices: Choice[] | undefined) => void
  moveTo: (charId: string, targetPos: TileCoord) => Promise<void>
  follow: (followerId: string, leaderId: string, gap: number) => void
  stopMovement: (charId: string) => void
  // True means Choice.next (adr/0017) sent control elsewhere; this run should stop.
  onChoicePicked: (choice: Choice) => Promise<{ handedOff: boolean }>
}

interface AdvanceGate {
  wait: () => Promise<void>
  signal: () => void
}

interface ChoiceGate {
  wait: () => Promise<Choice>
  signal: (choice: Choice) => void
}

interface RunContext {
  steps: CutsceneStep[]
  callbacks: CutsceneCallbacks
  advanceGate: AdvanceGate
  choiceGate: ChoiceGate
  followerIds: Set<string>
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

function createChoiceGate(): ChoiceGate {
  let resolveWait: ((choice: Choice) => void) | undefined

  return {
    wait() {
      // oxlint-disable-next-line promise/avoid-new
      return new Promise((resolve) => {
        resolveWait = resolve
      })
    },
    signal(choice) {
      resolveWait?.(choice)
      resolveWait = undefined
    },
  }
}

async function runDialogueStep(line: DialogueLine, ctx: RunContext): Promise<void> {
  ctx.callbacks.onLine(line)
  await ctx.advanceGate.wait()
}

async function runMovementStep(step: MovementStep, ctx: RunContext): Promise<void> {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- onLine's param is required; this is the "no line" case, not an omission.
  ctx.callbacks.onLine(undefined)
  await ctx.callbacks.moveTo(step.charId, step.targetPos)
}

// Doesn't wait: grid-engine's follow never completes, so the follower is stopped when the Cutscene ends (adr/0025).
function runFollowStep(step: FollowStep, ctx: RunContext): void {
  ctx.callbacks.follow(step.followerId, step.leaderId, step.gap)
  ctx.followerIds.add(step.followerId)
}

async function runChoiceStep(choices: Choice[], ctx: RunContext): Promise<{ handedOff: boolean }> {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- onLine's param is required; this is the "no line" case, not an omission.
  ctx.callbacks.onLine(undefined)
  ctx.callbacks.onChoices(choices)
  const picked = await ctx.choiceGate.wait()

  // oxlint-disable-next-line unicorn/no-useless-undefined -- onChoices' param is required; this is the "no choices" case, not an omission.
  ctx.callbacks.onChoices(undefined)
  return ctx.callbacks.onChoicePicked(picked)
}

// Every step but a Choice, which alone can hand off; resolves to the completion event the step finished with.
async function runStep(step: Exclude<CutsceneStep, ChoiceStep>, ctx: RunContext): Promise<CutsceneEvent> {
  if (step.type === 'dialogue') {
    await runDialogueStep(step.line, ctx)
    return { type: 'advance-click' }
  }
  if (step.type === 'follow') {
    runFollowStep(step, ctx)
    return { type: 'follow-started' }
  }
  await runMovementStep(step, ctx)
  return { type: 'move-finished' }
}

// Undefined means a Choice handed off elsewhere; runSteps should stop.
async function advanceStep(step: CutsceneStep, state: CutsceneRunnerState, ctx: RunContext): Promise<CutsceneRunnerState | undefined> {
  if (step.type === 'choice') {
    const { handedOff } = await runChoiceStep(step.choices, ctx)
    return handedOff ? undefined : stepCutscene(state, { type: 'choice-picked' }, ctx.steps)
  }
  return stepCutscene(state, await runStep(step, ctx), ctx.steps)
}

async function runSteps(ctx: RunContext): Promise<void> {
  let state: CutsceneRunnerState = { stepIndex: 0 }

  while (state.stepIndex < ctx.steps.length) {

    // oxlint-disable-next-line no-await-in-loop -- steps are a strict sequence, each waiting on the previous one's own completion signal.
    const next = await advanceStep(ctx.steps[state.stepIndex], state, ctx)
    if (!next) {return}
    state = next
  }
}

export function playCutscene(id: string, callbacks: CutsceneCallbacks, registry?: CutsceneRegistry): CutsceneHandle {
  const steps = resolveCutscene(id, registry)

  if (!steps || steps.length === 0) {
    return { done: Promise.resolve(), advance: noop, pickChoice: noop }
  }

  const advanceGate = createAdvanceGate()
  const choiceGate = createChoiceGate()
  const followerIds = new Set<string>()
  const done = runOnce({ store: flagStore, studentId: currentStudentId }, id, async () => {
    callbacks.setPaused(true)
    try {
      await runSteps({ steps, callbacks, advanceGate, choiceGate, followerIds })
    } finally {
      // Before unpausing, so control never returns to a Player still trailing someone.
      for (const followerId of followerIds) {
        callbacks.stopMovement(followerId)
      }
      callbacks.setPaused(false)
    }
  })

  return { done, advance: advanceGate.signal, pickChoice: choiceGate.signal }
}
