import { resolveCg } from '../state/cg.ts'
import { stepCgSlideshow } from '../state/cg-slideshow.ts'

export interface CgHandle {
  done: Promise<void>
  advance: () => void
  skip: () => void
}

interface CgLoop {
  frameIndex: number
  frameCount: number
  finished: boolean
  onFrame: (frameIndex: number) => void
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

function applyCgStep(loop: CgLoop, step: ReturnType<typeof stepCgSlideshow>): void {
  if (loop.finished) {return}
  loop.frameIndex = step.frameIndex
  loop.onFrame(step.frameIndex)
  if (step.done) {
    loop.finished = true
    loop.resolve()
  }
}

// Self-contained so a future call site needs no extra wiring (spec's "CG trigger").
export function playCG(id: string, onFrame: (frameIndex: number) => void): CgHandle {
  const frames = resolveCg(id)
  if (!frames || frames.length === 0) {
    return { done: Promise.resolve(), advance: noop, skip: noop }
  }

  const { promise, resolve } = createCgDeferred()
  const loop: CgLoop = { frameIndex: 0, frameCount: frames.length, finished: false, onFrame, resolve }

  return {
    done: promise,
    advance: () => {applyCgStep(loop, stepCgSlideshow({ frameIndex: loop.frameIndex }, { type: 'advance' }, loop.frameCount))},
    skip: () => {applyCgStep(loop, stepCgSlideshow({ frameIndex: loop.frameIndex }, { type: 'skip' }, loop.frameCount))},
  }
}
