import { computeCameraBounds, findDuplicates } from '../src/util.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('computeCameraBounds returns the map pixel rect starting at the origin', () => {
  const result = computeCameraBounds(480, 480)
  assert.deepEqual(result, { x: 0, y: 0, width: 480, height: 480 })
})

test('computeCameraBounds handles a single-tile map', () => {
  const result = computeCameraBounds(32, 32)
  assert.deepEqual(result, { x: 0, y: 0, width: 32, height: 32 })
})

test('computeCameraBounds handles a very large map', () => {
  const result = computeCameraBounds(102_400, 81_920)
  assert.deepEqual(result, { x: 0, y: 0, width: 102_400, height: 81_920 })
})

test('findDuplicates returns an empty array for empty input', () => {
  assert.deepEqual(findDuplicates([]), [])
})

test('findDuplicates returns an empty array when nothing repeats', () => {
  assert.deepEqual(findDuplicates(['a', 'b', 'c']), [])
})

test('findDuplicates returns each value that appears more than once, once each', () => {
  assert.deepEqual(findDuplicates(['a', 'b', 'a', 'c', 'b', 'a']), ['a', 'b'])
})
