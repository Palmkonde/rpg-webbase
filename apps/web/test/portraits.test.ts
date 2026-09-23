import type { PortraitRegistry } from '../src/state/portraits.ts'
import assert from 'node:assert/strict'
import { resolvePortrait } from '../src/state/portraits.ts'
import { test } from 'node:test'

const registry: PortraitRegistry = {
  Campfire: { Neutral: '/assets/portraits/campfire/neutral.png', Happy: '/assets/portraits/campfire/happy.png' },
}

test('resolvePortrait returns the asset path for a registered Speaker/Expression pair', () => {
  const result = resolvePortrait('Campfire', 'Happy', registry)
  assert.equal(result, '/assets/portraits/campfire/happy.png')
})

test('resolvePortrait returns undefined for an Expression with no art registered for that Speaker', () => {
  const result = resolvePortrait('Campfire', 'Angry', registry)
  assert.equal(result, undefined)
})

test('resolvePortrait returns undefined for a Speaker with no registry entry at all', () => {
  const result = resolvePortrait('Narrator', 'Neutral', registry)
  assert.equal(result, undefined)
})

test('resolvePortrait returns undefined when the line has no Speaker', () => {
  const result = resolvePortrait(undefined, 'Neutral', registry)
  assert.equal(result, undefined)
})

test('resolvePortrait returns undefined when the line has no Expression', () => {
  const result = resolvePortrait('Campfire', undefined, registry)
  assert.equal(result, undefined)
})

test('resolvePortrait defaults to the app registry: Campfire has Neutral art', () => {
  const result = resolvePortrait('Campfire', 'Neutral')
  assert.equal(result, '/assets/portraits/campfire/neutral.png')
})
