import { currentStudentId, flagStore, runOnce } from '../state/flags.ts'
import type { CgSlideshowStep } from '../state/cg-slideshow.ts'
import { resolveCg } from '../state/cg.ts'
import { stepCgSlideshow } from '../state/cg-slideshow.ts'

export interface CgStep {
  frameIndex: number
  hasMore: boolean
}

export interface CgHandle {
  done: Promise<void>
  advance: () => void
  skip: () => void
}

interface CgLoop {
  frameIndex: number
  frameCount: number
  finished: boolean
  onStep: (step: CgStep) => void
  resolve: () => void
}

function noop(): void {
  return undefined
}

// Bridges the loop's completion to a Promise.
function createCgDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolveDeferred!: () => void

  // oxlint-disable-next-line promise/avoid-new
  const promise = new Promise<void>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

// `done` collapses to no reportable step — the Host never sees stepCgSlideshow's one-past-the-end sentinel.
export function toCgStep(step: CgSlideshowStep, frameCount: number): CgStep | undefined {
  if (step.done) {return undefined}
  return { frameIndex: step.frameIndex, hasMore: step.frameIndex < frameCount - 1 }
}

function emitStep(loop: CgLoop, step: CgSlideshowStep): void {
  const cgStep = toCgStep(step, loop.frameCount)
  if (cgStep) {loop.onStep(cgStep)}
}

function applyCgStep(loop: CgLoop, step: CgSlideshowStep): void {
  if (loop.finished) {return}
  loop.frameIndex = step.frameIndex
  emitStep(loop, step)
  if (step.done) {
    loop.finished = true
    loop.resolve()
  }
}

// Self-contained so a future call site needs no extra wiring (spec's "CG trigger").
export function playCG(id: string, onStep: (step: CgStep) => void): CgHandle {
  const frames = resolveCg(id)
  if (!frames || frames.length === 0) {
    return { done: Promise.resolve(), advance: noop, skip: noop }
  }

  const { promise, resolve } = createCgDeferred()
  const loop: CgLoop = { frameIndex: 0, frameCount: frames.length, finished: false, onStep, resolve }
  // Guards advance/skip against a phantom mount (React Strict Mode) whose runOnce check is still pending.
  let started = false

  const done = runOnce({ store: flagStore, studentId: currentStudentId }, id, () => {
    started = true
    emitStep(loop, { frameIndex: 0, done: false })
    return promise
  })

  return {
    done,
    advance: () => {if (started) {applyCgStep(loop, stepCgSlideshow({ frameIndex: loop.frameIndex }, { type: 'advance' }, loop.frameCount))}},
    skip: () => {if (started) {applyCgStep(loop, stepCgSlideshow({ frameIndex: loop.frameIndex }, { type: 'skip' }, loop.frameCount))}},
  }
}
