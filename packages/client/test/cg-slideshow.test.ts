import type { CgSlideshowState } from '../src/cg-slideshow.ts'
import assert from 'node:assert/strict'
import { stepCgSlideshow } from '../src/cg-slideshow.ts'
import { test } from 'node:test'

const FRAME_COUNT = 3

test('stepCgSlideshow advance moves to the next frame', () => {
  const state: CgSlideshowState = { frameIndex: 0 }
  const result = stepCgSlideshow(state, { type: 'advance' }, FRAME_COUNT)
  assert.deepEqual(result, { frameIndex: 1, done: false })
})

test('stepCgSlideshow advance past the last frame reports done', () => {
  const state: CgSlideshowState = { frameIndex: 2 }
  const result = stepCgSlideshow(state, { type: 'advance' }, FRAME_COUNT)
  assert.deepEqual(result, { frameIndex: 3, done: true })
})

test('stepCgSlideshow advance once already done stays at frameCount instead of overshooting', () => {
  const state: CgSlideshowState = { frameIndex: 3 }
  const result = stepCgSlideshow(state, { type: 'advance' }, FRAME_COUNT)
  assert.deepEqual(result, { frameIndex: 3, done: true })
})

test('stepCgSlideshow skip jumps straight to done regardless of current progress', () => {
  const state: CgSlideshowState = { frameIndex: 1 }
  const result = stepCgSlideshow(state, { type: 'skip' }, FRAME_COUNT)
  assert.deepEqual(result, { frameIndex: 3, done: true })
})
