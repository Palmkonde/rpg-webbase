import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepAnimation } from '../src/tile-animation.ts'
import type { AnimationFrame } from '../src/tiled-assets.ts'

const frames: AnimationFrame[] = [
  { gid: 1, duration: 100 },
  { gid: 2, duration: 100 },
  { gid: 3, duration: 100 },
]

test('stepAnimation accumulates elapsed time under the current frame duration without advancing', () => {
  const result = stepAnimation(frames, 0, 0, 50)
  assert.deepEqual(result, { frameIndex: 0, elapsedMs: 50, changed: false })
})

test('stepAnimation advances to the next frame once its duration is crossed, carrying the remainder', () => {
  const result = stepAnimation(frames, 0, 50, 70)
  assert.deepEqual(result, { frameIndex: 1, elapsedMs: 20, changed: true })
})

test('stepAnimation wraps from the last frame back to the first', () => {
  const result = stepAnimation(frames, 2, 0, 100)
  assert.deepEqual(result, { frameIndex: 0, elapsedMs: 0, changed: true })
})

test('stepAnimation advances through multiple frames within a single large delta', () => {
  const result = stepAnimation(frames, 0, 0, 250)
  assert.deepEqual(result, { frameIndex: 2, elapsedMs: 50, changed: true })
})

test('stepAnimation reports unchanged when a large delta loops all the way back to the same frame', () => {
  const result = stepAnimation(frames, 2, 90, 250)
  assert.deepEqual(result, { frameIndex: 2, elapsedMs: 40, changed: false })
})

test('stepAnimation does not infinite-loop on a single-frame animation', () => {
  const single: AnimationFrame[] = [{ gid: 1, duration: 100 }]
  const result = stepAnimation(single, 0, 0, 350)
  assert.deepEqual(result, { frameIndex: 0, elapsedMs: 50, changed: false })
})
