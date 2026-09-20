import assert from 'node:assert/strict'
import { createScript } from '../src/scripts/script.ts'
import { runEntityScript } from '../src/scripts/run-entity-script.ts'
import { test } from 'node:test'

test('createScript builds Dialogue from chained say() calls, in order', () => {
  const dialogue = createScript().say('Hello.').say('Nice day, isn\'t it?').build()
  assert.deepEqual(dialogue, { lines: ['Hello.', 'Nice day, isn\'t it?'] })
})

test('createScript with no say() calls builds an empty line list', () => {
  const dialogue = createScript().build()
  assert.deepEqual(dialogue, { lines: [] })
})

test('runEntityScript finds and runs a Script by entityId naming convention', async () => {
  // Asserts shape, not exact copy — the demo Script's flavor text is content, free to change.
  const dialogue = await runEntityScript('CampFire', { flags: {} })
  assert.ok(dialogue)
  assert.ok(dialogue.lines.length > 0)
  assert.ok(dialogue.lines.every((line) => typeof line === 'string'))
})

test('runEntityScript returns undefined when no Script is authored for the entityId', async () => {
  const dialogue = await runEntityScript('no-such-entity', { flags: {} })
  assert.equal(dialogue, undefined)
})
