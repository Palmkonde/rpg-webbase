import type { CgSlideshowStep } from '../src/cg-slideshow.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toCgStep } from '../src/play-cg.ts'

const FRAME_COUNT = 3

test('toCgStep reports the frame and hasMore: true when a frame remains after it', () => {
  const step: CgSlideshowStep = { frameIndex: 0, done: false }
  assert.deepEqual(toCgStep(step, FRAME_COUNT), { frameIndex: 0, hasMore: true })
})

test('toCgStep reports hasMore: false on the last frame', () => {
  const step: CgSlideshowStep = { frameIndex: 2, done: false }
  assert.deepEqual(toCgStep(step, FRAME_COUNT), { frameIndex: 2, hasMore: false })
})

test('toCgStep returns undefined for the done sentinel, so the Host never sees the one-past-the-end index', () => {
  const step: CgSlideshowStep = { frameIndex: 3, done: true }
  assert.equal(toCgStep(step, FRAME_COUNT), undefined)
})
