import type { AnimationFrame } from './tiled-assets.ts'

export interface AnimationStep {
  frameIndex: number
  elapsedMs: number
  changed: boolean
}

// Advances a Tiled per-tile animation by deltaMs, looping through frames per their configured durations.
// Frames must be non-empty — callers only track tiles that have animation data.
export function stepAnimation(
  frames: AnimationFrame[],
  frameIndex: number,
  elapsedMs: number,
  deltaMs: number,
): AnimationStep {
  let index = frameIndex
  let elapsed = elapsedMs + deltaMs

  while (elapsed >= frames[index].duration && frames[index].duration > 0) {
    elapsed -= frames[index].duration
    index = (index + 1) % frames.length
  }

  return { frameIndex: index, elapsedMs: elapsed, changed: index !== frameIndex }
}
