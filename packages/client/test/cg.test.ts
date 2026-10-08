import type { CgRegistry } from '../src/cg.ts'
import assert from 'node:assert/strict'
import { resolveCg } from '../src/cg.ts'
import { test } from 'node:test'

const registry: CgRegistry = { intro: [{ art: '/cg/intro/1.png', captionKey: 'cg.intro.1' }] }

test('resolveCg returns the frames of a registered CG', () => {
  assert.deepEqual(resolveCg('intro', registry), [{ art: '/cg/intro/1.png', captionKey: 'cg.intro.1' }])
})

test('resolveCg returns undefined for an unregistered CG', () => {
  assert.equal(resolveCg('outro', registry), undefined)
})
