import type { CgArtRegistry } from '../src/cg.ts'
import assert from 'node:assert/strict'
import { resolveCgArt } from '../src/cg.ts'
import { test } from 'node:test'

const registry: CgArtRegistry = { 'intro-1': '/assets/cg/intro/1.png' }

test('resolveCgArt returns the asset path for a registered frame id', () => {
  const result = resolveCgArt('intro-1', registry)
  assert.equal(result, '/assets/cg/intro/1.png')
})

test('resolveCgArt returns undefined for an unregistered frame id', () => {
  const result = resolveCgArt('intro-2', registry)
  assert.equal(result, undefined)
})
