export interface CgSlideshowState {
  frameIndex: number
}

export type CgSlideshowEvent = { type: 'advance' } | { type: 'skip' }

export interface CgSlideshowStep {
  frameIndex: number
  done: boolean
}

export function stepCgSlideshow(state: CgSlideshowState, event: CgSlideshowEvent, frameCount: number): CgSlideshowStep {
  if (event.type === 'skip') {
    return { frameIndex: frameCount, done: true }
  }

  const frameIndex = Math.min(state.frameIndex + 1, frameCount)
  return { frameIndex, done: frameIndex >= frameCount }
}
