import type { CgArtRegistry } from '../src/state/cg-art.ts'
import assert from 'node:assert/strict'
import { resolveCgArt } from '../src/state/cg-art.ts'
import { test } from 'node:test'

// WARN: test need to change when we landed this code to other computer.
const registry: CgArtRegistry = { 'intro-1': '/assets/cg/intro/1.png' }

test('resolveCgArt returns the asset path for a registered frame id', () => {
  const result = resolveCgArt('intro-1', registry)
  assert.equal(result, '/assets/cg/intro/1.png')
})

test('resolveCgArt returns undefined for an unregistered frame id', () => {
  const result = resolveCgArt('intro-2', registry)
  assert.equal(result, undefined)
})

test('resolveCgArt defaults to the app registry: intro-1 has art', () => {
  const result = resolveCgArt('intro-1')
  assert.equal(result, '/assets/cg/intro/1.jpg')
})
